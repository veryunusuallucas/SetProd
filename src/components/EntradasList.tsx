import { useState } from 'react';
import { dinheiro } from '../lib/formato';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2 } from 'lucide-react';

export function EntradasList({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  const [novoAporte, setNovoAporte] = useState({ origem: '', valor: '', obs: '' });

  const handleAddAporte = async () => {
    const val = Number(novoAporte.valor);
    if (!novoAporte.origem || isNaN(val) || val <= 0) return;
    await db.aportes.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      origem: novoAporte.origem,
      valor: val,
      data: Date.now(),
      obs: novoAporte.obs
    });
    setNovoAporte({ origem: '', valor: '', obs: '' });
  };

  const handleDeleteAporte = async (id: string) => {
    if (confirm("Remover este aporte?")) {
      await db.aportes.delete(id);
    }
  };

  if (!projeto) return <div>Carregando...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="card">
        <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Entradas e Aportes de Dinheiro</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input 
            placeholder="Origem (Ex: Sócio, Ancine...)" 
            value={novoAporte.origem} 
            onChange={e => setNovoAporte({ ...novoAporte, origem: e.target.value })}
            style={{ flex: 1, minWidth: '150px', backgroundColor: 'var(--bg-primary)' }}
          />
          <input 
            type="number" 
            placeholder="Valor R$" 
            value={novoAporte.valor} 
            onChange={e => setNovoAporte({ ...novoAporte, valor: e.target.value })}
            style={{ width: '120px', backgroundColor: 'var(--bg-primary)' }}
          />
          <input 
            placeholder="Observação" 
            value={novoAporte.obs} 
            onChange={e => setNovoAporte({ ...novoAporte, obs: e.target.value })}
            style={{ flex: 2, minWidth: '150px', backgroundColor: 'var(--bg-primary)' }}
          />
          <button onClick={handleAddAporte} className="btn-primary" style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Adicionar
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projeto.saldo_inicial != null && projeto.saldo_inicial > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
              <div>
                <span className="font-bold">Saldo Inicial (Configuração do Projeto)</span>
              </div>
              <span className="text-accent font-bold">{dinheiro(projeto.saldo_inicial)}</span>
            </div>
          )}
          {aportes.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div>
                <div className="font-bold">{a.origem}</div>
                <div className="text-xs text-muted">{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {a.obs && `- ${a.obs}`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="text-accent font-bold">{dinheiro(a.valor)}</span>
                <button onClick={() => handleDeleteAporte(a.id)} className="btn-icon text-danger" style={{ padding: '8px' }} title="Excluir"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
          {(!projeto.saldo_inicial && aportes.length === 0) && (
            <div className="text-center text-muted py-4">Nenhum aporte registrado. O projeto não possui fundos iniciais.</div>
          )}
        </div>
      </div>

    </div>
  );
}
