import { useState } from 'react';
import { MapPin, Cross, Phone, ExternalLink, ChevronDown, CloudOff } from 'lucide-react';
import type { Locacao } from '../types';
import { parseCoords, descreverClima, type ClimaDia } from '../lib/clima';
import { formatarDistancia, linkRota, linkMapa } from '../lib/osm';

/**
 * Tudo sobre o lugar, num cartão só.
 *
 * POR QUE ELE EXISTE (spec §9.1)
 * A tela tinha "Locações", "Previsão do Tempo" e "Hospital Mais Próximo" em
 * três caixas separadas — e as três falam do MESMO lugar. O tempo é o tempo
 * *naquele set*; o hospital é o mais próximo *daquele set*. Separadas, a
 * informação obrigava a pessoa a cruzar três listas na cabeça, e numa diária
 * que atravessa a cidade ela cruzava errado: lia a previsão de um set e o
 * hospital de outro sem perceber.
 *
 * Aqui cada set é um cartão, e o que é dele está dentro dele.
 */

export function CardDeLocacao({
  locacao, clima, climaIndisponivel,
}: {
  locacao: Locacao;
  clima?: ClimaDia;
  /** Por que não há previsão. `undefined` quando ela veio. */
  climaIndisponivel?: string;
}) {
  const [contatosAbertos, setContatosAbertos] = useState(false);
  const coords = parseCoords(locacao.coordenadas);
  const contatos = locacao.contatos || [];

  const rotaAoHospital = (() => {
    if (!coords || !locacao.hospital_coordenadas) return null;
    const [lat, lng] = locacao.hospital_coordenadas.split(',').map(Number);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return linkRota(coords, { lat, lng });
  })();

  return (
    <div
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '3px solid var(--cor-logistica)' }}
    >
      {/* ---- Nome e endereço ---- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <MapPin size={16} style={{ color: 'var(--cor-logistica)', flexShrink: 0, marginTop: '3px' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-bold">{locacao.nome}</div>
          {locacao.endereco && (
            <div className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>{locacao.endereco}</div>
          )}
        </div>
        {coords && (
          <a
            href={linkMapa(coords.lat, coords.lng)}
            target="_blank"
            rel="noreferrer"
            className="text-xs"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--cor-logistica)', textDecoration: 'none', flexShrink: 0 }}
          >
            mapa <ExternalLink size={11} />
          </a>
        )}
      </div>

      {/* ---- Previsão do dia, aqui ---- */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
        {clima ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '30px', lineHeight: 1 }}>{descreverClima(clima.code).emoji}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="text-sm font-bold">{descreverClima(clima.code).texto}</div>
              <div className="text-xs text-muted">
                {Math.round(clima.tempMax)}° / {Math.round(clima.tempMin)}° ·{' '}
                <span style={{ color: clima.chuvaProb >= 50 ? 'var(--color-danger)' : undefined }}>
                  chuva {clima.chuvaProb}%
                </span>
              </div>
            </div>
            {/*
              Nascer e pôr do sol ficam ao lado da previsão porque são a mesma
              decisão: é com os dois juntos que se sabe se a luz do plano das
              17h ainda existe.
            */}
            <div style={{ display: 'flex', gap: '14px', textAlign: 'center' }}>
              <div>
                <div className="text-xs text-muted uppercase">Nascer</div>
                <div className="text-sm font-bold text-secondary">{clima.sunrise || '--'}</div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase">Pôr</div>
                <div className="text-sm font-bold text-secondary">{clima.sunset || '--'}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.5 }}>
            <CloudOff size={14} style={{ flexShrink: 0 }} />
            {climaIndisponivel || 'Sem previsão para este set.'}
          </div>
        )}
      </div>

      {/* ---- Emergência ---- */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
        {locacao.hospital_proximo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Cross size={14} className="text-danger" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: '120px' }}>
              <div className="text-sm font-bold">{locacao.hospital_proximo}</div>
              {locacao.hospital_distancia !== undefined && (
                <div className="text-xs text-muted">a {formatarDistancia(locacao.hospital_distancia)} daqui</div>
              )}
            </div>
            {locacao.hospital_telefone && (
              <a href={`tel:${locacao.hospital_telefone}`} className="text-xs font-bold" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--color-danger)', textDecoration: 'none' }}>
                <Phone size={12} /> {locacao.hospital_telefone}
              </a>
            )}
            {rotaAoHospital && (
              <a href={rotaAoHospital} target="_blank" rel="noreferrer" className="text-xs" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
                rota
              </a>
            )}
          </div>
        ) : (
          /*
            Estado vazio com ação (spec §14). "Nenhum hospital cadastrado" não
            ajuda ninguém às 6h da manhã; dizer ONDE se resolve, sim.
          */
          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.5 }}>
            <Cross size={14} style={{ flexShrink: 0 }} />
            Sem hospital de referência. Abra Locações e use "Achar Hospital Próximo".
          </div>
        )}
      </div>

      {/* ---- Contatos do local ---- */}
      {contatos.length > 0 && (
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <button
            onClick={() => setContatosAbertos(a => !a)}
            className="text-xs font-bold text-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ChevronDown size={13} style={{ transform: contatosAbertos ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
            {contatos.length} contato{contatos.length > 1 ? 's' : ''} do local
          </button>
          {contatosAbertos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              {contatos.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm">{c.nome}</div>
                    <div className="text-xs text-muted">{c.papel}</div>
                  </div>
                  {c.telefone && (
                    <a href={`tel:${c.telefone}`} className="text-xs" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                      {c.telefone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
