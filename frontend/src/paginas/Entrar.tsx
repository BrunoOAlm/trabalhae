import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Marca } from '../componentes/Layout';
import { Avatar, Botao, Campo, Carimbo } from '../componentes/ui';
import { useAuth } from '../contexto/AuthContext';
import { useToast } from '../contexto/ToastContext';

const DEMO = [
  { nome: 'Ana', papel: 'representante', id: 1 },
  { nome: 'Bruno', papel: 'membro', id: 2 },
  { nome: 'Carla', papel: 'membro', id: 3 },
  { nome: 'Diego', papel: 'membro', id: 4 },
  { nome: 'Eduardo', papel: 'tem um convite', id: 5 },
];

export function Entrar({ modo }: { modo: 'login' | 'cadastro' }) {
  const { usuario, entrar, cadastrar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);

  const destino = (location.state as { de?: string } | null)?.de ?? '/';
  if (usuario) return <Navigate to={destino} replace />;

  const enviar = async (e?: FormEvent, conta?: { email: string; senha: string }) => {
    e?.preventDefault();
    setEnviando(true);
    try {
      if (modo === 'cadastro' && !conta) await cadastrar(nome, email, senha);
      else await entrar(conta?.email ?? email, conta?.senha ?? senha);
      navigate(destino, { replace: true });
    } catch (err) {
      toast.erro(err);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* painel da marca */}
      <section className="pauta relative hidden overflow-hidden bg-tinta px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Marca clara />
        <div className="max-w-lg">
          <h1 className="font-display text-5xl font-extrabold leading-[1.05] text-white">
            Cada parte tem dono. Cada entrega tem data.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/80">
            O Trabalhaê registra quem ficou responsável por cada tarefa, quando entregou e o que foi revisado. No fim, o
            relatório vai junto com o trabalho.
          </p>
        </div>

        {/* ficha de exemplo: o que o sistema resolve, em uma imagem */}
        <div className="relative max-w-md rounded-2xl bg-folha p-5 text-grafite shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-grafite-suave">Trabalho de Engenharia de Software</p>
              <p className="mt-1 font-display text-lg font-bold">Escrever requisitos funcionais</p>
            </div>
            <Carimbo texto="Aprovada" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Avatar nome="Carla" id={3} tamanho="sm" />
            <span className="font-semibold">Carla</span>
            <span className="text-grafite-suave">entregou em 25/09 às 21:14</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200">
              Entregue com atraso
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
              Revisada por Ana
            </span>
          </div>
        </div>
      </section>

      {/* formulário */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden">
            <Marca />
            <p className="mt-2 text-grafite-suave">Cada parte tem dono. Cada entrega tem data.</p>
          </div>
          <h2 className="mt-10 text-3xl font-extrabold lg:mt-0">{modo === 'login' ? 'Entrar' : 'Criar conta'}</h2>
          <p className="mt-2 text-grafite-suave">
            {modo === 'login' ? (
              <>
                Não tem conta?{' '}
                <Link to="/cadastro" className="font-semibold text-tinta hover:underline">
                  Criar conta
                </Link>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <Link to="/entrar" className="font-semibold text-tinta hover:underline">
                  Entrar
                </Link>
              </>
            )}
          </p>

          <form onSubmit={enviar} className="mt-8 space-y-4">
            {modo === 'cadastro' && (
              <Campo id="nome" rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
            )}
            <Campo
              id="email"
              rotulo="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Campo
              id="senha"
              rotulo="Senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              minLength={modo === 'cadastro' ? 6 : undefined}
              dica={modo === 'cadastro' ? 'Pelo menos 6 caracteres.' : undefined}
              required
            />
            <Botao type="submit" className="w-full" carregando={enviando}>
              {modo === 'login' ? 'Entrar' : 'Criar conta'}
            </Botao>
          </form>

          {(import.meta.env.DEV || import.meta.env.VITE_MOSTRAR_DEMO === 'true') && modo === 'login' && (
            <div className="mt-10 rounded-xl border border-dashed border-linha p-4">
              <p className="text-sm font-semibold">Contas de demonstração</p>
              <p className="text-xs text-grafite-suave">Criadas pelo seed. Senha 123456.</p>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {DEMO.map((d) => (
                  <button
                    key={d.nome}
                    type="button"
                    disabled={enviando}
                    onClick={() => enviar(undefined, { email: `${d.nome.toLowerCase()}@trabalhae.com`, senha: '123456' })}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-tinta-clara"
                  >
                    <Avatar nome={d.nome} id={d.id} tamanho="sm" />
                    <span className="font-semibold">{d.nome}</span>
                    <span className="text-grafite-suave">{d.papel}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
