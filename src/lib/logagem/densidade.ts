import type { VisaoDeQuemVe } from './permissao';

/**
 * Quanto a Logagem mostra de uma vez (PLANO-logagem §6.3).
 *
 * Três telas para três situações reais, e não três níveis de "avançado":
 *
 * - **Foco:** o aparelho na mão, no set, entre um "ação" e um "corta". Claquete,
 *   o que está valendo em uma linha, a foto, os quatro botões e os últimos
 *   takes. Nada mais, porque cada seção a mais empurra os botões para longe do
 *   polegar.
 * - **Detalhada:** o notebook na mesa do DIT. Tudo: os seletores de ambiente e
 *   luz, a observação, a diária inteira.
 * - **Acompanhamento:** quem não loga e quer saber o que está rolando. A
 *   claquete de agora, o último take e a lista — sem nada para apertar por
 *   engano.
 */
export type Densidade = 'foco' | 'detalhada' | 'acompanhamento';

export const CHAVE_DENSIDADE = 'setprod:logagem:densidade';

/** O que cada um pode escolher. Quem não edita não tem por que abrir o modo Foco. */
export function densidadesPossiveis(podeEditar: boolean): Densidade[] {
  return podeEditar ? ['foco', 'detalhada'] : ['acompanhamento', 'detalhada'];
}

export const NOME_DA_DENSIDADE: Record<Densidade, string> = {
  foco: 'Foco',
  detalhada: 'Detalhada',
  acompanhamento: 'Acompanhamento',
};

/**
 * Em que visão a Logagem abre.
 *
 * Quem edita: **Foco no celular** (é a mão no set) e **Detalhada no
 * computador** (é a mesa). Quem só vê: o que a função dele pede — a
 * continuísta abre na Detalhada, o resto no Acompanhamento.
 *
 * A escolha da pessoa vence o padrão, mas só se ainda fizer sentido para ela:
 * quem era da Fotografia numa produção e só acompanha em outra não pode abrir
 * no Foco de uma tela onde não há o que apertar.
 */
export function densidadeInicial(opcoes: {
  podeEditar: boolean;
  visaoDeQuemVe: VisaoDeQuemVe;
  ehCelular: boolean;
  lembrada?: string | null;
}): Densidade {
  const possiveis = densidadesPossiveis(opcoes.podeEditar);
  if (opcoes.lembrada && possiveis.includes(opcoes.lembrada as Densidade)) {
    return opcoes.lembrada as Densidade;
  }
  if (opcoes.podeEditar) return opcoes.ehCelular ? 'foco' : 'detalhada';
  return opcoes.visaoDeQuemVe === 'completa' ? 'detalhada' : 'acompanhamento';
}

export function lerDensidadeLembrada(): string | null {
  try { return localStorage.getItem(CHAVE_DENSIDADE); } catch { return null; }
}

export function lembrarDensidade(d: Densidade) {
  try { localStorage.setItem(CHAVE_DENSIDADE, d); } catch { /* fica só nesta visita */ }
}
