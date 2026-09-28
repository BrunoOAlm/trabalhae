import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { config } from './config';
import { openapi } from './docs/openapi';
import { naoEncontrada, tratadorDeErros } from './http/erros';
import { criarRotas } from './http/rotas';

export function criarApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/saude', (_req, res) => res.json({ status: 'ok' }));
  app.get('/api/docs.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Trabalhaê API' }));
  app.use('/api', criarRotas());

  app.use(naoEncontrada);
  app.use(tratadorDeErros);
  return app;
}
