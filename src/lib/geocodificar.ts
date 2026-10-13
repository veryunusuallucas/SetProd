/**
 * Endereço → ponto no mapa, pelo Nominatim (OpenStreetMap).
 *
 * O Nominatim procura o texto INTEIRO, e um endereço brasileiro de verdade
 * traz pedaços que ele não conhece: "R. Dom José Gaspar, 500 - Prédio 30 -
 * Coração Eucarístico, Belo Horizonte - MG, 30535-000" não achava nada (Lucas,
 * 13/10/2026). Por isso a busca tenta por partes, do mais exato ao mais solto,
 * e para no primeiro que achar.
 *
 * Uma consulta por segundo, no máximo: é a regra de uso do Nominatim.
 */

export interface LugarAchado {
  lat: number;
  lng: number;
  /** O nome que o OpenStreetMap dá ao lugar. */
  rotulo: string;
  /** Achou o número da casa, ou só a rua? */
  temNumero: boolean;
}

const COMPLEMENTO = /\b(pr[eé]dio|bloco|bl\.?|apto?\.?|apartamento|sala|sl\.?|casa|loja|lj\.?|andar|conj(unto)?\.?|galp[aã]o|port[aã]o|fundos)\s*[\w-]*/gi;
const CEP = /\b\d{5}-?\d{3}\b/g;

/** O OpenStreetMap conhece "Rua", e não "R.". */
const ABREVIACOES: [RegExp, string][] = [
  [/^\s*R\.?\s+/i, 'Rua '], [/^\s*Av\.?\s+/i, 'Avenida '], [/^\s*Al\.?\s+/i, 'Alameda '],
  [/^\s*P[cç]a?\.?\s+/i, 'Praça '], [/^\s*Trav\.?\s+/i, 'Travessa '], [/^\s*Rod\.?\s+/i, 'Rodovia '],
  [/^\s*Estr\.?\s+/i, 'Estrada '],
];

/** Junta separadores que ficaram sobrando depois de tirar pedaços: "500 -  - Bairro" → "500 - Bairro". */
function arrumar(s: string): string {
  return s
    .replace(/\s*[-–]\s*/g, ' - ')
    .replace(/(\s-\s*){2,}/g, ' - ')
    .replace(/\s*,\s*(-\s*)?/g, ', ')
    .replace(/\s-\s*,/g, ',')
    .replace(/(,\s*){2,}/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,-]+|[\s,-]+$/g, '')
    .trim();
}

/** As versões do endereço a tentar, da mais completa para a mais solta. Sem repetidas. */
export function tentativasDeBusca(endereco: string): string[] {
  const original = endereco.trim();
  const expandido = ABREVIACOES.reduce((s, [de, para]) => s.replace(de, para), original);
  const semComplemento = arrumar(expandido.replace(COMPLEMENTO, '').replace(CEP, ''));

  /*
    "Rua X, 500 - Bairro, Cidade - UF" → "Rua X, 500, Cidade - UF": a rua com o
    número e a cidade, sem o bairro (o bairro que o OSM não tem derruba tudo).
  */
  const [primeira = '', segunda = ''] = semComplemento.split(', ');
  const numero = (segunda.match(/^\d+[A-Za-z]?/) || [])[0];
  const rua = numero ? `${primeira}, ${numero}` : primeira.split(' - ')[0];
  const cidadeUf = (semComplemento.match(/([A-Za-zÀ-ú' ]+?)\s-\s([A-Z]{2})\b/) || [])[0]?.trim();

  /*
    Sem o tipo da rua: o OSM chama de "Avenida Dom José Gaspar" o que o
    endereço da PUC escreve "R. Dom José Gaspar". Testado em 13/10/2026 — só
    assim achou o número 500 e o 290.

    O CEP sozinho NÃO entra: o Nominatim respondeu com outra cidade (José
    Bonifácio, Unaí). Um ponto errado é pior que nenhum.
  */
  const semTipo = rua.replace(/^(rua|avenida|alameda|praça|travessa|rodovia|estrada)\s+/i, '');
  return [...new Set([
    original,
    semComplemento,
    rua && cidadeUf ? `${rua}, ${cidadeUf}` : '',
    semTipo !== rua && cidadeUf ? `${semTipo}, ${cidadeUf}` : '',
  ].map(s => s.trim()).filter(s => s.length >= 3))];
}

async function consultar(q: string): Promise<LugarAchado[]> {
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('O OpenStreetMap não respondeu. Tente de novo em alguns segundos.');
  const dados: { lat: string; lon: string; display_name: string; address?: { house_number?: string } }[] = await res.json();
  return dados.map(d => ({ lat: Number(d.lat), lng: Number(d.lon), rotulo: d.display_name, temNumero: Boolean(d.address?.house_number) }));
}

const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Tenta as versões do endereço até uma achar. Devolve até 5 lugares (vazio se nenhuma achou). */
export async function buscarEndereco(endereco: string): Promise<LugarAchado[]> {
  const tentativas = tentativasDeBusca(endereco);
  for (let i = 0; i < tentativas.length; i++) {
    if (i > 0) await espera(1100);
    const achados = await consultar(tentativas[i]);
    if (achados.length) return achados;
  }
  return [];
}

/** Ponto → nome do lugar, para confirmar que o alfinete caiu onde devia. */
export async function nomeDoPonto(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&lat=${lat}&lon=${lng}`);
    if (!res.ok) return null;
    const d: { display_name?: string } = await res.json();
    return d.display_name || null;
  } catch {
    return null;
  }
}

/** O link do Maps que o app grava em `coordenadas` (o mesmo formato do "Buscar OSM"). */
export const linkDoPonto = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;

/** Link curto do Google (maps.app.goo.gl): não traz o ponto, e o navegador não deixa abrir para descobrir. */
export const ehLinkCurtoDoGoogle = (texto: string) => /(?:maps\.app\.goo\.gl|goo\.gl\/maps)\//i.test(texto);
