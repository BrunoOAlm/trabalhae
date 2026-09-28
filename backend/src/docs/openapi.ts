/* Documentação OpenAPI 3 da API do Trabalhaê (servida em /api/docs). */

type Op = {
  tag: string;
  resumo: string;
  body?: string;
  multipart?: boolean;
  publico?: boolean;
  status?: number;
  erros?: number[];
  params?: string[];
};

const ref = (nome: string) => ({ $ref: `#/components/schemas/${nome}` });

const ROTULOS: Record<number, string> = {
  200: 'Sucesso',
  201: 'Criado',
  204: 'Sem conteúdo',
  400: 'Dados inválidos',
  401: 'Não autenticado',
  403: 'Sem permissão',
  404: 'Não encontrado',
  409: 'Trabalho já finalizado',
  422: 'Regra de negócio violada',
};

function op(o: Op) {
  const status = o.status ?? 200;
  const respostas: Record<string, unknown> = { [status]: { description: ROTULOS[status] } };
  for (const e of o.erros ?? [400, 401, 403, 404, 409, 422]) {
    respostas[e] = { description: ROTULOS[e], content: { 'application/json': { schema: ref('Erro') } } };
  }
  return {
    tags: [o.tag],
    summary: o.resumo,
    ...(o.publico ? { security: [] } : {}),
    parameters: (o.params ?? []).map((p) => ({ name: p, in: 'path', required: true, schema: { type: 'integer' } })),
    ...(o.body
      ? { requestBody: { required: true, content: { 'application/json': { schema: ref(o.body) } } } }
      : {}),
    ...(o.multipart
      ? {
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    arquivo: { type: 'string', format: 'binary', description: 'PDF, DOCX, PNG ou JPG até 10 MB' },
                    link: { type: 'string', example: 'https://docs.google.com/...' },
                    comentario: { type: 'string' },
                  },
                },
              },
            },
          },
        }
      : {}),
    responses: respostas,
  };
}

const id = ['id'];

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Trabalhaê API',
    version: '1.0.0',
    description:
      'API do Trabalhaê: organização de trabalhos em grupo com responsáveis, entregas registradas, controle de atrasos e revisão. ' +
      'Faça login em /api/auth/login, copie o token e clique em "Authorize".',
  },
  servers: [{ url: '/api' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Autenticação' },
    { name: 'Grupos' },
    { name: 'Convites' },
    { name: 'Tarefas' },
    { name: 'Entregas e revisão' },
  ],
  paths: {
    '/auth/cadastro': { post: op({ tag: 'Autenticação', resumo: 'Cadastrar aluno (RF01)', body: 'Cadastro', publico: true, status: 201, erros: [400, 422] }) },
    '/auth/login': { post: op({ tag: 'Autenticação', resumo: 'Entrar e receber o token JWT', body: 'Login', publico: true, erros: [400, 401] }) },
    '/auth/me': { get: op({ tag: 'Autenticação', resumo: 'Dados do usuário logado', erros: [401] }) },

    '/grupos': {
      get: op({ tag: 'Grupos', resumo: 'Meus grupos', erros: [401] }),
      post: op({ tag: 'Grupos', resumo: 'Criar grupo e virar representante (RN01, RN05, RN06)', body: 'Grupo', status: 201, erros: [400, 401, 422] }),
    },
    '/grupos/{id}': {
      get: op({ tag: 'Grupos', resumo: 'Detalhes do grupo, membros e convites pendentes', params: id, erros: [401, 403, 404] }),
      put: op({ tag: 'Grupos', resumo: 'Editar título, objetivo, prazo e limite (RN06, RN10)', body: 'Grupo', params: id }),
    },
    '/grupos/{id}/transferir-representante': {
      post: op({ tag: 'Grupos', resumo: 'Transferir a função de representante (RN03)', body: 'Transferencia', params: id }),
    },
    '/grupos/{id}/sair': { post: op({ tag: 'Grupos', resumo: 'Sair do grupo (RN04)', params: id, status: 204 }) },
    '/grupos/{id}/finalizar': { post: op({ tag: 'Grupos', resumo: 'Finalizar o trabalho (RN15, RN29, RN30)', params: id }) },
    '/grupos/{id}/painel': { get: op({ tag: 'Grupos', resumo: 'Painel: tarefas por status, progresso, membros sem tarefa', params: id, erros: [401, 403, 404] }) },
    '/grupos/{id}/historico': { get: op({ tag: 'Grupos', resumo: 'Linha do tempo do grupo (RN31)', params: id, erros: [401, 403, 404] }) },
    '/grupos/{id}/relatorio': { get: op({ tag: 'Grupos', resumo: 'Relatório por membro (prévia ou final, RN32)', params: id, erros: [401, 403, 404] }) },

    '/grupos/{id}/convites': { post: op({ tag: 'Convites', resumo: 'Convidar aluno pelo e-mail (RN09, RN11)', body: 'Convite', params: id, status: 201 }) },
    '/convites': { get: op({ tag: 'Convites', resumo: 'Meus convites pendentes', erros: [401] }) },
    '/convites/{id}/aceitar': { post: op({ tag: 'Convites', resumo: 'Aceitar convite (RN09, RN11)', params: id }) },
    '/convites/{id}/recusar': { post: op({ tag: 'Convites', resumo: 'Recusar convite', params: id, status: 204 }) },

    '/grupos/{id}/tarefas': { post: op({ tag: 'Tarefas', resumo: 'Criar tarefa (RN07, RN12 a RN16, RN24)', body: 'NovaTarefa', params: id, status: 201 }) },
    '/tarefas/{id}': {
      get: op({ tag: 'Tarefas', resumo: 'Detalhe da tarefa com entregas, revisões e permissões', params: id, erros: [401, 403, 404] }),
      put: op({ tag: 'Tarefas', resumo: 'Editar título, descrição e prazo', body: 'Tarefa', params: id }),
      delete: op({ tag: 'Tarefas', resumo: 'Excluir tarefa sem entregas', params: id, status: 204 }),
    },
    '/tarefas/{id}/responsavel': { put: op({ tag: 'Tarefas', resumo: 'Trocar responsável antes do primeiro envio (RN17)', body: 'Responsavel', params: id }) },
    '/tarefas/{id}/revisor': { put: op({ tag: 'Tarefas', resumo: 'Indicar revisor de tarefa do representante (RN24)', body: 'Revisor', params: id }) },
    '/tarefas/{id}/iniciar': { post: op({ tag: 'Tarefas', resumo: 'Iniciar tarefa (Pendente → Em andamento)', params: id }) },

    '/tarefas/{id}/entregas': {
      get: op({ tag: 'Entregas e revisão', resumo: 'Entregas da tarefa, em ordem cronológica', params: id, erros: [401, 403, 404] }),
      post: op({ tag: 'Entregas e revisão', resumo: 'Enviar entrega (RN18 a RN22)', multipart: true, params: id, status: 201 }),
    },
    '/entregas/{id}/arquivo': { get: op({ tag: 'Entregas e revisão', resumo: 'Baixar o arquivo de uma entrega', params: id, erros: [401, 403, 404] }) },
    '/tarefas/{id}/revisao/iniciar': { post: op({ tag: 'Entregas e revisão', resumo: 'Iniciar revisão (Enviada → Em revisão)', params: id }) },
    '/tarefas/{id}/revisao/aprovar': { post: op({ tag: 'Entregas e revisão', resumo: 'Aprovar (Em revisão → Concluída)', params: id }) },
    '/tarefas/{id}/revisao/correcao': { post: op({ tag: 'Entregas e revisão', resumo: 'Pedir correção com motivo (RN25)', body: 'Correcao', params: id }) },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Erro: {
        type: 'object',
        properties: {
          status: { type: 'integer', example: 422 },
          erro: { type: 'string', example: 'Regra de negócio violada' },
          mensagem: { type: 'string', example: 'O prazo da tarefa não pode ser posterior ao prazo final do trabalho.' },
        },
      },
      Cadastro: {
        type: 'object',
        required: ['nome', 'email', 'senha'],
        properties: { nome: { type: 'string' }, email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 6 } },
      },
      Login: {
        type: 'object',
        required: ['email', 'senha'],
        properties: { email: { type: 'string', example: 'ana@trabalhae.com' }, senha: { type: 'string', example: '123456' } },
      },
      Grupo: {
        type: 'object',
        required: ['titulo', 'objetivo', 'prazoFinal', 'limiteMembros'],
        properties: {
          titulo: { type: 'string' },
          objetivo: { type: 'string' },
          prazoFinal: { type: 'string', format: 'date-time', example: '2026-12-01T23:59:00-03:00' },
          limiteMembros: { type: 'integer', minimum: 2, maximum: 50 },
        },
      },
      Transferencia: { type: 'object', required: ['novoRepresentanteId'], properties: { novoRepresentanteId: { type: 'integer' } } },
      Convite: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } },
      Tarefa: {
        type: 'object',
        required: ['titulo', 'prazo'],
        properties: { titulo: { type: 'string' }, descricao: { type: 'string' }, prazo: { type: 'string', format: 'date-time' } },
      },
      NovaTarefa: {
        type: 'object',
        required: ['titulo', 'prazo', 'responsavelId'],
        properties: {
          titulo: { type: 'string' },
          descricao: { type: 'string' },
          prazo: { type: 'string', format: 'date-time' },
          responsavelId: { type: 'integer' },
          revisorId: { type: 'integer', nullable: true, description: 'Obrigatório quando o responsável é o representante' },
        },
      },
      Responsavel: {
        type: 'object',
        required: ['responsavelId'],
        properties: { responsavelId: { type: 'integer' }, revisorId: { type: 'integer', nullable: true } },
      },
      Revisor: { type: 'object', required: ['revisorId'], properties: { revisorId: { type: 'integer' } } },
      Correcao: { type: 'object', required: ['motivo'], properties: { motivo: { type: 'string' } } },
    },
  },
};
