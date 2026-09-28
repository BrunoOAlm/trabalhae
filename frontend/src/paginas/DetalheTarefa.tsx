import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Pencil,
  Play,
  Search,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { baixarArquivo } from '../api/cliente';
import { tarefaApi } from '../api/servicos';
import type { Entrega, TarefaDetalhe } from '../api/tipos';
import { Avatar, Botao, Carimbo, Carregando, ErroCarregar, SeloAtraso, SeloStatus } from '../componentes/ui';
import { useAuth } from '../contexto/AuthContext';
import { useToast } from '../contexto/ToastContext';
import { ConfirmarModal } from '../modais/ModaisGrupo';
import { CorrecaoModal, EditarTarefaModal, EnviarEntregaModal, RevisorModal, TrocarResponsavelModal } from '../modais/ModaisTarefa';
import { formatarDataHora, prazoRelativo, tamanhoArquivo } from '../util/datas';
import { useCarregar } from '../util/useCarregar';

type ModalAberto = 'enviar' | 'correcao' | 'editar' | 'responsavel' | 'revisor' | 'excluir' | null;

export function DetalheTarefa() {
  const { id } = useParams();
  const tarefaId = Number(id);
  const { usuario } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { dados: t, setDados, erro, carregando, recarregar } = useCarregar(() => tarefaApi.detalhar(tarefaId), [tarefaId]);
  const [modal, setModal] = useState<ModalAberto>(null);
  const [agindo, setAgindo] = useState<string | null>(null);

  if (carregando) return <Carregando />;
  if (erro || !t) return <ErroCarregar mensagem={erro ?? ''} tentarDeNovo={recarregar} />;

  const p = t.permissoes;
  const nome = (pessoa: { id: number; nome: string } | null) => (pessoa ? (pessoa.id === usuario?.id ? 'você' : pessoa.nome) : '');
  const ultimaCorrecao = [...t.revisoes].reverse().find((r) => r.resultado === 'CORRECAO');

  const acao = async (chave: string, fn: () => Promise<TarefaDetalhe>, sucesso: string) => {
    setAgindo(chave);
    try {
      setDados(await fn());
      toast.sucesso(sucesso);
    } catch (e) {
      toast.erro(e);
    } finally {
      setAgindo(null);
    }
  };

  const concluirModal = (nova: TarefaDetalhe) => {
    setDados(nova);
    setModal(null);
  };

  return (
    <div>
      <Link
        to={`/grupos/${t.grupo.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite-suave hover:text-tinta"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t.grupo.titulo}
      </Link>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <SeloStatus status={t.status} grande />
            {t.atrasada && <SeloAtraso tipo="atrasada" />}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">{t.titulo}</h1>
          {t.descricao && <p className="mt-2 whitespace-pre-line text-grafite-suave">{t.descricao}</p>}
        </div>
        {(t.status === 'CONCLUIDA' || t.entregueComAtraso) && (
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end sm:pt-2">
            {t.status === 'CONCLUIDA' && <Carimbo texto="Aprovada" />}
            {t.entregueComAtraso && <Carimbo texto="Entregue com atraso" cor="vermelho" />}
          </div>
        )}
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linha bg-linha text-sm sm:grid-cols-4">
        <Info rotulo="Responsável">
          <span className="flex items-center gap-2">
            <Avatar nome={t.responsavel.nome} id={t.responsavel.id} tamanho="sm" />
            <span className={p.souResponsavel ? 'marca-texto font-semibold' : 'font-semibold'}>
              {p.souResponsavel ? 'Você' : t.responsavel.nome}
            </span>
          </span>
        </Info>
        <Info rotulo="Revisor">
          {t.revisor ? (
            <span className="flex items-center gap-2">
              <Avatar nome={t.revisor.nome} id={t.revisor.id} tamanho="sm" />
              <span className="font-semibold">{p.souRevisor ? 'Você' : t.revisor.nome}</span>
            </span>
          ) : (
            <span className="font-semibold text-amber-700">Falta indicar</span>
          )}
        </Info>
        <Info rotulo="Prazo">
          <span className="font-semibold">{formatarDataHora(t.prazo)}</span>
          {t.status !== 'CONCLUIDA' && (
            <span className={`block text-xs ${t.atrasada ? 'font-semibold text-red-700' : 'text-grafite-suave'}`}>
              {prazoRelativo(t.prazo)}
            </span>
          )}
        </Info>
        <Info rotulo="Entregas">
          <span className="font-semibold">{t.totalEntregas}</span>
          <span className="text-grafite-suave">
            {' '}
            {t.totalCorrecoes > 0 && `(${t.totalCorrecoes} ${t.totalCorrecoes === 1 ? 'correção' : 'correções'})`}
          </span>
        </Info>
      </dl>

      {/* próximo passo */}
      <section className="mt-6 rounded-2xl border border-tinta/20 bg-folha p-5 sm:p-6" aria-label="Próximo passo">
        {t.status === 'EM_CORRECAO' && ultimaCorrecao && (
          <div className="mb-4 rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-inset ring-orange-200">
            <p className="text-sm font-semibold text-orange-900">{ultimaCorrecao.revisor.nome} pediu correção:</p>
            <p className="mt-1 text-orange-900">“{ultimaCorrecao.motivo}”</p>
          </div>
        )}
        <p className="font-semibold">{mensagemProximoPasso(t, nome)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {p.podeIniciar && (
            <Botao
              variante="secundario"
              icone={<Play className="size-4" aria-hidden />}
              carregando={agindo === 'iniciar'}
              onClick={() => acao('iniciar', () => tarefaApi.iniciar(t.id), 'Tarefa em andamento.')}
            >
              Começar tarefa
            </Botao>
          )}
          {p.podeEnviar && (
            <Botao icone={<Send className="size-4" aria-hidden />} onClick={() => setModal('enviar')}>
              {t.status === 'EM_CORRECAO' ? 'Reenviar entrega corrigida' : 'Enviar entrega'}
            </Botao>
          )}
          {p.podeIniciarRevisao && (
            <Botao
              icone={<Search className="size-4" aria-hidden />}
              carregando={agindo === 'revisar'}
              onClick={() => acao('revisar', () => tarefaApi.iniciarRevisao(t.id), 'Revisão iniciada.')}
            >
              Começar revisão
            </Botao>
          )}
          {p.podeRevisar && (
            <>
              <Botao variante="perigo" icone={<XCircle className="size-4" aria-hidden />} onClick={() => setModal('correcao')}>
                Pedir correção
              </Botao>
              <Botao
                variante="sucesso"
                icone={<CheckCircle2 className="size-4" aria-hidden />}
                carregando={agindo === 'aprovar'}
                onClick={() => acao('aprovar', () => tarefaApi.aprovar(t.id), 'Tarefa aprovada e concluída.')}
              >
                Aprovar
              </Botao>
            </>
          )}
        </div>

        {(p.podeEditar || p.podeTrocarResponsavel || p.podeDefinirRevisor || p.podeExcluir) && (
          <div className="mt-5 flex flex-wrap gap-1 border-t border-linha pt-4">
            <span className="mr-2 self-center text-xs font-semibold text-grafite-suave">Representante:</span>
            {p.podeEditar && (
              <Botao variante="fantasma" className="!px-3 !py-1.5" icone={<Pencil className="size-3.5" aria-hidden />} onClick={() => setModal('editar')}>
                Editar
              </Botao>
            )}
            {p.podeTrocarResponsavel && (
              <Botao variante="fantasma" className="!px-3 !py-1.5" icone={<ArrowRightLeft className="size-3.5" aria-hidden />} onClick={() => setModal('responsavel')}>
                Trocar responsável
              </Botao>
            )}
            {p.podeDefinirRevisor && (
              <Botao variante="fantasma" className="!px-3 !py-1.5" icone={<UserCheck className="size-3.5" aria-hidden />} onClick={() => setModal('revisor')}>
                {t.revisor ? 'Trocar revisor' : 'Indicar revisor'}
              </Botao>
            )}
            {p.podeExcluir && (
              <Botao variante="fantasma" className="!px-3 !py-1.5 hover:!text-red-700" icone={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setModal('excluir')}>
                Excluir
              </Botao>
            )}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="entregas">
          <h2 id="entregas" className="text-xl font-bold">
            Entregas
          </h2>
          {t.entregas.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-linha px-4 py-8 text-center text-sm text-grafite-suave">
              Nenhuma entrega ainda.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {t.entregas.map((e, i) => (
                <ItemEntrega key={e.id} entrega={e} numero={i + 1} />
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="revisoes">
            <h2 id="revisoes" className="text-xl font-bold">
              Revisões
            </h2>
            {t.revisoes.length === 0 ? (
              <p className="mt-3 text-sm text-grafite-suave">Nenhuma revisão ainda.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {t.revisoes.map((r) => (
                  <li key={r.id} className="rounded-xl border border-linha bg-folha p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-bold ${r.resultado === 'APROVADA' ? 'text-emerald-700' : 'text-orange-700'}`}
                      >
                        {r.resultado === 'APROVADA' ? 'Aprovada' : 'Correção pedida'}
                      </span>
                      <span className="text-xs text-grafite-suave">{formatarDataHora(r.revisadaEm)}</span>
                    </div>
                    <p className="mt-1 text-sm text-grafite-suave">por {r.revisor.nome}</p>
                    {r.motivo && <p className="mt-2 text-sm">“{r.motivo}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="hist-tarefa">
            <h2 id="hist-tarefa" className="text-xl font-bold">
              Histórico da tarefa
            </h2>
            <ol className="mt-4 space-y-3 border-l-2 border-linha pl-4">
              {t.historico.map((ev) => (
                <li key={ev.id} className="relative text-sm">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-tinta/60" aria-hidden />
                  <p>{ev.descricao}</p>
                  <p className="text-xs text-grafite-suave">{formatarDataHora(ev.criadoEm)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      <EnviarEntregaModal aberto={modal === 'enviar'} aoFechar={() => setModal(null)} aoConcluir={concluirModal} tarefa={t} />
      <CorrecaoModal aberto={modal === 'correcao'} aoFechar={() => setModal(null)} aoConcluir={concluirModal} tarefa={t} />
      <EditarTarefaModal aberto={modal === 'editar'} aoFechar={() => setModal(null)} aoConcluir={concluirModal} tarefa={t} />
      <TrocarResponsavelModal aberto={modal === 'responsavel'} aoFechar={() => setModal(null)} aoConcluir={concluirModal} tarefa={t} />
      <RevisorModal aberto={modal === 'revisor'} aoFechar={() => setModal(null)} aoConcluir={concluirModal} tarefa={t} />
      <ConfirmarModal
        aberto={modal === 'excluir'}
        aoFechar={() => setModal(null)}
        aoConcluir={() => navigate(`/grupos/${t.grupo.id}`)}
        titulo="Excluir tarefa?"
        descricao={`"${t.titulo}" será removida do painel. A exclusão fica registrada no histórico do grupo.`}
        textoConfirmar="Excluir tarefa"
        variante="perigo"
        acao={() => tarefaApi.excluir(t.id)}
        mensagemSucesso="Tarefa excluída."
      />
    </div>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="bg-folha px-4 py-3.5">
      <dt className="text-xs font-semibold text-grafite-suave">{rotulo}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function ItemEntrega({ entrega: e, numero }: { entrega: Entrega; numero: number }) {
  const toast = useToast();
  const [baixando, setBaixando] = useState(false);
  const baixar = async () => {
    if (!e.arquivo) return;
    setBaixando(true);
    try {
      await baixarArquivo(e.arquivo.url, e.arquivo.nome);
    } catch (err) {
      toast.erro(err);
    } finally {
      setBaixando(false);
    }
  };
  return (
    <li className="rounded-xl border border-linha bg-folha p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Avatar nome={e.autor.nome} id={e.autor.id} />
          <div>
            <p className="text-sm font-semibold">
              Entrega {numero} de {e.autor.nome}
            </p>
            <p className="text-xs text-grafite-suave">{formatarDataHora(e.enviadaEm)}</p>
          </div>
        </div>
        {e.comAtraso && <SeloAtraso tipo="entregue" />}
      </div>
      {e.comentario && <p className="mt-3 text-sm">{e.comentario}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {e.arquivo && (
          <button
            onClick={baixar}
            disabled={baixando}
            className="inline-flex items-center gap-2 rounded-lg bg-papel px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-linha hover:bg-tinta-clara"
          >
            <Download className="size-4 text-tinta" aria-hidden />
            {e.arquivo.nome}
            <span className="font-normal text-grafite-suave">{tamanhoArquivo(e.arquivo.tamanho)}</span>
          </button>
        )}
        {e.link && (
          <a
            href={e.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-2 rounded-lg bg-papel px-3 py-2 text-sm font-semibold ring-1 ring-inset ring-linha hover:bg-tinta-clara"
          >
            <ExternalLink className="size-4 shrink-0 text-tinta" aria-hidden />
            <span className="truncate">{e.link.replace(/^https?:\/\//, '')}</span>
          </a>
        )}
      </div>
    </li>
  );
}

function mensagemProximoPasso(t: TarefaDetalhe, nome: (p: { id: number; nome: string } | null) => string): string {
  const p = t.permissoes;
  if (t.grupo.status === 'FINALIZADO') return 'O trabalho foi finalizado. Esta tarefa não pode mais ser alterada.';
  switch (t.status) {
    case 'PENDENTE':
      return p.souResponsavel ? 'Esta tarefa é sua. Comece quando quiser e envie sua parte até o prazo.' : `Aguardando ${nome(t.responsavel)} começar.`;
    case 'EM_ANDAMENTO':
      return p.souResponsavel ? 'Você está fazendo esta tarefa. Envie sua parte quando terminar.' : `${t.responsavel.nome} está fazendo esta tarefa.`;
    case 'ENVIADA':
      if (!t.revisor) return 'Entrega enviada. Falta o representante indicar quem revisa.';
      return p.souRevisor ? `${t.responsavel.nome} enviou a parte. Você revisa esta tarefa.` : `Entrega enviada. Aguardando revisão de ${nome(t.revisor)}.`;
    case 'EM_REVISAO':
      return p.souRevisor ? 'Você está revisando. Aprove ou peça correção explicando o motivo.' : `${t.revisor?.nome} está revisando a entrega.`;
    case 'EM_CORRECAO':
      return p.souResponsavel ? 'Corrija sua parte e reenvie. Ela volta para revisão.' : `Aguardando ${t.responsavel.nome} reenviar a parte corrigida.`;
    case 'CONCLUIDA':
      return 'Tarefa aprovada e concluída.';
  }
}
