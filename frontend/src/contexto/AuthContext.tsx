import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { definirAoExpirar, tokenSalvo } from '../api/cliente';
import { authApi } from '../api/servicos';
import type { Usuario } from '../api/tipos';

interface AuthValor {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const AuthContext = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  const sair = useCallback(() => {
    tokenSalvo.limpar();
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirAoExpirar(sair);
    if (!tokenSalvo.ler()) {
      setCarregando(false);
      return;
    }
    authApi
      .me()
      .then(setUsuario)
      .catch(() => tokenSalvo.limpar())
      .finally(() => setCarregando(false));
  }, [sair]);

  const valor = useMemo<AuthValor>(
    () => ({
      usuario,
      carregando,
      sair,
      entrar: async (email, senha) => {
        const s = await authApi.login({ email, senha });
        tokenSalvo.salvar(s.token);
        setUsuario(s.usuario);
      },
      cadastrar: async (nome, email, senha) => {
        const s = await authApi.cadastrar({ nome, email, senha });
        tokenSalvo.salvar(s.token);
        setUsuario(s.usuario);
      },
    }),
    [usuario, carregando, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValor {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
