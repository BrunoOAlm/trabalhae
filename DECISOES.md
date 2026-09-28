# Decisões do projeto

Registro das escolhas feitas onde o enunciado deixava espaço para interpretação. Em todos os casos, a opção foi a mais simples que respeita as regras de negócio.

## Stack do backend: Node.js + TypeScript no lugar de Java/Spring Boot

O prompt original pedia Spring Boot. No ambiente em que o sistema foi construído, o repositório do Maven estava bloqueado, o que impedia compilar e testar um backend Java. Para entregar algo **testado de ponta a ponta**, o backend foi feito em Node.js + TypeScript, mantendo o resto igual:

| Pedido no prompt | Equivalente usado |
|---|---|
| Spring Web | Express |
| Spring Data JPA + DTOs | Repositórios com SQL (`pg`) + funções de DTO |
| Flyway | Migrações `.sql` versionadas em `backend/migrations`, aplicadas em ordem (tabela `schema_migrations`) |
| Spring Security + JWT + BCrypt | `jsonwebtoken` + `bcryptjs` |
| Bean Validation | Zod |
| springdoc-openapi | `swagger-ui-express` em `/api/docs` |
| `@Scheduled` | `setInterval` de hora em hora (`src/jobs/atrasos.ts`) |
| JUnit | Vitest + Supertest contra um PostgreSQL real |

A arquitetura em camadas (controller → service → repository), a API, o banco e todas as regras são os mesmos do prompt.

## Regras

- **RN15 (todo membro com pelo menos uma tarefa):** o painel mostra os membros sem tarefa e o sistema **bloqueia a finalização** enquanto algum membro estiver sem tarefa. Não dá para exigir isso na criação, porque as tarefas são distribuídas uma a uma.
- **RN16 (prazo da tarefa):** além de não passar do prazo final, o prazo da tarefa precisa ser futuro ao criar ou alterar. Ao editar o prazo final do grupo, o sistema recusa uma data anterior ao prazo de alguma tarefa.
- **RN17 (troca de responsável):** "antes do primeiro envio" = enquanto a tarefa não tem nenhuma entrega registrada.
- **RN19 (entregas imutáveis):** além de não existir rota de edição ou exclusão, o banco tem um *trigger* que impede `UPDATE` e `DELETE` em `entrega` e `UPDATE` em `historico_evento`. Por isso, **tarefas com entrega não podem ser excluídas**.
- **RN21 (atraso):** o campo `atrasada` é calculado a cada resposta. O job de hora em hora só registra o evento `TAREFA_ATRASADA` no histórico, uma vez por tarefa, e também roda quando a API inicia.
- **RN23/RN24 (revisão):** o revisor de uma tarefa é sempre o representante atual, exceto nas tarefas do próprio representante, que usam o membro indicado em `revisor_id`. Se a função de representante for transferida, o novo representante passa a revisar.
- **RN25 (motivo):** motivo vazio ou só com espaços é rejeitado com 422.
- **RN32 (relatório):** o relatório pode ser aberto a qualquer momento como **prévia** (`final: false`); vira o relatório final (`final: true`) depois da finalização.
- **Sair do grupo:** o representante não sai (RN04). Um membro só sai se não for responsável nem revisor de nenhuma tarefa, para não deixar tarefas sem dono.
- **Convites:** só é possível convidar quem já tem conta (busca pelo e-mail). O convite é recusado se o grupo já estiver no limite, e o aceite é recusado se o grupo encheu depois do convite (RN09).
- **Limite de membros:** entre 2 e 50, contando com o representante.
- **Status "Atrasada" e "Entregue com atraso":** não são status armazenados, e sim marcações sobre os status da máquina de estados, como definido no prompt.

## Datas

Todas as datas são gravadas como `TIMESTAMPTZ`, e a API responde em ISO 8601 com o fuso de Brasília (ex.: `2026-10-17T23:59:00-03:00`). A data e a hora de cada entrega vêm do servidor, nunca do navegador.

## Arquivos

Os arquivos são validados pela extensão **e** pelo tipo MIME (PDF, DOCX, PNG, JPG, até 10 MB) e salvos em `UPLOAD_DIR/<id do grupo>/<uuid>.<ext>`. O banco guarda só o caminho e o nome original. O arquivo só é gravado em disco depois de todas as regras passarem.

## Publicação na Vercel

A Vercel roda a API como função serverless, sem disco permanente e sem processo sempre ligado. Para funcionar lá sem mudar as regras:

- **Arquivos no banco:** com `ARMAZENAMENTO=banco` (padrão na Vercel), o conteúdo vai para a tabela `arquivo_armazenado` (migração 002), também protegida contra alteração por *trigger*. A entrega guarda `banco:<uuid>` no lugar do caminho. Localmente continua em disco.
- **Limite de 4 MB:** a Vercel recusa requisições acima de ~4,5 MB, então lá o limite de upload é 4 MB (`MAX_UPLOAD_MB`). O site mostra o limite certo porque o build define `VITE_MAX_UPLOAD_MB=4`.
- **Migrações e dados de exemplo automáticos:** na primeira requisição de cada instância, a API aplica as migrações (com trava no PostgreSQL) e, se não houver nenhum usuário, cria os dados de exemplo. O SQL das migrações também vai embutido no código compilado (`src/db/migracoesEmbutidas.ts`, gerado no build), para não depender de arquivos extras na função; um teste garante que a cópia está igual aos `.sql`.
- **Atrasos (RN21):** sem timer contínuo, o registro no histórico roda junto com as requisições, no máximo a cada 10 minutos. O campo `atrasada` continua calculado em toda resposta.
- **Segredo do JWT:** se `JWT_SECRET` não for definido, é derivado (SHA-256) da URL do banco, que já é secreta. Assim o deploy funciona sem configurar variáveis.
- **Rotas:** o `vercel.json` manda `/api/*` para a função com o caminho em `?__rota=`, e a função remonta o caminho original antes de passar para o Express. As demais rotas devolvem `index.html` (React Router).
