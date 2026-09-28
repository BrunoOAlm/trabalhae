import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { config } from '../config';
import { AppError, ROTULO_ERRO } from '../errors';

function responder(res: Response, status: number, mensagem: string) {
  res.status(status).json({ status, erro: ROTULO_ERRO[status] ?? 'Erro', mensagem });
}

/** Converte qualquer erro no JSON padronizado { status, erro, mensagem }. */
export function tratadorDeErros(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) return responder(res, err.status, err.message);

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return responder(res, 400, `O arquivo deve ter no máximo ${config.maxUploadMb} MB.`);
    return responder(res, 400, 'Envie apenas um arquivo, no campo "arquivo".');
  }

  const e = err as { type?: string; code?: string; message?: string };
  if (e?.type === 'entity.parse.failed') return responder(res, 400, 'O corpo da requisição não é um JSON válido.');
  if (e?.type === 'entity.too.large') return responder(res, 400, 'Requisição grande demais.');
  if (e?.code === '23505') return responder(res, 422, 'Este registro já existe.');
  if (e?.code === 'P0001') return responder(res, 422, 'Registros de entrega e histórico não podem ser alterados.');

  console.error(err);
  return responder(res, 500, 'Ocorreu um erro inesperado. Tente novamente.');
}

export function naoEncontrada(_req: Request, res: Response) {
  responder(res, 404, 'Rota não encontrada.');
}
