/**
 * Busca de hospitais próximos via Overpass API (OpenStreetMap) — gratuito, sem chave.
 * O app apenas SUGERE: quem confirma o que vai para a OD é o usuário (v4 §4.2),
 * porque isso é informação de segurança.
 */

export interface HospitalOSM {
  id: string;
  nome: string;
  telefone?: string;
  distancia: number; // metros, linha reta
  lat: number;
  lng: number;
  endereco?: string;
}

/** Distância em metros entre dois pontos (Haversine). */
export function distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function formatarDistancia(metros?: number): string {
  if (metros === undefined || metros === null) return '';
  if (metros < 1000) return `${metros} m`;
  return `${(metros / 1000).toFixed(1)} km`;
}

/** URL de rota no OpenStreetMap (sem custo e sem chave de API). */
export function linkRota(origem: { lat: number; lng: number }, destino: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${origem.lat}%2C${origem.lng}%3B${destino.lat}%2C${destino.lng}`;
}

/** Link genérico para abrir um ponto no mapa. */
export function linkMapa(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * Os servidores da Overpass, em ordem de tentativa.
 *
 * São instâncias diferentes do MESMO banco (o OpenStreetMap inteiro), mantidas
 * por gente diferente. Consultar a segunda quando a primeira falha não é gambiarra
 * — é como a rede foi feita para ser usada.
 */
/**
 * Os servidores da Overpass, em ordem de preferência.
 *
 * São instâncias diferentes do MESMO banco (o OpenStreetMap inteiro), mantidas
 * por gente diferente. Perguntar à segunda quando a primeira não responde não é
 * gambiarra — é como a rede foi feita para ser usada.
 *
 * Os dois foram conferidos de dentro do navegador: respondem à mesma consulta,
 * com os mesmos dados, e mandam o cabeçalho de CORS. Espelho que só funciona no
 * terminal não serve para nada aqui.
 */
const ESPELHOS_OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

/**
 * Quanto esperar antes de perguntar também ao espelho seguinte.
 *
 * Num dia bom o primeiro responde em ~3s e nenhum outro chega a ser incomodado.
 * Passando disto, a chance de ele estar congestionado é grande o bastante para
 * valer uma segunda pergunta em paralelo — e o serviço é público e gratuito,
 * então não se dispara para todos de uma vez sem motivo.
 */
const ESCALONAR_MS = 5_000;

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Pergunta à Overpass, escalonando os espelhos.
 *
 * ⚠️ POR QUE A TRAVA DE 429 QUE JÁ EXISTIA AQUI NUNCA PEGOU NADA
 *
 * Quando a Overpass está cheia ela responde 429 — mas responde SEM o cabeçalho
 * `Access-Control-Allow-Origin`. O navegador então bloqueia a resposta antes de
 * o app poder olhar para ela: o `fetch` estoura um `TypeError` genérico, o
 * status nunca chega até aqui, e o que a pessoa via era um erro de CORS no
 * console e um alerta dizendo "Failed to fetch".
 *
 * Ou seja: o modo mais comum de falhar era justamente o único que o tratamento
 * de erro não alcançava.
 *
 * POR QUE EM PARALELO, E NÃO UM DEPOIS DO OUTRO
 * Porque o espelho lento é tão comum quanto o espelho fora do ar. Medindo em
 * horário comercial: o principal respondeu em 6s e o segundo, vivo e correto,
 * levou 31s. Em fila, com um limite de tempo decente para cada um, a busca
 * ficaria mais de um minuto em "Buscando..." antes de desistir — e ninguém
 * espera um minuto olhando para um botão.
 *
 * Escalonado, o caso comum manda UMA pergunta só.
 */
async function consultarOverpass(query: string): Promise<any> {
  /*
    Nada de cabeçalho `Content-Type`, de propósito.

    Sem ele o navegador manda `text/plain`, e isso faz da consulta uma
    "requisição simples": ela vai direto, sem o OPTIONS de sondagem. Com o
    Content-Type "certo", cada busca passaria a custar um preflight em cada
    espelho — e nem todos respondem bem a ele.
  */
  const cancelamento = new AbortController();
  const relogio = setTimeout(() => cancelamento.abort(), 40_000);
  let respondido = false;

  /*
    A vez de cada espelho: o relógio OU a desistência do anterior, o que vier
    primeiro.

    O caso do CORS falha na hora — em milissegundos, sem nem chegar a ir à rede.
    Sem este atalho o segundo espelho ficaria os 5 segundos parado esperando a
    vez de um concorrente que já morreu, e são justamente esses segundos que
    faltam quando ele está lento.
  */
  const liberar: (() => void)[] = [];
  const vez = ESPELHOS_OVERPASS.map((_, i) =>
    i === 0 ? Promise.resolve() : new Promise<void>(r => { liberar[i] = r; })
  );

  const perguntar = async (url: string, i: number) => {
    await Promise.race([vez[i], esperar(i * ESCALONAR_MS)]);
    // O anterior já voltou enquanto este esperava: não incomoda o espelho à toa.
    if (respondido) throw new Error('já respondido');

    try {
      const res = await fetch(url, { method: 'POST', body: query, signal: cancelamento.signal });
      if (!res.ok) throw new Error(`${new URL(url).host} respondeu ${res.status}`);
      const dados = await res.json();
      respondido = true;
      return dados;
    } catch (e) {
      liberar[i + 1]?.();
      throw e;
    }
  };

  try {
    return await Promise.any(ESPELHOS_OVERPASS.map(perguntar));
  } catch {
    /*
      Todos falharam. A mensagem não tenta distinguir congestionado de fora do
      ar de bloqueado pelo navegador: para quem está cadastrando uma locação,
      os três significam a mesma coisa, e a saída é a mesma.

      O que ela precisa dizer é que existe uma saída — o campo à mão logo
      abaixo —, senão a pessoa fica tentando de novo achando que é ela.
    */
    throw new Error(
      'Não deu para consultar o mapa agora. O serviço é gratuito e compartilhado, e costuma ficar ' +
      'congestionado em horário comercial. Tente de novo em alguns minutos — ou escreva o hospital ' +
      'à mão no campo abaixo, que funciona igual na Ordem do Dia.'
    );
  } finally {
    clearTimeout(relogio);
    // Encerra o que ainda estiver no ar: a resposta já não interessa a ninguém.
    cancelamento.abort();
  }
}

/**
 * Lista hospitais/prontos-socorros num raio (padrão 8km), ordenados por distância.
 * Retorna no máximo 8 candidatos para o usuário escolher.
 */
export async function buscarHospitaisProximos(
  lat: number,
  lng: number,
  raioMetros = 8000
): Promise<HospitalOSM[]> {
  const query = `[out:json][timeout:25];
(
  node["amenity"~"^(hospital|clinic)$"](around:${raioMetros},${lat},${lng});
  way["amenity"~"^(hospital|clinic)$"](around:${raioMetros},${lat},${lng});
);
out center tags 30;`;

  const data = await consultarOverpass(query);
  const elementos: any[] = data.elements || [];

  return elementos
    .map(el => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') return null;
      const tags = el.tags || {};
      const partesEndereco = [tags['addr:street'], tags['addr:housenumber'], tags['addr:suburb']].filter(Boolean);
      return {
        id: String(el.id),
        nome: tags.name || (tags.amenity === 'clinic' ? 'Clínica sem nome' : 'Hospital sem nome'),
        telefone: tags.phone || tags['contact:phone'] || undefined,
        distancia: distanciaMetros(lat, lng, elLat, elLng),
        lat: elLat,
        lng: elLng,
        endereco: partesEndereco.length ? partesEndereco.join(', ') : undefined,
      } as HospitalOSM;
    })
    .filter((h): h is HospitalOSM => h !== null)
    .sort((a, b) => a.distancia - b.distancia)
    .slice(0, 8);
}
