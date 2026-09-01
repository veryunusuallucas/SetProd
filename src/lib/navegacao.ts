/**
 * Para onde o botão "voltar" leva.
 *
 * POR QUE NÃO É `navigate(-1)`
 * O histórico do navegador é o caminho que a pessoa FEZ, não a estrutura do
 * app. Quem chegou na diária por um link do WhatsApp voltaria para o WhatsApp;
 * quem passeou por cinco telas volta pela quinta. O botão ao lado do nome do
 * projeto promete uma coisa só — "subir um nível" — e para cumprir isso ele
 * precisa saber a hierarquia, não o passado.
 *
 * A hierarquia é rasa de propósito, porque as rotas do app são rasas:
 *
 *   /projeto/:id/diaria/:diariaId  →  /projeto/:id/diarias  →  /projeto/:id  →  sair
 *   /projeto/:id/financeiro        →  /projeto/:id                          →  sair
 *
 * Sub-abas dentro de uma tela (o acerto dentro do Financeiro, por exemplo) não
 * são rotas, então este cálculo não as enxerga — quem volta de lá é o controle
 * da própria tela.
 */

export interface Destino {
  /** Para onde ir. `null` quer dizer "sair do projeto". */
  caminho: string | null;
  /** O que o botão está prometendo, para o `title`. */
  rotulo: string;
}

export function voltarDe(pathname: string, projetoId: string): Destino {
  const raiz = `/projeto/${projetoId}`;
  const resto = pathname.startsWith(raiz) ? pathname.slice(raiz.length).replace(/^\/|\/$/g, '') : '';

  // Já estamos no painel do projeto: o próximo passo para trás é sair dele.
  if (!resto) return { caminho: null, rotulo: 'Sair do projeto' };

  const partes = resto.split('/');

  /*
    A diária tem um pai que não é o painel: a lista de diárias.

    É a única tela do app com dois níveis, e sem este caso ela pularia direto
    para o dashboard — deixando quem estava conferindo cinco diárias seguidas
    ter que reentrar na lista toda vez.
  */
  if (partes[0] === 'diaria' && partes.length > 1) {
    return { caminho: `${raiz}/diarias`, rotulo: 'Voltar para Diárias e Eventos' };
  }

  return { caminho: raiz, rotulo: 'Voltar para o painel do projeto' };
}
