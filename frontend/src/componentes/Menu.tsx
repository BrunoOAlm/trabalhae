import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface ItemMenu {
  rotulo: string;
  icone?: ReactNode;
  aoClicar: () => void;
  perigo?: boolean;
}

/** Menu suspenso simples para ações secundárias. */
export function Menu({ rotulo, itens }: { rotulo: string; itens: ItemMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  if (itens.length === 0) return null;

  return (
    <div ref={raiz} className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-expanded={aberto}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-lg bg-folha px-4 py-2.5 text-sm font-semibold ring-1 ring-inset ring-linha hover:bg-papel"
      >
        {rotulo}
        <ChevronDown className={`size-4 transition-transform ${aberto ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 animate-surgir overflow-hidden rounded-xl border border-linha bg-folha py-1.5 shadow-xl shadow-grafite/10"
        >
          {itens.map((item) => (
            <button
              key={item.rotulo}
              role="menuitem"
              type="button"
              onClick={() => {
                setAberto(false);
                item.aoClicar();
              }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-medium hover:bg-papel ${
                item.perigo ? 'text-red-700' : 'text-grafite'
              }`}
            >
              {item.icone}
              {item.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
