import { Request } from 'express';
import { z } from 'zod';
import { invalido } from '../errors';

const texto = (campo: string, max: number) =>
  z
    .string({ error: `${campo} é obrigatório.` })
    .trim()
    .min(1, `${campo} é obrigatório.`)
    .max(max, `${campo} deve ter no máximo ${max} caracteres.`);

const data = (campo: string) =>
  z
    .string({ error: `${campo} é obrigatório.` })
    .refine((v) => !Number.isNaN(Date.parse(v)), `${campo} precisa ser uma data válida (ISO 8601).`)
    .transform((v) => new Date(v));

const id = (campo: string) =>
  z.coerce.number({ error: `${campo} é obrigatório.` }).int(`${campo} inválido.`).positive(`${campo} inválido.`);

export const schemas = {
  cadastro: z.object({
    nome: texto('Nome', 120),
    email: z.string({ error: 'E-mail é obrigatório.' }).trim().email('Informe um e-mail válido.'),
    senha: z
      .string({ error: 'Senha é obrigatória.' })
      .min(6, 'A senha deve ter pelo menos 6 caracteres.')
      .max(72, 'A senha deve ter no máximo 72 caracteres.'),
  }),
  login: z.object({
    email: z.string({ error: 'E-mail é obrigatório.' }).trim().min(1, 'E-mail é obrigatório.'),
    senha: z.string({ error: 'Senha é obrigatória.' }).min(1, 'Senha é obrigatória.'),
  }),
  grupo: z.object({
    titulo: texto('Título', 150),
    objetivo: texto('Objetivo', 2000),
    prazoFinal: data('Prazo final'),
    limiteMembros: z.coerce
      .number({ error: 'Limite de membros é obrigatório.' })
      .int('O limite de membros deve ser um número inteiro.')
      .min(2, 'O grupo precisa comportar pelo menos 2 membros.')
      .max(50, 'O limite máximo é de 50 membros.'),
  }),
  transferir: z.object({ novoRepresentanteId: id('Novo representante') }),
  convite: z.object({
    email: z.string({ error: 'E-mail é obrigatório.' }).trim().email('Informe um e-mail válido.'),
  }),
  tarefa: z.object({
    titulo: texto('Título', 150),
    descricao: z.string().trim().max(5000, 'A descrição deve ter no máximo 5000 caracteres.').default(''),
    prazo: data('Prazo'),
  }),
  novaTarefa: z.object({
    titulo: texto('Título', 150),
    descricao: z.string().trim().max(5000, 'A descrição deve ter no máximo 5000 caracteres.').default(''),
    prazo: data('Prazo'),
    responsavelId: id('Responsável'),
    revisorId: id('Revisor').nullish(),
  }),
  responsavel: z.object({ responsavelId: id('Responsável'), revisorId: id('Revisor').nullish() }),
  revisor: z.object({ revisorId: id('Revisor') }),
  entrega: z.object({
    comentario: z.string().max(2000, 'O comentário deve ter no máximo 2000 caracteres.').nullish(),
    link: z.string().max(1000, 'O link deve ter no máximo 1000 caracteres.').nullish(),
  }),
  correcao: z.object({ motivo: z.string({ error: 'Informe o motivo da correção.' }).max(2000) }),
};

export function validar<T extends z.ZodType>(schema: T, dados: unknown): z.infer<T> {
  const resultado = schema.safeParse(dados ?? {});
  if (!resultado.success) throw invalido(resultado.error.issues[0]?.message ?? 'Dados inválidos.');
  return resultado.data;
}

export function paramId(req: Request, nome = 'id'): number {
  const valor = Number(req.params[nome]);
  if (!Number.isInteger(valor) || valor <= 0) throw invalido('Identificador inválido.');
  return valor;
}
