import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  api,
  auth,
  cenario,
  concluirTarefa,
  criarAluno,
  criarTarefa,
  DIA,
  daqui,
  enviarLink,
  limparBanco,
  pool,
  vencerPrazo,
} from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

/** Grupo com uma tarefa concluída para cada membro (Ana revisada por Bruno). */
async function grupoPronto() {
  const c = await cenario();
  const tBruno = await criarTarefa(c.grupoId, c.ana, c.bruno, { titulo: 'Parte do Bruno' });
  const tCarla = await criarTarefa(c.grupoId, c.ana, c.carla, { titulo: 'Parte da Carla' });
  const tAna = await criarTarefa(c.grupoId, c.ana, c.ana, { titulo: 'Parte da Ana', revisorId: c.bruno.id });
  await vencerPrazo(tCarla); // Carla entrega atrasada
  await concluirTarefa(tBruno, c.bruno, c.ana);
  await concluirTarefa(tCarla, c.carla, c.ana);
  await concluirTarefa(tAna, c.ana, c.bruno);
  return { ...c, tBruno, tCarla, tAna };
}

describe('Finalização', () => {
  it('RN29: não finaliza sem tarefas', async () => {
    const { ana, grupoId } = await cenario();
    const res = await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/pelo menos uma tarefa/);
  });

  it('RN29: não finaliza com tarefas abertas', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    await criarTarefa(grupoId, ana, bruno);
    await criarTarefa(grupoId, ana, carla);
    await criarTarefa(grupoId, ana, ana, { revisorId: bruno.id });
    const res = await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/3 tarefas não concluídas/);
  });

  it('RN15: não finaliza com membro sem tarefa', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const t = await criarTarefa(grupoId, ana, bruno);
    await concluirTarefa(t, bruno, ana);
    const res = await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    expect(res.status).toBe(422);
    expect(res.body.mensagem).toMatch(/Todo membro precisa ter pelo menos uma tarefa: .*Carla/);
  });

  it('só o representante finaliza', async () => {
    const { bruno, grupoId } = await grupoPronto();
    expect((await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(bruno))).status).toBe(403);
  });

  it('finaliza quando tudo está concluído', async () => {
    const { ana, grupoId } = await grupoPronto();
    const res = await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('FINALIZADO');
    expect(res.body.finalizadoEm).toBeTruthy();
  });

  it('RN30: depois de finalizado, qualquer escrita retorna 409', async () => {
    const { ana, bruno, tBruno, grupoId } = await grupoPronto();
    await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    const novato = await criarAluno('Novato');
    const tentativas = [
      api().put(`/api/grupos/${grupoId}`).set(auth(ana)).send({ titulo: 'X', objetivo: 'Y', prazoFinal: daqui(40 * DIA), limiteMembros: 5 }),
      api().post(`/api/grupos/${grupoId}/tarefas`).set(auth(ana)).send({ titulo: 'T', prazo: daqui(DIA), responsavelId: bruno.id }),
      api().post(`/api/grupos/${grupoId}/convites`).set(auth(ana)).send({ email: novato.email }),
      api().put(`/api/tarefas/${tBruno}`).set(auth(ana)).send({ titulo: 'T', prazo: daqui(DIA) }),
      api().delete(`/api/tarefas/${tBruno}`).set(auth(ana)),
      enviarLink(tBruno, bruno),
      api().post(`/api/grupos/${grupoId}/transferir-representante`).set(auth(ana)).send({ novoRepresentanteId: bruno.id }),
      api().post(`/api/grupos/${grupoId}/sair`).set(auth(bruno)),
      api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana)),
    ];
    for (const t of tentativas) {
      const res = await t;
      expect(res.status).toBe(409);
      expect(res.body.mensagem).toBe('Este trabalho já foi finalizado e não pode mais ser alterado.');
    }
  });

  it('RN31: todos os membros consultam o histórico completo', async () => {
    const { carla, grupoId } = await grupoPronto();
    const res = await api().get(`/api/grupos/${grupoId}/historico`).set(auth(carla));
    expect(res.status).toBe(200);
    const tipos = new Set(res.body.map((e: { tipo: string }) => e.tipo));
    for (const tipo of ['GRUPO_CRIADO', 'MEMBRO_CONVIDADO', 'CONVITE_ACEITO', 'TAREFA_CRIADA', 'RESPONSAVEL_ATRIBUIDO',
      'ENTREGA_ENVIADA', 'ENTREGA_COM_ATRASO', 'REVISAO_INICIADA', 'TAREFA_APROVADA']) {
      expect(tipos).toContain(tipo);
    }
    // mais recente primeiro
    const datas = res.body.map((e: { criadoEm: string }) => Date.parse(e.criadoEm));
    expect([...datas].sort((a, b) => b - a)).toEqual(datas);
  });

  it('RN32: o relatório final mostra responsáveis, entregas, atrasos e correções por membro', async () => {
    const { ana, grupoId } = await grupoPronto();
    const previa = await api().get(`/api/grupos/${grupoId}/relatorio`).set(auth(ana));
    expect(previa.body.final).toBe(false);

    await api().post(`/api/grupos/${grupoId}/finalizar`).set(auth(ana));
    const res = await api().get(`/api/grupos/${grupoId}/relatorio`).set(auth(ana));
    expect(res.status).toBe(200);
    expect(res.body.final).toBe(true);
    expect(res.body.resumo).toMatchObject({ totalTarefas: 3, concluidas: 3, entregasComAtraso: 1 });
    const carla = res.body.membros.find((m: { nome: string }) => m.nome === 'Carla');
    expect(carla.totais).toMatchObject({ tarefas: 1, concluidas: 1, entregasComAtraso: 1 });
    expect(carla.tarefas[0]).toMatchObject({ titulo: 'Parte da Carla', entregueComAtraso: true, totalEntregas: 1 });
    expect(carla.tarefas[0].primeiraEntrega).toBeTruthy();
    const anaRel = res.body.membros.find((m: { nome: string }) => m.nome === 'Ana');
    expect(anaRel.tarefas[0].revisor.nome).toBe('Bruno');
  });

  it('o painel indica quando o trabalho pode ser finalizado', async () => {
    const { ana, grupoId } = await grupoPronto();
    const painel = await api().get(`/api/grupos/${grupoId}/painel`).set(auth(ana));
    expect(painel.body.finalizacao).toEqual({ pode: true, pendencias: [] });
    expect(painel.body.progresso).toEqual({ total: 3, concluidas: 3, percentual: 100 });
  });
});
