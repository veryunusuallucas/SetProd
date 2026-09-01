import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { supabaseConfigurado } from '../lib/supabase';
import { limparParticipacoesLocais, sincronizarParticipacoes } from '../lib/membros';
import { registrarConta, CONTA_LOCAL } from '../lib/conta';
import { confirmar } from '../components/ui/Confirmacao';
import {
  avisoDeSaida,
  conferirAntesDeSair,
  haRisco,
  limparDadosLocais,
  tentarSubirTudo,
} from '../lib/limpezaLocal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, logout: () => {} });

/**
 * Anota quem entrou e, se for outra pessoa, limpa o que ficou da anterior.
 *
 * Cobre o buraco que o logout não cobre: fechar a aba sem sair. A sessão morre,
 * mas o IndexedDB continua cheio — e a próxima conta a entrar neste navegador
 * abriria a produção de quem estava aqui antes, com os dados dela na tela e o
 * cursor dela no sync.
 *
 * Não é o mesmo caso do logout, e a diferença muda o que dá para fazer: aqui a
 * sessão anterior JÁ acabou. Não há como subir o que ficou pendente, porque
 * quem tinha permissão de subir foi embora. Então o aviso é honesto sobre isso
 * e oferece a única saída que existe de verdade — voltar na outra conta antes.
 */
async function anotarConta(id: string | undefined): Promise<void> {
  const { anterior, trocou } = registrarConta(id);
  // `anterior === CONTA_LOCAL` é navegador limpo, ou já limpo por um logout:
  // não há dono anterior para proteger.
  if (!trocou || anterior === CONTA_LOCAL) return;

  const risco = await conferirAntesDeSair();
  if (haRisco(risco)) {
    const seguir = await confirmar(
      [
        'Este navegador ainda tem dados de outra conta, e há coisa que nunca chegou ao servidor:',
        '',
        risco.pendentes > 0 ? `• ${risco.pendentes} alteração(ões) não enviada(s).` : '',
        risco.producoesSoLocais.length > 0
          ? `• Produções que existem só aqui: ${risco.producoesSoLocais.join(', ')}.`
          : '',
        '',
        'Como aquela sessão já acabou, este app não consegue enviar isso — só a conta de origem consegue.',
        '',
        'Continuar apaga tudo. Cancelar mantém os dados para você entrar na outra conta primeiro.',
      ].filter(Boolean).join('\n')
    );

    if (!seguir) {
      // A pessoa vai voltar para a outra conta. Sair daqui evita que ela comece
      // a trabalhar por cima de dado que não é dela.
      await supabase.auth.signOut();
      return;
    }
  }

  limparParticipacoesLocais();
  await limparDadosLocais();
  // A conta nova precisa ser registrada de novo: `limparDadosLocais` esquece
  // quem estava aqui, e sem isto o cursor desta sessão nasceria como `local`.
  registrarConta(id);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await anotarConta(session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false);
      // Sessão retomada (voltou ao app, outro aparelho): confere de quais
      // projetos esta conta participa, sem travar a tela esperando.
      if (session?.user) sincronizarParticipacoes();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Antes do setUser: o cursor do sync é lido por conta, e uma volta de
      // sincronização disparada pela re-renderização não pode usar o id de quem
      // saiu. Ver `conta.ts`.
      void anotarConta(session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sair leva o dado junto.
   *
   * Não é excesso de zelo: o app é offline-first, então a produção inteira está
   * no IndexedDB deste navegador. Sem apagar, a próxima pessoa a abrir o
   * notebook da produção vê tudo — sem login, sem internet, sem pedir nada.
   * Esconder na tela não resolveria, porque o dado continua lá para quem abrir
   * o DevTools.
   *
   * O preço é que apagar é definitivo, e por isso a ordem importa: primeiro
   * tenta subir o que falta, depois confere o que ainda se perderia, e só
   * pergunta quando há mesmo algo em risco. Logout com uma caixa de diálogo
   * toda vez seria treinar a pessoa a clicar em "sim" sem ler.
   */
  const logout = async () => {
    // Quem usa o app sem Supabase não tem conta nenhuma, e para essa pessoa o
    // Dexie é o banco de verdade — apagar seria destruir o trabalho dela.
    if (!supabaseConfigurado) {
      limparParticipacoesLocais();
      await supabase.auth.signOut();
      return;
    }

    await tentarSubirTudo();

    const risco = await conferirAntesDeSair();
    if (haRisco(risco) && !(await confirmar(avisoDeSaida(risco)))) return;

    // As participações ficam no localStorage e são o que a tela lê para decidir
    // o que mostrar; sem limpá-las a próxima conta veria permissões que não tem.
    limparParticipacoesLocais();
    await limparDadosLocais();
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
