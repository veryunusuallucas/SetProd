import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { MapPin, Plus, Edit2, Trash2, Cross, Shield } from 'lucide-react';
import { logAction } from '../lib/audit';

export interface LocacaoContato {
  id: string;
  nome: string;
  telefone: string;
  papel: string;
}

export interface Locacao {
  id: string;
  projeto_id: string;
  nome: string;
  endereco: string;
  status?: 'conversa' | 'temos' | 'caiu';
  contatos?: LocacaoContato[];
  coordenadas?: string;
  hospital_proximo?: string;
  contato_seguranca?: string;
  obs?: string;
}

export function LocacoesModule() {
  const { id: projetoId } = useParams();
  const locacoes = useLiveQuery(
    () => db.table('locacoes').where('projeto_id').equals(projetoId!).toArray(), 
    [projetoId]
  ) || [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [coordenadas, setCoordenadas] = useState('');
  const [hospital, setHospital] = useState('');
  const [seguranca, setSeguranca] = useState('');
  const [status, setStatus] = useState<'conversa' | 'temos' | 'caiu'>('conversa');
  const [contatos, setContatos] = useState<LocacaoContato[]>([]);
  
  const [obs, setObs] = useState('');
  const [buscandoOSM, setBuscandoOSM] = useState(false);

  const buscarOSM = async () => {
    if (!endereco || endereco.length < 3) return alert('Digite um endereço para buscar.');
    setBuscandoOSM(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const place = data[0];
        setCoordenadas(`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lon}`);
        alert('Endereço encontrado e link gerado!');
      } else {
        alert('Endereço não encontrado no OpenStreetMap.');
      }
    } catch (e) {
      alert('Erro na busca OSM.');
    } finally {
      setBuscandoOSM(false);
    }
  };

  const addContato = () => {
    setContatos([...contatos, { id: crypto.randomUUID(), nome: '', telefone: '', papel: '' }]);
  };

  const updateContato = (id: string, field: keyof LocacaoContato, value: string) => {
    setContatos(contatos.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeContato = (id: string) => {
    setContatos(contatos.filter(c => c.id !== id));
  };

  const limparForm = () => {
    setNome(''); setEndereco(''); setCoordenadas('');
    setHospital(''); setSeguranca(''); setObs('');
    setStatus('conversa'); setContatos([]);
    setEditId(null);
  };

  const handleEdit = (loc: Locacao) => {
    setEditId(loc.id);
    setNome(loc.nome);
    setEndereco(loc.endereco);
    setCoordenadas(loc.coordenadas || '');
    setHospital(loc.hospital_proximo || '');
    setSeguranca(loc.contato_seguranca || '');
    setObs(loc.obs || '');
    setStatus(loc.status || 'conversa');
    setContatos(loc.contatos || []);
    setShowForm(true);
  };

  const salvar = async () => {
    if (!nome || !endereco) {
      alert('Nome e Endereço são obrigatórios.');
      return;
    }

    const payload: Locacao = {
      id: editId || crypto.randomUUID(),
      projeto_id: projetoId!,
      nome,
      endereco,
      coordenadas,
      hospital_proximo: hospital,
      contato_seguranca: seguranca,
      obs,
      status,
      contatos
    };

    if (editId) {
      await db.table('locacoes').put(payload);
      await logAction(projetoId!, 'editar', 'locacao', payload.id, `Editou locação: ${nome}`);
    } else {
      await db.table('locacoes').add(payload);
      await logAction(projetoId!, 'criar', 'locacao', payload.id, `Criou locação: ${nome}`);
    }

    setShowForm(false);
    limparForm();
  };

  const excluir = async (id: string, nomeLoc: string) => {
    if (confirm(`Excluir a locação ${nomeLoc}?`)) {
      await db.table('locacoes').delete(id);
      await logAction(projetoId!, 'deletar', 'locacao', id, `Deletou locação: ${nomeLoc}`);
    }
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={24} color="var(--accent)" /> Locações
          </h1>
          <p className="text-sm text-secondary">Base de dados dos sets de filmagem</p>
        </div>
        <button onClick={() => { limparForm(); setShowForm(true); }} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Nova Locação
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--accent)' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted">{editId ? 'Editar Locação' : 'Nova Locação'}</h2>
          
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <input required placeholder="Nome do Set (ex: Mansão do Vilão)" value={nome} onChange={e => setNome(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }} />
            <select value={status} onChange={e => setStatus(e.target.value as any)} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', fontWeight: 'bold', color: status === 'conversa' ? 'var(--text-secondary)' : status === 'temos' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              <option value="conversa">🟡 Em Conversa</option>
              <option value="temos">🟢 Temos a Locação</option>
              <option value="caiu">🔴 Caiu</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input required placeholder="Endereço para buscar (ex: Av Paulista, 1000)" value={endereco} onChange={e => setEndereco(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }} />
            <button onClick={buscarOSM} disabled={buscandoOSM} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
              {buscandoOSM ? 'Buscando...' : 'Buscar OSM'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <MapPin size={16} className="text-muted" />
              <input placeholder="Link Maps / Coordenadas" value={coordenadas} onChange={e => setCoordenadas(e.target.value)} style={{ border: 'none', padding: '16px 0', width: '100%', backgroundColor: 'transparent' }} />
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <Cross size={16} className="text-danger" />
              <input placeholder="Hospital Mais Próximo" value={hospital} onChange={e => setHospital(e.target.value)} style={{ border: 'none', padding: '16px 0', width: '100%', backgroundColor: 'transparent' }} />
            </div>
            
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '0 12px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <Shield size={16} style={{ color: '#4CAF50' }} />
              <input placeholder="Contato de Segurança / Base" value={seguranca} onChange={e => setSeguranca(e.target.value)} style={{ border: 'none', padding: '16px 0', width: '100%', backgroundColor: 'transparent' }} />
            </div>
          </div>

          <div style={{ border: '1px solid var(--border-light)', padding: '12px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">Contatos da Locação</div>
              <button onClick={addContato} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }}><Plus size={14}/></button>
            </div>
            {contatos.length === 0 && <div className="text-xs text-muted">Nenhum contato adicionado.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {contatos.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: '8px' }}>
                  <input placeholder="Papel (Dono, Zelador)" value={c.papel} onChange={e => updateContato(c.id, 'papel', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                  <input placeholder="Nome" value={c.nome} onChange={e => updateContato(c.id, 'nome', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                  <input placeholder="Telefone" value={c.telefone} onChange={e => updateContato(c.id, 'telefone', e.target.value)} style={{ flex: 1, padding: '8px' }} />
                  <button onClick={() => removeContato(c.id)} className="btn-icon text-danger" style={{ backgroundColor: 'var(--bg-primary)' }}><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <textarea placeholder="Observações (estacionamento, regras do local, restrições de horário...)" value={obs} onChange={e => setObs(e.target.value)} rows={2} />

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} className="btn-icon" style={{ backgroundColor: 'var(--bg-primary)' }}>Cancelar</button>
            <button onClick={salvar} className="btn-primary">Salvar Locação</button>
          </div>
        </div>
      )}

      {locacoes.length === 0 && !showForm && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhuma locação cadastrada ainda.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {locacoes.map(loc => (
          <div key={loc.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="font-bold text-lg">{loc.nome}</div>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: !loc.status || loc.status === 'conversa' ? 'var(--color-warning)' : loc.status === 'temos' ? 'var(--color-success)' : 'var(--color-danger)' }} title={loc.status || 'conversa'} />
                </div>
                <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                  <MapPin size={12} /> {loc.endereco}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => handleEdit(loc)} className="btn-icon text-muted" style={{ padding: '8px' }}><Edit2 size={14} /></button>
                <button onClick={() => excluir(loc.id, loc.nome)} className="btn-icon text-danger" style={{ padding: '8px' }}><Trash2 size={14} /></button>
              </div>
            </div>

            <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>

            {loc.contatos && loc.contatos.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', marginBottom: '4px' }}>
                <div className="text-xs text-muted font-bold uppercase tracking-widest">Contatos</div>
                {loc.contatos.map((c: LocacaoContato) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'var(--bg-surface)', padding: '6px', borderRadius: '6px' }}>
                    <span><strong>{c.papel}:</strong> {c.nome}</span>
                    <span className="text-muted">{c.telefone}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              {loc.hospital_proximo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Cross size={14} className="text-danger" /> <strong>Hospital:</strong> {loc.hospital_proximo}
                </div>
              )}
              {loc.contato_seguranca && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                  <Shield size={14} style={{ color: '#4CAF50' }} /> <strong>Segurança:</strong> {loc.contato_seguranca}
                </div>
              )}
            </div>

            {loc.obs && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '8px', borderRadius: '8px' }}>
                {loc.obs}
              </div>
            )}
            
            {loc.coordenadas && (
              <a href={loc.coordenadas.startsWith('http') ? loc.coordenadas : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.coordenadas)}`} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', fontSize: '12px', color: 'var(--accent)', textDecoration: 'none', border: '1px solid var(--accent)', borderRadius: '8px', padding: '6px', marginTop: '4px' }}>
                Abrir no Maps
              </a>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}
