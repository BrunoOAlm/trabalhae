import { pool } from '../db/pool';

/**
 * RN21: registra no histórico, uma única vez por tarefa, quando uma tarefa não enviada
 * passa do prazo. O campo "atrasada" das respostas é calculado na hora; este job só
 * deixa o fato registrado na linha do tempo.
 */
export async function registrarAtrasos(): Promise<number> {
  const { rowCount } = await pool.query(`
    INSERT INTO historico_evento (grupo_id, tarefa_id, usuario_id, tipo, descricao)
    SELECT t.grupo_id, t.id, t.responsavel_id, 'TAREFA_ATRASADA',
           format('A tarefa "%s" passou do prazo sem entrega (responsável: %s).', t.titulo, u.nome)
      FROM tarefa t
      JOIN grupo g ON g.id = t.grupo_id AND g.status = 'ATIVO'
      JOIN usuario u ON u.id = t.responsavel_id
     WHERE t.status IN ('PENDENTE', 'EM_ANDAMENTO')
       AND t.prazo < now()
       AND NOT EXISTS (
         SELECT 1 FROM historico_evento h WHERE h.tarefa_id = t.id AND h.tipo = 'TAREFA_ATRASADA'
       )`);
  return rowCount ?? 0;
}

let timer: NodeJS.Timeout | null = null;

export function iniciarJobDeAtrasos(intervaloMs = 60 * 60 * 1000): void {
  const executar = () =>
    registrarAtrasos()
      .then((n) => n > 0 && console.log(`Job de atrasos: ${n} tarefa(s) marcada(s) como atrasada(s).`))
      .catch((err) => console.error('Falha no job de atrasos:', err));
  void executar();
  timer = setInterval(executar, intervaloMs);
}

export function pararJobDeAtrasos(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
