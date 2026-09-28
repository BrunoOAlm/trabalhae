import { describe, expect, it } from 'vitest';
import { escolherUrlDoBanco } from '../src/config';
import { explicarFalhaDoBanco } from '../src/db/diagnostico';

const NEON = 'postgresql://usuario:senha@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const NEON_DIRETO = 'postgresql://usuario:senha@ep-x.sa-east-1.aws.neon.tech/neondb?sslmode=require';
const vercel = { naVercel: true, isTest: false };

describe('Escolha da URL do banco', () => {
  it('usa DATABASE_URL quando existe', () => {
    expect(escolherUrlDoBanco({ DATABASE_URL: NEON, POSTGRES_URL: 'x' }, vercel)).toEqual({ url: NEON, origem: 'DATABASE_URL' });
  });

  it('na Vercel, acha a variável da Neon criada com prefixo, preferindo a com pooler', () => {
    const env = { STORAGE_URL_UNPOOLED: NEON_DIRETO, STORAGE_URL: NEON, OUTRA: 'https://site' };
    expect(escolherUrlDoBanco(env, vercel)).toEqual({ url: NEON, origem: 'STORAGE_URL' });
  });

  it('sem nenhuma variável, cai no banco local e avisa a origem', () => {
    expect(escolherUrlDoBanco({}, vercel).origem).toBe('padrão local');
  });

  it('fora da Vercel não procura variáveis com outros nomes', () => {
    expect(escolherUrlDoBanco({ STORAGE_URL: NEON }, { naVercel: false, isTest: false }).origem).toBe('padrão local');
  });
});

describe('Explicação da falha do banco', () => {
  it('avisa quando a Neon não está conectada', () => {
    expect(explicarFalhaDoBanco(new Error('x'), 'padrão local', true)).toContain('Connect Project');
  });

  it('explica senha recusada sem mostrar dados da conexão', () => {
    const erro = Object.assign(new Error('password authentication failed for user "neondb_owner"'), { code: '28P01' });
    const texto = explicarFalhaDoBanco(erro, 'DATABASE_URL', true);
    expect(texto).toContain('senha');
    expect(texto).not.toContain('neondb_owner');
  });

  it('explica conexão recusada (URL apontando para localhost)', () => {
    const erro = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    expect(explicarFalhaDoBanco(erro, 'DATABASE_URL', true)).toContain('localhost');
  });
});
