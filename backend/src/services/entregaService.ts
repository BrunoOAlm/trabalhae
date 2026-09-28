import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config';
import { pool, withTx } from '../db/pool';
import { formatarDataHora } from '../domain/datas';
import { transitar } from '../domain/maquinaEstados';
import { invalido, naoEncontrado, proibido } from '../errors';
import * as entregas from '../repositories/entregaRepository';
import * as historico from '../repositories/historicoRepository';
import * as tarefas from '../repositories/tarefaRepository';
import { contextoDaTarefa, contextoDoGrupo, exigirAtivo } from './acesso';
import { entregaDto } from './dto';
import { detalhar } from './tarefaService';

export const TIPOS_PERMITIDOS: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
};

export interface ArquivoEnviado {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function validarArquivo(arquivo: ArquivoEnviado): { nome: string; extensao: string } {
  // multer entrega o nome em latin1; converte para UTF-8 para manter acentos
  const nome = Buffer.from(arquivo.originalname, 'latin1').toString('utf8');
  const extensao = path.extname(nome).toLowerCase();
  const tipos = TIPOS_PERMITIDOS[extensao];
  if (!tipos || !tipos.includes(arquivo.mimetype)) {
    throw invalido('Formato de arquivo não permitido. Envie PDF, DOCX, PNG ou JPG.');
  }
  if (arquivo.size > config.maxUploadBytes) throw invalido(`O arquivo deve ter no máximo ${config.maxUploadMb} MB.`);
  if (arquivo.size === 0) throw invalido('O arquivo enviado está vazio.');
  return { nome, extensao };
}

function validarLink(link: string): string {
  try {
    const url = new URL(link);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error();
    return url.toString();
  } catch {
    throw invalido('Informe um link válido, começando com http:// ou https://.');
  }
}

/**
 * RN18 a RN22: só o responsável envia; a entrega fica registrada com data/hora do servidor
 * e autor, e é marcada permanentemente se chegar depois do prazo. O status vai para ENVIADA
 * (a partir de Pendente, Em andamento ou Em correção).
 */
export async function enviar(
  tarefaId: number,
  usuarioId: number,
  dados: { comentario?: string | null; link?: string | null },
  arquivo?: ArquivoEnviado,
) {
  const link = dados.link?.trim() ? validarLink(dados.link.trim()) : null;
  const comentario = dados.comentario?.trim() || null;
  if (!link && !arquivo) throw invalido('Anexe um arquivo ou informe um link para enviar a entrega.');
  const infoArquivo = arquivo ? validarArquivo(arquivo) : null;

  let caminhoGravado: string | null = null;
  try {
    await withTx(async (db) => {
      const ctx = await contextoDaTarefa(db, tarefaId, usuarioId, true);
      exigirAtivo(ctx.grupo);
      if (ctx.tarefa.responsavel_id !== usuarioId) {
        throw proibido('Somente o responsável pela tarefa pode enviar a entrega.');
      }
      const novoStatus = transitar(ctx.tarefa.status, 'ENVIADA');
      const agora = new Date();
      const comAtraso = agora.getTime() > ctx.tarefa.prazo.getTime();

      let arquivoCaminho: string | null = null;
      if (arquivo && infoArquivo) {
        if (config.armazenamento === 'banco') {
          // sem disco permanente (ex.: Vercel): o arquivo vai para a tabela arquivo_armazenado
          const chave = crypto.randomUUID();
          await db.query('INSERT INTO arquivo_armazenado (chave, conteudo) VALUES ($1, $2)', [chave, arquivo.buffer]);
          arquivoCaminho = `banco:${chave}`;
        } else {
          const pasta = path.join(config.uploadDir, String(ctx.grupo.id));
          fs.mkdirSync(pasta, { recursive: true });
          arquivoCaminho = path.join(String(ctx.grupo.id), `${crypto.randomUUID()}${infoArquivo.extensao}`);
          caminhoGravado = path.join(config.uploadDir, arquivoCaminho);
          fs.writeFileSync(caminhoGravado, arquivo.buffer);
        }
      }

      const reenvio = ctx.tarefa.status === 'EM_CORRECAO';
      await entregas.inserir(db, {
        tarefaId,
        autorId: usuarioId,
        comentario,
        link,
        arquivoNome: infoArquivo?.nome ?? null,
        arquivoCaminho,
        arquivoTipo: arquivo?.mimetype ?? null,
        arquivoTamanho: arquivo?.size ?? null,
        comAtraso,
        enviadaEm: agora,
      });
      await tarefas.atualizarStatus(db, tarefaId, novoStatus);
      const eu = ctx.membros.find((m) => m.id === usuarioId)!;
      await historico.registrar(db, {
        grupoId: ctx.grupo.id,
        tarefaId,
        usuarioId,
        tipo: 'ENTREGA_ENVIADA',
        descricao: `${eu.nome} ${reenvio ? 'reenviou a entrega corrigida de' : 'enviou a entrega de'} "${ctx.tarefa.titulo}".`,
      });
      if (comAtraso) {
        await tarefas.marcarEntregueComAtraso(db, tarefaId);
        await historico.registrar(db, {
          grupoId: ctx.grupo.id,
          tarefaId,
          usuarioId,
          tipo: 'ENTREGA_COM_ATRASO',
          descricao: `A entrega de "${ctx.tarefa.titulo}" foi feita depois do prazo (${formatarDataHora(ctx.tarefa.prazo)}).`,
        });
      }
    });
  } catch (err) {
    if (caminhoGravado) fs.rmSync(caminhoGravado, { force: true });
    throw err;
  }
  return detalhar(tarefaId, usuarioId);
}

export async function listar(tarefaId: number, usuarioId: number) {
  await contextoDaTarefa(pool, tarefaId, usuarioId);
  return (await entregas.listarDaTarefa(pool, tarefaId)).map(entregaDto);
}

export async function arquivo(entregaId: number, usuarioId: number) {
  const entrega = await entregas.buscarPorId(pool, entregaId);
  if (!entrega) throw naoEncontrado('Entrega não encontrada.');
  const tarefa = await tarefas.buscarPorId(pool, entrega.tarefa_id);
  await contextoDoGrupo(pool, tarefa!.grupo_id, usuarioId);
  if (!entrega.arquivo_caminho) throw naoEncontrado('Esta entrega foi feita por link e não tem arquivo.');
  const nome = entrega.arquivo_nome ?? 'arquivo';
  if (entrega.arquivo_caminho.startsWith('banco:')) {
    const { rows } = await pool.query<{ conteudo: Buffer }>(
      'SELECT conteudo FROM arquivo_armazenado WHERE chave = $1',
      [entrega.arquivo_caminho.slice('banco:'.length)],
    );
    if (!rows[0]) throw naoEncontrado('O arquivo desta entrega não foi encontrado no servidor.');
    return { conteudo: rows[0].conteudo, caminho: null, nome, tipo: entrega.arquivo_tipo };
  }
  const caminho = path.join(config.uploadDir, entrega.arquivo_caminho);
  if (!fs.existsSync(caminho)) throw naoEncontrado('O arquivo desta entrega não foi encontrado no servidor.');
  return { conteudo: null, caminho, nome, tipo: entrega.arquivo_tipo };
}
