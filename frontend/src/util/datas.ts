const TZ = 'America/Sao_Paulo';

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const dataCurta = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, day: 'numeric', month: 'short' });
const dataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const diaChave = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const formatarDataHora = (iso: string) => dataHora.format(new Date(iso)).replace(',', ' às');
export const formatarDataCurta = (iso: string) => dataCurta.format(new Date(iso)).replace('.', '');
export const formatarDataLonga = (iso: string) => dataLonga.format(new Date(iso));
export const formatarHora = (iso: string) => hora.format(new Date(iso));
export const chaveDoDia = (iso: string) => diaChave.format(new Date(iso));

/** "vence hoje às 23:59", "vence em 3 dias", "venceu há 2 dias" */
export function prazoRelativo(iso: string, agora = new Date()): string {
  const alvo = new Date(iso);
  const dias = diferencaEmDias(alvo, agora);
  if (alvo.getTime() < agora.getTime()) {
    if (dias === 0) return `venceu hoje às ${formatarHora(iso)}`;
    return Math.abs(dias) === 1 ? 'venceu ontem' : `venceu há ${Math.abs(dias)} dias`;
  }
  if (dias === 0) return `vence hoje às ${formatarHora(iso)}`;
  if (dias === 1) return `vence amanhã às ${formatarHora(iso)}`;
  return `vence em ${dias} dias`;
}

function diferencaEmDias(alvo: Date, agora: Date): number {
  const a = Date.parse(chaveDoDia(alvo.toISOString()));
  const b = Date.parse(chaveDoDia(agora.toISOString()));
  return Math.round((a - b) / 86_400_000);
}

/** Valor para <input type="datetime-local"> no horário de Brasília. */
export function paraInputLocal(iso: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Converte o valor do input (horário de Brasília) em ISO com fuso -03:00. */
export function deInputLocal(valor: string): string {
  return `${valor}:00-03:00`;
}

/** Sugestão de prazo: daqui a N dias, às 23:59. */
export function sugestaoDePrazo(dias: number): string {
  const d = new Date(Date.now() + dias * 86_400_000);
  return `${chaveDoDia(d.toISOString())}T23:59`;
}

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
