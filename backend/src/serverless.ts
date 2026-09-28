import type { IncomingMessage, ServerResponse } from 'node:http';
import { criarApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { popularSeVazio } from './db/seed';
import { registrarAtrasos } from './jobs/atrasos';

/**
 * Entrada da API como função serverless (Vercel).
 * Na primeira requisição de cada instância: aplica as migrações e, se o banco estiver vazio,
 * cria os dados de exemplo. O registro de atrasos (RN21) roda no máximo a cada 10 minutos,
 * junto com as requisições, já que funções serverless não mantêm um timer rodando.
 */
const app = criarApp();
const DEZ_MINUTOS = 10 * 60 * 1000;
let preparo: Promise<void> | null = null;
let ultimaVerificacaoDeAtrasos = 0;

function preparar(): Promise<void> {
  if (!preparo) {
    preparo = (async () => {
      await migrate(false);
      if (config.seedAutomatico && (await popularSeVazio())) {
        console.log('Banco vazio: dados de exemplo criados.');
      }
    })().catch((err) => {
      preparo = null;
      throw err;
    });
  }
  return preparo;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await preparar();
  } catch (err) {
    console.error('Falha ao preparar o banco:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        status: 503,
        erro: 'Serviço indisponível',
        mensagem: 'Não foi possível conectar ao banco de dados. Confira se o Neon está ligado ao projeto na Vercel.',
      }),
    );
    return;
  }
  if (Date.now() - ultimaVerificacaoDeAtrasos > DEZ_MINUTOS) {
    ultimaVerificacaoDeAtrasos = Date.now();
    await registrarAtrasos().catch((err) => console.error('Falha ao registrar atrasos:', err));
  }
  restaurarCaminho(req);
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}

/**
 * O vercel.json reescreve /api/qualquer/coisa para /api?__rota=qualquer/coisa.
 * Se a função receber a URL reescrita, remonta o caminho original para o Express.
 */
function restaurarCaminho(req: IncomingMessage) {
  const url = new URL(req.url ?? '/', 'http://local');
  const rota = url.searchParams.get('__rota');
  url.searchParams.delete('__rota');
  if (rota !== null && (url.pathname === '/api' || url.pathname === '/api/')) {
    url.pathname = `/api/${rota.replace(/^\/+/, '')}`;
  }
  req.url = url.pathname + url.search;
}
