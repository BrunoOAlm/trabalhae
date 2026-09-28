/** Formata uma data em ISO 8601 com o deslocamento de America/Sao_Paulo (ex.: 2026-09-28T14:30:00-03:00). */
export function isoLocal(data: Date | null | undefined): string | null {
  if (!data) return null;
  const d = data instanceof Date ? data : new Date(data);
  const offsetMin = -d.getTimezoneOffset();
  const sinal = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const pad = (n: number, t = 2) => String(n).padStart(t, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sinal}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function formatarDataHora(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
