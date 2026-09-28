import { http } from './cliente';
import type {
  Evento,
  GrupoDetalhe,
  GrupoResumo,
  MeuConvite,
  Painel,
  Relatorio,
  TarefaDetalhe,
  Usuario,
} from './tipos';

type Sessao = { token: string; usuario: Usuario };

export interface DadosGrupo {
  titulo: string;
  objetivo: string;
  prazoFinal: string;
  limiteMembros: number;
}

export interface DadosTarefa {
  titulo: string;
  descricao: string;
  prazo: string;
}

export const authApi = {
  cadastrar: (d: { nome: string; email: string; senha: string }) => http.post<Sessao>('/auth/cadastro', d),
  login: (d: { email: string; senha: string }) => http.post<Sessao>('/auth/login', d),
  me: () => http.get<Usuario>('/auth/me'),
};

export const grupoApi = {
  listar: () => http.get<GrupoResumo[]>('/grupos'),
  criar: (d: DadosGrupo) => http.post<GrupoDetalhe>('/grupos', d),
  detalhar: (id: number) => http.get<GrupoDetalhe>(`/grupos/${id}`),
  atualizar: (id: number, d: DadosGrupo) => http.put<GrupoDetalhe>(`/grupos/${id}`, d),
  transferir: (id: number, novoRepresentanteId: number) =>
    http.post<GrupoDetalhe>(`/grupos/${id}/transferir-representante`, { novoRepresentanteId }),
  sair: (id: number) => http.post<void>(`/grupos/${id}/sair`),
  finalizar: (id: number) => http.post<GrupoDetalhe>(`/grupos/${id}/finalizar`),
  painel: (id: number) => http.get<Painel>(`/grupos/${id}/painel`),
  historico: (id: number) => http.get<Evento[]>(`/grupos/${id}/historico`),
  relatorio: (id: number) => http.get<Relatorio>(`/grupos/${id}/relatorio`),
  convidar: (id: number, email: string) => http.post<unknown>(`/grupos/${id}/convites`, { email }),
};

export const conviteApi = {
  meus: () => http.get<MeuConvite[]>('/convites'),
  aceitar: (id: number) => http.post<{ grupoId: number }>(`/convites/${id}/aceitar`),
  recusar: (id: number) => http.post<void>(`/convites/${id}/recusar`),
};

export const tarefaApi = {
  criar: (grupoId: number, d: DadosTarefa & { responsavelId: number; revisorId?: number | null }) =>
    http.post<TarefaDetalhe>(`/grupos/${grupoId}/tarefas`, d),
  detalhar: (id: number) => http.get<TarefaDetalhe>(`/tarefas/${id}`),
  atualizar: (id: number, d: DadosTarefa) => http.put<TarefaDetalhe>(`/tarefas/${id}`, d),
  excluir: (id: number) => http.delete<void>(`/tarefas/${id}`),
  trocarResponsavel: (id: number, responsavelId: number, revisorId?: number | null) =>
    http.put<TarefaDetalhe>(`/tarefas/${id}/responsavel`, { responsavelId, revisorId }),
  definirRevisor: (id: number, revisorId: number) => http.put<TarefaDetalhe>(`/tarefas/${id}/revisor`, { revisorId }),
  iniciar: (id: number) => http.post<TarefaDetalhe>(`/tarefas/${id}/iniciar`),
  enviar: (id: number, dados: FormData) => http.post<TarefaDetalhe>(`/tarefas/${id}/entregas`, dados),
  iniciarRevisao: (id: number) => http.post<TarefaDetalhe>(`/tarefas/${id}/revisao/iniciar`),
  aprovar: (id: number) => http.post<TarefaDetalhe>(`/tarefas/${id}/revisao/aprovar`),
  pedirCorrecao: (id: number, motivo: string) => http.post<TarefaDetalhe>(`/tarefas/${id}/revisao/correcao`, { motivo }),
};
