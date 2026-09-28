import { Db } from '../db/pool';

export interface RevisaoRow {
  id: number;
  tarefa_id: number;
  entrega_id: number;
  revisor_id: number;
  resultado: 'APROVADA' | 'CORRECAO';
  motivo: string | null;
  revisada_em: Date;
}

export interface RevisaoComRevisorRow extends RevisaoRow {
  revisor_nome: string;
}

export async function inserir(
  db: Db,
  dados: { tarefaId: number; entregaId: number; revisorId: number; resultado: 'APROVADA' | 'CORRECAO'; motivo: string | null },
): Promise<RevisaoRow> {
  const { rows } = await db.query<RevisaoRow>(
    `INSERT INTO revisao (tarefa_id, entrega_id, revisor_id, resultado, motivo)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [dados.tarefaId, dados.entregaId, dados.revisorId, dados.resultado, dados.motivo],
  );
  return rows[0];
}

export async function listarDaTarefa(db: Db, tarefaId: number): Promise<RevisaoComRevisorRow[]> {
  const { rows } = await db.query<RevisaoComRevisorRow>(
    `SELECT r.*, u.nome AS revisor_nome
       FROM revisao r JOIN usuario u ON u.id = r.revisor_id
      WHERE r.tarefa_id = $1
      ORDER BY r.revisada_em, r.id`,
    [tarefaId],
  );
  return rows;
}

export async function listarDoGrupo(db: Db, grupoId: number): Promise<RevisaoComRevisorRow[]> {
  const { rows } = await db.query<RevisaoComRevisorRow>(
    `SELECT r.*, u.nome AS revisor_nome
       FROM revisao r
       JOIN tarefa t ON t.id = r.tarefa_id
       JOIN usuario u ON u.id = r.revisor_id
      WHERE t.grupo_id = $1
      ORDER BY r.revisada_em, r.id`,
    [grupoId],
  );
  return rows;
}
