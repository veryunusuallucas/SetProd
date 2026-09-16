/**
 * As anotações rápidas: pílulas que acrescentam uma frase pronta à observação.
 *
 * No set, digitar "vazou boom" com o take rodando é tirar o olho da cena. Um
 * toque resolve. A lista começa com as do Lumavi e se edita na aba Config.
 *
 * Ficam NO APARELHO, como as opções do relatório: são o vocabulário de quem
 * loga. O 2º AC e o DIT anotam coisas diferentes, e uma lista da produção
 * inteira viraria a soma das duas — comprida demais para caber no polegar.
 */

export const NOTAS_PADRAO = ['Foco cravado', 'Vazou boom', 'Tremido', 'Melhor atuação', 'MOS', 'Reflexo', 'Áudio clipou'];

const CHAVE = 'setprod:logagem:notas';
/** Mais que isso não cabe numa olhada, e a pílula deixa de ser mais rápida que digitar. */
export const MAXIMO_DE_NOTAS = 16;

export function lerNotas(): string[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [...NOTAS_PADRAO];
    return normalizarNotas(JSON.parse(bruto));
  } catch {
    return [...NOTAS_PADRAO];
  }
}

export function lembrarNotas(notas: string[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(normalizarNotas(notas)));
    // Avisa as outras telas abertas neste aparelho (a Config e a Logagem).
    window.dispatchEvent(new Event('setprod-notas'));
  } catch { /* sem localStorage: vale só agora */ }
}

/** Sem vazias, sem repetidas (ignorando maiúsculas), no máximo `MAXIMO_DE_NOTAS`. */
export function normalizarNotas(bruto: unknown): string[] {
  if (!Array.isArray(bruto)) return [...NOTAS_PADRAO];
  const vistas = new Set<string>();
  const notas: string[] = [];
  for (const n of bruto) {
    const t = String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    const chave = t.toLowerCase();
    if (!t || vistas.has(chave)) continue;
    vistas.add(chave);
    notas.push(t);
  }
  return notas.slice(0, MAXIMO_DE_NOTAS);
}

/**
 * A observação com a nota no fim.
 *
 * Tocar duas vezes na mesma pílula não escreve duas vezes — o segundo toque
 * quase sempre é engano, e "MOS, MOS" no boletim parece defeito do app.
 */
export function acrescentarNota(obs: string, nota: string): string {
  const atual = obs.replace(/\s+$/, '');
  if (!atual) return nota;
  const jaTem = atual.toLowerCase().split(/[,;.]\s*|\s+-\s+/).some(p => p.trim() === nota.toLowerCase());
  if (jaTem) return atual;
  const separador = /[,;.]$/.test(atual) ? ' ' : ', ';
  return atual + separador + nota;
}
