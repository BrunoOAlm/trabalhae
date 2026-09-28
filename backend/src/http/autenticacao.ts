import { NextFunction, Request, Response } from 'express';
import { naoAutenticado } from '../errors';
import { validarToken } from '../services/authService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuarioId: number;
    }
  }
}

/** Exige o cabeçalho Authorization: Bearer <token>. */
export function autenticado(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) return next(naoAutenticado());
  try {
    req.usuarioId = validarToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
