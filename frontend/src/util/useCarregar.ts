import { useCallback, useEffect, useState } from 'react';

/** Carrega dados de uma função assíncrona e permite recarregar. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(buscar, deps);

  const recarregar = useCallback(async () => {
    try {
      setErro(null);
      setDados(await executar());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }, [executar]);

  useEffect(() => {
    setCarregando(true);
    void recarregar();
  }, [recarregar]);

  return { dados, setDados, erro, carregando, recarregar };
}
