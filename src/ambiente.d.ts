/**
 * Constantes que o Vite injeta no build (ver `define` no vite.config.ts).
 *
 * Não são variáveis de ambiente: o valor é trocado no código durante a
 * compilação, então precisa ser declarado aqui para o TypeScript conhecê-lo.
 */

/** A versão do app, lida do package.json na hora de construir. */
declare const __VERSAO_APP__: string;
