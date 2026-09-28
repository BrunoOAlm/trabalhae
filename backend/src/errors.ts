export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const ROTULO_ERRO: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito',
  413: 'Arquivo muito grande',
  422: 'Regra de negócio violada',
  500: 'Erro interno',
};

export const invalido = (msg: string) => new AppError(400, msg);
export const naoAutenticado = (msg = 'Faça login para continuar.') => new AppError(401, msg);
export const proibido = (msg: string) => new AppError(403, msg);
export const naoEncontrado = (msg: string) => new AppError(404, msg);
export const conflito = (msg: string) => new AppError(409, msg);
export const regra = (msg: string) => new AppError(422, msg);
