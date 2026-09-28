import { Db } from '../db/pool';

export interface GrupoRow {
  id: number;
  titulo: string;
  objetivo: string;
  prazo_final: Date;
  limite_membros: number;
  representante_id: number;
  status: 'ATIVO' | 'FINALIZADO';
  criado_em: Date;
  finalizado_em: Date | null;
}

export interface MembroRow {
  id: number;
  nome: string;
  email: string;
  entrou_em: Date;
}

export interface GrupoResumoRow extends GrupoRow {
  representante_nome: string;
  total_membros: number;
  total_tarefas: number;
  tarefas_concluidas: number;
}

export async function inserir(
  db: Db,
  dados: { titulo: string; objetivo: string; prazoFinal: Date; limiteMembros: number; representanteId: number },
): Promise<GrupoRow> {
  const { rows } = await db.query<GrupoRow>(
    `INSERT INTO grupo (titulo, objetivo, prazo_final, limite_membros, representante_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [dados.titulo, dados.objetivo, dados.prazoFinal, dados.limiteMembros, dados.representanteId],
  );
  return rows[0];
}

export async function buscarPorId(db: Db, id: number, paraAtualizar = false): Promise<GrupoRow | null> {
  const { rows } = await db.query<GrupoRow>(
    `SELECT * FROM grupo WHERE id = $1${paraAtualizar ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function atualizar(
  db: Db,
  id: number,
  dados: { titulo: string; objetivo: string; prazoFinal: Date; limiteMembros: number },
): Promise<GrupoRow> {
  const { rows } = await db.query<GrupoRow>(
    `UPDATE grupo SET titulo = $2, objetivo = $3, prazo_final = $4, limite_membros = $5
     WHERE id = $1 RETURNING *`,
    [id, dados.titulo, dados.objetivo, dados.prazoFinal, dados.limiteMembros],
  );
  return rows[0];
}

export async function definirRepresentante(db: Db, id: number, usuarioId: number): Promise<void> {
  await db.query('UPDATE grupo SET representante_id = $2 WHERE id = $1', [id, usuarioId]);
}

export async function finalizar(db: Db, id: number): Promise<void> {
  await db.query(`UPDATE grupo SET status = 'FINALIZADO', finalizado_em = now() WHERE id = $1`, [id]);
}

export async function listarDoUsuario(db: Db, usuarioId: number): Promise<GrupoResumoRow[]> {
  const { rows } = await db.query<GrupoResumoRow>(
    `SELECT g.*, u.nome AS representante_nome,
            (SELECT count(*) FROM membro_grupo m2 WHERE m2.grupo_id = g.id)::int AS total_membros,
            (SELECT count(*) FROM tarefa t WHERE t.grupo_id = g.id)::int AS total_tarefas,
            (SELECT count(*) FROM tarefa t WHERE t.grupo_id = g.id AND t.status = 'CONCLUIDA')::int AS tarefas_concluidas
       FROM grupo g
       JOIN membro_grupo m ON m.grupo_id = g.id AND m.usuario_id = $1
       JOIN usuario u ON u.id = g.representante_id
      ORDER BY g.status, g.prazo_final`,
    [usuarioId],
  );
  return rows;
}

// ---------- membros ----------

export async function listarMembros(db: Db, grupoId: number): Promise<MembroRow[]> {
  const { rows } = await db.query<MembroRow>(
    `SELECT u.id, u.nome, u.email, m.entrou_em
       FROM membro_grupo m JOIN usuario u ON u.id = m.usuario_id
      WHERE m.grupo_id = $1
      ORDER BY m.entrou_em, u.nome`,
    [grupoId],
  );
  return rows;
}

export async function ehMembro(db: Db, grupoId: number, usuarioId: number): Promise<boolean> {
  const { rowCount } = await db.query('SELECT 1 FROM membro_grupo WHERE grupo_id = $1 AND usuario_id = $2', [
    grupoId,
    usuarioId,
  ]);
  return (rowCount ?? 0) > 0;
}

export async function contarMembros(db: Db, grupoId: number): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM membro_grupo WHERE grupo_id = $1',
    [grupoId],
  );
  return rows[0].total;
}

export async function adicionarMembro(db: Db, grupoId: number, usuarioId: number): Promise<void> {
  await db.query('INSERT INTO membro_grupo (grupo_id, usuario_id) VALUES ($1, $2)', [grupoId, usuarioId]);
}

export async function removerMembro(db: Db, grupoId: number, usuarioId: number): Promise<void> {
  await db.query('DELETE FROM membro_grupo WHERE grupo_id = $1 AND usuario_id = $2', [grupoId, usuarioId]);
}
