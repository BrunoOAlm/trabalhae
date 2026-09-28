import { Pool, PoolClient, types } from 'pg';
import { config } from '../config';

// BIGINT (ids) como number no JavaScript
types.setTypeParser(20, (v: string) => Number(v));

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.naVercel ? 3 : 10,
  // Na Vercel, conexões paradas são fechadas logo: o banco da Neon hiberna quando fica sem uso.
  idleTimeoutMillis: config.naVercel ? 10_000 : 30_000,
});

// Se uma conexão parada cair (banco hibernou ou reiniciou), só registra: não pode derrubar a API.
pool.on('error', (err) => console.error('Conexão ociosa com o banco foi encerrada:', err.message));

export type Db = Pool | PoolClient;

export async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
