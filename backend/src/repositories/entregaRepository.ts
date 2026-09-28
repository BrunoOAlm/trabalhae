import { Db } from '../db/pool';

export interface EntregaRow {
  id: number;
  tarefa_id: number;
  autor_id: number;
  comentario: string | null;
  link: string | null;
  arquivo_nome: string | null;
  arquivo_caminho: string | null;
  arquivo_tipo: string | null;
  arquivo_tamanho: number | null;
  enviada_em: Date;
  com_atraso: boolean;
}

export interface EntregaComAutorRow extends EntregaRow {
  autor_nome: string;
}

export async function inserir(
  db: Db,
  dados: {
    tarefaId: number;
    autorId: number;
    comentario: string | null;
    link: string | null;
    arquivoNome: string | null;
    arquivoCaminho: string | null;
    arquivoTipo: string | null;
    arquivoTamanho: number | null;
    comAtraso: boolean;
    enviadaEm: Date;
  },
): Promise<EntregaRow> {
  const { rows } = await db.query<EntregaRow>(
    `INSERT INTO entrega (tarefa_id, autor_id, comentario, link, arquivo_nome, arquivo_caminho,
                          arquivo_tipo, arquivo_tamanho, com_atraso, enviada_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      dados.tarefaId,
      dados.autorId,
      dados.comentario,
      dados.link,
      dados.arquivoNome,
      dados.arquivoCaminho,
      dados.arquivoTipo,
      dados.arquivoTamanho,
      dados.comAtraso,
      dados.enviadaEm,
    ],
  );
  return rows[0];
}

export async function listarDaTarefa(db: Db, tarefaId: number): Promise<EntregaComAutorRow[]> {
  const { rows } = await db.query<EntregaComAutorRow>(
    `SELECT e.*, u.nome AS autor_nome
       FROM entrega e JOIN usuario u ON u.id = e.autor_id
      WHERE e.tarefa_id = $1
      ORDER BY e.enviada_em, e.id`,
    [tarefaId],
  );
  return rows;
}

export async function buscarPorId(db: Db, id: number): Promise<EntregaRow | null> {
  const { rows } = await db.query<EntregaRow>('SELECT * FROM entrega WHERE id = $1', [id]);
  return rows[0] ?? null;
}

export async function ultimaDaTarefa(db: Db, tarefaId: number): Promise<EntregaRow | null> {
  const { rows } = await db.query<EntregaRow>(
    'SELECT * FROM entrega WHERE tarefa_id = $1 ORDER BY enviada_em DESC, id DESC LIMIT 1',
    [tarefaId],
  );
  return rows[0] ?? null;
}

export async function contarDaTarefa(db: Db, tarefaId: number): Promise<number> {
  const { rows } = await db.query<{ total: number }>(
    'SELECT count(*)::int AS total FROM entrega WHERE tarefa_id = $1',
    [tarefaId],
  );
  return rows[0].total;
}

export async function listarDoGrupo(db: Db, grupoId: number): Promise<EntregaComAutorRow[]> {
  const { rows } = await db.query<EntregaComAutorRow>(
    `SELECT e.*, u.nome AS autor_nome
       FROM entrega e
       JOIN tarefa t ON t.id = e.tarefa_id
       JOIN usuario u ON u.id = e.autor_id
      WHERE t.grupo_id = $1
      ORDER BY e.enviada_em, e.id`,
    [grupoId],
  );
  return rows;
}
