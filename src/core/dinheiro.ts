/**
 * Dinheiro em centavos inteiros — na conta (ROADMAP §10.B).
 *
 * O PROBLEMA
 * O app somava `number` em reais e arredondava no fim. Quase sempre dava
 * certo. O "quase" era o rateio: R$ 100 entre 7 pessoas gravava 14,285714… em
 * cada uma, e as sete parcelas que a tela mostrava (14,29) somavam R$ 100,03.
 * Num app de dinheiro, um centavo que não fecha é o que faz alguém desconfiar
 * de todos os outros números.
 *
 * A DECISÃO — e por que não é a do ROADMAP ao pé da letra
 * O ROADMAP pedia guardar tudo em centavos inteiros, com campo novo, backfill
 * e remoção do antigo. Isso é uma migração de dado financeiro já gravado — no
 * servidor e em cada aparelho —, com aparelhos no app antigo escrevendo o campo
 * velho no meio da transição, em oito campos de dinheiro que teriam de mudar
 * juntos.
 *
 * O defeito, porém, não mora no armazenamento: mora na CONTA. Então:
 *
 *   1. toda soma, saldo e simplificação acontece em centavos inteiros;
 *   2. o rateio novo divide em centavos e distribui o resto — os primeiros
 *      levam um centavo a mais, em ordem estável — e grava valores que fecham;
 *   3. despesas antigas, gravadas com 14,285714…, fecham NA LEITURA
 *      (`fecharNoTotal`), sem reescrever nada.
 *
 * O que fica gravado continua em reais, com duas casas. Se um dia for preciso
 * guardar em inteiros, a conta já está pronta para isso.
 */

/** Reais → centavos. O arredondamento acontece UMA vez, na entrada. */
export const emCentavos = (reais: number | undefined | null): number => Math.round((reais || 0) * 100);

/** Centavos → reais, só para gravar ou mostrar. */
export const emReais = (centavos: number): number => centavos / 100;

/**
 * Divide um total em `partes` que somam EXATAMENTE o total.
 *
 * R$ 100,00 / 7 → 14,29 ×4 e 14,28 ×3 — as primeiras levam o centavo que
 * sobra. A ordem é a da lista recebida, então quem paga o centavo a mais é
 * sempre o mesmo para a mesma escala: nada muda de uma edição para a outra.
 */
export function dividirEmPartes(totalReais: number, partes: number): number[] {
  if (partes <= 0) return [];
  const total = emCentavos(totalReais);
  const base = Math.trunc(total / partes);
  const resto = total - base * partes;
  return Array.from({ length: partes }, (_, i) => emReais(base + (i < Math.abs(resto) ? Math.sign(resto) : 0)));
}

/**
 * Leva uma lista de valores a fechar exatamente no total, em centavos.
 *
 * É o conserto das despesas antigas: sete parcelas de 14,285714… viram
 * 14,29 ×4 e 14,28 ×3 pelo método do maior resto — cada uma arredondada para
 * baixo, e os centavos que faltam vão para as de maior parte decimal.
 *
 * Só age quando a diferença é ruído de arredondamento (menos de um centavo por
 * parcela). Uma lista que não soma o total por OUTRO motivo não é rateio mal
 * arredondado — é outra coisa, e não cabe à conta "consertar" em silêncio.
 */
export function fecharNoTotal(valoresReais: number[], totalReais: number): number[] {
  const brutos = valoresReais.map(v => (v || 0) * 100);
  const alvo = emCentavos(totalReais);
  const somaBruta = brutos.reduce((s, v) => s + v, 0);

  if (!valoresReais.length || Math.abs(somaBruta - alvo) >= valoresReais.length) {
    return valoresReais.map(v => emCentavos(v));
  }

  const pisos = brutos.map(v => Math.floor(v + 1e-6));
  let falta = alvo - pisos.reduce((s, v) => s + v, 0);

  const porResto = brutos
    .map((v, i) => ({ i, resto: v - pisos[i] }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);

  const saida = [...pisos];
  for (let k = 0; falta > 0 && k < porResto.length; k++, falta--) saida[porResto[k].i] += 1;
  for (let k = porResto.length - 1; falta < 0 && k >= 0; k--, falta++) saida[porResto[k].i] -= 1;
  return saida;
}
