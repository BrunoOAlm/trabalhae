import fs from 'node:fs';
import request from 'supertest';
import { criarApp } from '../src/app';
import { config } from '../src/config';
import { pool } from '../src/db/pool';

export const app = criarApp();
export const api = () => request(app);

export const DIA = 24 * 60 * 60 * 1000;
export const daqui = (ms: number) => new Date(Date.now() + ms).toISOString();

export async function limparBanco() {
  await pool.query(
    'TRUNCATE historico_evento, revisao, entrega, tarefa, convite, membro_grupo, grupo, usuario RESTART IDENTITY CASCADE',
  );
  fs.rmSync(config.uploadDir, { recursive: true, force: true });
}

export interface Aluno {
  id: number;
  nome: string;
  email: string;
  token: string;
}

export async function criarAluno(nome: string): Promise<Aluno> {
  const email = `${nome.toLowerCase()}@teste.com`;
  const res = await api().post('/api/auth/cadastro').send({ nome, email, senha: '123456' });
  if (res.status !== 201) throw new Error(`cadastro falhou: ${JSON.stringify(res.body)}`);
  return { id: res.body.usuario.id, nome, email, token: res.body.token };
}

export const auth = (a: Aluno) => ({ Authorization: `Bearer ${a.token}` });

export async function criarGrupo(rep: Aluno, extra: Partial<Record<string, unknown>> = {}) {
  const res = await api()
    .post('/api/grupos')
    .set(auth(rep))
    .send({
      titulo: 'Trabalho de Teste',
      objetivo: 'Testar as regras do Trabalhaê',
      prazoFinal: daqui(30 * DIA),
      limiteMembros: 4,
      ...extra,
    });
  if (res.status !== 201) throw new Error(`criar grupo falhou: ${JSON.stringify(res.body)}`);
  return res.body.id as number;
}

export async function entrarNoGrupo(grupoId: number, rep: Aluno, aluno: Aluno) {
  const convite = await api().post(`/api/grupos/${grupoId}/convites`).set(auth(rep)).send({ email: aluno.email });
  if (convite.status !== 201) throw new Error(`convite falhou: ${JSON.stringify(convite.body)}`);
  const aceite = await api().post(`/api/convites/${convite.body.id}/aceitar`).set(auth(aluno));
  if (aceite.status !== 200) throw new Error(`aceite falhou: ${JSON.stringify(aceite.body)}`);
}

/** Cenário padrão: Ana (representante), Bruno e Carla no mesmo grupo. */
export async function cenario() {
  const ana = await criarAluno('Ana');
  const bruno = await criarAluno('Bruno');
  const carla = await criarAluno('Carla');
  const grupoId = await criarGrupo(ana);
  await entrarNoGrupo(grupoId, ana, bruno);
  await entrarNoGrupo(grupoId, ana, carla);
  return { ana, bruno, carla, grupoId };
}

export async function criarTarefa(
  grupoId: number,
  rep: Aluno,
  responsavel: Aluno,
  extra: Partial<Record<string, unknown>> = {},
) {
  const res = await api()
    .post(`/api/grupos/${grupoId}/tarefas`)
    .set(auth(rep))
    .send({ titulo: 'Tarefa de teste', descricao: 'Descrição', prazo: daqui(5 * DIA), responsavelId: responsavel.id, ...extra });
  if (res.status !== 201) throw new Error(`criar tarefa falhou: ${JSON.stringify(res.body)}`);
  return res.body.id as number;
}

export async function enviarLink(tarefaId: number, aluno: Aluno) {
  return api()
    .post(`/api/tarefas/${tarefaId}/entregas`)
    .set(auth(aluno))
    .field('link', 'https://docs.google.com/document/d/abc')
    .field('comentario', 'Minha parte');
}

/** Leva uma tarefa até CONCLUIDA: envio pelo responsável e aprovação pelo revisor. */
export async function concluirTarefa(tarefaId: number, responsavel: Aluno, revisor: Aluno) {
  const e = await enviarLink(tarefaId, responsavel);
  if (e.status !== 201) throw new Error(`envio falhou: ${JSON.stringify(e.body)}`);
  const i = await api().post(`/api/tarefas/${tarefaId}/revisao/iniciar`).set(auth(revisor));
  if (i.status !== 200) throw new Error(`iniciar revisão falhou: ${JSON.stringify(i.body)}`);
  const a = await api().post(`/api/tarefas/${tarefaId}/revisao/aprovar`).set(auth(revisor));
  if (a.status !== 200) throw new Error(`aprovar falhou: ${JSON.stringify(a.body)}`);
}

export async function vencerPrazo(tarefaId: number) {
  await pool.query(`UPDATE tarefa SET prazo = now() - interval '1 hour' WHERE id = $1`, [tarefaId]);
}

export { pool };
