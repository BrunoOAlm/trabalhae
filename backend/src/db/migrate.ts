import fs from 'node:fs';
import path from 'node:path';
import { migracoesEmbutidas } from './migracoesEmbutidas';
import { pool } from './pool';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');
const TRAVA_MIGRACAO = 727001;

type Migracao = { nome: string; sql: string };

/**
 * Lê os .sql de backend/migrations. Onde a pasta não existe (função serverless da Vercel),
 * usa a cópia embutida no código, gerada por scripts/embutir-migracoes.mjs.
 */
export function carregarMigracoes(): Migracao[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return migracoesEmbutidas;
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((nome) => ({ nome, sql: fs.readFileSync(path.join(MIGRATIONS_DIR, nome), 'utf8') }));
}

/**
 * Aplica, em ordem, as migrações que ainda não rodaram (estilo Flyway).
 * Tudo roda numa única transação com trava de transação (pg_advisory_xact_lock): duas instâncias
 * da API não migram ao mesmo tempo, e a trava funciona também atrás de pooler em modo transação
 * (a DATABASE_URL da Neon), onde travas de sessão não são suportadas. Se algo falhar, nada fica aplicado.
 */
export async function migrate(log = true): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [TRAVA_MIGRACAO]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome VARCHAR(200) PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ nome: string }>('SELECT nome FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nome));
    const novas: string[] = [];
    for (const { nome, sql } of carregarMigracoes()) {
      if (aplicadas.has(nome)) continue;
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [nome]);
      novas.push(nome);
    }
    await client.query('COMMIT');
    if (log) novas.forEach((nome) => console.log(`Migração aplicada: ${nome}`));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log('Banco atualizado.');
      return pool.end();
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
