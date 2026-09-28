import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { StatusTarefa } from '../api/tipos';
import { COR_STATUS, SELO_ATRASADA } from '../util/status';

// ---------- botões ----------
type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo' | 'sucesso';

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-tinta text-white hover:bg-tinta-escura shadow-sm shadow-tinta/20',
  secundario: 'bg-folha text-grafite ring-1 ring-inset ring-linha hover:bg-papel',
  fantasma: 'text-grafite-suave hover:bg-tinta-clara hover:text-tinta',
  perigo: 'bg-folha text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/20',
};

export function Botao({
  variante = 'primario',
  carregando = false,
  icone,
  children,
  className = '',
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean; icone?: ReactNode }) {
  return (
    <button
      {...props}
      disabled={disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTES[variante]} ${className}`}
    >
      {carregando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icone}
      {children}
    </button>
  );
}

// ---------- campos ----------
const estiloCampo =
  'w-full rounded-lg border border-linha bg-folha px-3 py-2.5 text-[15px] text-grafite placeholder:text-grafite-suave/60 transition-colors focus:border-tinta focus:outline-none focus:ring-2 focus:ring-tinta/20';

export function Campo({
  rotulo,
  dica,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-grafite">
        {rotulo}
      </label>
      <input id={id} {...props} className={estiloCampo} />
      {dica && <p className="text-xs text-grafite-suave">{dica}</p>}
    </div>
  );
}

export function AreaTexto({
  rotulo,
  dica,
  id,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string; dica?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-grafite">
        {rotulo}
      </label>
      <textarea id={id} rows={3} {...props} className={`${estiloCampo} resize-y`} />
      {dica && <p className="text-xs text-grafite-suave">{dica}</p>}
    </div>
  );
}

export function Selecao({
  rotulo,
  dica,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { rotulo: string; dica?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-grafite">
        {rotulo}
      </label>
      <select id={id} {...props} className={estiloCampo}>
        {children}
      </select>
      {dica && <p className="text-xs text-grafite-suave">{dica}</p>}
    </div>
  );
}

// ---------- selos ----------
export function SeloStatus({ status, grande = false }: { status: StatusTarefa; grande?: boolean }) {
  const cor = COR_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ring-inset ${cor.selo} ${
        grande ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <span className={`size-1.5 rounded-full ${cor.ponto}`} aria-hidden />
      {cor.rotulo}
    </span>
  );
}

export function SeloAtraso({ tipo }: { tipo: 'atrasada' | 'entregue' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${SELO_ATRASADA}`}>
      {tipo === 'atrasada' ? 'Atrasada' : 'Entregue com atraso'}
    </span>
  );
}

export function Selo({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-tinta-clara px-2 py-0.5 text-xs font-semibold text-tinta ${className}`}>
      {children}
    </span>
  );
}

/** O carimbo do professor: aparece em tarefas aprovadas e em entregas atrasadas. */
export function Carimbo({ texto, cor = 'verde', animar = true }: { texto: string; cor?: 'verde' | 'vermelho'; animar?: boolean }) {
  const cores = cor === 'verde' ? 'border-emerald-600 text-emerald-700' : 'border-red-600 text-red-700';
  return (
    <span
      className={`inline-block -rotate-[7deg] select-none rounded-md border-[3px] border-double px-3 py-1 font-display text-sm font-extrabold uppercase tracking-wider opacity-90 ${cores} ${
        animar ? 'animate-carimbar' : ''
      }`}
    >
      {texto}
    </span>
  );
}

// ---------- pessoas ----------
const CORES_AVATAR = ['bg-violet-200 text-violet-900', 'bg-sky-200 text-sky-900', 'bg-emerald-200 text-emerald-900', 'bg-amber-200 text-amber-900', 'bg-rose-200 text-rose-900', 'bg-teal-200 text-teal-900'];

export function Avatar({ nome, id, tamanho = 'md' }: { nome: string; id: number; tamanho?: 'sm' | 'md' | 'lg' }) {
  const iniciais = nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  const tam = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs', lg: 'size-10 text-sm' }[tamanho];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${tam} ${CORES_AVATAR[id % CORES_AVATAR.length]}`}
      aria-hidden
    >
      {iniciais}
    </span>
  );
}

// ---------- progresso ----------
export function BarraProgresso({ percentual, animar = false }: { percentual: number; animar?: boolean }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-linha"
      role="progressbar"
      aria-valuenow={percentual}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full origin-left rounded-full bg-tinta ${animar ? 'animate-preencher' : ''}`}
        style={{ width: `${percentual}%` }}
      />
    </div>
  );
}

// ---------- estados de tela ----------
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-24 text-grafite-suave" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function ErroCarregar({ mensagem, tentarDeNovo }: { mensagem: string; tentarDeNovo: () => void }) {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h2 className="text-xl font-bold">Não deu para carregar</h2>
      <p className="mt-2 text-grafite-suave">{mensagem}</p>
      <Botao variante="secundario" className="mt-6" onClick={tentarDeNovo}>
        Tentar de novo
      </Botao>
    </div>
  );
}

export function Vazio({ titulo, children, acao }: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-linha bg-folha/60 px-6 py-12 text-center">
      <h3 className="text-lg font-bold">{titulo}</h3>
      {children && <p className="mx-auto mt-1.5 max-w-md text-sm text-grafite-suave">{children}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}
