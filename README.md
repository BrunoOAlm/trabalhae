# Trabalhaê

Sistema web para organizar trabalhos em grupo da faculdade. Resolve um problema específico: **quem ficou responsável por cada parte e quem realmente entregou**.

- Cada tarefa tem **um único responsável**.
- Toda entrega fica registrada com **data, hora e autor**, e não pode ser alterada.
- Atrasos ficam **marcados para sempre**.
- Cada parte passa por **revisão** antes de ser concluída.
- No fim, o sistema gera um **relatório** que o grupo anexa à entrega ao professor.

Projeto acadêmico de Análise e Desenvolvimento de Sistemas. Capturas das telas em [`docs/telas`](docs/telas).

![Painel do grupo](docs/telas/03-painel-do-grupo.png)

## Stack

| Parte | Tecnologias |
|---|---|
| Backend (`/backend`) | Node.js 22, TypeScript, Express, PostgreSQL, JWT, BCrypt, Zod, Swagger |
| Frontend (`/frontend`) | React 19, TypeScript, Vite, Tailwind CSS, React Router |
| Banco | PostgreSQL 16 (via Docker) |
| Testes | Vitest + Supertest contra um PostgreSQL real (107 testes) |
| Publicação | Vercel (site + API como função serverless) com PostgreSQL da Neon |

> O prompt original previa Spring Boot. O backend foi feito em Node.js mantendo a mesma API, banco, arquitetura em camadas e regras. O motivo e o mapeamento de cada tecnologia estão em [DECISOES.md](DECISOES.md).

## Publicar na Vercel

O projeto já vem pronto para a Vercel (`vercel.json` na raiz): o site vai como arquivos estáticos e a API roda como função serverless em `/api`.

1. Em <https://vercel.com/new>, clique em **Import** no repositório do GitHub. Não precisa mudar nenhuma configuração (o `vercel.json` já define tudo). Clique em **Deploy**.
2. No projeto criado, abra a aba **Storage**, escolha **Neon** (Postgres), crie o banco e ligue ao projeto. Isso cria a variável `DATABASE_URL` sozinho.
3. Na aba **Deployments**, abra o último deploy e clique em **Redeploy**, para a API enxergar o banco.
4. Abra o site. Na primeira requisição, a API cria as tabelas e, se o banco estiver vazio, os dados de exemplo (contas abaixo, senha `123456`).

Diferenças da versão publicada:

- Os arquivos das entregas ficam **no próprio banco** (a Vercel não guarda arquivos em disco) e o limite é de **4 MB** por arquivo (limite de corpo de requisição da Vercel).
- O registro de atrasos no histórico roda junto com as requisições, no máximo a cada 10 minutos, em vez de um timer de hora em hora.
- Opcional: crie a variável `JWT_SECRET` em **Settings > Environment Variables** com um texto longo qualquer. Sem ela, o segredo é derivado da URL do banco.

## Pré-requisitos

- **Node.js 22** (ou 20.19+): <https://nodejs.org>
- **Docker Desktop**, para subir o PostgreSQL com um comando. Se preferir um PostgreSQL instalado na máquina, veja a seção "Sem Docker".

## Como rodar (passo a passo)

Abra um terminal na pasta do projeto.

**1. Subir o banco**

```bash
docker compose up -d
```

**2. Rodar a API** (em um terminal)

```bash
cd backend
npm install
cp .env.example .env      # no Windows (cmd): copy .env.example .env
npm run seed              # cria as tabelas e os dados de exemplo
npm run dev
```

A API fica em <http://localhost:8080/api> e a documentação Swagger em <http://localhost:8080/api/docs>.

**3. Rodar o site** (em outro terminal)

```bash
cd frontend
npm install
npm run dev
```

Abra <http://localhost:5173>. Na tela de entrada aparecem atalhos para as contas de demonstração.

### Contas de demonstração

Todas com a senha **123456**:

| Conta | Situação |
|---|---|
| ana@trabalhae.com | Representante do grupo "Trabalho de Engenharia de Software" |
| bruno@trabalhae.com | Membro, revisor da tarefa da Ana |
| carla@trabalhae.com | Membro, representante do grupo "Projeto de Banco de Dados" |
| diego@trabalhae.com | Membro, com uma tarefa atrasada e outra em correção |
| eduardo@trabalhae.com | Sem grupo, com um convite pendente da Carla |

Para voltar os dados ao estado inicial a qualquer momento: `npm run seed` dentro de `backend`.

## Testes

Com o banco rodando:

```bash
cd backend
npm test
```

Os testes usam o banco separado `trabalhae_test`, criado automaticamente pelo Docker na primeira vez. Eles cobrem a máquina de estados da tarefa e as regras RN01 a RN32 (arquivos em `backend/test/`).

## Roteiro de teste manual

Um caminho de uns 5 minutos que passa por todas as regras principais:

1. **Entre como Eduardo.** Aparece o convite da Carla. Clique em **Aceitar**: você entra no grupo (RN11).
2. **Entre como Ana** e abra "Trabalho de Engenharia de Software".
   - O painel mostra as tarefas por status, o progresso e o aviso da tarefa atrasada do Diego (RN21).
   - Abra "Diagrama de casos de uso" (enviada pelo Bruno), clique em **Começar revisão** e depois **Pedir correção**. Tente sem motivo: o sistema recusa (RN25).
   - Clique em **Nova tarefa**, escolha você mesma como responsável: o sistema pede um revisor, porque ninguém revisa a própria tarefa (RN24).
3. **Entre como Bruno** e abra "Introdução e objetivos do documento" (tarefa da Ana). Como revisor indicado, clique em **Aprovar**: aparece o carimbo "Aprovada".
4. **Entre como Diego** e abra "Desenhar o BPMN". O motivo da correção aparece em destaque. Clique em **Reenviar entrega corrigida** e anexe um PDF: a tarefa volta para revisão (RN26).
   - Abra "Pesquisa de trabalhos relacionados", que está atrasada, e envie: a entrega é aceita, mas fica marcada como **entregue com atraso** (RN20, RN22).
5. **Como Ana**, abra **Mais > Histórico do grupo**: está tudo registrado. Abra **Mais > Prévia do relatório** para ver o relatório por membro.
6. Quando todas as tarefas estiverem aprovadas, **Finalizar trabalho** fica disponível. Depois de finalizar, nada mais pode ser alterado (RN29, RN30).

## Estrutura

```
trabalhae/
├── docker-compose.yml          PostgreSQL 16
├── DECISOES.md                 escolhas de implementação
├── vercel.json                 configuração da publicação na Vercel
├── api/index.js                entrada da API como função serverless
├── backend/
│   ├── migrations/             SQL versionado (estilo Flyway)
│   ├── scripts/                geração das migrações embutidas e banco de teste
│   ├── src/
│   │   ├── http/               rotas (controllers), validação, autenticação, erros
│   │   ├── services/           TODAS as regras de negócio
│   │   ├── repositories/       acesso ao banco (SQL)
│   │   ├── domain/             máquina de estados e datas
│   │   ├── jobs/               job de atrasos (de hora em hora)
│   │   ├── docs/               documentação OpenAPI
│   │   └── db/                 conexão, migração e seed
│   └── test/                   testes automatizados
└── frontend/
    └── src/
        ├── api/                cliente HTTP e chamadas da API (separado das telas)
        ├── paginas/            telas
        ├── modais/             janelas de ação
        ├── componentes/        botões, selos, carimbo, layout
        └── contexto/           login e avisos
```

A chamada à API fica separada da parte visual (`src/api`), então as telas podem ser redesenhadas a partir de layouts do Google Stitch sem mexer na lógica.

## Onde está cada regra

| Regras | Arquivo |
|---|---|
| RN01 a RN06, RN10, RN29, RN30 | `backend/src/services/grupoService.ts` e `acesso.ts` |
| RN08, RN09, RN11 | `backend/src/services/conviteService.ts` |
| RN07, RN12 a RN17, RN24 | `backend/src/services/tarefaService.ts` |
| RN18 a RN22 | `backend/src/services/entregaService.ts` e `jobs/atrasos.ts` |
| RN23 a RN26 | `backend/src/services/revisaoService.ts` |
| RN27, RN28 | `backend/src/domain/maquinaEstados.ts` |
| RN15, RN31, RN32 | `backend/src/services/painelService.ts` |

## Sem Docker

Com um PostgreSQL 16 instalado, crie o usuário e os bancos:

```sql
CREATE USER trabalhae WITH PASSWORD 'trabalhae' CREATEDB;
CREATE DATABASE trabalhae OWNER trabalhae;
CREATE DATABASE trabalhae_test OWNER trabalhae;
```

Depois siga a partir do passo 2. Se usar outro usuário, senha ou porta, ajuste `DATABASE_URL` e `TEST_DATABASE_URL` no `backend/.env`.

## Scripts

| Onde | Comando | O que faz |
|---|---|---|
| backend | `npm run dev` | API com recarga automática |
| backend | `npm run seed` | recria os dados de exemplo (só no perfil `dev`) |
| backend | `npm run migrate` | aplica as migrações pendentes |
| backend | `npm test` | roda os testes |
| backend | `npm run build` e `npm start` | versão compilada |
| backend | `npm run migracoes:embutir` | atualiza a cópia das migrações usada na Vercel (rode depois de criar um `.sql`) |
| raiz | `npm run build:vercel` | build usado pela Vercel (backend + site) |
| frontend | `npm run dev` | site em modo de desenvolvimento |
| frontend | `npm run build` | gera a versão final em `frontend/dist` |
