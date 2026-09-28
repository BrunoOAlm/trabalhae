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
 * Usa uma trava do PostgreSQL para que duas instâncias da API não migrem ao mesmo tempo.
 */
export async function migrate(log = true): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [TRAVA_MIGRACAO]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nome VARCHAR(200) PRIMARY KEY,
      aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ nome: string }>('SELECT nome FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nome));
    for (const { nome: arquivo, sql } of carregarMigracoes()) {
      if (aplicadas.has(arquivo)) continue;
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nome) VALUES ($1)', [arquivo]);
        await client.query('COMMIT');
        if (log) console.log(`Migração aplicada: ${arquivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [TRAVA_MIGRACAO]).catch(() => undefined);
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
