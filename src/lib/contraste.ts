/**
 * Preto ou branco por cima de uma cor — calculado, nunca chutado.
 *
 * O erro comum é fixar branco. Sobre o amarelo e o verde-claro da paleta dos
 * departamentos, um ✓ branco some por completo: a amostra escolhida fica
 * idêntica às outras, e o seletor deixa de dizer o que está selecionado.
 *
 * A conta é a luminância relativa da WCAG. Ela não é a média dos canais: o olho
 * humano enxerga o verde muito mais que o azul, e por isso os pesos são
 * diferentes (0,2126 / 0,7152 / 0,0722). Um verde e um azul de mesmo valor RGB
 * pedem letras de cores opostas.
 *
 * ⚠️ O CORTE NÃO É EM 0,5 — ISSO É FOLCLORE, E EU ESCREVI ASSIM NA PRIMEIRA
 * VERSÃO. Um teste sobre a paleta real pegou: o verde-água `#00C49F` tem
 * luminância 0,42, cai do lado "escuro" da metade e receberia um ✓ branco. Só
 * que a razão de contraste dele com branco é 2,2 e com preto é 9,4 — o branco
 * ali é quase ilegível.
 *
 * A comparação certa é entre as duas razões de contraste, e o ponto de empate
 * fica em L ≈ 0,179, não em 0,5. Metade da escala de luminância não é metade do
 * que o olho enxerga; é justamente esse o motivo de a fórmula existir.
 */

/** Converte um canal sRGB (0–255) para luz linear, desfazendo o gama. */
function canalLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Luminância relativa de um hex `#rgb` ou `#rrggbb`. 0 = preto, 1 = branco. */
export function luminancia(hex: string): number {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return 0; // cor inválida: trata como escura
  const r = canalLinear(parseInt(h.slice(0, 2), 16));
  const g = canalLinear(parseInt(h.slice(2, 4), 16));
  const b = canalLinear(parseInt(h.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Razão de contraste da WCAG entre duas luminâncias: (Lclara+0,05)/(Lescura+0,05).
 * Vai de 1 (iguais) a 21 (preto sobre branco).
 */
export function razaoDeContraste(a: number, b: number): number {
  const [claro, escuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (escuro + 0.05);
}

/** A cor de traço que se enxerga por cima de `fundo` — a de maior contraste. */
export function contrasteSobre(fundo: string): string {
  const L = luminancia(fundo);
  // Compara as duas de verdade, em vez de partir a escala ao meio.
  return razaoDeContraste(L, 0) >= razaoDeContraste(L, 1) ? '#000000' : '#ffffff';
}
