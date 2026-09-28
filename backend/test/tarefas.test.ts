import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  cenario,
  criarAluno,
  criarTarefa,
  DIA,
  daqui,
  enviarLink,
  limparBanco,
  pool,
} from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

describe('Tarefas e responsáveis', () => {
  it('RN12: somente o representante cria tarefas', async () => {
    const { bruno, carla, grupoId } = await cenario();
    const res = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(bruno))
      .send({ titulo: 'T', prazo: daqui(DIA), responsavelId: carla.id });
    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/Somente o representante/);
  });

  it('RN13: a tarefa nasce com exatamente um responsável', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const semResp = await api().post(`/api/grupos/${grupoId}/tarefas`).set(auth(ana)).send({ titulo: 'T', prazo: daqui(DIA) });
    expect(semResp.status).toBe(400);
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await api().get(`/api/tarefas/${id}`).set(auth(bruno));
    expect(res.body.responsavel).toEqual({ id: bruno.id, nome: 'Bruno' });
    expect(res.body.status).toBe('PENDENTE');
  });

  it('RN14: o responsável precisa ser membro do grupo', async () => {
    const { ana, grupoId } = await cenario();
    const fora = await criarAluno('Fora');
    const res = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'T', prazo: daqui(DIA), responsavelId: fora.id });
    expect(res.status).toBe(403);
    expect(res.body.mensagem).toMatch(/membro do grupo/);
  });

  it('RN15: o painel mostra os membros sem tarefa', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    await criarTarefa(grupoId, ana, bruno);
    const res = await api().get(`/api/grupos/${grupoId}/painel`).set(auth(ana));
    const semTarefa = res.body.membrosSemTarefa.map((m: { nome: string }) => m.nome).sort();
    expect(semTarefa).toEqual(['Ana', 'Carla'].sort());
    expect(res.body.membros.find((m: { id: number }) => m.id === carla.id).totalTarefas).toBe(0);
  });

  it('RN16: o prazo da tarefa não pode passar do prazo final do trabalho', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const res = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'T', prazo: daqui(60 * DIA), responsavelId: bruno.id });
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/posterior ao prazo final/);
  });

  it('RN24: tarefa do representante exige um revisor que seja outro membro', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const semRevisor = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'Minha', prazo: daqui(DIA), responsavelId: ana.id });
    expect(semRevisor.status).toBe(422);
    const autoRevisao = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'Minha', prazo: daqui(DIA), responsavelId: ana.id, revisorId: ana.id });
    expect(autoRevisao.status).toBe(422);
    const ok = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'Minha', prazo: daqui(DIA), responsavelId: ana.id, revisorId: bruno.id });
    expect(ok.status).toBe(201);
    expect(ok.body.revisor).toEqual({ id: bruno.id, nome: 'Bruno' });
  });

  it('RN17: troca o responsável antes do primeiro envio e registra no histórico', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const troca = await api().put(`/api/tarefas/${id}/responsavel`).set(auth(ana)).send({ responsavelId: carla.id });
    expect(troca.status).toBe(200);
    expect(troca.body.responsavel.id).toBe(carla.id);
    expect(troca.body.historico.map((e: { tipo: string }) => e.tipo)).toContain('RESPONSAVEL_TROCADO');
  });

  it('RN17: depois do primeiro envio o responsável não muda', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    expect((await enviarLink(id, bruno)).status).toBe(201);
    const troca = await api().put(`/api/tarefas/${id}/responsavel`).set(auth(ana)).send({ responsavelId: carla.id });
    expect(troca.status).toBe(422);
    expect(troca.body.mensagem).toMatch(/antes do primeiro envio/);
  });

  it('tarefa com entrega não pode ser excluída; sem entrega pode', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const comEntrega = await criarTarefa(grupoId, ana, bruno);
    await enviarLink(comEntrega, bruno);
    expect((await api().delete(`/api/tarefas/${comEntrega}`).set(auth(ana))).status).toBe(422);
    const semEntrega = await criarTarefa(grupoId, ana, carla);
    expect((await api().delete(`/api/tarefas/${semEntrega}`).set(auth(ana))).status).toBe(204);
    expect((await api().get(`/api/tarefas/${semEntrega}`).set(auth(ana))).status).toBe(404);
  });

  it('só o responsável inicia a tarefa; iniciar duas vezes é transição inválida', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    expect((await api().post(`/api/tarefas/${id}/iniciar`).set(auth(ana))).status).toBe(403);
    const ok = await api().post(`/api/tarefas/${id}/iniciar`).set(auth(bruno));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('EM_ANDAMENTO');
    const de_novo = await api().post(`/api/tarefas/${id}/iniciar`).set(auth(bruno));
    expect(de_novo.status).toBe(422);
  });

  it('RN28: não pula etapas (aprovar sem revisar é rejeitado)', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana));
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/Pendente.*Concluída/);
  });

  it('as permissões do detalhe refletem o papel do usuário', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const doBruno = (await api().get(`/api/tarefas/${id}`).set(auth(bruno))).body.permissoes;
    expect(doBruno).toMatchObject({ podeIniciar: true, podeEnviar: true, podeEditar: false });
    const daAna = (await api().get(`/api/tarefas/${id}`).set(auth(ana))).body.permissoes;
    expect(daAna).toMatchObject({ podeIniciar: false, podeEditar: true, podeTrocarResponsavel: true });
    const daCarla = (await api().get(`/api/tarefas/${id}`).set(auth(carla))).body.permissoes;
    expect(daCarla).toMatchObject({ podeIniciar: false, podeEnviar: false, podeEditar: false });
  });

  it('edita dados da tarefa, mas não depois de concluída', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await api()
      .put(`/api/tarefas/${id}`)
      .set(auth(ana))
      .send({ titulo: 'Novo título', descricao: 'Nova', prazo: daqui(3 * DIA) });
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe('Novo título');
  });
});
