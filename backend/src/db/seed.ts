import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import type { PoolClient } from 'pg';
import { config } from '../config';
import { TipoEvento } from '../repositories/historicoRepository';
import { migrate } from './migrate';
import { pool, withTx } from './pool';

/**
 * Dados de exemplo para demonstração: usuários Ana, Bruno, Carla, Diego e Eduardo (senha 123456),
 * um grupo com tarefas em todos os status e um convite pendente.
 */
const DIA = 24 * 60 * 60 * 1000;
const HORA = 60 * 60 * 1000;
const TRAVA_SEED = 727002;

export async function popularDadosDeExemplo(db: PoolClient): Promise<void> {
  const agora = Date.now();
  const em = (ms: number) => new Date(agora + ms);
  /** Prazo "redondo": o dia de hoje + N, às 23:59. */
  const prazo = (ms: number) => {
    const d = new Date(agora + ms);
    d.setHours(23, 59, 0, 0);
    return d;
  };
  const hash = await bcrypt.hash('123456', 10);
  const u: Record<string, number> = {};
  for (const nome of ['Ana', 'Bruno', 'Carla', 'Diego', 'Eduardo']) {
    const { rows } = await db.query<{ id: number }>(
      'INSERT INTO usuario (nome, email, senha_hash, criado_em) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome, `${nome.toLowerCase()}@trabalhae.com`, hash, em(-30 * DIA)],
    );
    u[nome] = rows[0].id;
  }

  const evento = (g: number, t: number | null, usuario: number | null, tipo: TipoEvento, descricao: string, quando: Date) =>
    db.query(
      'INSERT INTO historico_evento (grupo_id, tarefa_id, usuario_id, tipo, descricao, criado_em) VALUES ($1,$2,$3,$4,$5,$6)',
      [g, t, usuario, tipo, descricao, quando],
    );

  // ---------- Grupo 1: Engenharia de Software (Ana representante) ----------
  const { rows: g1r } = await db.query<{ id: number }>(
    `INSERT INTO grupo (titulo, objetivo, prazo_final, limite_membros, representante_id, criado_em)
     VALUES ($1, $2, $3, 4, $4, $5) RETURNING id`,
    [
      'Trabalho de Engenharia de Software',
      'Documentar e prototipar o Trabalhaê: regras de negócio, requisitos, BPMN, casos de uso e protótipo das telas.',
      prazo(20 * DIA),
      u.Ana,
      em(-12 * DIA),
    ],
  );
  const g1 = g1r[0].id;
  await evento(g1, null, u.Ana, 'GRUPO_CRIADO', 'Ana criou o grupo "Trabalho de Engenharia de Software" e se tornou representante.', em(-12 * DIA));
  const entradas: [string, number][] = [['Ana', -12], ['Bruno', -11], ['Carla', -11], ['Diego', -10]];
  for (const [nome, dia] of entradas) {
    await db.query('INSERT INTO membro_grupo (grupo_id, usuario_id, entrou_em) VALUES ($1, $2, $3)', [g1, u[nome], em(dia * DIA)]);
    if (nome !== 'Ana') {
      await db.query(
        `INSERT INTO convite (grupo_id, convidado_id, status, criado_em, respondido_em) VALUES ($1, $2, 'ACEITO', $3, $4)`,
        [g1, u[nome], em(-12 * DIA + HORA), em(dia * DIA)],
      );
      await evento(g1, null, u.Ana, 'MEMBRO_CONVIDADO', `Ana convidou ${nome} para o grupo.`, em(-12 * DIA + HORA));
      await evento(g1, null, u[nome], 'CONVITE_ACEITO', `${nome} aceitou o convite e entrou no grupo.`, em(dia * DIA));
    }
  }

  type Entrega = { dia: number; atraso?: boolean; link?: string; comentario: string };
  type Revisao = { dia: number; resultado: 'APROVADA' | 'CORRECAO'; motivo?: string; revisor: string };
  const criarTarefa = async (t: {
    titulo: string;
    descricao: string;
    prazo: number;
    resp: string;
    revisor?: string;
    status: string;
    criada: number;
    iniciada?: number;
    entregas?: Entrega[];
    revisoes?: Revisao[];
    revisaoIniciada?: number;
  }) => {
    const atrasoFinal = (t.entregas ?? []).some((e) => e.atraso);
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO tarefa (grupo_id, titulo, descricao, prazo, responsavel_id, revisor_id, status, entregue_com_atraso, criado_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [g1, t.titulo, t.descricao, prazo(t.prazo), u[t.resp], t.revisor ? u[t.revisor] : null, t.status, atrasoFinal, em(t.criada)],
    );
    const id = rows[0].id;
    await evento(g1, id, u.Ana, 'TAREFA_CRIADA', `Ana criou a tarefa "${t.titulo}".`, em(t.criada));
    await evento(
      g1, id, u.Ana, 'RESPONSAVEL_ATRIBUIDO',
      `Ana atribuiu "${t.titulo}" a ${t.resp}${t.revisor ? `, com revisão de ${t.revisor}.` : '.'}`,
      em(t.criada),
    );
    if (t.iniciada) await evento(g1, id, u[t.resp], 'TAREFA_INICIADA', `${t.resp} começou a tarefa "${t.titulo}".`, em(t.iniciada));

    const eventosOrdenados: { quando: number; fn: () => Promise<unknown> }[] = [];
    let ultimaEntregaId = 0;
    for (const [i, e] of (t.entregas ?? []).entries()) {
      eventosOrdenados.push({
        quando: e.dia,
        fn: async () => {
          const { rows: er } = await db.query<{ id: number }>(
            `INSERT INTO entrega (tarefa_id, autor_id, comentario, link, enviada_em, com_atraso)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
            [id, u[t.resp], e.comentario, e.link ?? 'https://docs.google.com/document/d/exemplo-trabalhae', em(e.dia), !!e.atraso],
          );
          ultimaEntregaId = er[0].id;
          await evento(g1, id, u[t.resp], 'ENTREGA_ENVIADA',
            `${t.resp} ${i > 0 ? 'reenviou a entrega corrigida de' : 'enviou a entrega de'} "${t.titulo}".`, em(e.dia));
          if (e.atraso) {
            await evento(g1, id, u[t.resp], 'ENTREGA_COM_ATRASO', `A entrega de "${t.titulo}" foi feita depois do prazo.`, em(e.dia));
          }
        },
      });
    }
    for (const r of t.revisoes ?? []) {
      eventosOrdenados.push({
        quando: r.dia,
        fn: async () => {
          await evento(g1, id, u[r.revisor], 'REVISAO_INICIADA', `${r.revisor} começou a revisar "${t.titulo}".`, em(r.dia - HORA));
          await db.query(
            `INSERT INTO revisao (tarefa_id, entrega_id, revisor_id, resultado, motivo, revisada_em) VALUES ($1,$2,$3,$4,$5,$6)`,
            [id, ultimaEntregaId, u[r.revisor], r.resultado, r.motivo ?? null, em(r.dia)],
          );
          if (r.resultado === 'APROVADA') {
            await evento(g1, id, u[r.revisor], 'TAREFA_APROVADA', `${r.revisor} aprovou "${t.titulo}". Tarefa concluída.`, em(r.dia));
          } else {
            await evento(g1, id, u[r.revisor], 'CORRECAO_SOLICITADA', `${r.revisor} pediu correção em "${t.titulo}": ${r.motivo}`, em(r.dia));
          }
        },
      });
    }
    if (t.revisaoIniciada) {
      const revisor = t.revisor ?? 'Ana';
      eventosOrdenados.push({
        quando: t.revisaoIniciada,
        fn: () => evento(g1, id, u[revisor], 'REVISAO_INICIADA', `${revisor} começou a revisar "${t.titulo}".`, em(t.revisaoIniciada!)),
      });
    }
    eventosOrdenados.sort((a, b) => a.quando - b.quando);
    for (const ev of eventosOrdenados) await ev.fn();
    return id;
  };

  await criarTarefa({
    titulo: 'Levantar regras de negócio',
    descricao: 'Definir as regras que o sistema deve seguir, a partir do fluxo do processo.',
    prazo: -5 * DIA, resp: 'Bruno', status: 'CONCLUIDA', criada: -9 * DIA, iniciada: -8 * DIA,
    entregas: [{ dia: -6 * DIA, comentario: 'Regras RN01 a RN07 no documento compartilhado.' }],
    revisoes: [{ dia: -5.5 * DIA, resultado: 'APROVADA', revisor: 'Ana' }],
  });
  await criarTarefa({
    titulo: 'Escrever requisitos funcionais',
    descricao: 'Listar os requisitos funcionais e não funcionais no formato de quadro do modelo.',
    prazo: -3 * DIA, resp: 'Carla', status: 'CONCLUIDA', criada: -9 * DIA, iniciada: -7 * DIA,
    entregas: [{ dia: -2 * DIA, atraso: true, comentario: 'Quadros 8 e 9 prontos. Desculpem o atraso!' }],
    revisoes: [{ dia: -1 * DIA, resultado: 'APROVADA', revisor: 'Ana' }],
  });
  await criarTarefa({
    titulo: 'Desenhar o BPMN',
    descricao: 'Diagrama BPMN com as raias Representante, Membro e Sistema, no Visual Paradigm.',
    prazo: 3 * DIA, resp: 'Diego', status: 'EM_CORRECAO', criada: -8 * DIA, iniciada: -4 * DIA,
    entregas: [{ dia: -1 * DIA, comentario: 'Primeira versão do BPMN exportada.' }],
    revisoes: [{
      dia: -0.5 * DIA, resultado: 'CORRECAO', revisor: 'Ana',
      motivo: 'Faltou o gateway de junção antes de "Revisar entrega" e a raia do Sistema ficou sem nome.',
    }],
  });
  await criarTarefa({
    titulo: 'Diagrama de casos de uso',
    descricao: 'Atores Aluno e Representante com generalização e os casos de uso de cada um.',
    prazo: 4 * DIA, resp: 'Bruno', status: 'ENVIADA', criada: -7 * DIA, iniciada: -3 * DIA,
    entregas: [{ dia: -3 * HORA, comentario: 'Diagrama pronto para revisão.' }],
  });
  await criarTarefa({
    titulo: 'Protótipo das telas no Stitch',
    descricao: 'Login, meus grupos, painel do grupo e detalhe da tarefa.',
    prazo: 6 * DIA, resp: 'Carla', status: 'EM_ANDAMENTO', criada: -6 * DIA, iniciada: -2 * DIA,
  });
  await criarTarefa({
    titulo: 'Pesquisa de trabalhos relacionados',
    descricao: 'Comparar o Trabalhaê com Trello, Notion e Google Classroom.',
    prazo: -1 * DIA, resp: 'Diego', status: 'PENDENTE', criada: -6 * DIA,
  });
  await criarTarefa({
    titulo: 'Introdução e objetivos do documento',
    descricao: 'Texto de introdução, problema e objetivos do Trabalhaê.',
    prazo: 2 * DIA, resp: 'Ana', revisor: 'Bruno', status: 'EM_REVISAO', criada: -6 * DIA, iniciada: -3 * DIA,
    entregas: [{ dia: -5 * HORA, comentario: 'Introdução finalizada, Bruno pode revisar.' }],
    revisaoIniciada: -2 * HORA,
  });
  await criarTarefa({
    titulo: 'Montar os slides da apresentação',
    descricao: 'Slides com o problema, a solução, os diagramas e a demonstração.',
    prazo: 10 * DIA, resp: 'Bruno', status: 'PENDENTE', criada: -1 * DIA,
  });

  // ---------- Grupo 2: Banco de Dados (Carla representante), com convite pendente para Eduardo ----------
  const { rows: g2r } = await db.query<{ id: number }>(
    `INSERT INTO grupo (titulo, objetivo, prazo_final, limite_membros, representante_id, criado_em)
     VALUES ($1, $2, $3, 3, $4, $5) RETURNING id`,
    ['Projeto de Banco de Dados', 'Modelar e implementar o banco de dados de uma biblioteca.', prazo(15 * DIA), u.Carla, em(-2 * DIA)],
  );
  const g2 = g2r[0].id;
  await db.query('INSERT INTO membro_grupo (grupo_id, usuario_id, entrou_em) VALUES ($1, $2, $3), ($1, $4, $5)', [
    g2, u.Carla, em(-2 * DIA), u.Diego, em(-1.5 * DIA),
  ]);
  await db.query(`INSERT INTO convite (grupo_id, convidado_id, status, criado_em, respondido_em) VALUES ($1, $2, 'ACEITO', $3, $4)`, [
    g2, u.Diego, em(-2 * DIA + HORA), em(-1.5 * DIA),
  ]);
  await db.query(`INSERT INTO convite (grupo_id, convidado_id, status, criado_em) VALUES ($1, $2, 'PENDENTE', $3)`, [
    g2, u.Eduardo, em(-1 * DIA),
  ]);
  await evento(g2, null, u.Carla, 'GRUPO_CRIADO', 'Carla criou o grupo "Projeto de Banco de Dados" e se tornou representante.', em(-2 * DIA));
  await evento(g2, null, u.Carla, 'MEMBRO_CONVIDADO', 'Carla convidou Diego para o grupo.', em(-2 * DIA + HORA));
  await evento(g2, null, u.Diego, 'CONVITE_ACEITO', 'Diego aceitou o convite e entrou no grupo.', em(-1.5 * DIA));
  await evento(g2, null, u.Carla, 'MEMBRO_CONVIDADO', 'Carla convidou Eduardo para o grupo.', em(-1 * DIA));
  const { rows: t2 } = await db.query<{ id: number }>(
    `INSERT INTO tarefa (grupo_id, titulo, descricao, prazo, responsavel_id, criado_em)
     VALUES ($1, 'Modelo entidade-relacionamento', 'Diagrama ER com as entidades Livro, Autor, Leitor e Empréstimo.', $2, $3, $4) RETURNING id`,
    [g2, prazo(7 * DIA), u.Diego, em(-1 * DIA)],
  );
  await evento(g2, t2[0].id, u.Carla, 'TAREFA_CRIADA', 'Carla criou a tarefa "Modelo entidade-relacionamento".', em(-1 * DIA));
  await evento(g2, t2[0].id, u.Carla, 'RESPONSAVEL_ATRIBUIDO', 'Carla atribuiu "Modelo entidade-relacionamento" a Diego.', em(-1 * DIA));
}

/** Linha de comando (npm run seed): apaga tudo e recria os dados de exemplo. Só no perfil dev. */
async function seedCli() {
  if (config.profile !== 'dev') {
    throw new Error('O seed só roda com APP_PROFILE=dev.');
  }
  await migrate(false);
  await withTx(async (db) => {
    await db.query(
      'TRUNCATE historico_evento, revisao, entrega, tarefa, convite, membro_grupo, grupo, usuario RESTART IDENTITY CASCADE',
    );
    await popularDadosDeExemplo(db);
  });
  fs.mkdirSync(config.uploadDir, { recursive: true });
  console.log('Dados de exemplo criados. Entre com ana@trabalhae.com (ou bruno, carla, diego, eduardo) e senha 123456.');
}

/** Usado na Vercel: cria os dados de exemplo só se o banco ainda não tiver nenhum usuário. */
export async function popularSeVazio(): Promise<boolean> {
  return withTx(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock($1)', [TRAVA_SEED]);
    const { rows } = await db.query<{ total: number }>('SELECT count(*)::int AS total FROM usuario');
    if (rows[0].total > 0) return false;
    await popularDadosDeExemplo(db);
    return true;
  });
}

if (require.main === module) {
  seedCli()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
