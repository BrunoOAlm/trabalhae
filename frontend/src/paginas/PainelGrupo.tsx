import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  FileText,
  History,
  LogOut,
  Pencil,
  Plus,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { grupoApi } from '../api/servicos';
import type { Painel } from '../api/tipos';
import { CartaoTarefa } from '../componentes/CartaoTarefa';
import { Menu, type ItemMenu } from '../componentes/Menu';
import { Avatar, BarraProgresso, Botao, Carimbo, Carregando, ErroCarregar, Selo } from '../componentes/ui';
import { useAuth } from '../contexto/AuthContext';
import { ConfirmarModal, ConvidarModal, NovaTarefaModal, TransferirModal } from '../modais/ModaisGrupo';
import { formatarDataHora, formatarDataCurta, prazoRelativo } from '../util/datas';
import { COR_STATUS } from '../util/status';
import { useCarregar } from '../util/useCarregar';

type ModalAberto = 'tarefa' | 'convidar' | 'transferir' | 'finalizar' | 'sair' | null;

export function PainelGrupo() {
  const { id } = useParams();
  const grupoId = Number(id);
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { dados, erro, carregando, recarregar } = useCarregar(() => grupoApi.painel(grupoId), [grupoId]);
  const [modal, setModal] = useState<ModalAberto>(null);

  if (carregando) return <Carregando />;
  if (erro || !dados) return <ErroCarregar mensagem={erro ?? ''} tentarDeNovo={recarregar} />;

  const { grupo, progresso } = dados;
  const ativo = grupo.status === 'ATIVO';
  const souRep = grupo.souRepresentante;
  const vagas = grupo.limiteMembros - grupo.totalMembros;
  const fechar = () => setModal(null);
  const concluir = () => {
    setModal(null);
    void recarregar();
  };

  const itensMenu: ItemMenu[] = [
    { rotulo: 'Histórico do grupo', icone: <History className="size-4" />, aoClicar: () => navigate(`/grupos/${grupoId}/historico`) },
    {
      rotulo: grupo.status === 'FINALIZADO' ? 'Relatório final' : 'Prévia do relatório',
      icone: <FileText className="size-4" />,
      aoClicar: () => navigate(`/grupos/${grupoId}/relatorio`),
    },
    ...(ativo && souRep
      ? [
          { rotulo: 'Editar trabalho', icone: <Pencil className="size-4" />, aoClicar: () => navigate(`/grupos/${grupoId}/editar`) },
          { rotulo: 'Transferir representante', icone: <ArrowRightLeft className="size-4" />, aoClicar: () => setModal('transferir') },
        ]
      : []),
    ...(ativo && !souRep
      ? [{ rotulo: 'Sair do grupo', icone: <LogOut className="size-4" />, aoClicar: () => setModal('sair'), perigo: true }]
      : []),
  ];

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        Meus trabalhos
      </Link>

      {/* cabeçalho do trabalho */}
      <header className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{grupo.titulo}</h1>
          <p className="mt-2 text-grafite-suave">{grupo.objetivo}</p>
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="size-4 text-grafite-suave" aria-hidden />
              <dt className="sr-only">Prazo final</dt>
              <dd>
                <span className="font-semibold">{formatarDataHora(grupo.prazoFinal)}</span>
                {ativo && <span className="text-grafite-suave"> ({prazoRelativo(grupo.prazoFinal)})</span>}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <dt className="text-grafite-suave">Representante</dt>
              <dd className="font-semibold">{grupo.representante.id === usuario?.id ? 'Você' : grupo.representante.nome}</dd>
            </div>
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Menu rotulo="Mais" itens={itensMenu} />
          {ativo && souRep && (
            <Botao icone={<Plus className="size-4" aria-hidden />} onClick={() => setModal('tarefa')}>
              Nova tarefa
            </Botao>
          )}
        </div>
      </header>

      {/* progresso: o momento animado da página */}
      <section className="mt-6 rounded-2xl border border-linha bg-folha p-5">
        <div className="mb-2.5 flex items-baseline justify-between gap-4">
          <p className="text-sm">
            <span className="font-display text-2xl font-extrabold">{progresso.concluidas}</span>
            <span className="text-grafite-suave"> de {progresso.total} tarefas concluídas</span>
          </p>
          <span className="font-display text-lg font-bold text-tinta">{progresso.percentual}%</span>
        </div>
        <BarraProgresso percentual={progresso.percentual} animar />
      </section>

      {/* avisos */}
      <Avisos painel={dados} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* quadro por status */}
        <section aria-label="Tarefas por status" className="-mx-4 snap-x snap-mandatory overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 xl:snap-none">
          <div className="grid min-w-max auto-cols-[260px] grid-flow-col gap-3 xl:min-w-0 xl:auto-cols-auto xl:grid-flow-row xl:grid-cols-3">
            {dados.colunas.map((col) => (
              <div key={col.status} className={`flex snap-start flex-col rounded-2xl p-2.5 ${COR_STATUS[col.status].coluna}`}>
                <h2 className="flex items-center gap-2 px-1.5 pb-2.5 pt-1 font-sans text-sm font-bold">
                  <span className={`size-2.5 rounded-full ${COR_STATUS[col.status].ponto}`} aria-hidden />
                  {col.rotulo}
                  <span className="ml-auto rounded-full bg-folha px-2 text-xs font-semibold text-grafite-suave">{col.tarefas.length}</span>
                </h2>
                <div className="flex flex-1 flex-col gap-2">
                  {col.tarefas.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-grafite/10 px-3 py-5 text-center text-xs text-grafite-suave">
                      Nenhuma tarefa
                    </p>
                  ) : (
                    col.tarefas.map((t) => <CartaoTarefa key={t.id} tarefa={t} meuId={usuario!.id} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* lateral: membros e finalização */}
        <aside className="space-y-4">
          <section className="rounded-2xl border border-linha bg-folha p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Membros</h2>
              <span className="text-sm text-grafite-suave">
                {grupo.totalMembros} de {grupo.limiteMembros}
              </span>
            </div>
            <ul className="mt-4 space-y-3.5">
              {dados.membros.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar nome={m.nome} id={m.id} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      {m.nome}
                      {m.id === usuario?.id && <span className="font-normal text-grafite-suave">(você)</span>}
                    </p>
                    <p className="text-xs text-grafite-suave">
                      {m.totalTarefas === 0
                        ? 'Sem tarefa'
                        : `${m.tarefasConcluidas} de ${m.totalTarefas} ${m.totalTarefas === 1 ? 'concluída' : 'concluídas'}`}
                      {m.tarefasAtrasadas > 0 && <span className="font-semibold text-red-700">, {m.tarefasAtrasadas} atrasada</span>}
                    </p>
                  </div>
                  {m.representante && <Selo>Rep.</Selo>}
                </li>
              ))}
            </ul>
            {dados.convitesPendentes.length > 0 && (
              <div className="mt-4 border-t border-linha pt-4">
                <p className="text-xs font-semibold text-grafite-suave">Aguardando resposta</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {dados.convitesPendentes.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>{c.convidado.nome}</span>
                      <span className="text-grafite-suave">desde {formatarDataCurta(c.criadoEm)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ativo && souRep && vagas > 0 && (
              <Botao
                variante="secundario"
                className="mt-5 w-full"
                icone={<UserPlus className="size-4" aria-hidden />}
                onClick={() => setModal('convidar')}
              >
                Convidar membro
              </Botao>
            )}
          </section>

          {ativo && souRep && (
            <section className="rounded-2xl border border-linha bg-folha p-5">
              <h2 className="text-lg font-bold">Finalizar trabalho</h2>
              {dados.finalizacao.pode ? (
                <p className="mt-1.5 text-sm text-grafite-suave">
                  Todas as tarefas foram aprovadas. Ao finalizar, nada mais pode ser alterado e o relatório final fica pronto.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm text-grafite-suave">
                  {dados.finalizacao.pendencias.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-grafite-suave" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              )}
              <Botao
                variante="sucesso"
                className="mt-4 w-full"
                disabled={!dados.finalizacao.pode}
                onClick={() => setModal('finalizar')}
              >
                Finalizar trabalho
              </Botao>
            </section>
          )}
        </aside>
      </div>

      {/* modais */}
      <NovaTarefaModal
        aberto={modal === 'tarefa'}
        aoFechar={fechar}
        aoConcluir={concluir}
        grupoId={grupoId}
        membros={dados.membros}
        representanteId={grupo.representante.id}
        prazoFinal={grupo.prazoFinal}
        meuId={usuario!.id}
      />
      <ConvidarModal aberto={modal === 'convidar'} aoFechar={fechar} aoConcluir={concluir} grupoId={grupoId} vagas={vagas} />
      <TransferirModal
        aberto={modal === 'transferir'}
        aoFechar={fechar}
        aoConcluir={concluir}
        grupoId={grupoId}
        membros={dados.membros}
        representanteId={grupo.representante.id}
      />
      <ConfirmarModal
        aberto={modal === 'finalizar'}
        aoFechar={fechar}
        aoConcluir={() => navigate(`/grupos/${grupoId}/relatorio`)}
        titulo="Finalizar o trabalho?"
        descricao="Depois de finalizado, nenhuma tarefa, entrega ou convite pode ser alterado. O relatório final fica disponível para todos os membros."
        textoConfirmar="Finalizar trabalho"
        variante="sucesso"
        acao={() => grupoApi.finalizar(grupoId)}
        mensagemSucesso="Trabalho finalizado. Este é o relatório final."
      />
      <ConfirmarModal
        aberto={modal === 'sair'}
        aoFechar={fechar}
        aoConcluir={() => navigate('/')}
        titulo="Sair do grupo?"
        descricao="Você deixa de ver o painel deste trabalho. Só é possível sair se você não for responsável nem revisor de nenhuma tarefa."
        textoConfirmar="Sair do grupo"
        variante="perigo"
        acao={() => grupoApi.sair(grupoId)}
        mensagemSucesso="Você saiu do grupo."
      />
    </div>
  );
}

function Avisos({ painel }: { painel: Painel }) {
  const { grupo } = painel;
  if (grupo.status === 'FINALIZADO') {
    return (
      <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center">
        <Carimbo texto="Finalizado" />
        <p className="flex-1 text-sm text-emerald-900">
          Trabalho finalizado em {formatarDataHora(grupo.finalizadoEm!)}. As tarefas e entregas estão congeladas.
        </p>
        <Link to={`/grupos/${grupo.id}/relatorio`}>
          <Botao variante="secundario" icone={<FileText className="size-4" aria-hidden />}>
            Ver relatório final
          </Botao>
        </Link>
      </div>
    );
  }
  const avisos: string[] = [];
  if (painel.totalAtrasadas > 0) {
    avisos.push(painel.totalAtrasadas === 1 ? '1 tarefa passou do prazo sem entrega.' : `${painel.totalAtrasadas} tarefas passaram do prazo sem entrega.`);
  }
  if (painel.membrosSemTarefa.length > 0) {
    avisos.push(`Sem tarefa ainda: ${painel.membrosSemTarefa.map((m) => m.nome).join(', ')}.`);
  }
  for (const t of painel.tarefasSemRevisor) avisos.push(`"${t.titulo}" é do representante e precisa de um revisor.`);
  if (avisos.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4" role="status">
      <ul className="space-y-1 text-sm text-amber-900">
        {avisos.map((a) => (
          <li key={a} className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            {a}
          </li>
        ))}
      </ul>
    </div>
  );
}
