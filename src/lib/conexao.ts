import { situacaoDe, ouvirSync, estaAoVivo } from './sincronizacaoAutomatica';

/**
 * O estado de conexão do app, em uma pergunta só: **meu trabalho está salvo?**
 *
 * TRÊS COISAS QUE A MAIORIA DOS APPS CONFUNDE
 *   1. tem internet?          → `navigator.onLine`
 *   2. está falando com o servidor? → a última rodada de sync
 *   3. meu trabalho está seguro?    → pendências === 0
 *
 * ⚠️ OFFLINE NÃO É ERRO. Este app foi feito para o set sem sinal. Ícone vermelho
 * toda vez que a equipe entra numa locação sem cobertura ensina a pessoa a
 * ignorar o indicador — e aí ele falha justamente no dia em que importava.
 * Alarme só existe no caso em que há o que fazer: offline COM trabalho parado.
 *
 * ⚠️ `navigator.onLine` MENTE. Ele diz `true` no wifi da locação que exige login
 * no portal: há rede, não há internet. O sinal confiável é a própria
 * sincronização ter falhado — e é ele que manda aqui.
 */

export type EstadoDaConexao =
  | 'conectado'      // online, nada esperando
  | 'salvando'       // online, subindo agora
  | 'offline_limpo'  // sem conexão, mas nada estava esperando
  | 'offline_sujo'   // sem conexão e com trabalho parado — o único que alarma
  | 'erro';          // o servidor recusou ou algo quebrou

export interface Conexao {
  estado: EstadoDaConexao;
  pendentes: number;
  /** O canal ao vivo está de pé. Cair com internet boa aponta para o servidor. */
  aoVivo: boolean;
  ultimoErro?: string;
  ultimaVez?: number;
}

export function lerConexao(projetoId?: string): Conexao {
  if (!projetoId) {
    // Home, login: não há projeto para contar pendência. Só online ou não.
    return { estado: navigator.onLine ? 'conectado' : 'offline_limpo', pendentes: 0, aoVivo: false };
  }

  const s = situacaoDe(projetoId);
  const aoVivo = estaAoVivo(projetoId);
  const pendentes = s.pendentes ?? 0;

  // A falha de rede manda mais que o navegador: é ela que sabe do portal de login.
  const semRede = !navigator.onLine || s.estado === 'offline';

  const estado: EstadoDaConexao =
    s.estado === 'erro' ? 'erro'
    : semRede ? (pendentes > 0 ? 'offline_sujo' : 'offline_limpo')
    : s.estado === 'sincronizando' ? 'salvando'
    : 'conectado';

  return { estado, pendentes, aoVivo, ultimoErro: s.ultimoErro, ultimaVez: s.ultimaVez };
}

/** A frase que a pessoa lê. Curta no ícone, inteira no toque. */
export function frasesDaConexao(c: Conexao): { curta: string; longa: string } {
  switch (c.estado) {
    case 'salvando':
      return { curta: 'Salvando…', longa: `Salvando ${c.pendentes || ''} ${c.pendentes === 1 ? 'alteração' : 'alterações'}`.replace('  ', ' ') };
    case 'offline_limpo':
      return { curta: 'Sem conexão', longa: 'Sem conexão · tudo que você fez já foi salvo' };
    case 'offline_sujo':
      return {
        curta: `Sem conexão · ${c.pendentes}`,
        longa: `Sem conexão · ${c.pendentes} ${c.pendentes === 1 ? 'alteração aguardando' : 'alterações aguardando'}. Elas sobem sozinhas quando o sinal voltar — não feche o app antes disso.`,
      };
    case 'erro':
      return { curta: 'Erro ao salvar', longa: c.ultimoErro || 'Não consegui salvar no servidor.' };
    default:
      return { curta: 'Conectado', longa: c.aoVivo ? 'Conectado · tudo salvo, e ao vivo com a equipe' : 'Conectado · tudo salvo' };
  }
}

/**
 * Observa a conexão com um FREIO de dois segundos na queda.
 *
 * Sinal de set cai e volta o tempo todo. Sem o freio, o indicador pisca a cada
 * oscilação, e piscar é a forma mais rápida de virar ruído. A volta é imediata
 * (boa notícia não espera); só a queda espera.
 */
export function ouvirConexao(projetoId: string | undefined, aoMudar: (c: Conexao) => void): () => void {
  let relogio: number | undefined;
  let ultimo: EstadoDaConexao | undefined;

  const avaliar = () => {
    const c = lerConexao(projetoId);
    const caiu = c.estado.startsWith('offline') && !(ultimo || '').startsWith('offline');

    window.clearTimeout(relogio);
    if (caiu) {
      relogio = window.setTimeout(() => { ultimo = c.estado; aoMudar(lerConexao(projetoId)); }, 2000);
      return;
    }
    ultimo = c.estado;
    aoMudar(c);
  };

  const parar = ouvirSync(avaliar);
  window.addEventListener('online', avaliar);
  window.addEventListener('offline', avaliar);
  avaliar();

  return () => {
    window.clearTimeout(relogio);
    parar();
    window.removeEventListener('online', avaliar);
    window.removeEventListener('offline', avaliar);
  };
}
