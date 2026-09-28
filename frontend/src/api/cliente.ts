const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const CHAVE_TOKEN = 'trabalhae.token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export const tokenSalvo = {
  ler: () => localStorage.getItem(CHAVE_TOKEN),
  salvar: (t: string) => localStorage.setItem(CHAVE_TOKEN, t),
  limpar: () => localStorage.removeItem(CHAVE_TOKEN),
};

/** Avisado quando o servidor responde 401 (sessão expirada). */
let aoExpirar: (() => void) | null = null;
export const definirAoExpirar = (fn: () => void) => {
  aoExpirar = fn;
};

async function requisitar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenSalvo.ler();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (corpo instanceof FormData) body = corpo;
  else if (corpo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(corpo);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/api${caminho}`, { method: metodo, headers, body });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique se a API está rodando.', 0);
  }

  if (res.status === 204) return undefined as T;
  const dados = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) aoExpirar?.();
    throw new ApiError(dados?.mensagem ?? 'Algo deu errado. Tente de novo.', res.status);
  }
  return dados as T;
}

export const http = {
  get: <T>(c: string) => requisitar<T>('GET', c),
  post: <T>(c: string, corpo?: unknown) => requisitar<T>('POST', c, corpo),
  put: <T>(c: string, corpo?: unknown) => requisitar<T>('PUT', c, corpo),
  delete: <T>(c: string) => requisitar<T>('DELETE', c),
};

/** Baixa um arquivo protegido (precisa do token) e abre o "salvar como" do navegador. */
export async function baixarArquivo(url: string, nome: string) {
  const res = await fetch(`${BASE}${url}`, { headers: { Authorization: `Bearer ${tokenSalvo.ler() ?? ''}` } });
  if (!res.ok) {
    const dados = await res.json().catch(() => null);
    throw new ApiError(dados?.mensagem ?? 'Não foi possível baixar o arquivo.', res.status);
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
