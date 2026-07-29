import { useState } from 'react';
import { db } from '../db/db';
import { Camera, Clapperboard, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { Diaria, Cena, Plano } from '../types';

export function ShotList({ diaria, locacoes }: { diaria: Diaria, locacoes: any[] }) {
  const [expandida, setExpandida] = useState<string | null>(null);

  const addCena = async () => {
    const novaCena: Cena = {
      id: crypto.randomUUID(),
      numero: String((diaria.cenas || []).length + 1),
      descricao: 'Nova cena...',
      ambiente: 'ext',
      periodo: 'dia'
    };
    await db.diarias.update(diaria.id, {
      cenas: [...(diaria.cenas || []), novaCena]
    });
  };

  const updateCena = async (id: string, updates: Partial<Cena>) => {
    const novasCenas = (diaria.cenas || []).map(c => c.id === id ? { ...c, ...updates } : c);
    await db.diarias.update(diaria.id, { cenas: novasCenas });
  };

  const removeCena = async (id: string) => {
    const novasCenas = (diaria.cenas || []).filter(c => c.id !== id);
    const novosPlanos = (diaria.planos || []).filter(p => p.cena_id !== id);
    await db.diarias.update(diaria.id, { cenas: novasCenas, planos: novosPlanos });
  };

  const addPlano = async (cenaId: string) => {
    const planosDaCena = (diaria.planos || []).filter(p => p.cena_id === cenaId);
    const novoPlano: Plano = {
      id: crypto.randomUUID(),
      cena_id: cenaId,
      numero: String(planosDaCena.length + 1),
      descricao: '',
    };
    await db.diarias.update(diaria.id, {
      planos: [...(diaria.planos || []), novoPlano]
    });
    setExpandida(novoPlano.id);
  };

  const updatePlano = async (id: string, updates: Partial<Plano>) => {
    const novosPlanos = (diaria.planos || []).map(p => p.id === id ? { ...p, ...updates } : p);
    await db.diarias.update(diaria.id, { planos: novosPlanos });
  };

  const removePlano = async (id: string) => {
    const novosPlanos = (diaria.planos || []).filter(p => p.id !== id);
    await db.diarias.update(diaria.id, { planos: novosPlanos });
  };

  const selectStyle = { padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', fontSize: '13px' };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clapperboard size={16} /> Shot List
        </h2>
        <button onClick={addCena} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 12px', width: 'auto', gap: '6px' }}>
          <Plus size={16} /> <span className="text-xs">Cena</span>
        </button>
      </div>

      {(diaria.cenas || []).length === 0 && (
        <div className="text-muted text-sm text-center" style={{ padding: '16px' }}>
          Adicione as cenas que serão gravadas nesta diária.
        </div>
      )}

      {(diaria.cenas || []).map(cena => {
        const planos = (diaria.planos || []).filter(p => p.cena_id === cena.id);
        
        return (
          <div key={cena.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
            {/* Header da Cena */}
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input 
                  value={cena.numero} 
                  onChange={e => updateCena(cena.id, { numero: e.target.value })} 
                  style={{ width: '40px', fontWeight: 'bold', textAlign: 'center', padding: '4px' }}
                  placeholder="Nº"
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input 
                  value={cena.descricao} 
                  onChange={e => updateCena(cena.id, { descricao: e.target.value })} 
                  style={{ fontWeight: 'bold', border: 'none', background: 'transparent', padding: 0 }}
                  placeholder="Descrição da cena..."
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <select value={cena.ambiente || 'ext'} onChange={e => updateCena(cena.id, { ambiente: e.target.value as any })} style={selectStyle}>
                    <option value="int">INT.</option>
                    <option value="ext">EXT.</option>
                  </select>
                  <select value={cena.locacao_id || ''} onChange={e => updateCena(cena.id, { locacao_id: e.target.value })} style={selectStyle}>
                    <option value="">(Sem Locação)</option>
                    {locacoes.filter(l => (diaria.locacoes_ids || []).includes(l.id)).map(l => (
                      <option key={l.id} value={l.id}>{l.nome}</option>
                    ))}
                  </select>
                  <select value={cena.periodo || 'dia'} onChange={e => updateCena(cena.id, { periodo: e.target.value as any })} style={selectStyle}>
                    <option value="dia">DIA</option>
                    <option value="noite">NOITE</option>
                  </select>
                </div>
              </div>
              <button onClick={() => removeCena(cena.id)} className="btn-icon text-muted" style={{ padding: '6px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
            </div>

            {/* Lista de Planos */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {planos.map(plano => {
                const isExpanded = expandida === plano.id;
                return (
                  <div key={plano.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <input 
                        value={plano.numero} 
                        onChange={e => updatePlano(plano.id, { numero: e.target.value })} 
                        style={{ width: '40px', textAlign: 'center', padding: '4px', fontSize: '13px' }}
                        placeholder="Plano"
                      />
                      <input 
                        value={plano.descricao} 
                        onChange={e => updatePlano(plano.id, { descricao: e.target.value })} 
                        style={{ flex: 1, padding: '4px 8px', fontSize: '13px', backgroundColor: 'transparent', border: '1px solid var(--border-light)' }}
                        placeholder="O que acontece no plano..."
                      />
                      <button onClick={() => setExpandida(isExpanded ? null : plano.id)} className="btn-icon" style={{ padding: '6px', border: 'none', background: 'transparent' }}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <button onClick={() => removePlano(plano.id)} className="btn-icon text-muted" style={{ padding: '6px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
                    </div>

                    {isExpanded && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="text-xs text-muted uppercase">Tamanho</span>
                          <select value={plano.tamanho || ''} onChange={e => updatePlano(plano.id, { tamanho: e.target.value })} style={selectStyle}>
                            <option value="">-</option>
                            <option value="Wide">Wide (Aberto)</option>
                            <option value="Medium">Medium (Médio)</option>
                            <option value="Close">Close</option>
                            <option value="Detail">Detail (Detalhe)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="text-xs text-muted uppercase">Ângulo</span>
                          <select value={plano.angulo || ''} onChange={e => updatePlano(plano.id, { angulo: e.target.value })} style={selectStyle}>
                            <option value="">-</option>
                            <option value="Nível">Nível</option>
                            <option value="Plongée (Alto)">Plongée (Alto)</option>
                            <option value="Contra-plongée (Baixo)">Contra-plongée (Baixo)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="text-xs text-muted uppercase">Movimento</span>
                          <select value={plano.movimento || ''} onChange={e => updatePlano(plano.id, { movimento: e.target.value })} style={selectStyle}>
                            <option value="">-</option>
                            <option value="Estático">Estático</option>
                            <option value="Pan">Pan</option>
                            <option value="Tilt">Tilt</option>
                            <option value="Dolly/Track">Dolly / Track</option>
                            <option value="Handheld">Handheld (Mão)</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="text-xs text-muted uppercase">Lente / Info</span>
                          <input 
                            value={plano.lente || ''} 
                            onChange={e => updatePlano(plano.id, { lente: e.target.value })} 
                            style={selectStyle} 
                            placeholder="ex: 35mm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={() => addPlano(cena.id)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                <Camera size={14} /> Novo Plano
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
