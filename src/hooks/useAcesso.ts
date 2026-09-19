import { useParams } from 'react-router-dom';
import { useRole } from './useRole';
import { negacaoDaEscrita, FRASE_DA_NEGACAO, type Negacao } from '../lib/escopo';
import { quemEscreveEm } from '../lib/travaDeEscrita';

/**
 * A pergunta que a tela faz antes de mostrar um botão: posso gravar ISTO?
 *
 * É a mesma regra da trava de escrita (`travaDeEscrita.ts`) e do servidor
 * (`escopo.sql`) — a tela só pergunta antes, para não oferecer o que vai ser
 * barrado. "Esconder, não desabilitar" (ROADMAP, Etapa 8): onde o botão some,
 * `motivo()` dá a frase que fica no lugar dele.
 *
 * `registro` é a linha que se quer mexer (a task, a ficha); sem ele, a
 * pergunta é sobre CRIAR na tabela — e, no departamental, criar no meu
 * departamento.
 */
export function useAcesso() {
  const { id: projetoId } = useParams<{ id: string }>();
  // Só para re-renderizar quando a participação muda; a regra lê na hora.
  useRole();

  const negacao = (tabela: string, registro?: object): Negacao | null => {
    if (!projetoId) return null;
    const quem = quemEscreveEm(projetoId);
    const alvo = registro ?? { departamento_id: quem.meuDepartamentoId ?? undefined };
    return negacaoDaEscrita(tabela, quem, registro as never, alvo as never);
  };

  return {
    /** O meu departamento nesta produção, quando o layout já sabe. */
    meuDepartamentoId: projetoId ? quemEscreveEm(projetoId).meuDepartamentoId ?? undefined : undefined,
    podeEscrever: (tabela: string, registro?: object) => !negacao(tabela, registro),
    motivo: (tabela: string, registro?: object) => {
      const n = negacao(tabela, registro);
      return n ? FRASE_DA_NEGACAO[n] : '';
    },
  };
}
