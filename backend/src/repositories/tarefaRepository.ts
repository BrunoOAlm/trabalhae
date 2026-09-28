import { Db } from '../db/pool';
import { StatusTarefa } from '../domain/maquinaEstados';

export interface TarefaRow {
  id: number;
  grupo_id: number;
  titulo: string;
  descricao: string;
  prazo: Date;
  responsavel_id: number;
  revisor_id: number | null;
  status: StatusTarefa;
  entregue_com_atraso: boolean;
  criado_em: Date;
}

export interface TarefaDetalhadaRow extends TarefaRow {
  responsavel_nome: string;
  revisor_nome: string | null;
  total_entregas: number;
  total_correcoes: number;
}

const SELECT_DETALHADA = `
  SELECT t.*, r.nome AS responsavel_nome, v.nome AS revisor_nome,
         (SELECT count(*) FROM entrega e WHERE e.tarefa_id = t.id)::int AS total_entregas,
         (SELECT count(*) FROM revisao rv WHERE rv.tarefa_id = t.id AND rv.resultado = 'CORRECAO')::int AS total_correcoes
    FROM tarefa t
    JOIN usuario r ON r.id = t.responsavel_id
    LEFT JOIN usuario v ON v.id = t.revisor_id`;

export async function inserir(
  db: Db,
  dados: {
    grupoId: number;
    titulo: string;
    descricao: string;
    prazo: Date;
    responsavelId: number;
    revisorId: number | null;
  },
): Promise<TarefaRow> {
  const { rows } = await db.query<TarefaRow>(
    `INSERT INTO tarefa (grupo_id, titulo, descricao, prazo, responsavel_id, revisor_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [dados.grupoId, dados.titulo, dados.descricao, dados.prazo, dados.responsavelId, dados.revisorId],
  );
  return rows[0];
}

export async function buscarPorId(db: Db, id: number, paraAtualizar = false): Promise<TarefaRow | null> {
  const { rows } = await db.query<TarefaRow>(
    `SELECT * FROM tarefa WHERE id = $1${paraAtualizar ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return rows[0] ?? null;
}

export async function buscarDetalhada(db: Db, id: number): Promise<TarefaDetalhadaRow | null> {
  const { rows } = await db.query<TarefaDetalhadaRow>(`${SELECT_DETALHADA} WHERE t.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listarDoGrupo(db: Db, grupoId: number): Promise<TarefaDetalhadaRow[]> {
  const { rows } = await db.query<TarefaDetalhadaRow>(
    `${SELECT_DETALHADA} WHERE t.grupo_id = $1 ORDER BY t.prazo, t.id`,
    [grupoId],
  );
  return rows;
}

export async function atualizarDados(
  db: Db,
  id: number,
  dados: { titulo: string; descricao: string; prazo: Date },
): Promise<void> {
  await db.query('UPDATE tarefa SET titulo = $2, descricao = $3, prazo = $4 WHERE id = $1', [
    id,
    dados.titulo,
    dados.descricao,
    dados.prazo,
  ]);
}

export async function atualizarStatus(db: Db, id: number, status: StatusTarefa): Promise<void> {
  await db.query('UPDATE tarefa SET status = $2 WHERE id = $1', [id, status]);
}

export async function marcarEntregueComAtraso(db: Db, id: number): Promise<void> {
  await db.query('UPDATE tarefa SET entregue_com_atraso = true WHERE id = $1', [id]);
}

export async function definirResponsavel(db: Db, id: number, responsavelId: number, revisorId: number | null) {
  await db.query('UPDATE tarefa SET responsavel_id = $2, revisor_id = $3 WHERE id = $1', [
    id,
    responsavelId,
    revisorId,
  ]);
}

export async function definirRevisor(db: Db, id: number, revisorId: number | null): Promise<void> {
  await db.query('UPDATE tarefa SET revisor_id = $2 WHERE id = $1', [id, revisorId]);
}

export async function excluir(db: Db, id: number): Promise<void> {
  await db.query('DELETE FROM tarefa WHERE id = $1', [id]);
}

export async function contarDoResponsavel(db: Db, grupoId: number, usuarioId: number): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM tarefa WHERE grupo_id = $1 AND (responsavel_id = $2 OR revisor_id = $2)',
    [grupoId, usuarioId],
  );
  return rows[0].total;
}
