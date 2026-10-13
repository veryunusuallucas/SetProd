import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Search, MapPin, Check } from 'lucide-react';
import { useComportamentoDeJanela } from './ui/Janela';
import { buscarEndereco, nomeDoPonto, type LugarAchado } from '../lib/geocodificar';

/**
 * Escolher o ponto da locação clicando no mapa (Lucas, 13/10/2026).
 *
 * A busca por texto não basta: o OpenStreetMap não conhece todo número de
 * casa no Brasil, e o link curto do Google (maps.app.goo.gl) não traz o ponto.
 * Aqui a pessoa busca para chegar perto, e então toca no lugar EXATO — a
 * portaria, a entrada do prédio. É desse ponto que saem o hospital mais
 * próximo, o clima e a rota da OD, então ele precisa ser o do set.
 *
 * Carregado sob demanda (`lazy`): o Leaflet só baixa quando a janela abre.
 */

/** O alfinete em CSS: o ícone padrão do Leaflet quebra com o empacotador (as imagens somem). */
const ALFINETE = L.divIcon({
  className: 'alfinete-mapa',
  html: '<span></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});

/** Centro do Brasil, quando ainda não há ponto nem busca. */
const BRASIL: [number, number] = [-14.2, -51.9];

export default function EscolherNoMapa({ endereco, inicial, aoEscolher, aoFechar }: {
  endereco: string;
  inicial?: { lat: number; lng: number } | null;
  aoEscolher: (ponto: { lat: number; lng: number; rotulo: string | null }) => void;
  aoFechar: () => void;
}) {
  useComportamentoDeJanela(aoFechar);
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const alfinete = useRef<L.Marker | null>(null);

  const [busca, setBusca] = useState(endereco);
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [achados, setAchados] = useState<LugarAchado[]>([]);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(inicial ?? null);
  const [rotulo, setRotulo] = useState<string | null>(null);

  // O nome do lugar onde o alfinete está: é a conferência de que caiu no lugar certo.
  useEffect(() => {
    if (!ponto) return;
    let vivo = true;
    setRotulo(null);
    const relogio = setTimeout(() => { void nomeDoPonto(ponto.lat, ponto.lng).then(n => { if (vivo) setRotulo(n); }); }, 600);
    return () => { vivo = false; clearTimeout(relogio); };
  }, [ponto]);

  const colocar = (lat: number, lng: number, zoom?: number) => {
    const m = mapa.current;
    if (!m) return;
    if (!alfinete.current) {
      alfinete.current = L.marker([lat, lng], { icon: ALFINETE, draggable: true, keyboard: false }).addTo(m);
      alfinete.current.on('dragend', () => {
        const p = alfinete.current!.getLatLng();
        setPonto({ lat: p.lat, lng: p.lng });
      });
    } else {
      alfinete.current.setLatLng([lat, lng]);
    }
    setPonto({ lat, lng });
    if (zoom) m.setView([lat, lng], zoom);
  };

  useEffect(() => {
    if (!caixa.current || mapa.current) return;
    const m = L.map(caixa.current, { zoomControl: true, attributionControl: true })
      .setView(inicial ? [inicial.lat, inicial.lng] : BRASIL, inicial ? 18 : 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(m);
    m.on('click', e => colocar(e.latlng.lat, e.latlng.lng));
    mapa.current = m;
    if (inicial) colocar(inicial.lat, inicial.lng);
    else if (endereco.trim().length >= 3) void procurar(endereco);
    return () => { m.remove(); mapa.current = null; alfinete.current = null; };
    // Uma vez, ao abrir: o mapa é criado e destruído com a janela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function procurar(texto: string) {
    if (texto.trim().length < 3) return;
    setBuscando(true);
    setAviso('');
    try {
      const lista = await buscarEndereco(texto);
      setAchados(lista);
      if (!lista.length) {
        setAviso('Não achei esse endereço no OpenStreetMap. Busque o bairro ou um lugar perto e toque no ponto exato no mapa.');
        return;
      }
      const [primeiro] = lista;
      colocar(primeiro.lat, primeiro.lng, primeiro.temNumero ? 18 : 16);
      if (!primeiro.temNumero) setAviso('Achei a rua, mas não o número. Toque no lugar exato do set.');
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'A busca falhou. Tente de novo.');
    } finally {
      setBuscando(false);
    }
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Escolher o ponto no mapa" className="janela-mapa-fundo">
      <div className="janela-mapa card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MapPin size={16} style={{ color: 'var(--cor-logistica)' }} aria-hidden />
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ flex: 1, margin: 0 }}>Escolher no mapa</h2>
          <button type="button" className="btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <form
          onSubmit={e => { e.preventDefault(); void procurar(busca); }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Endereço, bairro ou um lugar conhecido perto"
            style={{ flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
          />
          <button type="submit" className="btn-secondary" disabled={buscando} style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <Search size={15} /> {buscando ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {achados.length > 1 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {achados.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => colocar(a.lat, a.lng, a.temNumero ? 18 : 16)}
                className="text-xs"
                title={a.rotulo}
                style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: '36px', padding: '0 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                {a.rotulo.split(',').slice(0, 3).join(',')}
              </button>
            ))}
          </div>
        )}

        {aviso && <p className="text-xs" style={{ margin: 0, color: 'var(--color-warning)' }}>{aviso}</p>}

        <div ref={caixa} className="janela-mapa-mapa" />

        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Toque no lugar exato do set (a portaria, a entrada) ou arraste o alfinete. É desse ponto que saem o hospital mais próximo, o clima e a rota da OD.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span className="text-xs text-secondary" style={{ flex: 1, minWidth: '200px' }}>
            {ponto
              ? <><b style={{ fontVariantNumeric: 'tabular-nums' }}>{ponto.lat.toFixed(6)}, {ponto.lng.toFixed(6)}</b>{rotulo ? <> · {rotulo}</> : ''}</>
              : 'Nenhum ponto ainda.'}
          </span>
          <button type="button" className="btn-secondary" onClick={aoFechar}>Cancelar</button>
          <button
            type="button"
            className="btn-primary"
            disabled={!ponto}
            onClick={() => ponto && aoEscolher({ ...ponto, rotulo })}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: ponto ? 1 : 0.5 }}
          >
            <Check size={16} /> Usar este ponto
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
