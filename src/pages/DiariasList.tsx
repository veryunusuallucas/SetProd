import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Plus, ChevronRight, Users, CheckSquare } from 'lucide-react';
import type { Diaria } from '../types';
import { logAction } from '../lib/audit';

export function DiariasList() {
  const { id: projetoId } = useParams();
  const navigate = useNavigate();

  const diarias = useLiveQuery(
    async () => {
      const arr = await db.diarias.where('projeto_id').equals(projetoId!).toArray();
      return arr.sort((a, b) => a.numero - b.numero);
    },
    [projetoId]
  ) || [];

  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  
  const [showForm, setShowForm] = useState(false);
  const [numero, setNumero] = useState('');
  const [data, setData] = useState('');

  const criarDiaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero || !data) return;

    const nova: Diaria = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      numero: Number(numero),
      data,
      tem_unidade_b: false,
      equipe_escalada: [],
      locacoes_ids: []
    };

    await db.diarias.add(nova);
    await logAction(projetoId!, 'criar', 'diaria', nova.id, `Criou Diária ${numero} para o dia ${data}`);
    setShowForm(false);
    setNumero('');
    setData('');
  };

  const formataData = (d: string) => {
    const [a, m, dia] = d.split('-');
    return `${dia}/${m}/${a.slice(-2)}`;
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={24} color="var(--accent)" /> Ordem do Dia (OD)
          </h1>
          <p className="text-sm text-secondary">Planejamento e acompanhamento por diária</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Criar Diária
        </button>
      </div>

      {showForm && (
        <form onSubmit={criarDiaria} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', borderLeft: '4px solid var(--accent)' }}>
          <div style={{ flex: 1 }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Número da Diária (ex: 1)</label>
            <input type="number" required value={numero} onChange={e => setNumero(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Data</label>
            <input type="date" required value={data} onChange={e => setData(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">Adicionar</button>
        </form>
      )}

      {diarias.length === 0 && !showForm && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhuma diária cadastrada. Comece o seu plano de filmagem criando a Diária 01.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
        {diarias.map(d => {
          const despesasDaDiaria = despesas.filter(dx => dx.diaria === d.id);
          const totalDespesas = despesasDaDiaria.reduce((acc, curr) => acc + curr.valor_total, 0);

          return (
            <div 
              key={d.id} 
              className="card" 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s ease', flexWrap: 'wrap', gap: '16px' }}
              onClick={() => navigate(`/projeto/${projetoId}/diaria/${d.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg-surface)', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px', border: '1px solid var(--border-light)' }}>
                  {String(d.numero).padStart(2, '0')}
                </div>
                <div>
                  <div className="font-bold text-lg">Diária {String(d.numero).padStart(2, '0')}</div>
                  <div className="text-xs text-muted">{formataData(d.data)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Users size={14} /> {d.equipe_escalada?.length || 0} na equipe
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <CheckSquare size={14} /> Tasks (em breve)
                  </div>
                </div>

                <div style={{ textAlign: 'right', minWidth: '100px' }}>
                  <div className="text-xs text-muted font-bold uppercase tracking-widest">Gastos do Dia</div>
                  <div className="font-bold" style={{ color: totalDespesas > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    R$ {totalDespesas.toFixed(2)}
                  </div>
                </div>
                
                <ChevronRight className="text-muted" />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
