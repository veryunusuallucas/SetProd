import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useParams } from 'react-router-dom';
import { Camera, Clapperboard, Plus, Trash2, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { Cena, Plano } from '../types';

export function DecupagemModule() {
  const { id: projetoId } = useParams<{ id: string }>();
  const [expandida, setExpandida] = useState<string | null>(null);

  const locacoes = useLiveQuery(() => db.locacoes.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);
  const cenas = useLiveQuery(() => db.cenas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);
  const planos = useLiveQuery(() => db.planos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);

  if (!cenas || !planos || !locacoes) return <div style={{ padding: '24px' }}>Carregando decupagem...</div>;

  // Ordenar cenas por numero (tentar parsear int para ordenação numérica)
  const cenasOrdenadas = [...cenas].sort((a, b) => {
    const numA = parseInt(a.numero.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.numero.replace(/\D/g, '')) || 0;
    return numA - numB;
  });

  const addCena = async () => {
    const novaCena: Cena = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      numero: String(cenas.length + 1),
      descricao: 'Nova cena...',
      ambiente: 'ext',
      periodo: 'dia'
    };
    await db.cenas.add(novaCena);
  };

  const updateCena = async (id: string, updates: Partial<Cena>) => {
    await db.cenas.update(id, updates);
  };

  const removeCena = async (id: string) => {
    if (!window.confirm("Deseja realmente apagar esta cena e todos os seus planos?")) return;
    await db.cenas.delete(id);
    const planosDaCena = planos.filter(p => p.cena_id === id);
    for (const p of planosDaCena) {
      await db.planos.delete(p.id);
    }
  };

  const addPlano = async (cenaId: string) => {
    const planosDaCena = planos.filter(p => p.cena_id === cenaId);
    const novoPlano: Plano = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      cena_id: cenaId,
      numero: String(planosDaCena.length + 1),
      descricao: '',
    };
    await db.planos.add(novoPlano);
    setExpandida(novoPlano.id);
  };

  const updatePlano = async (id: string, updates: Partial<Plano>) => {
    await db.planos.update(id, updates);
  };

  const removePlano = async (id: string) => {
    await db.planos.delete(id);
  };

  const selectStyle = { padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', fontSize: '13px', color: 'var(--text-primary)' };

  return (
    <div style={{ paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clapperboard size={20} /> Decupagem Geral (Master Shot List)
        </h2>
        <button onClick={addCena} className="btn-icon" style={{ backgroundColor: 'var(--accent)', color: '#000', padding: '8px 16px', width: 'auto', gap: '6px', borderRadius: '12px' }}>
          <Plus size={16} /> <span className="font-bold text-sm">Cena</span>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {cenasOrdenadas.length === 0 && (
          <div className="card text-muted text-center" style={{ padding: '40px 16px' }}>
            Nenhuma cena decupada. Crie sua primeira cena para começar o shot list.
          </div>
        )}

        {cenasOrdenadas.map(cena => {
          const planosDaCena = planos.filter(p => p.cena_id === cena.id).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
          
          return (
            <div key={cena.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header da Cena */}
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input 
                    value={cena.numero} 
                    onChange={e => updateCena(cena.id, { numero: e.target.value })} 
                    style={{ width: '48px', fontWeight: 'bold', textAlign: 'center', padding: '6px', fontSize: '16px' }}
                    placeholder="Nº"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    value={cena.descricao} 
                    onChange={e => updateCena(cena.id, { descricao: e.target.value })} 
                    style={{ fontWeight: 'bold', fontSize: '18px', border: 'none', background: 'transparent', padding: 0 }}
                    placeholder="Descrição da cena (ex: Assalto no banco)..."
                  />
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <select value={cena.ambiente || 'ext'} onChange={e => updateCena(cena.id, { ambiente: e.target.value as any })} style={selectStyle}>
                      <option value="int">INT.</option>
                      <option value="ext">EXT.</option>
                    </select>
                    <select value={cena.locacao_id || ''} onChange={e => updateCena(cena.id, { locacao_id: e.target.value })} style={selectStyle}>
                      <option value="">(Sem Locação definida)</option>
                      {locacoes.map(l => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                    <select value={cena.periodo || 'dia'} onChange={e => updateCena(cena.id, { periodo: e.target.value as any })} style={selectStyle}>
                      <option value="dia">DIA</option>
                      <option value="noite">NOITE</option>
                    </select>
                  </div>
                </div>
                <button onClick={() => removeCena(cena.id)} className="btn-icon text-muted hover-danger" style={{ padding: '8px', border: 'none', background: 'transparent' }} title="Excluir Cena"><Trash2 size={18} /></button>
              </div>

              {/* Lista de Planos */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {planosDaCena.map((plano, index) => {
                  const isExpanded = expandida === plano.id;
                  return (
                    <div key={plano.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <GripVertical size={16} className="text-muted" style={{ cursor: 'grab' }} />
                        <span className="text-secondary font-bold text-xs" style={{ width: '20px' }}>{(index+1).toString().padStart(2, '0')}</span>
                        
                        <input 
                          value={plano.descricao} 
                          onChange={e => updatePlano(plano.id, { descricao: e.target.value })} 
                          style={{ flex: 1, padding: '8px', fontSize: '14px', backgroundColor: 'transparent', border: '1px solid var(--border-light)' }}
                          placeholder="Ação neste plano..."
                        />
                        <button onClick={() => setExpandida(isExpanded ? null : plano.id)} className="btn-icon" style={{ padding: '8px', border: 'none', background: 'transparent' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button onClick={() => removePlano(plano.id)} className="btn-icon text-muted" style={{ padding: '8px', border: 'none', background: 'transparent' }}><Trash2 size={16} /></button>
                      </div>

                      {isExpanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px', paddingLeft: '40px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Tamanho</span>
                            <select value={plano.tamanho || ''} onChange={e => updatePlano(plano.id, { tamanho: e.target.value })} style={selectStyle}>
                              <option value="">-</option>
                              <option value="Wide">Wide (Aberto)</option>
                              <option value="Medium">Medium (Médio)</option>
                              <option value="Close">Close</option>
                              <option value="Detail">Detail (Detalhe)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Ângulo</span>
                            <select value={plano.angulo || ''} onChange={e => updatePlano(plano.id, { angulo: e.target.value })} style={selectStyle}>
                              <option value="">-</option>
                              <option value="Nível">Nível</option>
                              <option value="Plongée (Alto)">Plongée (Alto)</option>
                              <option value="Contra-plongée (Baixo)">Contra-plongée (Baixo)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Movimento</span>
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
                            <span className="text-xs text-muted uppercase font-bold">Lente / Info</span>
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

                <button onClick={() => addPlano(cena.id)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                  <Camera size={16} /> Adicionar Plano
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
