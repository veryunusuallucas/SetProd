/*
  As fontes embutidas do PDF só conhecem WinAnsi.

  Acento de português cabe; ✓, ☐ e os emojis do clima, não — eles sairiam como
  espaço em branco no papel, que é pior que sair como texto. A troca acontece
  no renderizador, e não nos dados: o e-mail em HTML mostra os símbolos sem
  problema, e tirá-los da origem empobreceria os dois.

  Mora aqui, fora de `lib/od/pdf.tsx`, porque a Logagem também faz papel.
*/
const TROCAS: [RegExp, string][] = [
  [/☑/g, '[x]'],
  [/☐/g, '[ ]'],
  [/[✓✔]/g, 'ok'],
  [/[·•]/g, '·'],
  [/[–—]/g, '-'],
  [/[“”]/g, '"'],
  [/[‘’]/g, "'"],
];

export function limpar(texto: string): string {
  let t = texto;
  for (const [de, para] of TROCAS) t = t.replace(de, para);
  // O que sobrou fora do Latin-1 (emoji, setas, símbolos) some com o espaço
  // junto. A quebra de linha fica: observação de dez linhas é uma só sem ela.
  return t.replace(/[^\n\r\u0020-\u00ff]/g, '').replace(/ {2,}/g, ' ').trim();
}
