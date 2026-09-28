import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

// Todas as datas do sistema seguem o horário de Brasília
process.env.TZ = 'America/Sao_Paulo';

/** true quando a API roda como função serverless na Vercel */
const naVercel = process.env.VERCEL === '1';
const profile = process.env.APP_PROFILE ?? (naVercel ? 'demo' : 'dev');
const isTest = profile === 'test' || process.env.VITEST === 'true';

const BANCO_LOCAL = 'postgres://trabalhae:trabalhae@localhost:5432/trabalhae';
const BANCO_LOCAL_TESTE = 'postgres://trabalhae:trabalhae@localhost:5432/trabalhae_test';

/**
 * Escolhe a URL do banco e diz de qual variável ela veio.
 * Na Vercel, se não houver DATABASE_URL nem POSTGRES_URL (ex.: a Neon foi conectada com prefixo,
 * criando STORAGE_URL), usa a primeira variável cujo valor é uma URL do PostgreSQL,
 * preferindo a conexão com pooler.
 */
export function escolherUrlDoBanco(
  env: NodeJS.ProcessEnv,
  opcoes: { naVercel: boolean; isTest: boolean },
): { url: string; origem: string } {
  if (opcoes.isTest) {
    return env.TEST_DATABASE_URL
      ? { url: env.TEST_DATABASE_URL, origem: 'TEST_DATABASE_URL' }
      : { url: BANCO_LOCAL_TESTE, origem: 'padrão local' };
  }
  for (const nome of ['DATABASE_URL', 'POSTGRES_URL']) {
    if (env[nome]) return { url: env[nome]!, origem: nome };
  }
  if (opcoes.naVercel) {
    const secundaria = (nome: string) => (/UNPOOLED|NON_POOLING|NO_SSL|PRISMA/.test(nome) ? 1 : 0);
    const candidatas = Object.keys(env)
      .filter((nome) => nome !== 'TEST_DATABASE_URL' && /^postgres(ql)?:\/\//.test(env[nome] ?? ''))
      .sort((a, b) => secundaria(a) - secundaria(b) || a.localeCompare(b));
    if (candidatas.length > 0) return { url: env[candidatas[0]]!, origem: candidatas[0] };
  }
  return { url: BANCO_LOCAL, origem: 'padrão local' };
}

const banco = escolherUrlDoBanco(process.env, { naVercel, isTest });
const databaseUrl = banco.url;

/**
 * Na Vercel, se JWT_SECRET não for definido, deriva um segredo estável da URL do banco
 * (que já é secreta). Em qualquer outro caso sem JWT_SECRET, usa o segredo de desenvolvimento.
 */
function segredoJwt(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (naVercel) return crypto.createHash('sha256').update(`trabalhae:${databaseUrl}`).digest('hex');
  return 'segredo-de-desenvolvimento';
}

const maxUploadMb = Number(process.env.MAX_UPLOAD_MB ?? (naVercel ? 4 : 10));

export const config = {
  profile: isTest ? 'test' : profile,
  isTest,
  naVercel,
  port: Number(process.env.PORT ?? 8080),
  databaseUrl,
  /** Nome da variável de onde veio a URL do banco (ou "padrão local"). Nunca expõe o valor. */
  origemDoBanco: banco.origem,
  jwtSecret: segredoJwt(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  /** "disco" (pasta UPLOAD_DIR) ou "banco" (tabela arquivo_armazenado) */
  armazenamento: (process.env.ARMAZENAMENTO ?? (naVercel ? 'banco' : 'disco')) as 'disco' | 'banco',
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? (isTest ? './uploads-test' : './uploads')),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  maxUploadMb,
  maxUploadBytes: maxUploadMb * 1024 * 1024,
  /** Cria os dados de exemplo automaticamente quando o banco está vazio (padrão na Vercel). */
  seedAutomatico: (process.env.SEED_AUTOMATICO ?? (naVercel ? 'true' : 'false')) === 'true',
};
