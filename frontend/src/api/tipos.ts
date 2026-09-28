export type StatusTarefa = 'PENDENTE' | 'EM_ANDAMENTO' | 'ENVIADA' | 'EM_REVISAO' | 'EM_CORRECAO' | 'CONCLUIDA';

export interface Pessoa {
  id: number;
  nome: string;
}

export interface Usuario extends Pessoa {
  email: string;
}

export interface Progresso {
  total: number;
  concluidas: number;
  percentual: number;
}

export interface GrupoBase {
  id: number;
  titulo: string;
  objetivo: string;
  prazoFinal: string;
  limiteMembros: number;
  status: 'ATIVO' | 'FINALIZADO';
  criadoEm: string;
  finalizadoEm: string | null;
  representante: Pessoa;
  souRepresentante: boolean;
}

export interface GrupoResumo extends GrupoBase {
  totalMembros: number;
  progresso: Progresso;
}

export interface Membro extends Usuario {
  representante: boolean;
  entrouEm: string;
}

export interface ConvitePendente {
  id: number;
  convidado: Usuario;
  criadoEm: string;
}

export interface GrupoDetalhe extends GrupoBase {
  membros: Membro[];
  convitesPendentes: ConvitePendente[];
}

export interface MeuConvite {
  id: number;
  criadoEm: string;
  grupo: {
    id: number;
    titulo: string;
    objetivo: string;
    prazoFinal: string;
    representante: string;
    totalMembros: number;
    limiteMembros: number;
  };
}

export interface Tarefa {
  id: number;
  grupoId: number;
  titulo: string;
  descricao: string;
  prazo: string;
  status: StatusTarefa;
  rotuloStatus: string;
  atrasada: boolean;
  entregueComAtraso: boolean;
  responsavel: Pessoa;
  revisor: Pessoa | null;
  precisaIndicarRevisor: boolean;
  totalEntregas: number;
  totalCorrecoes: number;
  criadoEm: string;
}

export interface MembroPainel extends Membro {
  totalTarefas: number;
  tarefasConcluidas: number;
  tarefasAtrasadas: number;
}

export interface Painel {
  grupo: GrupoBase & { totalMembros: number };
  progresso: Progresso;
  colunas: { status: StatusTarefa; rotulo: string; tarefas: Tarefa[] }[];
  membros: MembroPainel[];
  membrosSemTarefa: Pessoa[];
  tarefasSemRevisor: { id: number; titulo: string }[];
  totalAtrasadas: number;
  convitesPendentes: ConvitePendente[];
  finalizacao: { pode: boolean; pendencias: string[] };
}

export interface Entrega {
  id: number;
  tarefaId: number;
  autor: Pessoa;
  comentario: string | null;
  link: string | null;
  arquivo: { nome: string; tipo: string; tamanho: number; url: string } | null;
  enviadaEm: string;
  comAtraso: boolean;
}

export interface Revisao {
  id: number;
  entregaId: number;
  revisor: Pessoa;
  resultado: 'APROVADA' | 'CORRECAO';
  motivo: string | null;
  revisadaEm: string;
}

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

export interface Evento {
  id: number;
  tipo: TipoEvento;
  descricao: string;
  usuario: Pessoa | null;
  tarefa: { id: number; titulo: string | null } | null;
  criadoEm: string;
}

export interface Permissoes {
  souResponsavel: boolean;
  souRevisor: boolean;
  souRepresentante: boolean;
  podeIniciar: boolean;
  podeEnviar: boolean;
  podeIniciarRevisao: boolean;
  podeRevisar: boolean;
  podeEditar: boolean;
  podeExcluir: boolean;
  podeTrocarResponsavel: boolean;
  podeDefinirRevisor: boolean;
}

export interface TarefaDetalhe extends Tarefa {
  grupo: { id: number; titulo: string; status: 'ATIVO' | 'FINALIZADO'; prazoFinal: string; representanteId: number };
  membros: Membro[];
  entregas: Entrega[];
  revisoes: Revisao[];
  historico: Evento[];
  permissoes: Permissoes;
}

export interface TarefaRelatorio {
  id: number;
  titulo: string;
  prazo: string;
  status: StatusTarefa;
  rotuloStatus: string;
  revisor: Pessoa | null;
  totalEntregas: number;
  primeiraEntrega: string | null;
  ultimaEntrega: string | null;
  entregueComAtraso: boolean;
  atrasadaSemEntrega: boolean;
  correcoes: number;
  aprovadaEm: string | null;
}

export interface Relatorio {
  final: boolean;
  geradoEm: string;
  grupo: GrupoBase & { totalMembros: number };
  resumo: { totalTarefas: number; concluidas: number; totalEntregas: number; entregasComAtraso: number; totalCorrecoes: number };
  membros: (Membro & {
    tarefas: TarefaRelatorio[];
    totais: { tarefas: number; concluidas: number; entregasComAtraso: number; atrasadasSemEntrega: number; correcoes: number };
  })[];
}
