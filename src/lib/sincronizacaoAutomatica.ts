import { sincronizar, pendencias, aplicarLinhas, TABELA_ESPELHO } from './sincronizacao';
import { supabase } from './supabase';
import { EVENTO_ALTERACAO } from '../db/db';
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
 * Sincroniza todas as produções de que participo — sobe e desce.
 *
 * É isto que faz a Equipe B, que aceitou um convite e nunca teve o projeto
 * neste navegador, ver a produção aparecer na tela inicial. Sem isto o convite
 * dá acesso a uma tela vazia.
 *
 * ⚠️ SOBE TAMBÉM, e isso não é detalhe. Antes ela só puxava, e o `rodada()` —
 * único lugar que empurra — só roda dentro de uma produção ABERTA. Então tudo o
 * que a pessoa fazia na tela inicial ficava preso na caixa de saída: mandar uma
 * produção para a lixeira, restaurar, renomear. A alteração só saía do aparelho
 * se ela abrisse aquela produção depois — e quem acabou de mandar algo para a
 * lixeira justamente não abre.
 *
 * O sintoma era a produção sumir para quem apagou e continuar na lista da outra
 * equipe, para sempre.
 */
export async function sincronizarProjetosCompartilhados(): Promise<number> {
  if (!supabaseConfigurado || !navigator.onLine) return 0;

  const participacoes = await sincronizarParticipacoes();
  let total = 0;

  for (const p of participacoes) {
    try {
      const { recebidas } = await sincronizar(p.projeto_id);
      total += recebidas;
    } catch (e) {
      console.warn('[SetProd] Não consegui sincronizar o projeto', p.projeto_id, e);
    }
  }

  return total;
}

// ---------------------------------------------------------------------------
// Tempo real
// ---------------------------------------------------------------------------

/** Projetos com o canal ao vivo de pé — alimenta o rodapé e o ritmo do relógio. */
const aoVivo = new Set<string>();

export const estaAoVivo = (projetoId: string) => aoVivo.has(projetoId);

/**
 * Escuta as mudanças do projeto no servidor e aplica na hora.
 *
 * O Realtime entrega a linha inteira, então não precisa nem consultar de volta:
 * o que chega aqui passa pelo MESMO `aplicarLinhas` do lote periódico. É o que
 * faz o LWW e as lápides valerem igual nos dois caminhos, sem código separado.
 *
 * O QUE ELE NÃO FAZ: mexer no cursor.
 * O cursor diz "li tudo até aqui", e o Realtime não dá essa garantia — ele pode
 * perder eventos numa reconexão, e a entrega não é ordenada por `recebido_em`.
 * Avançar o cursor com o que chega ao vivo criaria um buraco silencioso: a
 * leitura periódica pularia justamente as linhas que o Realtime deixou passar.
 * Quem move o cursor é `puxar`, e só ele.
 */
function ligarTempoReal(projetoId: string, aoMudarEstado: () => void) {
  const canal = supabase
    .channel(`projeto:${projetoId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABELA_ESPELHO, filter: `projeto_id=eq.${projetoId}` },
      async payload => {
        const linha = payload.new as any;
        // DELETE só acontece na purga de um projeto inteiro; não há o que
        // aplicar linha a linha, e o `new` vem vazio.
        if (!linha?.tabela) return;

        try {
          const aplicadas = await aplicarLinhas([linha]);
          if (aplicadas) {
            anunciar(projetoId, { estado: 'salvo', ultimaVez: Date.now() });
          }
        } catch (e) {
          console.warn('[SetProd] Falha ao aplicar mudança ao vivo:', e);
        }
      }
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') aoVivo.add(projetoId);
      else aoVivo.delete(projetoId);
      aoMudarEstado();
    });

  return () => {
    aoVivo.delete(projetoId);
    supabase.removeChannel(canal);
  };
}

// ---------------------------------------------------------------------------
// O laço
// ---------------------------------------------------------------------------

/**
 * De quanto em quanto tempo o app confere o servidor por conta própria.
 *
 * Com o canal ao vivo de pé, a conferência periódica vira rede de segurança —
 * pega o que o Realtime tiver perdido — e pode ser rara. Sem ele, é o único
 * jeito de saber que algo mudou, então aperta.
 */
const INTERVALO_AO_VIVO_MS = 60_000;
const INTERVALO_SEM_TEMPO_REAL_MS = 15_000;

/**
 * Quanto esperar depois de uma alteração antes de subir.
 *
 * Não é atraso à toa: digitar um nome dispara uma gravação por tecla, e subir
 * a cada tecla mandaria dezenas de requisições para escrever a mesma linha.
 * Um segundo e meio é mais que o intervalo entre teclas e muito menos que o
 * tempo de perceber que algo demorou.
 */
const ESPERA_APOS_ALTERACAO_MS = 1_500;

/**
 * Mantém um projeto sincronizando enquanto a tela dele estiver aberta.
 *
 * Devolve a função de parar. Além do relógio, reage a três momentos em que o
 * estado quase sempre está desatualizado: a rede voltar, a aba voltar ao foco,
 * e o app voltar do segundo plano.
 */
export function manterSincronizado(projetoId: string): () => void {
  let vivo = true;
  let relogio: number | undefined;
  let ritmoAtual = 0;

  const agora = () => { if (vivo) void rodada(projetoId); };

  /**
   * Ajusta o ritmo conforme o canal ao vivo esteja de pé ou não.
   *
   * Só recria o intervalo quando o ritmo REALMENTE muda: reagendar a cada
   * evento adiaria a conferência para sempre, e ela nunca aconteceria.
   */
  const ajustarRitmo = () => {
    if (!vivo) return;
    const desejado = estaAoVivo(projetoId) ? INTERVALO_AO_VIVO_MS : INTERVALO_SEM_TEMPO_REAL_MS;
    if (desejado === ritmoAtual) return;

    ritmoAtual = desejado;
    window.clearInterval(relogio);
    relogio = window.setInterval(agora, desejado);
  };

  agora();
  ajustarRitmo();

  const desligarTempoReal = ligarTempoReal(projetoId, ajustarRitmo);

  /**
   * Sobe logo depois de alguém mexer em algo.
   *
   * O canal ao vivo já entregava em menos de um segundo — mas só depois que o
   * dado chegava ao servidor, e isso esperava o relógio. Na prática, uma
   * alteração podia levar um minuto para aparecer do outro lado, mesmo com
   * tudo online. O gargalo era a subida, não a descida.
   */
  let esperando: number | undefined;
  const aoAlterar = (e: Event) => {
    const alvo = (e as CustomEvent<{ projeto_id?: string }>).detail?.projeto_id;
    if (alvo && alvo !== projetoId) return;

    // Reinicia a contagem a cada alteração: o envio sai quando a pessoa para
    // de mexer, não no meio da digitação.
    window.clearTimeout(esperando);
    esperando = window.setTimeout(agora, ESPERA_APOS_ALTERACAO_MS);
  };
  window.addEventListener(EVENTO_ALTERACAO, aoAlterar);

  const aoVoltarAba = () => { if (!document.hidden) agora(); };

  window.addEventListener('online', agora);
  window.addEventListener('focus', agora);
  document.addEventListener('visibilitychange', aoVoltarAba);

  const aoCairARede = () => anunciar(projetoId, { estado: 'offline' });
  window.addEventListener('offline', aoCairARede);

  return () => {
    vivo = false;
    window.clearInterval(relogio);
    window.clearTimeout(esperando);
    desligarTempoReal();
    window.removeEventListener(EVENTO_ALTERACAO, aoAlterar);
    window.removeEventListener('online', agora);
    window.removeEventListener('focus', agora);
    window.removeEventListener('offline', aoCairARede);
    document.removeEventListener('visibilitychange', aoVoltarAba);
  };
}
