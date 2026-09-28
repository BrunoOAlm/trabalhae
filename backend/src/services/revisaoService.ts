import { withTx } from '../db/pool';
import { transitar } from '../domain/maquinaEstados';
import { proibido, regra } from '../errors';
import * as entregas from '../repositories/entregaRepository';
import * as historico from '../repositories/historicoRepository';
import * as revisoes from '../repositories/revisaoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import { contextoDaTarefa, exigirAtivo, revisorEfetivoId } from './acesso';
import { detalhar } from './tarefaService';

type Ctx = Awaited<ReturnType<typeof contextoDaTarefa>>;

/** RN23 + RN24: confere se quem está agindo é o revisor desta tarefa. */
function exigirRevisor(ctx: Ctx, usuarioId: number) {
  const revisorId = revisorEfetivoId(ctx.tarefa, ctx.grupo);
  if (revisorId == null) {
    throw regra('Esta tarefa é do representante e ainda não tem revisor. Indique um membro para revisar.');
  }
  if (ctx.tarefa.responsavel_id === usuarioId) throw proibido('Ninguém pode revisar a própria tarefa.');
  if (revisorId !== usuarioId) {
    const nome = ctx.membros.find((m) => m.id === revisorId)?.nome ?? 'o revisor indicado';
    throw proibido(`Somente ${nome} pode revisar esta tarefa.`);
  }
  if (revisorId === ctx.tarefa.responsavel_id) throw proibido('Ninguém pode revisar a própria tarefa.');
  return ctx.membros.find((m) => m.id === usuarioId)!;
}

/** ENVIADA → EM_REVISAO */
export async function iniciarRevisao(tarefaId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirAtivo(ctx.grupo);
    const revisor = exigirRevisor(ctx, usuarioId);
    const novo = transitar(ctx.tarefa.status, 'EM_REVISAO');
    await tarefas.atualizarStatus(db, tarefaId, novo);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'REVISAO_INICIADA',
      descricao: `${revisor.nome} começou a revisar "${ctx.tarefa.titulo}".`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}

/** EM_REVISAO → CONCLUIDA (RN26: só conclui com aprovação) */
export async function aprovar(tarefaId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirAtivo(ctx.grupo);
    const revisor = exigirRevisor(ctx, usuarioId);
    const novo = transitar(ctx.tarefa.status, 'CONCLUIDA');
    const ultima = (await entregas.ultimaDaTarefa(db, tarefaId))!;
    await revisoes.inserir(db, { tarefaId, entregaId: ultima.id, revisorId: usuarioId, resultado: 'APROVADA', motivo: null });
    await tarefas.atualizarStatus(db, tarefaId, novo);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'TAREFA_APROVADA',
      descricao: `${revisor.nome} aprovou "${ctx.tarefa.titulo}". Tarefa concluída.`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}

/** EM_REVISAO → EM_CORRECAO (RN25: motivo obrigatório) */
export async function pedirCorrecao(tarefaId: number, usuarioId: number, motivo: string) {
  const motivoLimpo = (motivo ?? '').trim();
  if (!motivoLimpo) throw regra('Informe o motivo da correção.');
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirAtivo(ctx.grupo);
    const revisor = exigirRevisor(ctx, usuarioId);
    const novo = transitar(ctx.tarefa.status, 'EM_CORRECAO');
    const ultima = (await entregas.ultimaDaTarefa(db, tarefaId))!;
    await revisoes.inserir(db, {
      tarefaId,
      entregaId: ultima.id,
      revisorId: usuarioId,
      resultado: 'CORRECAO',
      motivo: motivoLimpo,
    });
    await tarefas.atualizarStatus(db, tarefaId, novo);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'CORRECAO_SOLICITADA',
      descricao: `${revisor.nome} pediu correção em "${ctx.tarefa.titulo}": ${motivoLimpo}`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}
