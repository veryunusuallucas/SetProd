/**
 * Pedir ao navegador que NÃO apague os dados deste site (PLANO-logagem §8).
 *
 * Sem isso, o navegador trata o IndexedDB como cache: com o celular sem espaço,
 * ele pode esvaziar tudo sem perguntar. Para a maior parte do app isso é
 * incômodo (baixa de novo do servidor). Para a Logagem no set, sem sinal, é
 * perder takes que ainda não subiram.
 *
 * O Chrome decide sozinho, sem janela (pelo quanto o site é usado, e se está
 * instalado); o Firefox pergunta. Pedir não custa nada e só é feito uma vez.
 */

export type SituacaoDoArmazenamento = 'permanente' | 'temporario' | 'sem-suporte';

export async function situacaoDoArmazenamento(): Promise<SituacaoDoArmazenamento> {
  try {
    if (!navigator.storage?.persisted) return 'sem-suporte';
    return (await navigator.storage.persisted()) ? 'permanente' : 'temporario';
  } catch {
    return 'sem-suporte';
  }
}

export async function pedirArmazenamentoPermanente(): Promise<SituacaoDoArmazenamento> {
  try {
    if (!navigator.storage?.persist) return 'sem-suporte';
    return (await navigator.storage.persist()) ? 'permanente' : 'temporario';
  } catch {
    return 'sem-suporte';
  }
}

const CHAVE = 'setprod:logagem:armazenamento-pedido';

/** Na primeira abertura da Logagem por quem registra. Depois, só pela Config. */
export async function pedirUmaVez(): Promise<void> {
  try {
    if (localStorage.getItem(CHAVE)) return;
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return;
  }
  if ((await situacaoDoArmazenamento()) === 'temporario') await pedirArmazenamentoPermanente();
}
