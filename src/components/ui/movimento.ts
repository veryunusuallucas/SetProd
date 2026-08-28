import { useEffect, useState } from 'react';

/**
 * A física de movimento do app inteiro.
 *
 * POR QUE ISTO SAIU DE `ia.tsx`
 * Nasceu lá, e o arquivo dizia: *"este capricho vale só onde a IA aparece.
 * Espalhar isso pelo app inteiro custaria caro e deixaria tudo barulhento."*
 *
 * Metade dessa decisão estava certa. Barulho — brilho, partícula, repique em
 * tudo — cansa mesmo, e continua restrito à IA. Mas a BASE FÍSICA não é
 * barulho: mola em vez de duração, resposta no toque e movimento reduzido são o
 * que separa uma interface fluida de uma travada. Isso vale em todo lugar.
 *
 * Então a divisão passa a ser explícita, para o escopo não se confundir de novo:
 *
 *   AQUI  — física: molas, escalonamento, `prefers-reduced-motion`. Global.
 *   `ia.tsx` — capricho visual: borda com gradiente, brilho, `Sparkles`. Só IA,
 *              porque ali o enfeite tem significado: marca saída de máquina.
 *
 * Três regras que valem para qualquer componente que use isto:
 *
 *  1. Mola, não duração fixa. Movimento com física é interrompível: se a pessoa
 *     mexer no meio, a animação acompanha em vez de terminar sozinha.
 *  2. Resposta no toque (pointer-down), não no soltar. É o que faz o botão
 *     parecer instantâneo mesmo quando a ação leva tempo.
 *  3. Movimento reduzido é respeitado. Quem marcou isso no sistema tem motivo —
 *     enjoo, vertigem. A informação continua, o deslocamento some.
 */

/**
 * Molas do sistema, em física explícita (rigidez e amortecimento).
 *
 * Medi as alternativas no app: `duration` conta até a mola assentar por
 * completo, não até o movimento parecer pronto, e `visualDuration` não teve
 * efeito aqui. Com stiffness/damping o comportamento é previsível e igual em
 * qualquer versão da biblioteca.
 *
 * O que importa é a razão de amortecimento ζ = damping / (2·√stiffness):
 * ζ = 1 chega ao destino sem passar dele; abaixo disso, repica.
 */

/** Entrada e saída: ζ = 1, sem repique, porque não houve gesto do usuário. */
export const MOLA = { type: 'spring', stiffness: 400, damping: 40 } as const;

/** Resposta a gesto: ζ ≈ 0,75 — rápida, com um repique leve que devolve o toque. */
export const MOLA_GESTO = { type: 'spring', stiffness: 900, damping: 45 } as const;

/** Intervalo entre itens que entram em sequência. */
export const PASSO_STAGGER = 0.05;

/** O sistema pede menos movimento? Reage se a pessoa mudar isso com o app aberto. */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aoMudar = () => setReduzido(mq.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  return reduzido;
}
