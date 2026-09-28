import { describe, expect, it } from 'vitest';
import { estaAtrasada, podeTransitar, STATUS_TAREFA, StatusTarefa, transitar } from '../src/domain/maquinaEstados';

const PERMITIDAS: [StatusTarefa, StatusTarefa][] = [
  ['PENDENTE', 'EM_ANDAMENTO'],
  ['PENDENTE', 'ENVIADA'],
  ['EM_ANDAMENTO', 'ENVIADA'],
  ['ENVIADA', 'EM_REVISAO'],
  ['EM_REVISAO', 'CONCLUIDA'],
  ['EM_REVISAO', 'EM_CORRECAO'],
  ['EM_CORRECAO', 'ENVIADA'],
];

describe('Máquina de estados da tarefa (RN27, RN28)', () => {
  it.each(PERMITIDAS)('permite %s → %s', (de, para) => {
    expect(podeTransitar(de, para)).toBe(true);
    expect(transitar(de, para)).toBe(para);
  });

  const proibidas = STATUS_TAREFA.flatMap((de) =>
    STATUS_TAREFA.filter((para) => !PERMITIDAS.some(([a, b]) => a === de && b === para)).map(
      (para) => [de, para] as [StatusTarefa, StatusTarefa],
    ),
  );

  it.each(proibidas)('rejeita %s → %s com 422', (de, para) => {
    expect(podeTransitar(de, para)).toBe(false);
    expect(() => transitar(de, para)).toThrowError(expect.objectContaining({ status: 422 }));
  });

  it('não permite pular de Pendente direto para Concluída', () => {
    expect(() => transitar('PENDENTE', 'CONCLUIDA')).toThrow(/Pendente.*Concluída/);
  });

  it('Concluída é um estado final', () => {
    for (const para of STATUS_TAREFA) expect(podeTransitar('CONCLUIDA', para)).toBe(false);
  });
});

describe('Atraso calculado (RN21)', () => {
  const ontem = new Date(Date.now() - 86_400_000);
  const amanha = new Date(Date.now() + 86_400_000);

  it('tarefa pendente ou em andamento com prazo vencido está atrasada', () => {
    expect(estaAtrasada('PENDENTE', ontem)).toBe(true);
    expect(estaAtrasada('EM_ANDAMENTO', ontem)).toBe(true);
  });

  it('tarefa dentro do prazo não está atrasada', () => {
    expect(estaAtrasada('PENDENTE', amanha)).toBe(false);
  });

  it('tarefa já enviada deixa de aparecer como atrasada', () => {
    for (const s of ['ENVIADA', 'EM_REVISAO', 'EM_CORRECAO', 'CONCLUIDA'] as StatusTarefa[]) {
      expect(estaAtrasada(s, ontem)).toBe(false);
    }
  });
});
