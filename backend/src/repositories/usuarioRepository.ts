import { Db } from '../db/pool';

export interface UsuarioRow {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  criado_em: Date;
}

export async function inserir(db: Db, nome: string, email: string, senhaHash: string): Promise<UsuarioRow> {
  const { rows } = await db.query<UsuarioRow>(
    'INSERT INTO usuario (nome, email, senha_hash) VALUES ($1, $2, $3) RETURNING *',
    [nome, email, senhaHash],
  );
  return rows[0];
}

export async function buscarPorEmail(db: Db, email: string): Promise<UsuarioRow | null> {
  const { rows } = await db.query<UsuarioRow>('SELECT * FROM usuario WHERE lower(email) = lower($1)', [email]);
  return rows[0] ?? null;
}

export async function buscarPorId(db: Db, id: number): Promise<UsuarioRow | null> {
  const { rows } = await db.query<UsuarioRow>('SELECT * FROM usuario WHERE id = $1', [id]);
  return rows[0] ?? null;
}
