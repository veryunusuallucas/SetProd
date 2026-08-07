import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { limparParticipacoesLocais, sincronizarParticipacoes } from '../lib/membros';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Sessão retomada (voltou ao app, outro aparelho): confere de quais
      // projetos esta conta participa, sem travar a tela esperando.
      if (session?.user) sincronizarParticipacoes();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = async () => {
    // Limpa as participações ANTES de sair: elas ficam no localStorage, e sem
    // isto a próxima pessoa a entrar neste navegador herdaria os acessos de
    // quem saiu. O servidor recusaria de qualquer jeito, mas a tela mostraria
    // permissões que não existem — e susto de "por que eu vejo isso?" é caro.
    limparParticipacoesLocais();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
