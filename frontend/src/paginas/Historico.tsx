import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Flag,
  LogOut,
  MailPlus,
  MailX,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { grupoApi } from '../api/servicos';
import type { Evento, TipoEvento } from '../api/tipos';
import { Carregando, ErroCarregar } from '../componentes/ui';
import { chaveDoDia, formatarDataLonga, formatarHora } from '../util/datas';
import { useCarregar } from '../util/useCarregar';

const ICONES: Record<TipoEvento, { icone: ReactNode; cor: string }> = {
  GRUPO_CRIADO: { icone: <Users />, cor: 'bg-tinta-clara text-tinta' },
  GRUPO_EDITADO: { icone: <Pencil />, cor: 'bg-slate-100 text-slate-600' },
  MEMBRO_CONVIDADO: { icone: <MailPlus />, cor: 'bg-tinta-clara text-tinta' },
  CONVITE_ACEITO: { icone: <UserPlus />, cor: 'bg-emerald-50 text-emerald-700' },
  CONVITE_RECUSADO: { icone: <MailX />, cor: 'bg-slate-100 text-slate-600' },
  MEMBRO_SAIU: { icone: <LogOut />, cor: 'bg-slate-100 text-slate-600' },
  REPRESENTANTE_TRANSFERIDO: { icone: <ArrowRightLeft />, cor: 'bg-tinta-clara text-tinta' },
  TAREFA_CRIADA: { icone: <Plus />, cor: 'bg-slate-100 text-slate-600' },
  TAREFA_EDITADA: { icone: <Pencil />, cor: 'bg-slate-100 text-slate-600' },
  TAREFA_EXCLUIDA: { icone: <Trash2 />, cor: 'bg-slate-100 text-slate-600' },
  RESPONSAVEL_ATRIBUIDO: { icone: <UserCheck />, cor: 'bg-tinta-clara text-tinta' },
  RESPONSAVEL_TROCADO: { icone: <ArrowRightLeft />, cor: 'bg-amber-50 text-amber-700' },
  REVISOR_DEFINIDO: { icone: <UserCheck />, cor: 'bg-tinta-clara text-tinta' },
  TAREFA_INICIADA: { icone: <Play />, cor: 'bg-blue-50 text-blue-700' },
  ENTREGA_ENVIADA: { icone: <Send />, cor: 'bg-purple-50 text-purple-700' },
  ENTREGA_COM_ATRASO: { icone: <Clock3 />, cor: 'bg-red-50 text-red-700' },
  REVISAO_INICIADA: { icone: <Search />, cor: 'bg-amber-50 text-amber-700' },
  TAREFA_APROVADA: { icone: <CheckCircle2 />, cor: 'bg-emerald-50 text-emerald-700' },
  CORRECAO_SOLICITADA: { icone: <XCircle />, cor: 'bg-orange-50 text-orange-700' },
  TAREFA_ATRASADA: { icone: <Clock3 />, cor: 'bg-red-50 text-red-700' },
  GRUPO_FINALIZADO: { icone: <Flag />, cor: 'bg-emerald-50 text-emerald-700' },
};

export function Historico() {
  const { id } = useParams();
  const grupoId = Number(id);
  const { dados, erro, carregando, recarregar } = useCarregar(
    async () => {
      const [grupo, eventos] = await Promise.all([grupoApi.detalhar(grupoId), grupoApi.historico(grupoId)]);
      return { grupo, eventos };
    },
    [grupoId],
  );

  if (carregando) return <Carregando />;
  if (erro || !dados) return <ErroCarregar mensagem={erro ?? ''} tentarDeNovo={recarregar} />;

  const porDia = new Map<string, Evento[]>();
  for (const ev of dados.eventos) {
    const dia = chaveDoDia(ev.criadoEm);
    porDia.set(dia, [...(porDia.get(dia) ?? []), ev]);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/grupos/${grupoId}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite-suave hover:text-tinta">
        <ArrowLeft className="size-4" aria-hidden />
        {dados.grupo.titulo}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">Histórico do grupo</h1>
      <p className="mt-2 text-grafite-suave">
        Tudo o que aconteceu no trabalho, do mais recente ao mais antigo. Estes registros não podem ser alterados.
      </p>

      <div className="mt-8 space-y-8">
        {[...porDia.entries()].map(([dia, eventos]) => (
          <section key={dia} aria-label={formatarDataLonga(eventos[0].criadoEm)}>
            <h2 className="sticky top-16 z-10 bg-papel/95 py-2 font-sans text-sm font-bold capitalize text-grafite-suave backdrop-blur">
              {formatarDataLonga(eventos[0].criadoEm)}
            </h2>
            <ol className="mt-2 space-y-1">
              {eventos.map((ev) => {
                const estilo = ICONES[ev.tipo];
                return (
                  <li key={ev.id} className="flex gap-3.5 rounded-xl px-2 py-2.5 hover:bg-folha">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4 ${estilo.cor}`} aria-hidden>
                      {estilo.icone}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] leading-snug">{ev.descricao}</p>
                      <p className="mt-0.5 text-xs text-grafite-suave">
                        {formatarHora(ev.criadoEm)}
                        {ev.tarefa && ev.tipo !== 'TAREFA_EXCLUIDA' && ev.tarefa.titulo && (
                          <>
                            {' '}
                            em{' '}
                            <Link to={`/tarefas/${ev.tarefa.id}`} className="font-semibold text-tinta hover:underline">
                              {ev.tarefa.titulo}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
