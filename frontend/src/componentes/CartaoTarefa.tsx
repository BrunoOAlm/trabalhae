import { Clock3, MessageSquareWarning } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Tarefa } from '../api/tipos';
import { prazoRelativo } from '../util/datas';
import { Avatar, SeloAtraso } from './ui';

export function CartaoTarefa({ tarefa, meuId }: { tarefa: Tarefa; meuId: number }) {
  const minha = tarefa.responsavel.id === meuId;
  const revisoMinha = tarefa.revisor?.id === meuId && ['ENVIADA', 'EM_REVISAO'].includes(tarefa.status);
  return (
    <Link
      to={`/tarefas/${tarefa.id}`}
      className="block rounded-xl border border-linha bg-folha p-3.5 shadow-[0_1px_0_rgba(28,26,51,0.04)] transition-colors hover:border-tinta/50"
    >
      <p className="font-semibold leading-snug">{tarefa.titulo}</p>
      <div className="mt-2.5 flex items-center gap-2 text-sm">
        <Avatar nome={tarefa.responsavel.nome} id={tarefa.responsavel.id} tamanho="sm" />
        <span className={minha ? 'marca-texto font-semibold' : 'text-grafite-suave'}>
          {minha ? 'Você' : tarefa.responsavel.nome}
        </span>
      </div>
      {tarefa.status !== 'CONCLUIDA' && (
        <p className={`mt-2 flex items-center gap-1.5 text-xs ${tarefa.atrasada ? 'font-semibold text-red-700' : 'text-grafite-suave'}`}>
          <Clock3 className="size-3.5" aria-hidden />
          {prazoRelativo(tarefa.prazo)}
        </p>
      )}
      {(tarefa.atrasada || tarefa.entregueComAtraso || tarefa.totalCorrecoes > 0 || tarefa.precisaIndicarRevisor || revisoMinha) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {tarefa.atrasada && <SeloAtraso tipo="atrasada" />}
          {tarefa.entregueComAtraso && <SeloAtraso tipo="entregue" />}
          {tarefa.totalCorrecoes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800 ring-1 ring-inset ring-orange-200">
              <MessageSquareWarning className="size-3" aria-hidden />
              {tarefa.totalCorrecoes} {tarefa.totalCorrecoes === 1 ? 'correção' : 'correções'}
            </span>
          )}
          {tarefa.precisaIndicarRevisor && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              Sem revisor
            </span>
          )}
          {revisoMinha && (
            <span className="rounded-full bg-tinta-clara px-2 py-0.5 text-xs font-semibold text-tinta">Você revisa</span>
          )}
        </div>
      )}
    </Link>
  );
}
