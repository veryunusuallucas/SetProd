import { useSyncExternalStore } from 'react';

/**
 * Preferências DESTE APARELHO — não da produção, não da conta.
 *
 * Tema, as frases do J. Martins e a festa do wrap são gosto de quem segura o
 * celular: a diretora pode querer o wrap com fogos e o produtor, só os números.
 * Por isso ficam no navegador, e não no projeto — uma escolha de um não muda a
 * tela do outro. (Mesma lógica da barra de baixo e da ordem da equipe.)
 *
 * Toda leitura e escrita é protegida: em aba privada ou navegador que bloqueia
 * armazenamento, vale o padrão e o app segue.
 */

export interface Preferencias {
  /** 'escuro' é o app como sempre foi; 'claro', para o set de dia. */
  tema: 'escuro' | 'claro';
  /** As frases do J. Martins que aparecem de vez em quando no canto. */
  mensagensDivertidas: boolean;
  /** Fogos, frase e gif no wrap. Desligado, o wrap mostra só os números. */
  wrapFestivo: boolean;
}

const PADRAO: Preferencias = { tema: 'escuro', mensagensDivertidas: true, wrapFestivo: true };
const CHAVE = 'setprod:preferencias';

function ler(): Preferencias {
  try {
    const cru = localStorage.getItem(CHAVE);
    return cru ? { ...PADRAO, ...JSON.parse(cru) } : PADRAO;
  } catch {
    return PADRAO;
  }
}

let atual = ler();
const ouvintes = new Set<() => void>();

export function preferencias(): Preferencias {
  return atual;
}

export function mudarPreferencia<K extends keyof Preferencias>(chave: K, valor: Preferencias[K]) {
  atual = { ...atual, [chave]: valor };
  try { localStorage.setItem(CHAVE, JSON.stringify(atual)); } catch { /* fica só nesta sessão */ }
  if (chave === 'tema') aplicarTema();
  ouvintes.forEach(f => f());
}

/** Lê uma preferência e redesenha quando ela muda (em qualquer lugar do app). */
export function usePreferencia<K extends keyof Preferencias>(chave: K): Preferencias[K] {
  return useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => atual[chave],
  );
}

/**
 * Põe o tema no <html>. Chamado no `main.tsx` ANTES do primeiro desenho — se
 * esperasse o React, quem usa o claro veria um clarão escuro a cada abertura.
 */
export function aplicarTema() {
  const raiz = document.documentElement;
  raiz.dataset.tema = atual.tema;
  // A barra do navegador no celular acompanha o fundo do app.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', atual.tema === 'claro' ? '#f5f5f4' : '#121212');
}
