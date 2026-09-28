import { Db } from '../db/pool';
import { conflito, naoEncontrado, proibido } from '../errors';
import * as grupos from '../repositories/grupoRepository';
import { GrupoRow, MembroRow } from '../repositories/grupoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import { TarefaRow } from '../repositories/tarefaRepository';

export interface ContextoGrupo {
  grupo: GrupoRow;
  membros: MembroRow[];
  representante: MembroRow;
  souRepresentante: boolean;
}

/** Carrega o grupo garantindo que o usuário participa dele (403 caso contrário). */
export async function contextoDoGrupo(db: Db, grupoId: number, usuarioId: number, paraAtualizar = false): Promise<ContextoGrupo> {
  const grupo = await grupos.buscarPorId(db, grupoId, paraAtualizar);
  if (!grupo) throw naoEncontrado('Grupo não encontrado.');
  const membros = await grupos.listarMembros(db, grupoId);
  if (!membros.some((m) => m.id === usuarioId)) {
    throw proibido('Você não participa deste grupo.');
  }
  const representante = membros.find((m) => m.id === grupo.representante_id)!;
  return { grupo, membros, representante, souRepresentante: grupo.representante_id === usuarioId };
}

export async function contextoDaTarefa(db: Db, tarefaId: number, usuarioId: number, paraAtualizar = false) {
  const tarefa = await tarefas.buscarPorId(db, tarefaId, paraAtualizar);
  if (!tarefa) throw naoEncontrado('Tarefa não encontrada.');
  const ctx = await contextoDoGrupo(db, tarefa.grupo_id, usuarioId);
  return { ...ctx, tarefa };
}

export function exigirRepresentante(ctx: ContextoGrupo, acao: string): void {
  if (!ctx.souRepresentante) throw proibido(`Somente o representante do grupo pode ${acao}.`);
}

/** RN30: depois de finalizado, nada no grupo pode ser alterado. */
export function exigirAtivo(grupo: GrupoRow): void {
  if (grupo.status === 'FINALIZADO') {
    throw conflito('Este trabalho já foi finalizado e não pode mais ser alterado.');
  }
}

export function exigirMembro(ctx: ContextoGrupo, usuarioId: number, papel: string): MembroRow {
  const membro = ctx.membros.find((m) => m.id === usuarioId);
  if (!membro) throw proibido(`O ${papel} precisa ser membro do grupo.`);
  return membro;
}

/**
 * RN23/RN24: o representante revisa as tarefas dos outros membros;
 * as tarefas do próprio representante são revisadas pelo membro indicado em revisor_id.
 */
export function revisorEfetivoId(tarefa: TarefaRow, grupo: GrupoRow): number | null {
  return tarefa.responsavel_id === grupo.representante_id ? tarefa.revisor_id : grupo.representante_id;
}
