import type { Plano } from '../types';

/**
 * Os planos de uma cena, na ordem em que se filma.
 *
 * `Plano` não tem campo `ordem` — só `numero`, que é TEXTO. E texto ordena
 * errado: "10" vem antes de "2", e um plano "3A" some no meio. Aqui o número
 * é lido como número, e a letra que sobra desempata — que é exatamente como a
 * decupagem numera (3, 3A, 3B, 4).
 *
 * Se um dia a tela permitir arrastar plano, aí sim vale um `ordem?: number` no
 * tipo; até lá, o número impresso é a ordem, e é o que a equipe já usa no set.
 */

/** ["3A"] → [3, "A"] — o par que ordena de verdade. */
function chaveDoPlano(numero: string): [number, string] {
  const bruto = (numero || '').trim().toUpperCase();
  const digitos = bruto.match(/\d+/)?.[0];
  const letras = bruto.replace(/^\D*\d+/, '');
  // Sem dígito nenhum ("EXTRA", "PICKUP"), vai para o fim em vez de virar 0 e
  // se misturar com o plano 1.
  return [digitos ? parseInt(digitos, 10) : Number.MAX_SAFE_INTEGER, letras];
}

export function ordenarPlanos(planos: Plano[]): Plano[] {
  return [...planos].sort((a, b) => {
    const [na, la] = chaveDoPlano(a.numero);
    const [nb, lb] = chaveDoPlano(b.numero);
    return na - nb || la.localeCompare(lb);
  });
}

/** Índice cena → planos, já ordenados. Uma passada só. */
export function planosPorCena(planos: Plano[]): Map<string, Plano[]> {
  const mapa = new Map<string, Plano[]>();
  for (const p of planos) {
    const lista = mapa.get(p.cena_id);
    if (lista) lista.push(p);
    else mapa.set(p.cena_id, [p]);
  }
  for (const [cena, lista] of mapa) mapa.set(cena, ordenarPlanos(lista));
  return mapa;
}

/** "6 planos" / "1 plano" / "sem decupagem". */
export function resumoDePlanos(quantos: number): string {
  if (quantos === 0) return 'sem decupagem';
  return quantos === 1 ? '1 plano' : `${quantos} planos`;
}
