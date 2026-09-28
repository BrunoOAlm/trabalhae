import { ArrowLeft } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { grupoApi } from '../api/servicos';
import { AreaTexto, Botao, Campo, Carregando } from '../componentes/ui';
import { useToast } from '../contexto/ToastContext';
import { deInputLocal, paraInputLocal, sugestaoDePrazo } from '../util/datas';

/** Criar grupo (quem cria vira representante) ou editar os dados do trabalho. */
export function FormGrupo() {
  const { id } = useParams();
  const edicao = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const [carregando, setCarregando] = useState(edicao);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({ titulo: '', objetivo: '', prazoFinal: sugestaoDePrazo(30), limiteMembros: 4 });

  useEffect(() => {
    if (!edicao) return;
    grupoApi
      .detalhar(Number(id))
      .then((g) => {
        if (!g.souRepresentante) {
          toast.erro('Somente o representante pode editar os dados do trabalho.');
          navigate(`/grupos/${id}`, { replace: true });
          return;
        }
        setForm({ titulo: g.titulo, objetivo: g.objetivo, prazoFinal: paraInputLocal(g.prazoFinal), limiteMembros: g.limiteMembros });
      })
      .catch((e) => toast.erro(e))
      .finally(() => setCarregando(false));
  }, [edicao, id, navigate, toast]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const dados = { ...form, prazoFinal: deInputLocal(form.prazoFinal), limiteMembros: Number(form.limiteMembros) };
      const grupo = edicao ? await grupoApi.atualizar(Number(id), dados) : await grupoApi.criar(dados);
      toast.sucesso(edicao ? 'Dados do trabalho atualizados.' : 'Grupo criado. Agora convide os colegas.');
      navigate(`/grupos/${grupo.id}`);
    } catch (err) {
      toast.erro(err);
      setEnviando(false);
    }
  };

  if (carregando) return <Carregando />;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to={edicao ? `/grupos/${id}` : '/'}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-grafite-suave hover:text-tinta"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Voltar
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold">{edicao ? 'Editar trabalho' : 'Criar grupo'}</h1>
      {!edicao && (
        <p className="mt-2 text-grafite-suave">
          Você será o representante: vai convidar os colegas, dividir as tarefas e revisar as entregas.
        </p>
      )}

      <form onSubmit={enviar} className="mt-8 space-y-5 rounded-2xl border border-linha bg-folha p-6 sm:p-8">
        <Campo
          id="titulo"
          rotulo="Título do trabalho"
          placeholder="Ex.: Trabalho de Engenharia de Software"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
          maxLength={150}
          required
        />
        <AreaTexto
          id="objetivo"
          rotulo="Objetivo"
          placeholder="O que o grupo precisa entregar ao professor?"
          rows={4}
          value={form.objetivo}
          onChange={(e) => setForm({ ...form, objetivo: e.target.value })}
          maxLength={2000}
          required
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            id="prazo"
            rotulo="Prazo final de entrega"
            type="datetime-local"
            value={form.prazoFinal}
            onChange={(e) => setForm({ ...form, prazoFinal: e.target.value })}
            dica="Horário de Brasília. Precisa ser uma data futura."
            required
          />
          <Campo
            id="limite"
            rotulo="Limite de membros"
            type="number"
            min={2}
            max={50}
            value={form.limiteMembros}
            onChange={(e) => setForm({ ...form, limiteMembros: Number(e.target.value) })}
            dica="Contando com você."
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Link to={edicao ? `/grupos/${id}` : '/'}>
            <Botao type="button" variante="secundario">
              Cancelar
            </Botao>
          </Link>
          <Botao type="submit" carregando={enviando}>
            {edicao ? 'Salvar alterações' : 'Criar grupo'}
          </Botao>
        </div>
      </form>
    </div>
  );
}
