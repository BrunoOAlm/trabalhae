import { isoLocal } from '../domain/datas';
import { estaAtrasada, ROTULO_STATUS } from '../domain/maquinaEstados';
import { ConviteDoUsuarioRow, ConvitePendenteDoGrupoRow } from '../repositories/conviteRepository';
import { EntregaComAutorRow } from '../repositories/entregaRepository';
import { GrupoRow, MembroRow } from '../repositories/grupoRepository';
import { EventoComUsuarioRow } from '../repositories/historicoRepository';
import { RevisaoComRevisorRow } from '../repositories/revisaoRepository';
import { TarefaDetalhadaRow } from '../repositories/tarefaRepository';
import { UsuarioRow } from '../repositories/usuarioRepository';

export const usuarioDto = (u: Pick<UsuarioRow, 'id' | 'nome' | 'email'>) => ({ id: u.id, nome: u.nome, email: u.email });

export const pessoa = (id: number | null, nome: string | null | undefined) =>
  id != null && nome ? { id, nome } : null;

export function progresso(total: number, concluidas: number) {
  return { total, concluidas, percentual: total === 0 ? 0 : Math.round((concluidas / total) * 100) };
}

export function grupoBaseDto(g: GrupoRow, representanteNome: string, usuarioId: number) {
  return {
    id: g.id,
    titulo: g.titulo,
    objetivo: g.objetivo,
    prazoFinal: isoLocal(g.prazo_final),
    limiteMembros: g.limite_membros,
    status: g.status,
    criadoEm: isoLocal(g.criado_em),
    finalizadoEm: isoLocal(g.finalizado_em),
    representante: { id: g.representante_id, nome: representanteNome },
    souRepresentante: g.representante_id === usuarioId,
  };
}

export function membroDto(m: MembroRow, g: GrupoRow) {
  return {
    id: m.id,
    nome: m.nome,
    email: m.email,
    representante: m.id === g.representante_id,
    entrouEm: isoLocal(m.entrou_em),
  };
}

export function convitePendenteDoGrupoDto(c: ConvitePendenteDoGrupoRow) {
  return {
    id: c.id,
    convidado: { id: c.convidado_id, nome: c.convidado_nome, email: c.convidado_email },
    criadoEm: isoLocal(c.criado_em),
  };
}

export function conviteDoUsuarioDto(c: ConviteDoUsuarioRow) {
  return {
    id: c.id,
    status: c.status,
    criadoEm: isoLocal(c.criado_em),
    grupo: {
      id: c.grupo_id,
      titulo: c.grupo_titulo,
      objetivo: c.grupo_objetivo,
      prazoFinal: isoLocal(c.grupo_prazo_final),
      representante: c.representante_nome,
      totalMembros: c.total_membros,
      limiteMembros: c.limite_membros,
    },
  };
}

export function tarefaDto(t: TarefaDetalhadaRow, grupo: GrupoRow, representanteNome: string, agora = new Date()) {
  const tarefaDoRepresentante = t.responsavel_id === grupo.representante_id;
  const revisor = tarefaDoRepresentante
    ? pessoa(t.revisor_id, t.revisor_nome)
    : { id: grupo.representante_id, nome: representanteNome };
  return {
    id: t.id,
    grupoId: t.grupo_id,
    titulo: t.titulo,
    descricao: t.descricao,
    prazo: isoLocal(t.prazo),
    status: t.status,
    rotuloStatus: ROTULO_STATUS[t.status],
    atrasada: estaAtrasada(t.status, t.prazo, agora),
    entregueComAtraso: t.entregue_com_atraso,
    responsavel: { id: t.responsavel_id, nome: t.responsavel_nome },
    revisor,
    precisaIndicarRevisor: tarefaDoRepresentante && t.revisor_id == null,
    totalEntregas: t.total_entregas,
    totalCorrecoes: t.total_correcoes,
    criadoEm: isoLocal(t.criado_em),
  };
}

export function entregaDto(e: EntregaComAutorRow) {
  return {
    id: e.id,
    tarefaId: e.tarefa_id,
    autor: { id: e.autor_id, nome: e.autor_nome },
    comentario: e.comentario,
    link: e.link,
    arquivo: e.arquivo_caminho
      ? { nome: e.arquivo_nome, tipo: e.arquivo_tipo, tamanho: e.arquivo_tamanho, url: `/api/entregas/${e.id}/arquivo` }
      : null,
    enviadaEm: isoLocal(e.enviada_em),
    comAtraso: e.com_atraso,
  };
}

export function revisaoDto(r: RevisaoComRevisorRow) {
  return {
    id: r.id,
    entregaId: r.entrega_id,
    revisor: { id: r.revisor_id, nome: r.revisor_nome },
    resultado: r.resultado,
    motivo: r.motivo,
    revisadaEm: isoLocal(r.revisada_em),
  };
}

export function eventoDto(e: EventoComUsuarioRow) {
  return {
    id: e.id,
    tipo: e.tipo,
    descricao: e.descricao,
    usuario: pessoa(e.usuario_id, e.usuario_nome),
    tarefa: e.tarefa_id != null ? { id: e.tarefa_id, titulo: e.tarefa_titulo } : null,
    criadoEm: isoLocal(e.criado_em),
  };
}
