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

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  });
  if (!res.ok) throw new Error(`Overpass respondeu ${res.status}`);

  const data = await res.json();
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
