import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Truck, UserRound, Plus, Trash2, Edit2, X, Phone } from 'lucide-react';
import type { Veiculo, Motorista } from '../types';
import { confirmar } from '../components/ui/Confirmacao';

type Aba = 'veiculos' | 'motoristas';

/**
 * Logística → Transporte (v4 §4.1): cadastro geral de veículos e motoristas.
 * Mesma lógica de Locações — cadastra uma vez aqui, usa nos comboios de várias diárias.
 */
export function TransporteModule() {
  const { id: projetoId } = useParams<{ id: string }>();
  const [aba, setAba] = useState<Aba>('veiculos');

  const veiculos = useLiveQuery(() => db.veiculos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const motoristas = useLiveQuery(() => db.motoristas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  const [editandoVeiculo, setEditandoVeiculo] = useState<Veiculo | null>(null);
  const [editandoMotorista, setEditandoMotorista] = useState<Motorista | null>(null);

  const novoVeiculo = () => setEditandoVeiculo({
    id: crypto.randomUUID(), projeto_id: projetoId!, nome: '', placa: '', tipo: 'Van', capacidade: undefined, motorista_id: '', obs: ''
  });

  const novoMotorista = () => setEditandoMotorista({
    id: crypto.randomUUID(), projeto_id: projetoId!, nome: '', telefone: '', cnh: '', perfil_id: '', obs: ''
  });

  const salvarVeiculo = async () => {
    if (!editandoVeiculo) return;
    if (!editandoVeiculo.nome.trim()) return alert('Dê um nome ao veículo (ex: Van Elenco).');
    await db.veiculos.put({ ...editandoVeiculo, nome: editandoVeiculo.nome.trim() });
    setEditandoVeiculo(null);
  };

  const salvarMotorista = async () => {
    if (!editandoMotorista) return;
    if (!editandoMotorista.nome.trim()) return alert('Informe o nome do motorista.');
    await db.motoristas.put({ ...editandoMotorista, nome: editandoMotorista.nome.trim() });
    setEditandoMotorista(null);
  };

  /** Quantas diárias já usam este veículo/motorista (nos comboios). */
  const usoEmDiarias = (campo: 'veiculo_id' | 'motorista_id', id: string) =>
    diarias.filter(d => (d.comboios || []).some(c => (c as any)[campo] === id)).length;

  const excluirVeiculo = async (v: Veiculo) => {
    const uso = usoEmDiarias('veiculo_id', v.id);
    const aviso = uso > 0
      ? `"${v.nome}" está em ${uso} diária(s). Os comboios existentes mantêm o texto, mas perdem o vínculo. Excluir mesmo assim?`
      : `Excluir o veículo "${v.nome}"?`;
    if (await confirmar(aviso)) await db.veiculos.delete(v.id);
  };

  const excluirMotorista = async (m: Motorista) => {
    const uso = usoEmDiarias('motorista_id', m.id);
    const aviso = uso > 0
      ? `"${m.nome}" está em ${uso} diária(s). Os comboios existentes mantêm o texto, mas perdem o vínculo. Excluir mesmo assim?`
      : `Excluir o motorista "${m.nome}"?`;
    if (await confirmar(aviso)) await db.motoristas.delete(m.id);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px', borderRadius: '8px',
    border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)'
  };

  const abaBtn = (alvo: Aba, icone: React.ReactNode, texto: string) => (
    <button
      onClick={() => setAba(alvo)}
      style={{
        flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
        backgroundColor: aba === alvo ? 'var(--bg-active)' : 'transparent',
        color: aba === alvo ? 'var(--text-primary)' : 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold'
      }}
    >
      {icone} <span style={{ fontSize: '13px' }}>{texto}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

      <div>
        <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck size={22} /> Transporte
        </h1>
        <p className="text-sm text-secondary">Cadastre uma vez aqui e reaproveite nos comboios de cada diária.</p>
      </div>

      <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
        {abaBtn('veiculos', <Truck size={18} />, `Veículos (${veiculos.length})`)}
        {abaBtn('motoristas', <UserRound size={18} />, `Motoristas (${motoristas.length})`)}
      </div>

      {aba === 'veiculos' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={novoVeiculo} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Novo Veículo
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {veiculos.length === 0 && (
              <div className="card text-muted text-center" style={{ gridColumn: '1 / -1', padding: '40px 16px' }}>
                Nenhum veículo cadastrado.
              </div>
            )}
            {veiculos.map(v => {
              const mot = motoristas.find(m => m.id === v.motorista_id);
              return (
                <div key={v.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="font-bold" style={{ fontSize: '16px' }}>{v.nome}</div>
                      <div className="text-xs text-muted">{[v.tipo, v.placa].filter(Boolean).join(' · ') || 'Sem detalhes'}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => setEditandoVeiculo(v)} className="btn-icon" style={{ padding: '6px' }}><Edit2 size={14} /></button>
                      <button onClick={() => excluirVeiculo(v)} className="btn-icon text-danger" style={{ padding: '6px' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '13px' }}>
                    {v.capacidade ? <span className="text-secondary">{v.capacidade} lugares</span> : null}
                    {mot ? <span className="text-accent font-bold">{mot.nome}</span> : <span className="text-muted">Sem motorista padrão</span>}
                  </div>
                  {v.obs && <div className="text-xs text-muted" style={{ whiteSpace: 'pre-wrap' }}>{v.obs}</div>}
                  <div className="text-xs text-muted" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                    Em {usoEmDiarias('veiculo_id', v.id)} diária(s)
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {aba === 'motoristas' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={novoMotorista} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus size={16} /> Novo Motorista
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {motoristas.length === 0 && (
              <div className="card text-muted text-center" style={{ gridColumn: '1 / -1', padding: '40px 16px' }}>
                Nenhum motorista cadastrado.
              </div>
            )}
            {motoristas.map(m => (
              <div key={m.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="font-bold" style={{ fontSize: '16px' }}>{m.nome}</div>
                    {m.cnh && <div className="text-xs text-muted">CNH {m.cnh}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => setEditandoMotorista(m)} className="btn-icon" style={{ padding: '6px' }}><Edit2 size={14} /></button>
                    <button onClick={() => excluirMotorista(m)} className="btn-icon text-danger" style={{ padding: '6px' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                {m.telefone && (
                  <a href={`tel:${m.telefone}`} className="text-sm text-accent font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                    <Phone size={14} /> {m.telefone}
                  </a>
                )}
                {m.obs && <div className="text-xs text-muted" style={{ whiteSpace: 'pre-wrap' }}>{m.obs}</div>}
                <div className="text-xs text-muted" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '8px' }}>
                  Em {usoEmDiarias('motorista_id', m.id)} diária(s)
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal Veículo */}
      {editandoVeiculo && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-bold text-lg">Veículo</h3>
              <button onClick={() => setEditandoVeiculo(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <Campo label="Nome *">
              <input autoFocus value={editandoVeiculo.nome} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, nome: e.target.value })} placeholder="Ex: Van Elenco" style={inputStyle} />
            </Campo>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Campo label="Tipo">
                <select value={editandoVeiculo.tipo || ''} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, tipo: e.target.value })} style={inputStyle}>
                  <option value="">-</option>
                  <option value="Van">Van</option>
                  <option value="Carro">Carro</option>
                  <option value="Caminhão">Caminhão</option>
                  <option value="Ônibus">Ônibus</option>
                  <option value="Moto">Moto</option>
                </select>
              </Campo>
              <Campo label="Placa">
                <input value={editandoVeiculo.placa || ''} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, placa: e.target.value })} placeholder="ABC-1D23" style={inputStyle} />
              </Campo>
              <Campo label="Lugares">
                <input type="number" value={editandoVeiculo.capacidade ?? ''} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, capacidade: Number(e.target.value) || undefined })} style={inputStyle} />
              </Campo>
            </div>
            <Campo label="Motorista padrão">
              <select value={editandoVeiculo.motorista_id || ''} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, motorista_id: e.target.value })} style={inputStyle}>
                <option value="">(Definir na diária)</option>
                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </Campo>
            <Campo label="Observações">
              <textarea rows={2} value={editandoVeiculo.obs || ''} onChange={e => setEditandoVeiculo({ ...editandoVeiculo, obs: e.target.value })} style={inputStyle} />
            </Campo>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setEditandoVeiculo(null)} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>Cancelar</button>
              <button onClick={salvarVeiculo} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Motorista */}
      {editandoMotorista && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-bold text-lg">Motorista</h3>
              <button onClick={() => setEditandoMotorista(null)} className="btn-icon"><X size={18} /></button>
            </div>

            <Campo label="Vincular a um membro da equipe">
              <select
                value={editandoMotorista.perfil_id || ''}
                onChange={e => {
                  const p = perfis.find(x => x.id === e.target.value);
                  setEditandoMotorista({
                    ...editandoMotorista,
                    perfil_id: e.target.value,
                    nome: p ? `${p.nome} ${p.sobrenome || ''}`.trim() : editandoMotorista.nome,
                    telefone: p?.telefone || editandoMotorista.telefone,
                  });
                }}
                style={inputStyle}
              >
                <option value="">(Motorista externo)</option>
                {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                  <option key={p.id} value={p.id}>{p.nome} {p.sobrenome || ''}</option>
                ))}
              </select>
            </Campo>
            <Campo label="Nome *">
              <input value={editandoMotorista.nome} onChange={e => setEditandoMotorista({ ...editandoMotorista, nome: e.target.value })} style={inputStyle} />
            </Campo>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Campo label="Telefone">
                <input value={editandoMotorista.telefone || ''} onChange={e => setEditandoMotorista({ ...editandoMotorista, telefone: e.target.value })} placeholder="(11) 99999-9999" style={inputStyle} />
              </Campo>
              <Campo label="CNH">
                <input value={editandoMotorista.cnh || ''} onChange={e => setEditandoMotorista({ ...editandoMotorista, cnh: e.target.value })} style={inputStyle} />
              </Campo>
            </div>
            <Campo label="Observações">
              <textarea rows={2} value={editandoMotorista.obs || ''} onChange={e => setEditandoMotorista({ ...editandoMotorista, obs: e.target.value })} style={inputStyle} />
            </Campo>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setEditandoMotorista(null)} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>Cancelar</button>
              <button onClick={salvarMotorista} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}
