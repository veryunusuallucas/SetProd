import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';

/**
 * Quem mostra a ajuda: o botão flutuante ou o menu da tela.
 *
 * O "?" e o "relatar problema" são globais — existem em toda tela, num botão
 * que flutua no canto. Dentro de uma produção, no celular, esse canto agora é
 * da dock, e o botão ficava boiando em cima dela. Pedido do Lucas (17/09/2026):
 * que as duas ações morem **dentro do menu**, junto com Configurações e Busca.
 *
 * Então quem tem um menu que as abriga se anuncia aqui, e o botão flutuante
 * some enquanto isso durar. Fora da produção — na tela inicial, no login — ele
 * continua sendo o único caminho, e continua lá.
 */

let quantos = 0;
const ouvintes = new Set<() => void>();

function avisar() { for (const f of ouvintes) f(); }

/** Enquanto montado, a ajuda mora no menu desta tela. */
export function useAjudaNoMenu(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    quantos++;
    avisar();
    return () => { quantos--; avisar(); };
  }, [ativo]);
}

export function useAjudaEstaNoMenu(): boolean {
  return useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => quantos > 0,
    () => false,
  );
}

/** As duas ações, abertas de qualquer lugar. O host mora no App. */
export const abrirAjuda = () => window.dispatchEvent(new Event('setprod-abrir-ajuda'));
export const abrirRelatarProblema = () => window.dispatchEvent(new Event('setprod-abrir-bug'));
