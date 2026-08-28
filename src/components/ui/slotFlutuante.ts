import { useSyncExternalStore } from 'react';

/**
 * Quem está sentado no canto de baixo à direita.
 *
 * O menu de ajuda é global — ele existe em toda tela do app. O botão amarelo de
 * "criar" não: hoje ele só aparece na tela inicial, e amanhã pode aparecer em
 * mais alguma.
 *
 * ⚠️ ALTURA FIXA NÃO RESOLVE ISSO. O menu ficava sempre em 96px, a altura de
 * quem tem um botão embaixo — e dentro da produção, onde não há botão nenhum,
 * ele flutuava no meio do nada com um vão vazio embaixo. Parece coisa fora do
 * lugar, porque é: um botão flutuante ancora no canto, e aquele não estava
 * ancorado em coisa alguma.
 *
 * Também não dá para o menu adivinhar pela rota. Ele teria que carregar uma
 * lista de telas que têm botão, e essa lista envelhece calada: quem adicionar
 * um botão amarelo numa tela nova não vai lembrar de vir aqui, e os dois vão se
 * sobrepor.
 *
 * Então quem ocupa o canto se anuncia, e o menu sobe só quando há alguém
 * embaixo dele.
 */

let ocupantes = 0;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const f of ouvintes) f();
}

/** Chamado por quem ocupa o canto. Devolve a função de desocupar. */
export function ocuparSlotInferior(): () => void {
  ocupantes += 1;
  avisar();

  // Idempotente: em desenvolvimento o React monta e desmonta duas vezes, e um
  // decremento repetido deixaria a conta negativa — o menu voltaria a flutuar.
  let solto = false;
  return () => {
    if (solto) return;
    solto = true;
    ocupantes -= 1;
    avisar();
  };
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

export function useSlotInferiorOcupado(): boolean {
  return useSyncExternalStore(assinar, () => ocupantes > 0, () => false);
}
