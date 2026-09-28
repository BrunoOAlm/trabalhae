import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  cenario,
  criarAluno,
  criarGrupo,
  criarTarefa,
  DIA,
  daqui,
  entrarNoGrupo,
  limparBanco,
  pool,
} from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

describe('Grupo e representante', () => {
  it('RN01: quem cria o grupo vira representante e membro', async () => {
    const ana = await criarAluno('Ana');
    const grupoId = await criarGrupo(ana);
    const res = await api().get(`/api/grupos/${grupoId}`).set(auth(ana));
    expect(res.status).toBe(200);
    expect(res.body.representante).toEqual({ id: ana.id, nome: 'Ana' });
    expect(res.body.souRepresentante).toBe(true);
    expect(res.body.membros).toEqual([expect.objectContaining({ id: ana.id, representante: true })]);
  });

  it('RN05: título, objetivo e prazo são obrigatórios', async () => {
    const ana = await criarAluno('Ana');
    const semObjetivo = await api()
      .post('/api/grupos')
      .set(auth(ana))
      .send({ titulo: 'X', objetivo: '  ', prazoFinal: daqui(DIA), limiteMembros: 3 });
    expect(semObjetivo.status).toBe(400);
    expect(semObjetivo.body.mensagem).toBe('Objetivo é obrigatório.');
    const semPrazo = await api().post('/api/grupos').set(auth(ana)).send({ titulo: 'X', objetivo: 'Y', limiteMembros: 3 });
    expect(semPrazo.status).toBe(400);
  });

  it('RN06: o prazo final precisa ser futuro', async () => {
    const ana = await criarAluno('Ana');
    const res = await api()
      .post('/api/grupos')
      .set(auth(ana))
      .send({ titulo: 'X', objetivo: 'Y', prazoFinal: daqui(-DIA), limiteMembros: 3 });
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/data futura/);
  });

  it('RN02 + RN03: transfere a função e mantém um único representante', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const res = await api()
      .post(`/api/grupos/${grupoId}/transferir-representante`)
      .set(auth(ana))
      .send({ novoRepresentanteId: bruno.id });
    expect(res.status).toBe(200);
    expect(res.body.representante.id).toBe(bruno.id);
    expect(res.body.membros.filter((m: { representante: boolean }) => m.representante)).toHaveLength(1);
    // a Ana perdeu os poderes de representante
    const tarefa = await api()
      .post(`/api/grupos/${grupoId}/tarefas`)
      .set(auth(ana))
      .send({ titulo: 'T', prazo: daqui(DIA), responsavelId: bruno.id });
    expect(tarefa.status).toBe(403);
  });

  it('RN03: só transfere para quem é membro, e só o representante transfere', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const fora = await criarAluno('Fora');
    const r1 = await api()
      .post(`/api/grupos/${grupoId}/transferir-representante`)
      .set(auth(ana))
      .send({ novoRepresentanteId: fora.id });
    expect(r1.status).toBe(403);
    const r2 = await api()
      .post(`/api/grupos/${grupoId}/transferir-representante`)
      .set(auth(bruno))
      .send({ novoRepresentanteId: bruno.id });
    expect(r2.status).toBe(403);
  });

  it('RN04: o representante não sai sem transferir a função', async () => {
    const { ana, grupoId } = await cenario();
    const res = await api().post(`/api/grupos/${grupoId}/sair`).set(auth(ana));
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/transferir a função/);
  });

  it('membro sem tarefas pode sair; com tarefas, não', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    await criarTarefa(grupoId, ana, bruno);
    expect((await api().post(`/api/grupos/${grupoId}/sair`).set(auth(bruno))).status).toBe(422);
    expect((await api().post(`/api/grupos/${grupoId}/sair`).set(auth(carla))).status).toBe(204);
    expect((await api().get(`/api/grupos/${grupoId}`).set(auth(carla))).status).toBe(403);
  });

  it('só membros acessam o grupo (403 para os demais)', async () => {
    const { grupoId } = await cenario();
    const estranho = await criarAluno('Estranho');
    for (const rota of ['', '/painel', '/historico', '/relatorio']) {
      const res = await api().get(`/api/grupos/${grupoId}${rota}`).set(auth(estranho));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ status: 403, erro: 'Acesso negado', mensagem: 'Você não participa deste grupo.' });
    }
  });

  it('RN10: o limite não pode ficar abaixo do número de membros', async () => {
    const { ana, grupoId } = await cenario();
    const res = await api()
      .put(`/api/grupos/${grupoId}`)
      .set(auth(ana))
      .send({ titulo: 'T', objetivo: 'O', prazoFinal: daqui(30 * DIA), limiteMembros: 2 });
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/quantidade atual de membros \(3\)/);
  });

  it('só o representante edita o trabalho', async () => {
    const { bruno, grupoId } = await cenario();
    const res = await api()
      .put(`/api/grupos/${grupoId}`)
      .set(auth(bruno))
      .send({ titulo: 'T', objetivo: 'O', prazoFinal: daqui(30 * DIA), limiteMembros: 4 });
    expect(res.status).toBe(403);
  });

  it('não permite encurtar o prazo final para antes das tarefas (RN16)', async () => {
    const { ana, bruno, grupoId } = await cenario();
    await criarTarefa(grupoId, ana, bruno, { prazo: daqui(10 * DIA) });
    const res = await api()
      .put(`/api/grupos/${grupoId}`)
      .set(auth(ana))
      .send({ titulo: 'T', objetivo: 'O', prazoFinal: daqui(5 * DIA), limiteMembros: 4 });
    expect(res.status).toBe(422);
  });

  it('lista os grupos do usuário com progresso', async () => {
    const { ana, bruno, grupoId } = await cenario();
    await criarTarefa(grupoId, ana, bruno);
    const outro = await criarAluno('Outro');
    await criarGrupo(outro);
    const res = await api().get('/api/grupos').set(auth(bruno));
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: grupoId, souRepresentante: false, totalMembros: 3 });
    expect(res.body[0].progresso).toEqual({ total: 1, concluidas: 0, percentual: 0 });
  });

  it('entrarNoGrupo registra o membro', async () => {
    const ana = await criarAluno('Ana');
    const bruno = await criarAluno('Bruno');
    const grupoId = await criarGrupo(ana);
    await entrarNoGrupo(grupoId, ana, bruno);
    const res = await api().get(`/api/grupos/${grupoId}`).set(auth(bruno));
    expect(res.body.membros).toHaveLength(2);
  });
});
