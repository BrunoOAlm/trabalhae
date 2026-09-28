import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, criarAluno, criarGrupo, entrarNoGrupo, limparBanco, pool } from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

async function base(limite = 3) {
  const ana = await criarAluno('Ana');
  const bruno = await criarAluno('Bruno');
  const grupoId = await criarGrupo(ana, { limiteMembros: limite });
  return { ana, bruno, grupoId };
}

describe('Membros e convites', () => {
  it('RN11: o aluno só vira membro depois de aceitar', async () => {
    const { ana, bruno, grupoId } = await base();
    const convite = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    expect(convite.status).toBe(201);
    expect((await api().get(`/api/grupos/${grupoId}`).set(auth(bruno))).status).toBe(403);

    const meus = await api().get('/api/convites').set(auth(bruno));
    expect(meus.body).toHaveLength(1);
    expect(meus.body[0].grupo).toMatchObject({ id: grupoId, representante: 'Ana' });

    expect((await api().post(`/api/convites/${convite.body.id}/aceitar`).set(auth(bruno))).status).toBe(200);
    expect((await api().get(`/api/grupos/${grupoId}`).set(auth(bruno))).status).toBe(200);
    expect((await api().get('/api/convites').set(auth(bruno))).body).toHaveLength(0);
  });

  it('RN11: não permite convite pendente duplicado', async () => {
    const { ana, bruno, grupoId } = await base();
    await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    const dup = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    expect(dup.status).toBe(422);
    expect(dup.body.mensagem).toMatch(/convite pendente/);
  });

  it('não convida quem já é membro nem e-mail sem cadastro', async () => {
    const { ana, bruno, grupoId } = await base();
    await entrarNoGrupo(grupoId, ana, bruno);
    expect((await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email })).status).toBe(422);
    const semCadastro = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: 'ninguem@x.com' });
    expect(semCadastro.status).toBe(404);
  });

  it('RN09: aceitar com o grupo cheio retorna erro', async () => {
    const { ana, bruno, grupoId } = await base(2);
    const carla = await criarAluno('Carla');
    const c1 = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    const c2 = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: carla.email });
    expect((await api().post(`/api/convites/${c1.body.id}/aceitar`).set(auth(bruno))).status).toBe(200);
    const cheio = await api().post(`/api/convites/${c2.body.id}/aceitar`).set(auth(carla));
    expect(cheio.status).toBe(422);
    expect(cheio.body.mensagem).toMatch(/completo/);
  });

  it('RN09: não convida quando o grupo já está no limite', async () => {
    const { ana, bruno, grupoId } = await base(2);
    await entrarNoGrupo(grupoId, ana, bruno);
    const carla = await criarAluno('Carla');
    const res = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: carla.email });
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/limite de 2 membros/);
  });

  it('só o representante convida e só o convidado responde', async () => {
    const { ana, bruno, grupoId } = await base();
    await entrarNoGrupo(grupoId, ana, bruno);
    const carla = await criarAluno('Carla');
    expect((await api().post(`/api/grupos/${grupoId}/convites`).set(auth(bruno)).send({ email: carla.email })).status).toBe(403);
    const c = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: carla.email });
    expect((await api().post(`/api/convites/${c.body.id}/aceitar`).set(auth(bruno))).status).toBe(403);
  });

  it('recusar encerra o convite e permite novo convite depois', async () => {
    const { ana, bruno, grupoId } = await base();
    const c = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    expect((await api().post(`/api/convites/${c.body.id}/recusar`).set(auth(bruno))).status).toBe(204);
    expect((await api().post(`/api/convites/${c.body.id}/aceitar`).set(auth(bruno))).status).toBe(422);
    expect((await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email })).status).toBe(201);
  });

  it('convites pendentes aparecem no detalhe do grupo', async () => {
    const { ana, bruno, grupoId } = await base();
    await api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: bruno.email });
    const res = await api().get(`/api/grupos/${grupoId}`).set(auth(ana));
    expect(res.body.convitesPendentes).toEqual([
      expect.objectContaining({ convidado: { id: bruno.id, nome: 'Bruno', email: bruno.email } }),
    ]);
  });
});
