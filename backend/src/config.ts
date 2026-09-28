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

const databaseUrl = isTest
  ? process.env.TEST_DATABASE_URL ?? 'postgres://trabalhae:trabalhae@localhost:5432/trabalhae_test'
  : process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? 'postgres://trabalhae:trabalhae@localhost:5432/trabalhae';

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
