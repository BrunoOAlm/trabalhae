import { CalendarClock, Check, Plus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { conviteApi, grupoApi } from '../api/servicos';
import type { GrupoResumo, MeuConvite } from '../api/tipos';
import { BarraProgresso, Botao, Carregando, ErroCarregar, Selo, Vazio } from '../componentes/ui';
import { useAuth } from '../contexto/AuthContext';
import { useToast } from '../contexto/ToastContext';
import { formatarDataCurta, prazoRelativo } from '../util/datas';
import { useCarregar } from '../util/useCarregar';

export function MeusGrupos() {
  const { usuario } = useAuth();
  const { dados, erro, carregando, recarregar } = useCarregar(
    async () => {
      const [grupos, convites] = await Promise.all([grupoApi.listar(), conviteApi.meus()]);
      return { grupos, convites };
    },
    [],
  );

  if (carregando) return <Carregando />;
  if (erro || !dados) return <ErroCarregar mensagem={erro ?? ''} tentarDeNovo={recarregar} />;

  const ativos = dados.grupos.filter((g) => g.status === 'ATIVO');
  const finalizados = dados.grupos.filter((g) => g.status === 'FINALIZADO');

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-grafite-suave">Olá, {usuario?.nome}</p>
          <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">Meus trabalhos</h1>
        </div>
        <Link to="/grupos/novo">
          <Botao icone={<Plus className="size-4" aria-hidden />}>Criar grupo</Botao>
        </Link>
      </div>

      {dados.convites.length > 0 && (
        <section aria-labelledby="convites">
          <h2 id="convites" className="text-lg font-bold">
            Convites para você
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {dados.convites.map((c) => (
              <CartaoConvite key={c.id} convite={c} aoResponder={recarregar} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="ativos">
        <h2 id="ativos" className="sr-only">
          Trabalhos em andamento
        </h2>
        {ativos.length === 0 ? (
          <Vazio
            titulo="Nenhum trabalho em andamento"
            acao={
              <Link to="/grupos/novo">
                <Botao icone={<Plus className="size-4" aria-hidden />}>Criar grupo</Botao>
              </Link>
            }
          >
            Crie um grupo para o próximo trabalho ou aguarde o convite de um colega. Os convites aparecem aqui.
          </Vazio>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ativos.map((g) => (
              <CartaoGrupo key={g.id} grupo={g} />
            ))}
          </div>
        )}
      </section>

      {finalizados.length > 0 && (
        <section aria-labelledby="finalizados">
          <h2 id="finalizados" className="text-lg font-bold">
            Finalizados
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {finalizados.map((g) => (
              <CartaoGrupo key={g.id} grupo={g} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CartaoGrupo({ grupo }: { grupo: GrupoResumo }) {
  const finalizado = grupo.status === 'FINALIZADO';
  const vencido = !finalizado && new Date(grupo.prazoFinal) < new Date();
  return (
    <Link
      to={`/grupos/${grupo.id}`}
      className={`group flex flex-col rounded-2xl border bg-folha p-5 transition-colors hover:border-tinta/40 ${
        finalizado ? 'border-linha opacity-80' : 'border-linha'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold leading-snug group-hover:text-tinta">{grupo.titulo}</h3>
        {grupo.souRepresentante && <Selo className="shrink-0">Representante</Selo>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm text-grafite-suave">{grupo.objetivo}</p>

      <div className="mt-auto pt-5">
        <div className="mb-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            {grupo.progresso.concluidas} de {grupo.progresso.total} tarefas concluídas
          </span>
          <span className="text-grafite-suave">{grupo.progresso.percentual}%</span>
        </div>
        <BarraProgresso percentual={grupo.progresso.percentual} />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-grafite-suave">
          <span className={`inline-flex items-center gap-1.5 ${vencido ? 'font-semibold text-red-700' : ''}`}>
            <CalendarClock className="size-4" aria-hidden />
            {finalizado ? `Finalizado em ${formatarDataCurta(grupo.finalizadoEm!)}` : prazoRelativo(grupo.prazoFinal)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden />
            {grupo.totalMembros} de {grupo.limiteMembros}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CartaoConvite({ convite, aoResponder }: { convite: MeuConvite; aoResponder: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState<'aceitar' | 'recusar' | null>(null);
  const g = convite.grupo;

  const responder = async (acao: 'aceitar' | 'recusar') => {
    setEnviando(acao);
    try {
      if (acao === 'aceitar') {
        const { grupoId } = await conviteApi.aceitar(convite.id);
        toast.sucesso(`Você entrou no grupo "${g.titulo}".`);
        navigate(`/grupos/${grupoId}`);
      } else {
        await conviteApi.recusar(convite.id);
        toast.sucesso('Convite recusado.');
        aoResponder();
      }
    } catch (e) {
      toast.erro(e);
      setEnviando(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-tinta/30 bg-tinta-clara/50 p-5 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="text-sm text-grafite-suave">{g.representante} convidou você para</p>
        <h3 className="mt-0.5 text-lg font-bold">{g.titulo}</h3>
        <p className="mt-1 text-sm text-grafite-suave">
          Prazo {formatarDataCurta(g.prazoFinal)}, {g.totalMembros} de {g.limiteMembros} vagas ocupadas
        </p>
      </div>
      <div className="flex gap-2">
        <Botao variante="secundario" icone={<X className="size-4" aria-hidden />} carregando={enviando === 'recusar'} disabled={!!enviando} onClick={() => responder('recusar')}>
          Recusar
        </Botao>
        <Botao icone={<Check className="size-4" aria-hidden />} carregando={enviando === 'aceitar'} disabled={!!enviando} onClick={() => responder('aceitar')}>
          Aceitar
        </Botao>
      </div>
    </div>
  );
}
