import { LogOut } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../contexto/AuthContext';
import { Avatar } from './ui';

export function Marca({ clara = false }: { clara?: boolean }) {
  return (
    <span className={`font-display text-2xl font-extrabold tracking-tight ${clara ? 'text-white' : 'text-grafite'}`}>
      Trabalha<span className={clara ? 'text-marca' : 'text-tinta'}>ê</span>
    </span>
  );
}

export function Layout() {
  const { usuario, sair } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="nao-imprimir sticky top-0 z-40 border-b border-linha bg-folha/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Trabalhaê, meus trabalhos">
            <Marca />
          </Link>
          {usuario && (
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <Avatar nome={usuario.nome} id={usuario.id} />
                <span className="text-sm font-semibold">{usuario.nome}</span>
              </div>
              <button
                onClick={sair}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-grafite-suave hover:bg-papel hover:text-grafite"
              >
                <LogOut className="size-4" aria-hidden />
                Sair
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <Outlet />
      </main>
    </div>
  );
}
