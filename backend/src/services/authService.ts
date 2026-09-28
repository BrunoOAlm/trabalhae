import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db/pool';
import { naoAutenticado, regra } from '../errors';
import * as usuarios from '../repositories/usuarioRepository';
import { usuarioDto } from './dto';

function gerarToken(usuarioId: number): string {
  return jwt.sign({ sub: String(usuarioId) }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function validarToken(token: string): number {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    const id = Number(payload.sub);
    if (!Number.isInteger(id)) throw new Error('sub inválido');
    return id;
  } catch {
    throw naoAutenticado('Sessão inválida ou expirada. Faça login novamente.');
  }
}

export async function cadastrar(dados: { nome: string; email: string; senha: string }) {
  const email = dados.email.trim().toLowerCase();
  if (await usuarios.buscarPorEmail(pool, email)) {
    throw regra('Já existe uma conta cadastrada com este e-mail.');
  }
  const hash = await bcrypt.hash(dados.senha, 10);
  const usuario = await usuarios.inserir(pool, dados.nome.trim(), email, hash);
  return { token: gerarToken(usuario.id), usuario: usuarioDto(usuario) };
}

export async function login(dados: { email: string; senha: string }) {
  const usuario = await usuarios.buscarPorEmail(pool, dados.email.trim());
  if (!usuario || !(await bcrypt.compare(dados.senha, usuario.senha_hash))) {
    throw naoAutenticado('E-mail ou senha incorretos.');
  }
  return { token: gerarToken(usuario.id), usuario: usuarioDto(usuario) };
}

export async function me(usuarioId: number) {
  const usuario = await usuarios.buscarPorId(pool, usuarioId);
  if (!usuario) throw naoAutenticado('Usuário não encontrado. Faça login novamente.');
  return usuarioDto(usuario);
}
