/**
 * Como a versão aparece para quem usa.
 *
 * O APP É UM BETA (decisão do Lucas, 02/10/2026). Até aqui a numeração era
 * 4.x — herança do tempo em que cada reescrita ganhava um número inteiro —, e
 * "4.17" diz a quem usa que o app é maduro. Ele não é: ainda muda toda semana.
 * A série inteira foi renumerada de 4.N para 0.N (a 4.17 virou a beta 0.17),
 * e o número chega à 1.0 quando o app sair do beta.
 *
 * Todo lugar que escreve a versão na tela passa por aqui, para "Beta" não
 * aparecer num canto e faltar no outro.
 */

/** "Beta 0.17" — maior.menor, para a tela. */
export function rotuloCurto(versao: string = __VERSAO_APP__): string {
  return `Beta ${versao.split('.').slice(0, 2).join('.')}`;
}

/** "Beta 0.17.0" — com a correção, para rodapé e relatório de bug. */
export function rotuloCompleto(versao: string = __VERSAO_APP__): string {
  return `Beta ${versao}`;
}
