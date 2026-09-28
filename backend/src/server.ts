import { criarApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { iniciarJobDeAtrasos } from './jobs/atrasos';

async function iniciar() {
  await migrate();
  const app = criarApp();
  app.listen(config.port, () => {
    console.log(`Trabalhaê API rodando em http://localhost:${config.port}/api (perfil: ${config.profile})`);
    console.log(`Documentação: http://localhost:${config.port}/api/docs`);
  });
  iniciarJobDeAtrasos();
}

iniciar().catch((err) => {
  console.error('Falha ao iniciar a API:', err);
  process.exit(1);
});
