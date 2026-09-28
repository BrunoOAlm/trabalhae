import { pool } from '../db/pool';
import { isoLocal } from '../domain/datas';
import { estaAtrasada, ROTULO_STATUS, STATUS_TAREFA } from '../domain/maquinaEstados';
import * as convites from '../repositories/conviteRepository';
import * as entregas from '../repositories/entregaRepository';
import * as historico from '../repositories/historicoRepository';
import * as revisoes from '../repositories/revisaoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import { contextoDoGrupo } from './acesso';
import { convitePendenteDoGrupoDto, eventoDto, grupoBaseDto, membroDto, progresso, tarefaDto } from './dto';
import { pendenciasParaFinalizar } from './grupoService';

/** RF13 + RN15: painel com tarefas por status, progresso e membros sem tarefa. */
export async function painel(grupoId: number, usuarioId: number) {
  const ctx = await contextoDoGrupo(pool, grupoId, usuarioId);
  const [lista, pendentes] = await Promise.all([
    tarefas.listarDoGrupo(pool, grupoId),
    convites.pendentesDoGrupo(pool, grupoId),
  ]);
  const agora = new Date();
  const dtos = lista.map((t) => tarefaDto(t, ctx.grupo, ctx.representante.nome, agora));
  const concluidas = dtos.filter((t) => t.status === 'CONCLUIDA').length;

  const membros = ctx.membros.map((m) => {
    const minhas = dtos.filter((t) => t.responsavel.id === m.id);
    return {
      ...membroDto(m, ctx.grupo),
      totalTarefas: minhas.length,
      tarefasConcluidas: minhas.filter((t) => t.status === 'CONCLUIDA').length,
      tarefasAtrasadas: minhas.filter((t) => t.atrasada).length,
    };
  });
  const pendencias = pendenciasParaFinalizar(ctx.membros, lista);

  return {
    grupo: { ...grupoBaseDto(ctx.grupo, ctx.representante.nome, usuarioId), totalMembros: ctx.membros.length },
    progresso: progresso(dtos.length, concluidas),
    colunas: STATUS_TAREFA.map((status) => ({
      status,
      rotulo: ROTULO_STATUS[status],
      tarefas: dtos.filter((t) => t.status === status),
    })),
    membros,
    membrosSemTarefa: membros.filter((m) => m.totalTarefas === 0).map((m) => ({ id: m.id, nome: m.nome })),
    tarefasSemRevisor: dtos.filter((t) => t.precisaIndicarRevisor).map((t) => ({ id: t.id, titulo: t.titulo })),
    totalAtrasadas: dtos.filter((t) => t.atrasada).length,
    convitesPendentes: pendentes.map(convitePendenteDoGrupoDto),
    finalizacao: { pode: ctx.grupo.status === 'ATIVO' && pendencias.length === 0, pendencias },
  };
}

/** RF14 + RN31: linha do tempo do grupo, visível para todos os membros. */
export async function linhaDoTempo(grupoId: number, usuarioId: number) {
  await contextoDoGrupo(pool, grupoId, usuarioId);
  return (await historico.listarDoGrupo(pool, grupoId)).map(eventoDto);
}

/**
 * RF16 + RN32: relatório por membro. Fica disponível como prévia enquanto o trabalho está ativo
 * e vira o relatório final (final = true) depois da finalização.
 */
export async function relatorio(grupoId: number, usuarioId: number) {
  const ctx = await contextoDoGrupo(pool, grupoId, usuarioId);
  const [lista, todasEntregas, todasRevisoes] = await Promise.all([
    tarefas.listarDoGrupo(pool, grupoId),
    entregas.listarDoGrupo(pool, grupoId),
    revisoes.listarDoGrupo(pool, grupoId),
  ]);
  const agora = new Date();

  const linhas = lista.map((t) => {
    const minhasEntregas = todasEntregas.filter((e) => e.tarefa_id === t.id);
    const minhasRevisoes = todasRevisoes.filter((r) => r.tarefa_id === t.id);
    const aprovacao = minhasRevisoes.find((r) => r.resultado === 'APROVADA');
    const dto = tarefaDto(t, ctx.grupo, ctx.representante.nome, agora);
    return {
      responsavelId: t.responsavel_id,
      tarefa: {
        id: t.id,
        titulo: t.titulo,
        prazo: isoLocal(t.prazo),
        status: t.status,
        rotuloStatus: ROTULO_STATUS[t.status],
        revisor: dto.revisor,
        totalEntregas: minhasEntregas.length,
        primeiraEntrega: isoLocal(minhasEntregas[0]?.enviada_em),
        ultimaEntrega: isoLocal(minhasEntregas[minhasEntregas.length - 1]?.enviada_em),
        entregueComAtraso: t.entregue_com_atraso,
        atrasadaSemEntrega: estaAtrasada(t.status, t.prazo, agora),
        correcoes: minhasRevisoes.filter((r) => r.resultado === 'CORRECAO').length,
        aprovadaEm: isoLocal(aprovacao?.revisada_em),
      },
    };
  });

  const membros = ctx.membros.map((m) => {
    const minhas = linhas.filter((l) => l.responsavelId === m.id).map((l) => l.tarefa);
    return {
      ...membroDto(m, ctx.grupo),
      tarefas: minhas,
      totais: {
        tarefas: minhas.length,
        concluidas: minhas.filter((t) => t.status === 'CONCLUIDA').length,
        entregasComAtraso: minhas.filter((t) => t.entregueComAtraso).length,
        atrasadasSemEntrega: minhas.filter((t) => t.atrasadaSemEntrega).length,
        correcoes: minhas.reduce((s, t) => s + t.correcoes, 0),
      },
    };
  });

  return {
    final: ctx.grupo.status === 'FINALIZADO',
    geradoEm: isoLocal(agora),
    grupo: { ...grupoBaseDto(ctx.grupo, ctx.representante.nome, usuarioId), totalMembros: ctx.membros.length },
    resumo: {
      totalTarefas: lista.length,
      concluidas: lista.filter((t) => t.status === 'CONCLUIDA').length,
      totalEntregas: todasEntregas.length,
      entregasComAtraso: lista.filter((t) => t.entregue_com_atraso).length,
      totalCorrecoes: todasRevisoes.filter((r) => r.resultado === 'CORRECAO').length,
    },
    membros,
  };
}
