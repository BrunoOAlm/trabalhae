import { CheckCircle2, CircleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type Tipo = 'sucesso' | 'erro';
interface Aviso {
  id: number;
  tipo: Tipo;
  texto: string;
}

interface ToastValor {
  sucesso: (texto: string) => void;
  erro: (erroOuTexto: unknown) => void;
}

const ToastContext = createContext<ToastValor | null>(null);
let proximoId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const remover = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const mostrar = useCallback(
    (tipo: Tipo, texto: string) => {
      const id = proximoId++;
      setAvisos((a) => [...a.slice(-3), { id, tipo, texto }]);
      setTimeout(() => remover(id), tipo === 'erro' ? 6000 : 3500);
    },
    [remover],
  );

  const valor = useMemo<ToastValor>(
    () => ({
      sucesso: (texto) => mostrar('sucesso', texto),
      erro: (e) => mostrar('erro', e instanceof Error ? e.message : String(e)),
    }),
    [mostrar],
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div
        className="nao-imprimir pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-96"
        aria-live="polite"
      >
        {avisos.map((a) => (
          <div
            key={a.id}
            role={a.tipo === 'erro' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full animate-deslizar items-start gap-3 rounded-xl border bg-folha px-4 py-3 text-sm shadow-lg shadow-grafite/5 ${
              a.tipo === 'erro' ? 'border-red-200' : 'border-emerald-200'
            }`}
          >
            {a.tipo === 'erro' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            )}
            <p className="flex-1 leading-snug">{a.texto}</p>
            <button onClick={() => remover(a.id)} aria-label="Fechar aviso" className="text-grafite-suave hover:text-grafite">
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValor {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast fora do ToastProvider');
  return ctx;
}
