// Gera src/db/migracoesEmbutidas.ts a partir de migrations/*.sql.
// Assim o SQL vai junto no código compilado e a API funciona mesmo onde a pasta
// migrations/ não é copiada (ex.: função serverless da Vercel).
// Rode com: npm run migracoes:embutir (o build já faz isso sozinho).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pasta = path.join(raiz, 'migrations');
const destino = path.join(raiz, 'src/db/migracoesEmbutidas.ts');

const migracoes = fs
  .readdirSync(pasta)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((nome) => ({ nome, sql: fs.readFileSync(path.join(pasta, nome), 'utf8') }));

const conteudo = `// ARQUIVO GERADO por scripts/embutir-migracoes.mjs. Não edite à mão:
// altere os .sql em backend/migrations e rode "npm run migracoes:embutir".
export const migracoesEmbutidas: { nome: string; sql: string }[] = ${JSON.stringify(migracoes, null, 2)};
`;

fs.writeFileSync(destino, conteudo);
console.log(`${migracoes.length} migração(ões) embutida(s) em src/db/migracoesEmbutidas.ts`);
