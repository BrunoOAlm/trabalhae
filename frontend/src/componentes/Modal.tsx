import { X } from 'lucide-react';
import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { Botao } from './ui';

interface Props {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  aoFechar: () => void;
  aoConfirmar?: () => void;
  textoConfirmar?: string;
  varianteConfirmar?: 'primario' | 'perigo' | 'sucesso';
  enviando?: boolean;
  children?: ReactNode;
}

/** Janela modal com formulário: Enter confirma, Esc fecha. */
export function Modal({
  aberto,
  titulo,
  descricao,
  aoFechar,
  aoConfirmar,
  textoConfirmar = 'Salvar',
  varianteConfirmar = 'primario',
  enviando = false,
  children,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const anterior = document.activeElement as HTMLElement | null;
    const foco = caixa.current?.querySelector<HTMLElement>('input, textarea, select, button[data-principal]');
    foco?.focus();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !enviando && aoFechar();
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
      anterior?.focus();
    };
  }, [aberto, aoFechar, enviando]);

  if (!aberto) return null;

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    aoConfirmar?.();
  };

  return (
    <div className="nao-imprimir fixed inset-0 z-50 flex items-end justify-center bg-grafite/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={() => !enviando && aoFechar()} aria-hidden />
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal"
        className="relative max-h-[92vh] w-full animate-surgir overflow-y-auto rounded-t-2xl bg-folha shadow-2xl sm:max-w-lg sm:rounded-2xl"
      >
        <form onSubmit={enviar}>
          <div className="flex items-start justify-between gap-4 border-b border-linha px-6 py-5">
            <div>
              <h2 id="titulo-modal" className="text-xl font-bold">
                {titulo}
              </h2>
              {descricao && <p className="mt-1 text-sm text-grafite-suave">{descricao}</p>}
            </div>
            <button type="button" onClick={aoFechar} disabled={enviando} aria-label="Fechar" className="rounded-md p-1 text-grafite-suave hover:bg-papel hover:text-grafite">
              <X className="size-5" />
            </button>
          </div>
          {children && <div className="space-y-4 px-6 py-5">{children}</div>}
          <div className="flex flex-col-reverse gap-2 border-t border-linha bg-papel/60 px-6 py-4 sm:flex-row sm:justify-end">
            <Botao type="button" variante="secundario" onClick={aoFechar} disabled={enviando}>
              Cancelar
            </Botao>
            {aoConfirmar && (
              <Botao type="submit" variante={varianteConfirmar} carregando={enviando} data-principal>
                {textoConfirmar}
              </Botao>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
