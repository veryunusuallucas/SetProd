import { sincronizar, puxar, pendencias } from './sincronizacao';
import { sincronizarParticipacoes } from './membros';
import { enviarPendentes } from './arquivos';
import { migrarAnexosDoProjeto } from './migracaoAnexos';
import { supabaseConfigurado } from './supabase';

/**
 * Quando sincronizar, sem ninguém apertar botão.
 *
 * Separado do motor (`sincronizacao.ts`) de propósito: lá é "como" o dado vai e
 * vem, aqui é "quando". Misturar os dois faria o motor difícil de testar, e
 * testar o motor é o que impede um bug de vazar para todo mundo.
 */

export type EstadoSync = 'ocioso' | 'sincronizando' | 'salvo' | 'offline' | 'erro';

interface Situacao {
  estado: EstadoSync;
  pendentes: number;
  ultimoErro?: string;
  ultimaVez?: number;
}

const situacoes = new Map<string, Situacao>();
const OUVINTES = 'setprod-sync';

/** Projetos com uma rodada em andamento — duas ao mesmo tempo se atropelariam. */
const emAndamento = new Set<string>();

export function situacaoDe(projetoId: string): Situacao {
  return situacoes.get(projetoId) ?? { estado: 'ocioso', pendentes: 0 };
}

function anunciar(projetoId: string, mudanca: Partial<Situacao>) {
  situacoes.set(projetoId, { ...situacaoDe(projetoId), ...mudanca });
  window.dispatchEvent(new CustomEvent(OUVINTES, { detail: { projetoId } }));
}

export function ouvirSync(callback: () => void): () => void {
  window.addEventListener(OUVINTES, callback);
  return () => window.removeEventListener(OUVINTES, callback);
}

/**
 * Uma rodada completa para um projeto.
 *
 * Nunca lança: sincronização que quebra a tela é pior que sincronização que
 * falha em silêncio e tenta de novo. O erro fica na situação, para o rodapé
 * mostrar (§3.5 da spec).
 */
export async function rodada(projetoId: string): Promise<void> {
  if (!supabaseConfigurado) return;
  if (emAndamento.has(projetoId)) return;

  if (!navigator.onLine) {
    anunciar(projetoId, { estado: 'offline', pendentes: await pendencias(projetoId) });
    return;
  }

  emAndamento.add(projetoId);
  anunciar(projetoId, { estado: 'sincronizando' });

  try {
    // Os anexos que ainda estavam em base64 dentro das linhas viram arquivo de
    // verdade. Uma vez por projeto, e só o que faltou — ver migracaoAnexos.
    await migrarAnexosDoProjeto(projetoId);

    // Anexos criados sem sinal sobem agora. Antes do `sincronizar` de propósito:
    // a linha que aponta para o arquivo não deveria chegar na outra equipe
    // antes do arquivo em si.
    await enviarPendentes(projetoId);

    await sincronizar(projetoId);
    anunciar(projetoId, {
      estado: 'salvo',
      pendentes: await pendencias(projetoId),
      ultimoErro: undefined,
      ultimaVez: Date.now(),
    });
  } catch (e: any) {
    // 42501 = a RLS recusou. Quase sempre significa "ainda não sou membro
    // deste projeto", e não uma falha de verdade — não vale assustar.
    const semAcesso = e?.code === '42501';
    anunciar(projetoId, {
      estado: semAcesso ? 'ocioso' : 'erro',
      pendentes: await pendencias(projetoId),
      ultimoErro: semAcesso ? undefined : (e?.message || String(e)),
    });
    if (!semAcesso) console.warn('[SetProd] Sync falhou:', e);
  } finally {
    emAndamento.delete(projetoId);
  }
}

/**
 * Traz as produções que compartilharam comigo.
 *
 * É isto que faz a Equipe B, que aceitou um convite e nunca teve o projeto
 * neste navegador, ver a produção aparecer na tela inicial. Sem isto o convite
 * dá acesso a uma tela vazia.
 */
export async function puxarProjetosCompartilhados(): Promise<number> {
  if (!supabaseConfigurado || !navigator.onLine) return 0;

  const participacoes = await sincronizarParticipacoes();
  let total = 0;

  for (const p of participacoes) {
    try {
      total += await puxar(p.projeto_id);
    } catch (e) {
      console.warn('[SetProd] Não consegui puxar o projeto', p.projeto_id, e);
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// O laço
// ---------------------------------------------------------------------------

/** De quanto em quanto tempo, com o projeto aberto na tela. */
const INTERVALO_MS = 15_000;

/**
 * Mantém um projeto sincronizando enquanto a tela dele estiver aberta.
 *
 * Devolve a função de parar. Além do relógio, reage a três momentos em que o
 * estado quase sempre está desatualizado: a rede voltar, a aba voltar ao foco,
 * e o app voltar do segundo plano.
 */
export function manterSincronizado(projetoId: string): () => void {
  let vivo = true;

  const agora = () => { if (vivo) void rodada(projetoId); };

  agora();
  const relogio = window.setInterval(agora, INTERVALO_MS);

  const aoVoltarAba = () => { if (!document.hidden) agora(); };

  window.addEventListener('online', agora);
  window.addEventListener('focus', agora);
  document.addEventListener('visibilitychange', aoVoltarAba);

  const aoCairARede = () => anunciar(projetoId, { estado: 'offline' });
  window.addEventListener('offline', aoCairARede);

  return () => {
    vivo = false;
    window.clearInterval(relogio);
    window.removeEventListener('online', agora);
    window.removeEventListener('focus', agora);
    window.removeEventListener('offline', aoCairARede);
    document.removeEventListener('visibilitychange', aoVoltarAba);
  };
}
