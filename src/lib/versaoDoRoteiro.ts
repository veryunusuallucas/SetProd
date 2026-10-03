/**
 * A versão do roteiro como o ROTEIRISTA a numerou — lida do nome do arquivo.
 *
 * O app numera os envios (o 1º PDF é a v1, o 2º é a v2...), mas o roteiro já
 * chega com a numeração dele: "Canção de Outono_v6.pdf" era mostrado como
 * "v2", e a equipe fala "a v6". Duas numerações para a mesma coisa é pedir
 * para alguém marcar a cena na versão errada (pedido do Lucas, 02/10/2026).
 *
 * Então: se o nome do arquivo diz a versão, vale ela. Se não diz, vale a
 * contagem de envios do app, como antes.
 */

/**
 * Acha a versão no nome: "_v6", " V6", "-v6.2", "versão 3", "versao_3",
 * "rev 4", "tratamento 5". Devolve o texto ("6", "6.2") ou null.
 */
export function versaoNoNome(nome?: string): string | null {
  if (!nome) return null;
  const semExtensao = nome.replace(/\.[a-z0-9]{2,4}$/i, '');
  // Antes do marcador, só início ou separador: "v6" de "Nav6" não conta.
  const achado = /(?:^|[\s._\-()[\]])(?:v|vers[aã]o|rev(?:is[aã]o)?|tratamento)[\s._-]*(\d+(?:[.,]\d+)?)(?![a-z])/i.exec(semExtensao);
  return achado ? achado[1].replace(',', '.') : null;
}

/** "v6" (do nome do arquivo) ou "envio 2" (contagem do app). */
export function rotuloDaVersao(roteiro: { nome?: string; versao?: number }): string {
  const doNome = versaoNoNome(roteiro.nome);
  return doNome ? `v${doNome}` : `envio ${roteiro.versao ?? 1}`;
}
