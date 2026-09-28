import { Db } from '../db/pool';

export interface ConviteRow {
  id: number;
  grupo_id: number;
  convidado_id: number;
  status: 'PENDENTE' | 'ACEITO' | 'RECUSADO';
  criado_em: Date;
  respondido_em: Date | null;
}

export interface ConvitePendenteDoGrupoRow extends ConviteRow {
  convidado_nome: string;
  convidado_email: string;
}

export interface ConviteDoUsuarioRow extends ConviteRow {
  grupo_titulo: string;
  grupo_objetivo: string;
  grupo_prazo_final: Date;
  representante_nome: string;
  total_membros: number;
  limite_membros: number;
}

export async function inserir(db: Db, grupoId: number, convidadoId: number): Promise<ConviteRow> {
  const { rows } = await db.query<ConviteRow>(
    'INSERT INTO convite (grupo_id, convidado_id) VALUES ($1, $2) RETURNING *',
    [grupoId, convidadoId],
  );
  return rows[0];
}

export async function buscarPorId(db: Db, id: number, paraAtualizar = false): Promise<ConviteRow | null> {
  const { rows } = await db.query<ConviteRow>(
    `SELECT * FROM convite WHERE id = $1${paraAtualizar ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function existePendente(db: Db, grupoId: number, convidadoId: number): Promise<boolean> {
  const { rowCount } = await db.query(
    `SELECT 1 FROM convite WHERE grupo_id = $1 AND convidado_id = $2 AND status = 'PENDENTE'`,
    [grupoId, convidadoId],
  );
  return (rowCount ?? 0) > 0;
}

export async function pendentesDoGrupo(db: Db, grupoId: number): Promise<ConvitePendenteDoGrupoRow[]> {
  const { rows } = await db.query<ConvitePendenteDoGrupoRow>(
    `SELECT c.*, u.nome AS convidado_nome, u.email AS convidado_email
       FROM convite c JOIN usuario u ON u.id = c.convidado_id
      WHERE c.grupo_id = $1 AND c.status = 'PENDENTE'
      ORDER BY c.criado_em`,
    [grupoId],
  );
  return rows;
}

export async function pendentesDoUsuario(db: Db, usuarioId: number): Promise<ConviteDoUsuarioRow[]> {
  const { rows } = await db.query<ConviteDoUsuarioRow>(
    `SELECT c.*, g.titulo AS grupo_titulo, g.objetivo AS grupo_objetivo, g.prazo_final AS grupo_prazo_final,
            g.limite_membros, u.nome AS representante_nome,
            (SELECT count(*) FROM membro_grupo m WHERE m.grupo_id = g.id)::int AS total_membros
       FROM convite c
       JOIN grupo g ON g.id = c.grupo_id
       JOIN usuario u ON u.id = g.representante_id
      WHERE c.convidado_id = $1 AND c.status = 'PENDENTE' AND g.status = 'ATIVO'
      ORDER BY c.criado_em DESC`,
    [usuarioId],
  );
  return rows;
}

export async function responder(db: Db, id: number, status: 'ACEITO' | 'RECUSADO'): Promise<void> {
  await db.query('UPDATE convite SET status = $2, respondido_em = now() WHERE id = $1', [id, status]);
}
