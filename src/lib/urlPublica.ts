/**
 * O endereço que vai dentro dos links compartilhados.
 *
 * POR QUE NÃO `window.location.origin`
 * A Vercel publica cada commit também num endereço próprio de pré-visualização
 * (`setprodapp-66sqia1bw-….vercel.app`). Se você gerar um convite estando nele,
 * o link nasce apontando para lá — e esses endereços são protegidos por login
 * da própria Vercel. Quem recebe cai numa tela pedindo conta da Vercel, não do
 * SetProd, e não tem como passar.
 *
 * Vale para os três links que saem daqui: convite, cadastro da equipe e
 * pesquisa. Todos iam para quem está de fora, que é justamente quem não tem
 * acesso ao ambiente de pré-visualização.
 *
 * Configure `VITE_URL_PUBLICA` na Vercel com o endereço definitivo
 * (https://setprodapp.vercel.app). Sem ela, cai no endereço atual — que é o
 * certo em desenvolvimento e no domínio de produção.
 */
export function urlPublica(): string {
  const configurada = import.meta.env.VITE_URL_PUBLICA as string | undefined;
  const base = (configurada || window.location.origin).replace(/\/+$/, '');
  return base;
}

/** Monta um link do app já com a base pública e sem barra dobrada. */
export function linkDoApp(caminho: string): string {
  const raiz = import.meta.env.BASE_URL || '/';
  return `${urlPublica()}${raiz}${caminho}`.replace(/([^:])\/\/+/g, '$1/');
}
