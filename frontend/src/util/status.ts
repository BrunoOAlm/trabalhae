import type { StatusTarefa } from '../api/tipos';

/** Cores por status, conforme definido no projeto. */
export const COR_STATUS: Record<StatusTarefa, { ponto: string; selo: string; coluna: string; rotulo: string }> = {
  PENDENTE: {
    rotulo: 'Pendente',
    ponto: 'bg-slate-400',
    selo: 'bg-slate-100 text-slate-700 ring-slate-300',
    coluna: 'bg-slate-50',
  },
  EM_ANDAMENTO: {
    rotulo: 'Em andamento',
    ponto: 'bg-blue-500',
    selo: 'bg-blue-50 text-blue-800 ring-blue-200',
    coluna: 'bg-blue-50/50',
  },
  ENVIADA: {
    rotulo: 'Enviada',
    ponto: 'bg-purple-500',
    selo: 'bg-purple-50 text-purple-800 ring-purple-200',
    coluna: 'bg-purple-50/50',
  },
  EM_REVISAO: {
    rotulo: 'Em revisão',
    ponto: 'bg-amber-400',
    selo: 'bg-amber-50 text-amber-800 ring-amber-200',
    coluna: 'bg-amber-50/60',
  },
  EM_CORRECAO: {
    rotulo: 'Em correção',
    ponto: 'bg-orange-500',
    selo: 'bg-orange-50 text-orange-800 ring-orange-200',
    coluna: 'bg-orange-50/50',
  },
  CONCLUIDA: {
    rotulo: 'Concluída',
    ponto: 'bg-emerald-500',
    selo: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    coluna: 'bg-emerald-50/50',
  },
};

export const SELO_ATRASADA = 'bg-red-50 text-red-700 ring-red-200';
