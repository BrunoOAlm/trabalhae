import { pool, withTx } from '../db/pool';
import { formatarDataHora, isoLocal } from '../domain/datas';
import { transitar } from '../domain/maquinaEstados';
import { proibido, regra } from '../errors';
import * as entregas from '../repositories/entregaRepository';
import { MembroRow } from '../repositories/grupoRepository';
import * as historico from '../repositories/historicoRepository';
import * as revisoes from '../repositories/revisaoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import {
  ContextoGrupo,
  contextoDaTarefa,
  contextoDoGrupo,
  exigirAtivo,
  exigirMembro,
  exigirRepresentante,
  revisorEfetivoId,
} from './acesso';
import { entregaDto, eventoDto, membroDto, revisaoDto, tarefaDto } from './dto';

export interface DadosTarefa {
  titulo: string;
  descricao: string;
  prazo: Date;
}

/** RN16: prazo da tarefa no futuro e nunca depois do prazo final do trabalho. */
function validarPrazoTarefa(ctx: ContextoGrupo, prazo: Date): void {
  if (prazo.getTime() <= Date.now()) throw regra('O prazo da tarefa deve ser uma data futura.');
  if (prazo.getTime() > ctx.grupo.prazo_final.getTime()) {
    throw regra(
      `O prazo da tarefa não pode ser posterior ao prazo final do trabalho (${formatarDataHora(ctx.grupo.prazo_final)}).`,
    );
  }
}

/**
 * RN13, RN14 e RN24: define responsável e, quando a tarefa é do representante,
 * exige um revisor que seja outro membro do grupo.
 */
function resolverResponsavelERevisor(
  ctx: ContextoGrupo,
  responsavelId: number,
  revisorId: number | null | undefined,
): { responsavel: MembroRow; revisor: MembroRow | null } {
  const responsavel = exigirMembro(ctx, responsavelId, 'responsável pela tarefa');
  if (responsavelId !== ctx.grupo.representante_id) return { responsavel, revisor: null };
  if (revisorId == null) {
    throw regra('Tarefas do representante precisam de um revisor: indique outro membro do grupo.');
  }
  if (revisorId === responsavelId) throw regra('Ninguém pode revisar a própria tarefa.');
  const revisor = exigirMembro(ctx, revisorId, 'revisor');
  return { responsavel, revisor };
}

export async function criar(
  grupoId: number,
  usuarioId: number,
  dados: DadosTarefa & { responsavelId: number; revisorId?: number | null },
) {
  const tarefaId = await withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirRepresentante(ctx, 'criar tarefas'); // RN12
    exigirAtivo(ctx.grupo);
    // RN07: o trabalho precisa estar definido antes das tarefas
    if (!ctx.grupo.titulo.trim() || !ctx.grupo.objetivo.trim() || !ctx.grupo.prazo_final) {
      throw regra('Defina título, objetivo e prazo do trabalho antes de criar tarefas.');
    }
    validarPrazoTarefa(ctx, dados.prazo);
    const { responsavel, revisor } = resolverResponsavelERevisor(ctx, dados.responsavelId, dados.revisorId);

    const tarefa = await tarefas.inserir(db, {
      grupoId,
      titulo: dados.titulo,
      descricao: dados.descricao,
      prazo: dados.prazo,
      responsavelId: responsavel.id,
      revisorId: revisor?.id ?? null,
    });
    const rep = ctx.representante.nome;
    await historico.registrar(db, {
      grupoId,
      tarefaId: tarefa.id,
      usuarioId,
      tipo: 'TAREFA_CRIADA',
      descricao: `${rep} criou a tarefa "${tarefa.titulo}" (prazo ${formatarDataHora(tarefa.prazo)}).`,
    });
    await historico.registrar(db, {
      grupoId,
      tarefaId: tarefa.id,
      usuarioId,
      tipo: 'RESPONSAVEL_ATRIBUIDO',
      descricao:
        `${rep} atribuiu "${tarefa.titulo}" a ${responsavel.nome}` +
        (revisor ? `, com revisão de ${revisor.nome}.` : '.'),
    });
    return tarefa.id;
  });
  return detalhar(tarefaId, usuarioId);
}

export async function detalhar(tarefaId: number, usuarioId: number) {
  const ctx = await contextoDaTarefa(pool, tarefaId, usuarioId);
  const t = (await tarefas.buscarDetalhada(pool, tarefaId))!;
  const [listaEntregas, listaRevisoes, eventos] = await Promise.all([
    entregas.listarDaTarefa(pool, tarefaId),
    revisoes.listarDaTarefa(pool, tarefaId),
    historico.listarDaTarefa(pool, tarefaId),
  ]);

  const ativo = ctx.grupo.status === 'ATIVO';
  const souResponsavel = t.responsavel_id === usuarioId;
  const revisorId = revisorEfetivoId(t, ctx.grupo);
  const souRevisor = revisorId === usuarioId && revisorId !== t.responsavel_id;
  const tarefaDoRepresentante = t.responsavel_id === ctx.grupo.representante_id;
  const semEntregas = t.total_entregas === 0;

  return {
    ...tarefaDto(t, ctx.grupo, ctx.representante.nome),
    grupo: {
      id: ctx.grupo.id,
      titulo: ctx.grupo.titulo,
      status: ctx.grupo.status,
      prazoFinal: isoLocal(ctx.grupo.prazo_final),
      representanteId: ctx.grupo.representante_id,
    },
    membros: ctx.membros.map((m) => membroDto(m, ctx.grupo)),
    entregas: listaEntregas.map(entregaDto),
    revisoes: listaRevisoes.map(revisaoDto),
    historico: eventos.map(eventoDto),
    permissoes: {
      souResponsavel,
      souRevisor,
      souRepresentante: ctx.souRepresentante,
      podeIniciar: ativo && souResponsavel && t.status === 'PENDENTE',
      podeEnviar: ativo && souResponsavel && ['PENDENTE', 'EM_ANDAMENTO', 'EM_CORRECAO'].includes(t.status),
      podeIniciarRevisao: ativo && souRevisor && t.status === 'ENVIADA',
      podeRevisar: ativo && souRevisor && t.status === 'EM_REVISAO',
      podeEditar: ativo && ctx.souRepresentante && t.status !== 'CONCLUIDA',
      podeExcluir: ativo && ctx.souRepresentante && semEntregas,
      podeTrocarResponsavel: ativo && ctx.souRepresentante && semEntregas,
      podeDefinirRevisor:
        ativo && ctx.souRepresentante && tarefaDoRepresentante && !['EM_REVISAO', 'CONCLUIDA'].includes(t.status),
    },
  };
}

export async function atualizar(tarefaId: number, usuarioId: number, dados: DadosTarefa) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirRepresentante(ctx, 'editar tarefas');
    exigirAtivo(ctx.grupo);
    if (ctx.tarefa.status === 'CONCLUIDA') throw regra('Tarefas concluídas não podem mais ser editadas.');
    if (dados.prazo.getTime() !== ctx.tarefa.prazo.getTime()) validarPrazoTarefa(ctx, dados.prazo);
    await tarefas.atualizarDados(db, tarefaId, dados);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'TAREFA_EDITADA',
      descricao: `${ctx.representante.nome} editou a tarefa "${dados.titulo}".`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}

/** Tarefas com entrega não podem ser excluídas: o registro de entrega é permanente (RN19). */
export async function excluir(tarefaId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirRepresentante(ctx, 'excluir tarefas');
    exigirAtivo(ctx.grupo);
    if ((await entregas.contarDaTarefa(db, tarefaId)) > 0) {
      throw regra('Esta tarefa já tem entregas registradas e não pode ser excluída.');
    }
    await tarefas.excluir(db, tarefaId);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'TAREFA_EXCLUIDA',
      descricao: `${ctx.representante.nome} excluiu a tarefa "${ctx.tarefa.titulo}".`,
    });
  });
}

/** RN17: o responsável só muda antes do primeiro envio, e a troca fica no histórico. */
export async function trocarResponsavel(
  tarefaId: number,
  usuarioId: number,
  responsavelId: number,
  revisorId?: number | null,
) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirRepresentante(ctx, 'trocar o responsável de uma tarefa');
    exigirAtivo(ctx.grupo);
    if ((await entregas.contarDaTarefa(db, tarefaId)) > 0) {
      throw regra('O responsável só pode ser trocado antes do primeiro envio da tarefa.');
    }
    if (responsavelId === ctx.tarefa.responsavel_id) throw regra('Esta pessoa já é a responsável pela tarefa.');
    const anterior = ctx.membros.find((m) => m.id === ctx.tarefa.responsavel_id);
    const revisorAtual = revisorId !== undefined ? revisorId : ctx.tarefa.revisor_id;
    const { responsavel, revisor } = resolverResponsavelERevisor(ctx, responsavelId, revisorAtual);
    await tarefas.definirResponsavel(db, tarefaId, responsavel.id, revisor?.id ?? null);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'RESPONSAVEL_TROCADO',
      descricao: `${ctx.representante.nome} trocou o responsável de "${ctx.tarefa.titulo}": ${anterior?.nome ?? 'ex-membro'} → ${responsavel.nome}.`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}

/** RN24: indica quem revisa uma tarefa do próprio representante. */
export async function definirRevisor(tarefaId: number, usuarioId: number, revisorId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirRepresentante(ctx, 'indicar revisores');
    exigirAtivo(ctx.grupo);
    if (ctx.tarefa.responsavel_id !== ctx.grupo.representante_id) {
      throw regra('Só é preciso indicar revisor para tarefas do representante; as demais são revisadas por ele.');
    }
    if (['EM_REVISAO', 'CONCLUIDA'].includes(ctx.tarefa.status)) {
      throw regra('Não é possível trocar o revisor durante ou depois da revisão.');
    }
    if (revisorId === ctx.tarefa.responsavel_id) throw regra('Ninguém pode revisar a própria tarefa.');
    const revisor = exigirMembro(ctx, revisorId, 'revisor');
    await tarefas.definirRevisor(db, tarefaId, revisorId);
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'REVISOR_DEFINIDO',
      descricao: `${ctx.representante.nome} indicou ${revisor.nome} para revisar "${ctx.tarefa.titulo}".`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}

/** PENDENTE → EM_ANDAMENTO, só pelo responsável. */
export async function iniciar(tarefaId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
    exigirAtivo(ctx.grupo);
    if (ctx.tarefa.responsavel_id !== usuarioId) throw proibido('Somente o responsável pode iniciar esta tarefa.');
    const novo = transitar(ctx.tarefa.status, 'EM_ANDAMENTO');
    await tarefas.atualizarStatus(db, tarefaId, novo);
    const eu = ctx.membros.find((m) => m.id === usuarioId)!;
    await historico.registrar(db, {
      grupoId: ctx.grupo.id,
      tarefaId,
      usuarioId,
      tipo: 'TAREFA_INICIADA',
      descricao: `${eu.nome} começou a tarefa "${ctx.tarefa.titulo}".`,
    });
  });
  return detalhar(tarefaId, usuarioId);
}
