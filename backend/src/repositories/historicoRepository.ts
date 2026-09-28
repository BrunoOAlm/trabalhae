import { Db } from '../db/pool';

export type TipoEvento =
  | 'GRUPO_CRIADO'
  | 'GRUPO_EDITADO'
  | 'MEMBRO_CONVIDADO'
  | 'CONVITE_ACEITO'
  | 'CONVITE_RECUSADO'
  | 'MEMBRO_SAIU'
  | 'REPRESENTANTE_TRANSFERIDO'
  | 'TAREFA_CRIADA'
  | 'TAREFA_EDITADA'
  | 'TAREFA_EXCLUIDA'
  | 'RESPONSAVEL_ATRIBUIDO'
  | 'RESPONSAVEL_TROCADO'
  | 'REVISOR_DEFINIDO'
  | 'TAREFA_INICIADA'
  | 'ENTREGA_ENVIADA'
  | 'ENTREGA_COM_ATRASO'
  | 'REVISAO_INICIADA'
  | 'TAREFA_APROVADA'
  | 'CORRECAO_SOLICITADA'
  | 'TAREFA_ATRASADA'
  | 'GRUPO_FINALIZADO';

export interface EventoRow {
  id: number;
  grupo_id: number;
  tarefa_id: number | null;
  usuario_id: number | null;
  tipo: TipoEvento;
  descricao: string;
  criado_em: Date;
}

export interface EventoComUsuarioRow extends EventoRow {
  usuario_nome: string | null;
  tarefa_titulo: string | null;
}

export async function registrar(
  db: Db,
  evento: { grupoId: number; tarefaId?: number | null; usuarioId: number | null; tipo: TipoEvento; descricao: string },
): Promise<void> {
  await db.query(
    `INSERT INTO historico_evento (grupo_id, tarefa_id, usuario_id, tipo, descricao)
     VALUES ($1, $2, $3, $4, $5)`,
    [evento.grupoId, evento.tarefaId ?? null, evento.usuarioId, evento.tipo, evento.descricao],
  );
}

export async function listarDoGrupo(db: Db, grupoId: number): Promise<EventoComUsuarioRow[]> {
  const { rows } = await db.query<EventoComUsuarioRow>(
    `SELECT h.*, u.nome AS usuario_nome, t.titulo AS tarefa_titulo
       FROM historico_evento h
       LEFT JOIN usuario u ON u.id = h.usuario_id
       LEFT JOIN tarefa t ON t.id = h.tarefa_id
      WHERE h.grupo_id = $1
      ORDER BY h.criado_em DESC, h.id DESC`,
    [grupoId],
  );
  return rows;
}

export async function listarDaTarefa(db: Db, tarefaId: number): Promise<EventoComUsuarioRow[]> {
  const { rows } = await db.query<EventoComUsuarioRow>(
    `SELECT h.*, u.nome AS usuario_nome, NULL AS tarefa_titulo
       FROM historico_evento h LEFT JOIN usuario u ON u.id = h.usuario_id
      WHERE h.tarefa_id = $1
      ORDER BY h.criado_em, h.id`,
    [tarefaId],
  );
  return rows;
}

export async function contarPorTipo(db: Db, grupoId: number, tipo: TipoEvento): Promise<Map<number, number>> {
  const { rows } = await db.query<{ tarefa_id: number; total: number }>(
    `SELECT tarefa_id, count(*)::int AS total FROM historico_evento
      WHERE grupo_id = $1 AND tipo = $2 AND tarefa_id IS NOT NULL
      GROUP BY tarefa_id`,
    [grupoId, tipo],
  );
  return new Map(rows.map((r) => [r.tarefa_id, r.total]));
}
