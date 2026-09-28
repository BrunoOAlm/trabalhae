import { ArrowLeft, Printer } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { grupoApi } from '../api/servicos';
import { Marca } from '../componentes/Layout';
import { Botao, Carimbo, Carregando, ErroCarregar } from '../componentes/ui';
import { formatarDataHora } from '../util/datas';
import { useCarregar } from '../util/useCarregar';

/** Relatório por membro, pronto para imprimir e anexar à entrega. */
export function Relatorio() {
  const { id } = useParams();
  const grupoId = Number(id);
  const { dados: r, erro, carregando, recarregar } = useCarregar(() => grupoApi.relatorio(grupoId), [grupoId]);

  if (carregando) return <Carregando />;
  if (erro || !r) return <ErroCarregar mensagem={erro ?? ''} tentarDeNovo={recarregar} />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="nao-imprimir flex flex-wrap items-center justify-between gap-3">
        <Link to={`/grupos/${grupoId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite-suave hover:text-tinta">
          <ArrowLeft className="size-4" aria-hidden />
          Voltar ao painel
        </Link>
        <Botao variante="secundario" icone={<Printer className="size-4" aria-hidden />} onClick={() => window.print()}>
          Imprimir ou salvar PDF
        </Botao>
      </div>

      {!r.final && (
        <p className="nao-imprimir mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
          Esta é uma prévia. O relatório final fica disponível quando o representante finalizar o trabalho.
        </p>
      )}

      <article className="folha-impressao mt-4 rounded-2xl border border-linha bg-folha p-6 sm:p-10">
        <header className="flex flex-col gap-6 border-b border-linha pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Marca />
            <p className="mt-4 text-sm font-semibold text-grafite-suave">{r.final ? 'Relatório final do trabalho' : 'Prévia do relatório'}</p>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight">{r.grupo.titulo}</h1>
            <p className="mt-2 max-w-2xl text-grafite-suave">{r.grupo.objetivo}</p>
          </div>
          {r.final && <Carimbo texto="Finalizado" animar={false} />}
        </header>

        <dl className="grid grid-cols-2 gap-4 border-b border-linha py-6 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-grafite-suave">Representante</dt>
            <dd className="font-semibold">{r.grupo.representante.nome}</dd>
          </div>
          <div>
            <dt className="text-grafite-suave">Prazo final</dt>
            <dd className="font-semibold">{formatarDataHora(r.grupo.prazoFinal)}</dd>
          </div>
          <div>
            <dt className="text-grafite-suave">{r.final ? 'Finalizado em' : 'Gerado em'}</dt>
            <dd className="font-semibold">{formatarDataHora(r.final ? r.grupo.finalizadoEm! : r.geradoEm)}</dd>
          </div>
          <div>
            <dt className="text-grafite-suave">Membros</dt>
            <dd className="font-semibold">{r.grupo.totalMembros}</dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-4 py-6 sm:grid-cols-4">
          {[
            ['Tarefas concluídas', `${r.resumo.concluidas} de ${r.resumo.totalTarefas}`],
            ['Entregas registradas', r.resumo.totalEntregas],
            ['Entregas com atraso', r.resumo.entregasComAtraso],
            ['Correções pedidas', r.resumo.totalCorrecoes],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="rounded-xl bg-papel px-4 py-3">
              <dt className="text-xs font-semibold text-grafite-suave">{rotulo}</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold">{valor}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-8">
          {r.membros.map((m) => (
            <section key={m.id} className="break-inside-avoid">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-grafite pb-2">
                <h2 className="text-xl font-bold">
                  {m.nome}
                  {m.representante && <span className="ml-2 font-sans text-sm font-semibold text-tinta">representante</span>}
                </h2>
                <p className="text-sm text-grafite-suave">
                  {m.totais.concluidas} de {m.totais.tarefas} {m.totais.tarefas === 1 ? 'concluída' : 'concluídas'}
                  {m.totais.entregasComAtraso > 0 && `, ${m.totais.entregasComAtraso} com atraso`}
                  {m.totais.correcoes > 0 && `, ${m.totais.correcoes} ${m.totais.correcoes === 1 ? 'correção' : 'correções'}`}
                </p>
              </div>
              {m.tarefas.length === 0 ? (
                <p className="py-3 text-sm text-grafite-suave">Nenhuma tarefa sob responsabilidade deste membro.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="text-xs text-grafite-suave">
                        <th className="py-2.5 pr-3 font-semibold">Tarefa</th>
                        <th className="py-2.5 pr-3 font-semibold">Prazo</th>
                        <th className="py-2.5 pr-3 font-semibold">Entregue em</th>
                        <th className="py-2.5 pr-3 font-semibold">Situação</th>
                        <th className="py-2.5 pr-3 text-right font-semibold">Correções</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.tarefas.map((t) => (
                        <tr key={t.id} className="border-t border-linha align-top">
                          <td className="py-2.5 pr-3">
                            <p className="font-semibold">{t.titulo}</p>
                            {t.revisor && <p className="text-xs text-grafite-suave">revisão de {t.revisor.nome}</p>}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">{formatarDataHora(t.prazo)}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            {t.primeiraEntrega ? formatarDataHora(t.primeiraEntrega) : '—'}
                            {t.totalEntregas > 1 && <p className="text-xs text-grafite-suave">{t.totalEntregas} envios</p>}
                          </td>
                          <td className="py-2.5 pr-3">
                            <span className="font-semibold">{t.rotuloStatus}</span>
                            {t.entregueComAtraso && <p className="text-xs font-semibold text-red-700">Entregue com atraso</p>}
                            {t.atrasadaSemEntrega && <p className="text-xs font-semibold text-red-700">Atrasada, sem entrega</p>}
                          </td>
                          <td className="py-2.5 pr-3 text-right">{t.correcoes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>

        <p className="mt-10 border-t border-linha pt-4 text-xs text-grafite-suave">
          Gerado pelo Trabalhaê em {formatarDataHora(r.geradoEm)}. Datas no horário de Brasília, registradas pelo servidor no momento de cada
          entrega.
        </p>
      </article>
    </div>
  );
}
