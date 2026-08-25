// Clima via Open-Meteo (gratuito, sem chave de API).

export interface ClimaDia {
  tempMax: number;
  tempMin: number;
  chuvaProb: number; // %
  code: number; // WMO weather code
  sunrise?: string; // HH:MM
  sunset?: string; // HH:MM
}

/**
 * Extrai lat,lng de um texto livre (link do Maps, "lat, lng", "@lat,lng", etc.).
 * Retorna null se não achar um par de coordenadas plausível.
 */
export function parseCoords(texto?: string): { lat: number; lng: number } | null {
  if (!texto) return null;

  /*
    Links do OpenStreetMap trazem as coordenadas em parâmetros SEPARADOS
    (?mlat=…&mlon=…), e não como um par "lat,lng". O app gera esse formato no
    `linkMapa` e não conseguia lê-lo de volta: quem copiasse o link do próprio
    mapa que o SetProd abriu recebia "sem coordenadas".
  */
  const osm = texto.match(/[?&]mlat=(-?\d{1,3}\.?\d*)[^]*?[?&]mlon=(-?\d{1,3}\.?\d*)/);

  // Formato @-23.55,-46.63 (links do Google Maps)
  const arroba = texto.match(/@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/);
  const alvo = osm || arroba || texto.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!alvo) return null;
  const lat = parseFloat(alvo[1]);
  const lng = parseFloat(alvo[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/**
 * Busca a previsão para uma data específica (YYYY-MM-DD) numas coordenadas.
 * Lança erro se offline ou fora da janela de previsão.
 */
export async function buscarClima(lat: number, lng: number, data: string): Promise<ClimaDia | null> {
  // Verifica se a data está dentro de um range razoável para a API gratuita (~2 semanas p/ frente)
  const dataAlvo = new Date(data);
  const hoje = new Date();
  const diffDias = (dataAlvo.getTime() - hoje.getTime()) / (1000 * 3600 * 24);
  if (diffDias > 15 || diffDias < -30) {
    throw new Error('Data fora da janela de previsão gratuita (15 dias)');
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset` +
    `&timezone=auto&start_date=${data}&end_date=${data}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Falha ao consultar previsão');
  const json = await resp.json();
  const d = json?.daily;
  if (!d || !d.time || d.time.length === 0) return null;
  
  const formataHora = (isoStr: string) => {
    if (!isoStr) return '';
    return isoStr.split('T')[1]?.substring(0, 5) || '';
  };

  return {
    tempMax: d.temperature_2m_max?.[0],
    tempMin: d.temperature_2m_min?.[0],
    chuvaProb: d.precipitation_probability_max?.[0] ?? 0,
    code: d.weather_code?.[0] ?? 0,
    sunrise: formataHora(d.sunrise?.[0]),
    sunset: formataHora(d.sunset?.[0]),
  };
}

/** Uma previsão amarrada à locação de onde ela veio. */
export interface ClimaPorLocal {
  locacao: { id: string; nome: string };
  clima: ClimaDia;
}

/**
 * Junta as locações que têm a MESMA previsão.
 *
 * Uma diária com dois sets no mesmo bairro recebe duas previsões idênticas, e
 * dois cartões iguais lado a lado são ruído — a pessoa para de ler o bloco
 * inteiro. Quando batem, viram um cartão com os dois nomes; quando diferem, ficam
 * separados, que é exatamente quando a informação vale alguma coisa (um set na
 * serra e outro no litoral não têm o mesmo dia).
 *
 * A comparação é por TOLERÂNCIA, não por arredondamento.
 *
 * Arredondar parece equivalente e não é: 27,4°C e 27,6°C viram 27 e 28 e caem em
 * cartões separados, embora sejam o mesmo dia para quem está montando o set.
 * Qualquer fronteira de arredondamento tem esse problema — dois valores a um
 * décimo de distância podem cair de lados opostos. Com tolerância, o que decide
 * é a diferença real entre eles.
 */

/** Quanto dois sets podem divergir e ainda serem "o mesmo dia". */
const TOLERANCIA_GRAUS = 2;
const TOLERANCIA_CHUVA = 15; // pontos percentuais

function mesmoDia(a: ClimaDia, b: ClimaDia): boolean {
  return (
    descreverClima(a.code).texto === descreverClima(b.code).texto &&
    Math.abs(a.tempMax - b.tempMax) <= TOLERANCIA_GRAUS &&
    Math.abs(a.tempMin - b.tempMin) <= TOLERANCIA_GRAUS &&
    Math.abs(a.chuvaProb - b.chuvaProb) <= TOLERANCIA_CHUVA
  );
}

export function agruparClimasIguais(lista: ClimaPorLocal[]): { locais: string[]; clima: ClimaDia }[] {
  const grupos: { locais: string[]; clima: ClimaDia }[] = [];

  for (const item of lista) {
    // Compara com o primeiro de cada grupo. Guloso de propósito: a alternativa
    // seria agrupamento por similaridade, e para dois ou três sets num dia isso
    // seria complexidade sem ganho nenhum.
    const grupo = grupos.find(g => mesmoDia(g.clima, item.clima));
    if (grupo) grupo.locais.push(item.locacao.nome);
    else grupos.push({ locais: [item.locacao.nome], clima: item.clima });
  }

  return grupos;
}

/** Mapeia o código WMO para emoji + descrição em português. */
export function descreverClima(code: number): { emoji: string; texto: string } {
  if (code === 0) return { emoji: '☀️', texto: 'Céu limpo' };
  if (code <= 2) return { emoji: '🌤️', texto: 'Parcialmente nublado' };
  if (code === 3) return { emoji: '☁️', texto: 'Nublado' };
  if (code <= 48) return { emoji: '🌫️', texto: 'Névoa' };
  if (code <= 57) return { emoji: '🌧️', texto: 'Garoa' };
  if (code <= 67) return { emoji: '🌧️', texto: 'Chuva' };
  if (code <= 77) return { emoji: '🌨️', texto: 'Neve' };
  if (code <= 82) return { emoji: '🌦️', texto: 'Pancadas de chuva' };
  if (code <= 86) return { emoji: '🌨️', texto: 'Pancadas de neve' };
  if (code <= 99) return { emoji: '⛈️', texto: 'Tempestade' };
  return { emoji: '🌡️', texto: 'Indefinido' };
}
