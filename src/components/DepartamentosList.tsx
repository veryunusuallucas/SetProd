import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Download, Edit2, Trash2 } from 'lucide-react';
import { ProfileCard } from './ui/ProfileCard';
import { useRole } from '../hooks/useRole';

export function DepartamentosList({ projetoId }: { projetoId: string, onSelectDepartamento?: (id: string) => void }) {
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const { canEditProducao } = useRole();

  const [nomeDepto, setNomeDepto] = useState('');
  const [orcamento, setOrcamento] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const limparForm = () => {
    setNomeDepto('');
    setOrcamento('');
    setEditId(null);
  };

  const criarDepartamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeDepto) return;
    
    const payload = {
      projeto_id: projetoId,
      nome: nomeDepto,
      orcamento_departamento: parseFloat(orcamento) || 0
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-xs text-secondary font-bold uppercase tracking-widest">Departamentos</span>
        {canEditProducao && (
          <button onClick={() => { limparForm(); setShowForm(true); }} className="btn-icon">
            <Plus size={16} />
          </button>
        )}
      </div>

      {showForm && (
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>{editId ? 'Salvar Alterações' : 'Criar Departamento'}</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-icon" style={{ backgroundColor: 'var(--bg-primary)' }}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

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
              avatarUrl={`https://ui-avatars.com/api/?name=${d.nome}&background=random`}
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
    </div>
  );
}
