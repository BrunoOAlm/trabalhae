import { pool, withTx } from '../db/pool';
import { naoEncontrado, proibido, regra } from '../errors';
import * as convites from '../repositories/conviteRepository';
import * as grupos from '../repositories/grupoRepository';
import * as historico from '../repositories/historicoRepository';
import * as usuarios from '../repositories/usuarioRepository';
import { contextoDoGrupo, exigirAtivo, exigirRepresentante } from './acesso';
import { conviteDoUsuarioDto } from './dto';

/** RF04: o representante convida um aluno já cadastrado, pelo e-mail. */
export async function convidar(grupoId: number, usuarioId: number, email: string) {
  return withTx(async (db) => {
    const ctx = await contextoDoGrupo(db, grupoId, usuarioId, true);
    exigirRepresentante(ctx, 'convidar membros');
    exigirAtivo(ctx.grupo);

    const convidado = await usuarios.buscarPorEmail(db, email.trim());
    if (!convidado) throw naoEncontrado('Nenhum aluno cadastrado com este e-mail.');
    if (ctx.membros.some((m) => m.id === convidado.id)) {
      throw regra(`${convidado.nome} já faz parte do grupo.`);
    }
    // RN11: não pode haver dois convites pendentes para o mesmo aluno
    if (await convites.existePendente(db, grupoId, convidado.id)) {
      throw regra(`Já existe um convite pendente para ${convidado.nome}.`);
    }
    // RN09: não convida se o grupo já está cheio
    if (ctx.membros.length >= ctx.grupo.limite_membros) {
      throw regra(`O grupo já atingiu o limite de ${ctx.grupo.limite_membros} membros.`);
    }
    const convite = await convites.inserir(db, grupoId, convidado.id);
    await historico.registrar(db, {
      grupoId,
      usuarioId,
      tipo: 'MEMBRO_CONVIDADO',
      descricao: `${ctx.representante.nome} convidou ${convidado.nome} para o grupo.`,
    });
    return {
      id: convite.id,
      convidado: { id: convidado.id, nome: convidado.nome, email: convidado.email },
      status: convite.status,
    };
  });
}

export async function listarMeus(usuarioId: number) {
  const lista = await convites.pendentesDoUsuario(pool, usuarioId);
  return lista.map(conviteDoUsuarioDto);
}

async function carregarConvitePendente(db: Parameters<typeof convites.buscarPorId>[0], conviteId: number, usuarioId: number) {
  const convite = await convites.buscarPorId(db, conviteId, true);
  if (!convite) throw naoEncontrado('Convite não encontrado.');
  if (convite.convidado_id !== usuarioId) throw proibido('Este convite não é para você.');
  if (convite.status !== 'PENDENTE') throw regra('Este convite já foi respondido.');
  return convite;
}

/** RN09 + RN11: o aluno só vira membro ao aceitar, e só se ainda houver vaga. */
export async function aceitar(conviteId: number, usuarioId: number) {
  return withTx(async (db) => {
    const convite = await carregarConvitePendente(db, conviteId, usuarioId);
    const grupo = await grupos.buscarPorId(db, convite.grupo_id, true); // trava o grupo contra aceites simultâneos
    if (!grupo) throw naoEncontrado('Grupo não encontrado.');
    exigirAtivo(grupo);
    const total = await grupos.contarMembros(db, grupo.id);
    if (total >= grupo.limite_membros) {
      throw regra(`O grupo já está completo (${grupo.limite_membros} membros). Fale com o representante.`);
    }
    const eu = (await usuarios.buscarPorId(db, usuarioId))!;
    await grupos.adicionarMembro(db, grupo.id, usuarioId);
    await convites.responder(db, convite.id, 'ACEITO');
    await historico.registrar(db, {
      grupoId: grupo.id,
      usuarioId,
      tipo: 'CONVITE_ACEITO',
      descricao: `${eu.nome} aceitou o convite e entrou no grupo.`,
    });
    return { grupoId: grupo.id };
  });
}

export async function recusar(conviteId: number, usuarioId: number) {
  await withTx(async (db) => {
    const convite = await carregarConvitePendente(db, conviteId, usuarioId);
    const grupo = await grupos.buscarPorId(db, convite.grupo_id);
    if (!grupo) throw naoEncontrado('Grupo não encontrado.');
    exigirAtivo(grupo);
    const eu = (await usuarios.buscarPorId(db, usuarioId))!;
    await convites.responder(db, convite.id, 'RECUSADO');
    await historico.registrar(db, {
      grupoId: grupo.id,
      usuarioId,
      tipo: 'CONVITE_RECUSADO',
      descricao: `${eu.nome} recusou o convite.`,
    });
  });
}
