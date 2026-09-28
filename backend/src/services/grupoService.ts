import { pool, withTx } from '../db/pool';
import { formatarDataHora } from '../domain/datas';
import { regra } from '../errors';
import * as convites from '../repositories/conviteRepository';
import * as grupos from '../repositories/grupoRepository';
import * as historico from '../repositories/historicoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import { contextoDoGrupo, exigirAtivo, exigirMembro, exigirRepresentante } from './acesso';
import { convitePendenteDoGrupoDto, grupoBaseDto, membroDto, progresso } from './dto';

export interface DadosGrupo {
  titulo: string;
  objetivo: string;
  prazoFinal: Date;
  limiteMembros: number;
}

/** RN06: o prazo final precisa ser uma data futura. */
function validarPrazoFinal(prazoFinal: Date): void {
  if (prazoFinal.getTime() <= Date.now()) {
    throw regra('O prazo final do trabalho deve ser uma data futura.');
  }
}

/** RN01 + RN05: quem cria vira representante e membro; título, objetivo e prazo são obrigatórios. */
export async function criar(usuarioId: number, dados: DadosGrupo) {
  validarPrazoFinal(dados.prazoFinal);
  const grupoId = await withTx(async (db) => {
    const grupo = await grupos.inserir(db, { ...dados, representanteId: usuarioId });
    await grupos.adicionarMembro(db, grupo.id, usuarioId);
    const ctx = await contextoDoGrupo(db, grupo.id, usuarioId);
    await historico.registrar(db, {
      grupoId: grupo.id,
      usuarioId,
      tipo: 'GRUPO_CRIADO',
      descricao: `${ctx.representante.nome} criou o grupo "${grupo.titulo}" e se tornou representante.`,
    });
    return grupo.id;
  });
  return detalhar(grupoId, usuarioId);
}

export async function listar(usuarioId: number) {
  const linhas = await grupos.listarDoUsuario(pool, usuarioId);
  return linhas.map((g) => ({
    ...grupoBaseDto(g, g.representante_nome, usuarioId),
    totalMembros: g.total_membros,
    progresso: progresso(g.total_tarefas, g.tarefas_concluidas),
  }));
}

export async function detalhar(grupoId: number, usuarioId: number) {
  const ctx = await contextoDoGrupo(pool, grupoId, usuarioId);
  const pendentes = await convites.pendentesDoGrupo(pool, grupoId);
  return {
    ...grupoBaseDto(ctx.grupo, ctx.representante.nome, usuarioId),
    membros: ctx.membros.map((m) => membroDto(m, ctx.grupo)),
    convitesPendentes: pendentes.map(convitePendenteDoGrupoDto),
  };
}

export async function atualizar(grupoId: number, usuarioId: number, dados: DadosGrupo) {
  await withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirRepresentante(ctx, 'editar os dados do trabalho');
    exigirAtivo(ctx.grupo);
    if (dados.prazoFinal.getTime() !== ctx.grupo.prazo_final.getTime()) validarPrazoFinal(dados.prazoFinal);

    // RN10: o limite não pode ficar abaixo do número atual de membros
    if (dados.limiteMembros < ctx.membros.length) {
      throw regra(
        `O limite não pode ser menor que a quantidade atual de membros (${ctx.membros.length}).`,
      );
    }
    // RN16: nenhuma tarefa pode ficar com prazo depois do prazo final
    const lista = await tarefas.listarDoGrupo(db, grupoId);
    const foraDoPrazo = lista.find((t) => t.prazo.getTime() > dados.prazoFinal.getTime());
    if (foraDoPrazo) {
      throw regra(
        `A tarefa "${foraDoPrazo.titulo}" vence em ${formatarDataHora(foraDoPrazo.prazo)}, depois do novo prazo final. Ajuste a tarefa antes.`,
      );
    }
    await grupos.atualizar(db, grupoId, dados);
    await historico.registrar(db, {
      grupoId,
      usuarioId,
      tipo: 'GRUPO_EDITADO',
      descricao: `${ctx.representante.nome} atualizou os dados do trabalho.`,
    });
  });
  return detalhar(grupoId, usuarioId);
}

/** RN02 + RN03: transfere a função de representante para outro membro. */
export async function transferirRepresentante(grupoId: number, usuarioId: number, novoId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirRepresentante(ctx, 'transferir a função de representante');
    exigirAtivo(ctx.grupo);
    if (novoId === usuarioId) throw regra('Você já é o representante deste grupo.');
    const novo = exigirMembro(ctx, novoId, 'novo representante');
    await grupos.definirRepresentante(db, grupoId, novoId);
    await historico.registrar(db, {
      grupoId,
      usuarioId,
      tipo: 'REPRESENTANTE_TRANSFERIDO',
      descricao: `${ctx.representante.nome} transferiu a função de representante para ${novo.nome}.`,
    });
  });
  return detalhar(grupoId, usuarioId);
}

/** RN04: o representante só sai depois de transferir a função. */
export async function sair(grupoId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirAtivo(ctx.grupo);
    if (ctx.souRepresentante) {
      throw regra('O representante não pode sair do grupo sem antes transferir a função para outro membro.');
    }
    if ((await tarefas.contarDoResponsavel(db, grupoId, usuarioId)) > 0) {
      throw regra('Você ainda é responsável ou revisor de tarefas. Peça ao representante para reatribuí-las antes de sair.');
    }
    const eu = ctx.membros.find((m) => m.id === usuarioId)!;
    await grupos.removerMembro(db, grupoId, usuarioId);
    await historico.registrar(db, {
      grupoId,
      usuarioId,
      tipo: 'MEMBRO_SAIU',
      descricao: `${eu.nome} saiu do grupo.`,
    });
  });
}

/** Lista o que ainda impede a finalização (RN15 e RN29). */
export function pendenciasParaFinalizar(
  membros: { id: number; nome: string }[],
  lista: { status: string; responsavel_id: number }[],
): string[] {
  const pendencias: string[] = [];
  if (lista.length === 0) pendencias.push('O trabalho precisa ter pelo menos uma tarefa.');
  const abertas = lista.filter((t) => t.status !== 'CONCLUIDA').length;
  if (abertas > 0) {
    pendencias.push(
      abertas === 1 ? 'Ainda há 1 tarefa não concluída.' : `Ainda há ${abertas} tarefas não concluídas.`,
    );
  }
  const semTarefa = membros.filter((m) => !lista.some((t) => t.responsavel_id === m.id));
  if (semTarefa.length > 0) {
    pendencias.push(`Todo membro precisa ter pelo menos uma tarefa: ${semTarefa.map((m) => m.nome).join(', ')}.`);
  }
  return pendencias;
}

/** RN29: só finaliza com pelo menos uma tarefa e todas concluídas. */
export async function finalizar(grupoId: number, usuarioId: number) {
  await withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirRepresentante(ctx, 'finalizar o trabalho');
    exigirAtivo(ctx.grupo);
    const lista = await tarefas.listarDoGrupo(db, grupoId);
    const pendencias = pendenciasParaFinalizar(ctx.membros, lista);
    if (pendencias.length > 0) throw regra(`Não é possível finalizar: ${pendencias.join(' ')}`);
    await grupos.finalizar(db, grupoId);
    await historico.registrar(db, {
      grupoId,
      usuarioId,
      tipo: 'GRUPO_FINALIZADO',
      descricao: `${ctx.representante.nome} finalizou o trabalho. O relatório final está disponível.`,
    });
  });
  return detalhar(grupoId, usuarioId);
}
