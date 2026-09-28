# CLAUDE.md

Contexto rápido para continuar o desenvolvimento do Trabalhaê.

## O que é

Sistema de trabalhos em grupo da faculdade: cada tarefa tem um responsável, entregas são registradas com data/hora/autor e não podem ser alteradas, atrasos ficam marcados, tudo passa por revisão e o grupo finaliza com um relatório por membro.

## Stack

- `backend/`: Node.js 22 + TypeScript, Express, PostgreSQL (`pg`, SQL puro), JWT, bcryptjs, Zod, swagger-ui-express, Vitest + Supertest.
- `frontend/`: React 19 + TypeScript, Vite, Tailwind CSS v4, React Router, lucide-react. Fontes empacotadas via @fontsource.
- `docker-compose.yml`: PostgreSQL 16 (banco `trabalhae` e `trabalhae_test`).

## Comandos

```bash
docker compose up -d                          # banco
cd backend && npm run seed && npm run dev     # API em :8080 (Swagger em /api/docs)
cd backend && npm test                        # 107 testes
cd frontend && npm run dev                    # site em :5173 (proxy /api -> :8080)
cd frontend && npx tsc -b                     # checagem de tipos do front
```

## Arquitetura do backend

`http/rotas.ts` (controllers) → `services/*` (todas as regras) → `repositories/*` (SQL). DTOs em `services/dto.ts`, acesso e permissões em `services/acesso.ts`, máquina de estados em `domain/maquinaEstados.ts`. Erros sempre no formato `{ status, erro, mensagem }` via `errors.ts` e `http/erros.ts`. Migrações em `backend/migrations/*.sql`, aplicadas por `db/migrate.ts` no start. Depois de criar um `.sql`, rode `npm run migracoes:embutir` (a cópia embutida é usada na Vercel; um teste acusa se ficar diferente).

## Vercel

`vercel.json` + `api/index.js` → `backend/src/serverless.ts`. Na Vercel: arquivos no banco (`arquivo_armazenado`), upload até 4 MB, migração e seed automáticos no primeiro acesso, banco pela `DATABASE_URL` da Neon. Detalhes em `DECISOES.md`.

## Convenções

- Código, mensagens e nomes em português do Brasil.
- Toda regra nova vai no service e ganha teste em `backend/test/`.
- Datas: `TIMESTAMPTZ` no banco; a API responde com `isoLocal()` (fuso -03:00); o front envia `YYYY-MM-DDTHH:mm:00-03:00`.
- O front nunca decide permissão sozinho: usa `permissoes` que vem de `GET /tarefas/:id` e o backend valida de novo.
- Decisões de interpretação ficam em `DECISOES.md`.
