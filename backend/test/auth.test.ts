import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, criarAluno, limparBanco, pool } from './helpers';

beforeEach(limparBanco);
afterAll(() => pool.end());

describe('Autenticação (RF01)', () => {
  it('cadastra e devolve token sem expor a senha', async () => {
    const res = await api().post('/api/auth/cadastro').send({ nome: 'Ana', email: 'Ana@Teste.com', senha: '123456' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.usuario).toEqual({ id: expect.any(Number), nome: 'Ana', email: 'ana@teste.com' });
    const { rows } = await pool.query('SELECT senha_hash FROM usuario');
    expect(rows[0].senha_hash).not.toBe('123456');
    expect(rows[0].senha_hash).toMatch(/^\$2[aby]\$/); // hash BCrypt
  });

  it('não permite dois cadastros com o mesmo e-mail', async () => {
    await criarAluno('Ana');
    const res = await api().post('/api/auth/cadastro').send({ nome: 'Outra', email: 'ana@teste.com', senha: '123456' });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ status: 422, erro: 'Regra de negócio violada' });
  });

  it('valida os campos com mensagens em português', async () => {
    const res = await api().post('/api/auth/cadastro').send({ nome: '', email: 'x', senha: '1' });
    expect(res.status).toBe(400);
    expect(res.body.mensagem).toMatch(/obrigatório|válido|pelo menos/);
  });

  it('faz login e rejeita senha errada', async () => {
    await criarAluno('Ana');
    const ok = await api().post('/api/auth/login').send({ email: 'ana@teste.com', senha: '123456' });
    expect(ok.status).toBe(200);
    const errado = await api().post('/api/auth/login').send({ email: 'ana@teste.com', senha: 'errada' });
    expect(errado.status).toBe(401);
    expect(errado.body.mensagem).toBe('E-mail ou senha incorretos.');
  });

  it('exige token nas rotas protegidas e aceita token válido em /auth/me', async () => {
    expect((await api().get('/api/grupos')).status).toBe(401);
    expect((await api().get('/api/grupos').set('Authorization', 'Bearer invalido')).status).toBe(401);
    const ana = await criarAluno('Ana');
    const me = await api().get('/api/auth/me').set(auth(ana));
    expect(me.status).toBe(200);
    expect(me.body.email).toBe('ana@teste.com');
  });
});
