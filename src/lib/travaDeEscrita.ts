import { definirTravaDeEscrita } from '../db/db';
import { negacaoDaEscrita, FRASE_DA_NEGACAO, type QuemEscreve } from './escopo';
import { participacaoLocal } from './membros';
import { EVENTO_RECUSA, type Recusa } from './sincronizacao';

/**
 * A trava local: a escrita proibida não acontece, venha de que tela vier.
 *
 * POR QUE AQUI, E NÃO SÓ NA TELA
 * O app tem dezenas de telas que gravam, e quase nenhuma perguntava o papel:
 * quem era "leitura" via o botão de editar a despesa, clicava, o dado mudava
 * aqui, e só depois o servidor recusava. Esconder botão tela a tela é o
 * acabamento (e está sendo feito), mas um botão esquecido não pode virar dado
 * divergente. Os hooks do Dexie são o funil por onde TODA escrita passa, então é
 * aqui que a regra vale para todas.
 *
 * A regra é a de `escopo.ts` (`negacaoDaEscrita`), a mesma que o servidor aplica
 * em `supabase/sql/escopo.sql`. Esta trava não é a segurança — é o que evita
 * que a pessoa veja uma mudança que ninguém mais vai ver.
 *
 * O que vem do servidor passa direto: o db.ts nem chama a trava numa escrita
 * remota.
 */

/** A escrita foi barrada. Quem chamou recebe a rejeição; o aviso já saiu. */
export class EscritaNegada extends Error {
  tabela: string;
  motivo: string;
  constructor(tabela: string, motivo: string) {
    super(`Escrita negada em ${tabela}: ${motivo}`);
    this.name = 'EscritaNegada';
    this.tabela = tabela;
    this.motivo = motivo;
  }
}

/**
 * O que o layout da produção sabe sobre mim, por projeto.
 *
 * Síncrono de propósito: o hook do Dexie roda dentro da transação e não pode
 * sair para ler outra tabela. O papel não precisa estar aqui — ele mora no
 * `localStorage` e é lido na hora.
 */
const contextos = new Map<string, Omit<QuemEscreve, 'papel' | 'departamentoConhecido'>>();

export function definirContextoDeEscrita(projetoId: string, contexto: Omit<QuemEscreve, 'papel' | 'departamentoConhecido'>) {
  contextos.set(projetoId, contexto);
}

export function esquecerContextoDeEscrita(projetoId: string) {
  contextos.delete(projetoId);
}

export function quemEscreveEm(projetoId: string): QuemEscreve {
  const contexto = contextos.get(projetoId);
  return {
    papel: participacaoLocal(projetoId)?.papel ?? 'desconhecido',
    departamentoConhecido: Boolean(contexto),
    ...contexto,
  };
}

/**
 * A pergunta para quem vai gravar sozinho — sem clique de ninguém.
 *
 * Gravação automática (espelhar o stripboard na diária ao abrir a tela) não
 * deve nem tentar quando a conta não pode: tentar e ser barrada faria o aviso
 * aparecer para uma pessoa que não fez nada.
 */
export function possoEscrever(tabela: string, projetoId: string, antes?: object, depois?: object): boolean {
  return !negacaoDaEscrita(tabela, quemEscreveEm(projetoId), antes as never, (depois ?? antes) as never);
}

/*
  Um aviso por tabela a cada poucos segundos. Um "salvar" que mexe em doze
  linhas da mesma tabela é UMA recusa para quem clicou, não doze.
*/
const ultimoAviso = new Map<string, number>();

definirTravaDeEscrita((tabela, antes, depois) => {
  const linha = depois ?? antes;
  const projetoId = tabela === 'projetos' ? linha?.id : linha?.projeto_id;
  if (!projetoId) return;

  const negacao = negacaoDaEscrita(tabela, quemEscreveEm(projetoId), antes, depois);
  if (!negacao) return;

  const motivo = FRASE_DA_NEGACAO[negacao];
  const agora = Date.now();
  if ((ultimoAviso.get(tabela) ?? 0) < agora - 4000) {
    ultimoAviso.set(tabela, agora);
    // Fora da transação que vai abortar: o aviso é da tela, não do banco.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent<Recusa[]>(EVENTO_RECUSA, {
        detail: [{ projeto_id: projetoId, tabela, id: linha?.id ?? '', motivo }],
      }));
    }, 0);
  }
  throw new EscritaNegada(tabela, motivo);
});

/*
  A rejeição sobe para quem chamou `db.x.put(...)`, e quase ninguém no app
  espera por ela — viraria "Uncaught (in promise)" no console a cada clique
  barrado. O aviso para a pessoa já saiu; o console não precisa gritar.
*/
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason as { name?: string; inner?: { name?: string } } | undefined;
    if (r?.name === 'EscritaNegada' || r?.inner?.name === 'EscritaNegada') e.preventDefault();
  });
}
