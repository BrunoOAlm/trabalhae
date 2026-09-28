import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, cenario, criarTarefa, DIA, daqui, enviarLink, limparBanco, pool } from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

describe('Revisão', () => {
  it('RN23: o representante revisa as entregas dos membros', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(id, bruno);
    const inicio = await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    expect(inicio.status).toBe(200);
    expect(inicio.body.status).toBe('EM_REVISAO');
    const aprovada = await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana));
    expect(aprovada.body.status).toBe('CONCLUIDA');
    expect(aprovada.body.revisoes).toEqual([expect.objectContaining({ resultado: 'APROVADA', revisor: { id: ana.id, nome: 'Ana' } })]);
  });

  it('RN23: outro membro não pode revisar', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(id, bruno);
    const res = await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(carla));
    expect(res.status).toBe(403);
    expect(res.body.mensagem).toBe('Somente Ana pode revisar esta tarefa.');
  });

  it('RN24: o autor nunca revisa a própria tarefa', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(id, bruno);
    const res = await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(bruno));
    expect(res.status).toBe(403);
    expect(res.body.mensagem).toBe('Ninguém pode revisar a própria tarefa.');
  });

  it('RN24: a tarefa do representante é revisada pelo membro indicado', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, ana, { revisorId: bruno.id });
    await enviarLink(id, ana);
    expect((await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana))).status).toBe(403);
    expect((await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(carla))).status).toBe(403);
    expect((await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(bruno))).status).toBe(200);
    expect((await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(bruno))).body.status).toBe('CONCLUIDA');
  });

  it('RN24: o representante pode trocar o revisor antes da revisão', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, ana, { revisorId: bruno.id });
    const res = await api().put(`/api/tarefas/${id}/revisor`).set(auth(ana)).send({ revisorId: carla.id });
    expect(res.status).toBe(200);
    expect(res.body.revisor.id).toBe(carla.id);
    const proprio = await api().put(`/api/tarefas/${id}/revisor`).set(auth(ana)).send({ revisorId: ana.id });
    expect(proprio.status).toBe(422);
  });

  it('RN25: pedir correção exige motivo', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(id, bruno);
    await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    const semMotivo = await api().post(`/api/tarefas/${id}/revisao/correcao`).set(auth(ana)).send({ motivo: '   ' });
    expect(semMotivo.status).toBe(422);
    expect(semMotivo.body.mensagem).toBe('Informe o motivo da correção.');
  });

  it('RN26: após a correção a tarefa volta para revisão e só conclui com aprovação', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(id, bruno);
    await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    const correcao = await api()
      .post(`/api/tarefas/${id}/revisao/correcao`)
      .set(auth(ana))
      .send({ motivo: 'Faltou a conclusão.' });
    expect(correcao.body.status).toBe('EM_CORRECAO');

    // em correção não dá para aprovar direto
    expect((await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana))).status).toBe(422);

    const reenvio = await enviarLink(id, bruno);
    expect(reenvio.body.status).toBe('ENVIADA');
    expect(reenvio.body.entregas).toHaveLength(2); // RF11: a entrega anterior continua no histórico

    await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    const fim = await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana));
    expect(fim.body.status).toBe('CONCLUIDA');
    expect(fim.body.totalCorrecoes).toBe(1);
    expect(fim.body.revisoes.map((r: { resultado: string }) => r.resultado)).toEqual(['CORRECAO', 'APROVADA']);
    const tipos = fim.body.historico.map((e: { tipo: string }) => e.tipo);
    expect(tipos).toEqual(
      expect.arrayContaining(['ENTREGA_ENVIADA', 'REVISAO_INICIADA', 'CORRECAO_SOLICITADA', 'TAREFA_APROVADA']),
    );
  });

  it('não é possível enviar de novo uma tarefa já concluída', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno, { prazo: daqui(2 * DIA) });
    await enviarLink(id, bruno);
    await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana));
    expect((await enviarLink(id, bruno)).status).toBe(422);
  });
});
