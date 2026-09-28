export async function setup() {
  process.env.APP_PROFILE = 'test';
  const { migrate } = await import('../src/db/migrate');
  const { pool } = await import('../src/db/pool');
  await migrate(false);
  await pool.end();
}
