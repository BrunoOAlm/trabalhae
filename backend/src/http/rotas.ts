import { NextFunction, Request, RequestHandler, Response, Router } from 'express';
import multer from 'multer';
import { config } from '../config';
import { invalido } from '../errors';
import * as authService from '../services/authService';
import * as conviteService from '../services/conviteService';
import * as entregaService from '../services/entregaService';
import * as grupoService from '../services/grupoService';
import * as painelService from '../services/painelService';
import * as revisaoService from '../services/revisaoService';
import * as tarefaService from '../services/tarefaService';
import { autenticado } from './autenticacao';
import { paramId, schemas, validar } from './validacao';

/** Encaminha erros de handlers assíncronos para o tratador global. */
const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes, files: 1 } });

export function criarRotas(): Router {
  const r = Router();

  // ---------- autenticação ----------
  r.post('/auth/cadastro', h(async (req, res) => {
    res.status(201).json(await authService.cadastrar(validar(schemas.cadastro, req.body)));
  }));
  r.post('/auth/login', h(async (req, res) => {
    res.json(await authService.login(validar(schemas.login, req.body)));
  }));
  r.get('/auth/me', autenticado, h(async (req, res) => {
    res.json(await authService.me(req.usuarioId));
  }));

  // daqui para baixo, tudo exige login
  r.use(autenticado);

  // ---------- grupos ----------
  r.post('/grupos', h(async (req, res) => {
    res.status(201).json(await grupoService.criar(req.usuarioId, validar(schemas.grupo, req.body)));
  }));
  r.get('/grupos', h(async (req, res) => {
    res.json(await grupoService.listar(req.usuarioId));
  }));
  r.get('/grupos/:id', h(async (req, res) => {
    res.json(await grupoService.detalhar(paramId(req), req.usuarioId));
  }));
  r.put('/grupos/:id', h(async (req, res) => {
    res.json(await grupoService.atualizar(paramId(req), req.usuarioId, validar(schemas.grupo, req.body)));
  }));
  r.post('/grupos/:id/transferir-representante', h(async (req, res) => {
    const { novoRepresentanteId } = validar(schemas.transferir, req.body);
    res.json(await grupoService.transferirRepresentante(paramId(req), req.usuarioId, novoRepresentanteId));
  }));
  r.post('/grupos/:id/sair', h(async (req, res) => {
    await grupoService.sair(paramId(req), req.usuarioId);
    res.status(204).end();
  }));
  r.post('/grupos/:id/finalizar', h(async (req, res) => {
    res.json(await grupoService.finalizar(paramId(req), req.usuarioId));
  }));
  r.get('/grupos/:id/painel', h(async (req, res) => {
    res.json(await painelService.painel(paramId(req), req.usuarioId));
  }));
  r.get('/grupos/:id/historico', h(async (req, res) => {
    res.json(await painelService.linhaDoTempo(paramId(req), req.usuarioId));
  }));
  r.get('/grupos/:id/relatorio', h(async (req, res) => {
    res.json(await painelService.relatorio(paramId(req), req.usuarioId));
  }));

  // ---------- convites ----------
  r.post('/grupos/:id/convites', h(async (req, res) => {
    const { email } = validar(schemas.convite, req.body);
    res.status(201).json(await conviteService.convidar(paramId(req), req.usuarioId, email));
  }));
  r.get('/convites', h(async (req, res) => {
    res.json(await conviteService.listarMeus(req.usuarioId));
  }));
  r.post('/convites/:id/aceitar', h(async (req, res) => {
    res.json(await conviteService.aceitar(paramId(req), req.usuarioId));
  }));
  r.post('/convites/:id/recusar', h(async (req, res) => {
    await conviteService.recusar(paramId(req), req.usuarioId);
    res.status(204).end();
  }));

  // ---------- tarefas ----------
  r.post('/grupos/:id/tarefas', h(async (req, res) => {
    res.status(201).json(await tarefaService.criar(paramId(req), req.usuarioId, validar(schemas.novaTarefa, req.body)));
  }));
  r.get('/tarefas/:id', h(async (req, res) => {
    res.json(await tarefaService.detalhar(paramId(req), req.usuarioId));
  }));
  r.put('/tarefas/:id', h(async (req, res) => {
    res.json(await tarefaService.atualizar(paramId(req), req.usuarioId, validar(schemas.tarefa, req.body)));
  }));
  r.delete('/tarefas/:id', h(async (req, res) => {
    await tarefaService.excluir(paramId(req), req.usuarioId);
    res.status(204).end();
  }));
  r.put('/tarefas/:id/responsavel', h(async (req, res) => {
    const { responsavelId, revisorId } = validar(schemas.responsavel, req.body);
    res.json(await tarefaService.trocarResponsavel(paramId(req), req.usuarioId, responsavelId, revisorId));
  }));
  r.put('/tarefas/:id/revisor', h(async (req, res) => {
    const { revisorId } = validar(schemas.revisor, req.body);
    res.json(await tarefaService.definirRevisor(paramId(req), req.usuarioId, revisorId));
  }));
  r.post('/tarefas/:id/iniciar', h(async (req, res) => {
    res.json(await tarefaService.iniciar(paramId(req), req.usuarioId));
  }));

  // ---------- entregas e revisão ----------
  r.post(
    '/tarefas/:id/entregas',
    (req, res, next) => upload.single('arquivo')(req, res, next),
    h(async (req, res) => {
      const dados = validar(schemas.entrega, req.body);
      if (req.files && !req.file) throw invalido('Envie apenas um arquivo, no campo "arquivo".');
      res.status(201).json(await entregaService.enviar(paramId(req), req.usuarioId, dados, req.file));
    }),
  );
  r.get('/tarefas/:id/entregas', h(async (req, res) => {
    res.json(await entregaService.listar(paramId(req), req.usuarioId));
  }));
  r.get('/entregas/:id/arquivo', h(async (req, res) => {
    const arq = await entregaService.arquivo(paramId(req), req.usuarioId);
    if (arq.tipo) res.type(arq.tipo);
    if (arq.conteudo) {
      res.attachment(arq.nome);
      res.send(arq.conteudo);
    } else {
      res.download(arq.caminho!, arq.nome);
    }
  }));
  r.post('/tarefas/:id/revisao/iniciar', h(async (req, res) => {
    res.json(await revisaoService.iniciarRevisao(paramId(req), req.usuarioId));
  }));
  r.post('/tarefas/:id/revisao/aprovar', h(async (req, res) => {
    res.json(await revisaoService.aprovar(paramId(req), req.usuarioId));
  }));
  r.post('/tarefas/:id/revisao/correcao', h(async (req, res) => {
    const { motivo } = validar(schemas.correcao, req.body);
    res.json(await revisaoService.pedirCorrecao(paramId(req), req.usuarioId, motivo));
  }));

  return r;
}
