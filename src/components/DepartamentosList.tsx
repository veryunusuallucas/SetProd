import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Download, Edit2, Trash2 } from 'lucide-react';
import { ProfileCard } from './ui/ProfileCard';
import { useRole } from '../hooks/useRole';

export function DepartamentosList({ projetoId }: { projetoId: string, onSelectDepartamento?: (id: string) => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const { canEditProducao } = useRole();

  const [abaAtiva, setAbaAtiva] = useState<'depto' | 'grupos'>('depto');

  const [nomeDepto, setNomeDepto] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [corDepto, setCorDepto] = useState('#8884d8');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form Grupos
  const [showGrupoForm, setShowGrupoForm] = useState(false);
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [membrosGrupo, setMembrosGrupo] = useState<string[]>([]);
  const [editGrupoId, setEditGrupoId] = useState<string | null>(null);

  const CORES_DISPONIVEIS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#d0ed57', '#a4de6c', '#ff5722', '#673ab7'];

  const limparForm = () => {
    setNomeDepto('');
    setOrcamento('');
    setCorDepto('#8884d8');
    setEditId(null);
  };

  const limparGrupoForm = () => {
    setNomeGrupo('');
    setMembrosGrupo([]);
    setEditGrupoId(null);
  };

  const criarDepartamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeDepto) return;
    
    const payload = {
      projeto_id: projetoId,
      nome: nomeDepto,
      orcamento_departamento: parseFloat(orcamento) || 0,
      cor: corDepto
    };

    if (editId) {
      await db.departamentos.update(editId, payload);
    } else {
      await db.departamentos.add({ id: crypto.randomUUID(), ...payload });
    }

    limparForm();
    setShowForm(false);
  };

  const handleEdit = (d: any) => {
    setEditId(d.id);
    setNomeDepto(d.nome);
    setOrcamento(d.orcamento_departamento ? String(d.orcamento_departamento) : '');
    setCorDepto(d.cor || '#8884d8');
    setShowForm(true);
  };

  const handleDelete = async (id: string, nome: string) => {
    if (confirm(`Excluir o departamento ${nome}? Os membros não serão apagados, mas ficarão sem departamento.`)) {
      await db.departamentos.delete(id);
    }
  };

  const exportarDepartamento = async (deptoId: string, nome: string) => {
    if (!confirm('Deseja baixar o relatório financeiro deste departamento?')) return;
    try {
      const depto = await db.departamentos.get(deptoId);
      const membros = await db.perfis.where('departamento_id').equals(deptoId).toArray();
      const membrosIds = membros.map(m => m.id);
      
      const todasDespesas = await db.despesas.where('projeto_id').equals(projetoId).toArray();
      
      const despesasDepto = todasDespesas.filter(d => 
        d.pagadores.some(p => membrosIds.includes(p.id_ref)) || 
        d.devedores.some(dev => membrosIds.includes(dev.id_ref))
      );

      const data = { departamento: depto, membros, despesas: despesasDepto };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio_depto_${nome}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro: ' + e);
    }
  };

  const getDeptoStats = (deptoId: string, orcamentoMax: number) => {
    const membrosDepto = perfis?.filter(p => p.departamento_id === deptoId) || [];
    const membrosIds = membrosDepto.map(m => m.id);
    
    let gastoTotal = 0;
    despesas?.forEach(d => {
      d.devedores.forEach(dev => {
        if (membrosIds.includes(dev.id_ref)) {
          gastoTotal += dev.valor;
        }
      });
    });

    const falta = orcamentoMax - gastoTotal;
    const estourou = gastoTotal > orcamentoMax ? gastoTotal - orcamentoMax : 0;
    let pct = orcamentoMax > 0 ? (gastoTotal / orcamentoMax) * 100 : 0;
    if (pct > 100) pct = 100;

    return { numMembros: membrosDepto.length, gastoTotal, falta, estourou, pct };
  };

  // Grupos Logic
  const criarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projeto || !nomeGrupo) return;
    
    let grupos = [...(projeto.grupos || [])];
    
    if (editGrupoId) {
      grupos = grupos.map(g => g.id === editGrupoId ? { ...g, nome: nomeGrupo, perfis_ids: membrosGrupo } : g);
    } else {
      grupos.push({ id: crypto.randomUUID(), nome: nomeGrupo, perfis_ids: membrosGrupo });
    }
    
    await db.projetos.update(projetoId, { grupos });
    limparGrupoForm();
    setShowGrupoForm(false);
  };

  const handleEditGrupo = (g: any) => {
    setEditGrupoId(g.id);
    setNomeGrupo(g.nome);
    setMembrosGrupo(g.perfis_ids || []);
    setShowGrupoForm(true);
  };

  const handleDeleteGrupo = async (id: string, nome: string) => {
    if (!projeto) return;
    if (confirm(`Excluir o grupo/time ${nome}?`)) {
      const grupos = (projeto.grupos || []).filter(g => g.id !== id);
      await db.projetos.update(projetoId, { grupos });
    }
  };

  const toggleMembroGrupo = (id: string) => {
    setMembrosGrupo(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub Navbar Interna */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          onClick={() => setAbaAtiva('depto')}
          style={{ flex: 1, padding: '12px', border: 'none', background: 'none', color: abaAtiva === 'depto' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: abaAtiva === 'depto' ? '2px solid var(--accent)' : '2px solid transparent', fontWeight: 'bold' }}
        >
          Departamentos
        </button>
        <button 
          onClick={() => setAbaAtiva('grupos')}
          style={{ flex: 1, padding: '12px', border: 'none', background: 'none', color: abaAtiva === 'grupos' ? 'var(--accent)' : 'var(--text-muted)', borderBottom: abaAtiva === 'grupos' ? '2px solid var(--accent)' : '2px solid transparent', fontWeight: 'bold' }}
        >
          Grupos & Times
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-xs text-secondary font-bold uppercase tracking-widest">{abaAtiva === 'depto' ? 'Departamentos (Estrutura)' : 'Grupos & Times (Reutilizáveis)'}</span>
        {canEditProducao && (
          <button onClick={() => { 
            if (abaAtiva === 'depto') { limparForm(); setShowForm(true); }
            else { limparGrupoForm(); setShowGrupoForm(true); }
          }} className="btn-icon">
            <Plus size={16} />
          </button>
        )}
      </div>

      {abaAtiva === 'depto' && showForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <form onSubmit={criarDepartamento} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input 
              placeholder="Nome do Departamento (Ex: Arte, Som)" 
              value={nomeDepto} 
              onChange={e => setNomeDepto(e.target.value)} 
              required 
            />
            <input 
              type="number" 
              placeholder="Orçamento Máximo (R$)" 
              value={orcamento} 
              onChange={e => setOrcamento(e.target.value)} 
            />
            
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Cor do Departamento (Mural de Tarefas)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input 
                  type="color" 
                  value={corDepto}
                  onChange={e => setCorDepto(e.target.value)}
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    padding: 0, 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    backgroundColor: 'transparent'
                  }}
                />
                <span className="text-sm font-bold">{corDepto}</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {CORES_DISPONIVEIS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCorDepto(c)}
                      title={c}
                      style={{
                        width: '24px', height: '24px', borderRadius: '6px', backgroundColor: c,
                        border: corDepto.toLowerCase() === c.toLowerCase() ? '2px solid var(--text-primary)' : '1px solid var(--border-light)',
                        cursor: 'pointer', padding: 0
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="acoes-form" style={{ marginTop: '12px' }}>
              {/* Cancelar com largura própria: no .btn-icon, que é 40x40 fixo, o
                  rótulo vazava para fora da área clicável — o próprio CSS avisa
                  contra isso na definição da classe. */}
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editId ? 'Salvar Alterações' : 'Criar Departamento'}</button>
            </div>
          </form>
        </div>
      )}

      {abaAtiva === 'depto' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {departamentos?.length === 0 && (
            <div className="text-muted text-sm text-center" style={{ width: '100%', padding: '24px' }}>Nenhum departamento criado.</div>
          )}
          
          {departamentos?.map(d => {
            const max = d.orcamento_departamento || 0;
            const stats = getDeptoStats(d.id, max);

            return (
              <ProfileCard
                key={d.id}
                name={d.nome}
                title={`Equipe: ${stats.numMembros} pessoa(s)`}
                status="Ativo"
                handle={`depto_${d.nome.replace(/\s+/g, '').toLowerCase()}`}
                avatarUrl={`https://ui-avatars.com/api/?name=${d.nome}&background=${(d.cor || '8884d8').replace('#', '')}&color=fff`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div className="text-xs text-muted font-bold uppercase tracking-widest">Orçamento</div>
                      <div className="text-sm">R$ {max.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted font-bold uppercase tracking-widest">Consumido</div>
                      <div className={`text-sm font-bold ${stats.estourou > 0 ? 'text-danger' : 'text-primary'}`}>
                        R$ {stats.gastoTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {max > 0 && (
                    <div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-surface)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${stats.pct}%`, height: '100%', backgroundColor: stats.estourou > 0 ? 'var(--color-danger)' : 'var(--color-success)', transition: 'width 0.3s ease' }} />
                      </div>
                      <div className="text-xs" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: 'var(--text-muted)' }}>
                        <span>0%</span>
                        {stats.estourou > 0 ? (
                          <span className="text-danger">Excedido: R$ {stats.estourou.toFixed(2)}</span>
                        ) : (
                          <span>Restante: R$ {stats.falta.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); exportarDepartamento(d.id, d.nome); }} 
                      className="btn-primary" 
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '8px', fontSize: '0.85rem' }}
                    >
                      <Download size={14} /> Exportar
                    </button>
                    {canEditProducao && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(d); }} className="btn-icon text-muted" style={{ padding: '8px' }} title="Editar"><Edit2 size={16} /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id, d.nome); }} className="btn-icon text-danger" style={{ padding: '8px' }} title="Excluir"><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </div>
              </ProfileCard>
            );
          })}
        </div>
      )}

      {/* GRUPOS TAB */}
      {abaAtiva === 'grupos' && showGrupoForm && (
        <div className="card" style={{ marginBottom: '16px' }}>
          <form onSubmit={criarGrupo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input 
              placeholder="Nome do Grupo (Ex: Unidade 2, Equipe Noturna, Base)" 
              value={nomeGrupo} 
              onChange={e => setNomeGrupo(e.target.value)} 
              required 
            />
            
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2">Selecionar Membros</div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', padding: '12px', borderRadius: '12px', backgroundColor: 'var(--bg-primary)' }}>
                {perfis?.filter(p => p.id !== 'caixa_central').map(p => (
                  <label key={p.id} className="checkbox-label" style={{ fontSize: '14px' }}>
                    <input 
                      type="checkbox" 
                      checked={membrosGrupo.includes(p.id)} 
                      onChange={() => toggleMembroGrupo(p.id)} 
                    />
                    {p.nome} {p.sobrenome || ''} <span className="text-muted text-xs">({p.funcao || 'Sem função'})</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="acoes-form" style={{ marginTop: '12px' }}>
              {/* Cancelar com largura própria: no .btn-icon, que é 40x40 fixo, o
                  rótulo vazava para fora da área clicável — o próprio CSS avisa
                  contra isso na definição da classe. */}
              <button type="button" onClick={() => setShowGrupoForm(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary">{editGrupoId ? 'Salvar Alterações' : 'Criar Grupo'}</button>
            </div>
          </form>
        </div>
      )}

      {abaAtiva === 'grupos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {(projeto?.grupos || []).length === 0 && (
            <div className="text-muted text-sm text-center" style={{ width: '100%', padding: '24px' }}>Nenhum grupo criado. Crie grupos para escalar várias pessoas de uma vez.</div>
          )}
          
          {(projeto?.grupos || []).map(g => (
            <ProfileCard
              key={g.id}
              name={g.nome}
              title={`${g.perfis_ids.length} pessoa(s)`}
              status="Grupo"
              handle={`grupo_${g.nome.replace(/\s+/g, '').toLowerCase()}`}
              avatarUrl={`https://ui-avatars.com/api/?name=${g.nome}&background=222&color=fff`}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {g.perfis_ids.length > 0 ? g.perfis_ids.map(pid => {
                    const p = perfis?.find(x => x.id === pid);
                    return p ? `${p.nome}` : '';
                  }).filter(Boolean).slice(0, 5).join(', ') + (g.perfis_ids.length > 5 ? '...' : '') : 'Nenhum membro'}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {canEditProducao && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); handleEditGrupo(g); }} className="btn-icon text-muted" style={{ padding: '8px', flex: 1 }} title="Editar"><Edit2 size={16} /> Editar</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteGrupo(g.id, g.nome); }} className="btn-icon text-danger" style={{ padding: '8px' }} title="Excluir"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            </ProfileCard>
          ))}
        </div>
      )}
    </div>
  );
}
