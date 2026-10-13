import { preferencias } from './preferencias';

/**
 * Vibração no celular (Lucas, 12/10/2026).
 *
 * Só o Android vibra: o Safari do iPhone não deixa app da web usar o motor.
 * Onde não há `navigator.vibrate`, nada acontece e nada quebra.
 *
 * Cada momento tem o SEU padrão, para dar para saber o que aconteceu sem olhar
 * a tela — no set, com o aparelho na mão e o olho no monitor:
 *
 * - `toque`: o tique de mexer num controle (aba, interruptor, −/+);
 * - `ok`, `ng`, `hero`, `recinv`: o status do take, um por botão;
 * - `sucesso`: algo terminou bem (cartão liberado, ingest aplicado);
 * - `aviso`: uma pergunta de "tem certeza?" que pode apagar algo;
 * - `wrap`: o fim do dia — a diária fechada, a desprodução marcada.
 *
 * Os números são milissegundos, vibra-pausa-vibra. Curtos de propósito: um
 * celular vibrando longo em cima de um case faz barulho que o boom pega.
 */
export const PADROES = {
  toque: 8,
  segurar: 12,
  ok: 30,
  ng: [25, 70, 25],
  hero: [60, 50, 120],
  recinv: [18, 45, 18, 45, 18],
  sucesso: [20, 50, 45],
  aviso: [40, 70, 40],
  wrap: [70, 60, 70, 60, 220],
} as const satisfies Record<string, number | readonly number[]>;

export type Vibracao = keyof typeof PADROES;

/**
 * O aparelho sabe vibrar? Android sim; iPhone não tem a função. O Chrome do
 * computador TEM a função, mas não tem motor — por isso o dedo na tela entra
 * na conta, senão o interruptor das Configurações apareceria no notebook.
 */
export const vibraNesteAparelho = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function vibrar(qual: Vibracao) {
  if (!preferencias().vibracao || !vibraNesteAparelho()) return;
  const p = PADROES[qual];
  try { navigator.vibrate(typeof p === 'number' ? p : [...p]); } catch { /* o navegador recusou: segue sem */ }
}
