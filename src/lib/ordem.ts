/**
 * Ordem alfabética do jeito que se lê em português (Lucas, 13/10/2026: "todas
 * essas listas em ordem alfabética").
 *
 * O `sort()` puro põe "Ângela" depois de "Zé" e "ana" depois de "Zé": compara
 * códigos de caractere. O Collator ignora acento e maiúscula, e lê número como
 * número ("Van 2" antes de "Van 10").
 */
const COLLATOR = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Uma cópia da lista em ordem alfabética pelo nome que `nome` devolve. Não mexe na original. */
export function emOrdem<T>(lista: readonly T[] | null | undefined, nome: (item: T) => string | undefined): T[] {
  return [...(lista ?? [])].sort((a, b) => COLLATOR.compare((nome(a) ?? '').trim(), (nome(b) ?? '').trim()));
}

/** "Nome Sobrenome" de uma ficha, para ordenar e mostrar. */
export const nomeCompleto = (p: { nome?: string; sobrenome?: string }) => `${p.nome ?? ''} ${p.sobrenome ?? ''}`.trim();
