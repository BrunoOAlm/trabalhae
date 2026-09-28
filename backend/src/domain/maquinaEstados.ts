import { regra } from '../errors';

export const STATUS_TAREFA = [
  'PENDENTE',
  'EM_ANDAMENTO',
  'ENVIADA',
  'EM_REVISAO',
  'EM_CORRECAO',
  'CONCLUIDA',
] as const;

export type StatusTarefa = (typeof STATUS_TAREFA)[number];

export const ROTULO_STATUS: Record<StatusTarefa, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  ENVIADA: 'Enviada',
  EM_REVISAO: 'Em revisão',
  EM_CORRECAO: 'Em correção',
  CONCLUIDA: 'Concluída',
};

/**
 * Transições permitidas (RN27 e RN28). Qualquer outra é rejeitada com 422.
 * - PENDENTE → EM_ANDAMENTO           (responsável inicia)
 * - PENDENTE | EM_ANDAMENTO → ENVIADA (responsável envia)
 * - ENVIADA → EM_REVISAO              (revisor inicia a revisão)
 * - EM_REVISAO → CONCLUIDA            (revisor aprova)
 * - EM_REVISAO → EM_CORRECAO          (revisor pede correção)
 * - EM_CORRECAO → ENVIADA             (responsável reenvia)
 */
const TRANSICOES: Record<StatusTarefa, readonly StatusTarefa[]> = {
  PENDENTE: ['EM_ANDAMENTO', 'ENVIADA'],
  EM_ANDAMENTO: ['ENVIADA'],
  ENVIADA: ['EM_REVISAO'],
  EM_REVISAO: ['CONCLUIDA', 'EM_CORRECAO'],
  EM_CORRECAO: ['ENVIADA'],
  CONCLUIDA: [],
};

export function podeTransitar(de: StatusTarefa, para: StatusTarefa): boolean {
  return TRANSICOES[de].includes(para);
}

/** Valida a transição e devolve o novo status; lança 422 se não for permitida. */
export function transitar(de: StatusTarefa, para: StatusTarefa): StatusTarefa {
  if (!podeTransitar(de, para)) {
    throw regra(
      `Não é possível mudar a tarefa de "${ROTULO_STATUS[de]}" para "${ROTULO_STATUS[para]}".`,
    );
  }
  return para;
}

/** RN21: tarefa ainda não enviada cujo prazo já passou. */
export function estaAtrasada(status: StatusTarefa, prazo: Date, agora: Date = new Date()): boolean {
  return (status === 'PENDENTE' || status === 'EM_ANDAMENTO') && prazo.getTime() < agora.getTime();
}
