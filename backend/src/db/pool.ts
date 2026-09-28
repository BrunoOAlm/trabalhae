import { Pool, PoolClient, types } from 'pg';
import { config } from '../config';

// BIGINT (ids) como number no JavaScript
types.setTypeParser(20, (v: string) => Number(v));

export const pool = new Pool({ connectionString: config.databaseUrl, max: config.naVercel ? 3 : 10 });

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
