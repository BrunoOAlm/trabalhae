import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { registrarAtrasos } from '../src/jobs/atrasos';
import {
  api,
  auth,
  cenario,
  criarTarefa,
  enviarLink,
  limparBanco,
  pool,
  vencerPrazo,
} from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

describe('Entregas', () => {
  it('RN18: somente o responsável envia a entrega', async () => {
    const { ana, bruno, carla, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    expect((await enviarLink(id, carla)).status).toBe(403);
    expect((await enviarLink(id, ana)).status).toBe(403);
    const ok = await enviarLink(id, bruno);
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe('ENVIADA');
  });

  it('exige arquivo ou link, e o link precisa ser válido', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const vazio = await api().post(`/api/tarefas/${id}/entregas`).set(auth(bruno)).field('comentario', 'oi');
    expect(vazio.status).toBe(400);
    const linkRuim = await api().post(`/api/tarefas/${id}/entregas`).set(auth(bruno)).field('link', 'isso não é link');
    expect(linkRuim.status).toBe(400);
  });

  it('aceita PDF, guarda e permite baixar para membros do grupo', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await api()
      .post(`/api/tarefas/${id}/entregas`)
      .set(auth(bruno))
      .attach('arquivo', PDF, { filename: 'relatório.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    const entrega = res.body.entregas[0];
    expect(entrega.arquivo).toMatchObject({ nome: 'relatório.pdf', tipo: 'application/pdf' });
    const download = await api().get(entrega.arquivo.url).set(auth(ana));
    expect(download.status).toBe(200);
    expect(Buffer.from(download.body).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('rejeita formatos não permitidos', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await api()
      .post(`/api/tarefas/${id}/entregas`)
      .set(auth(bruno))
      .attach('arquivo', Buffer.from('MZ...'), { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/PDF, DOCX, PNG ou JPG/);
  });

  it('rejeita arquivos acima de 10 MB', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const grande = Buffer.alloc(10 * 1024 * 1024 + 10, 1);
    const res = await api()
      .post(`/api/tarefas/${id}/entregas`)
      .set(auth(bruno))
      .attach('arquivo', grande, { filename: 'grande.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/10 MB/);
  });

  it('RN19: a entrega registra data, hora e autor, e não pode ser alterada no banco', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await enviarLink(id, bruno);
    const entrega = res.body.entregas[0];
    expect(entrega.autor).toEqual({ id: bruno.id, nome: 'Bruno' });
    expect(entrega.enviadaEm).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    await expect(pool.query('UPDATE entrega SET comentario = $1', ['adulterado'])).rejects.toThrow(/imutável/);
    await expect(pool.query('DELETE FROM entrega')).rejects.toThrow(/imutável/);
  });

  it('RN20 + RN22: entrega após o prazo é aceita e marcada para sempre', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await vencerPrazo(id);
    const res = await enviarLink(id, bruno);
    expect(res.status).toBe(201);
    expect(res.body.entregueComAtraso).toBe(true);
    expect(res.body.entregas[0].comAtraso).toBe(true);
    expect(res.body.historico.map((e: { tipo: string }) => e.tipo)).toContain('ENTREGA_COM_ATRASO');
    // mesmo depois de aprovada, a marca continua
    await api().post(`/api/tarefas/${id}/revisao/iniciar`).set(auth(ana));
    const aprovada = await api().post(`/api/tarefas/${id}/revisao/aprovar`).set(auth(ana));
    expect(aprovada.body.status).toBe('CONCLUIDA');
    expect(aprovada.body.entregueComAtraso).toBe(true);
  });

  it('entrega no prazo não é marcada', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    const res = await enviarLink(id, bruno);
    expect(res.body.entregueComAtraso).toBe(false);
  });

  it('RN21: tarefa sem entrega após o prazo aparece como atrasada e o job registra uma única vez', async () => {
    const { ana, bruno, grupoId } = await cenario();
    const id = await criarTarefa(grupoId, ana, bruno);
    await vencerPrazo(id);
    const detalhe = await api().get(`/api/tarefas/${id}`).set(auth(bruno));
    expect(detalhe.body.atrasada).toBe(true);
    expect(await registrarAtrasos()).toBe(1);
    expect(await registrarAtrasos()).toBe(0);
    const historico = await api().get(`/api/grupos/${grupoId}/historico`).set(auth(bruno));
    expect(historico.body.filter((e: { tipo: string }) => e.tipo === 'TAREFA_ATRASADA')).toHaveLength(1);
  });
});
