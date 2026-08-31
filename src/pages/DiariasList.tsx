import { dinheiro } from '../lib/formato';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Plus, ChevronRight, Users, CheckSquare, Edit2, Trash2, X } from 'lucide-react';
import type { Diaria } from '../types';
import { logAction } from '../lib/audit';
import { EventosPanel } from '../components/EventosPanel';

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
  
  const [editModal, setEditModal] = useState<{ open: boolean, diaria: Diaria | null, num: string, date: string }>({ open: false, diaria: null, num: '', date: '' });

  /*
    Duas abas, e não duas telas no menu.

    A pergunta é a mesma — "o que a produção tem marcado" — e separar em dois
    itens de menu faria a pessoa escolher antes de saber onde a coisa está. Mas
    o CONTEÚDO é separado de propósito: diária tem número, cenas e relatório;
    evento tem hora e convidados. Ver os dois numa lista só embaralharia a
    numeração das diárias, que é a espinha do planejamento.
  */
  const [aba, setAba] = useState<'diarias' | 'eventos'>('diarias');
  const eventosFuturos = useLiveQuery(async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const todos = await db.eventos.where('projeto_id').equals(projetoId!).toArray();
    return todos.filter(e => e.data >= hoje).length;
  }, [projetoId]) || 0;

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

  const salvarEdicao = async () => {
    if (!editModal.diaria) return;
    await db.diarias.update(editModal.diaria.id, { numero: Number(editModal.num), data: editModal.date });
    setEditModal({ open: false, diaria: null, num: '', date: '' });
  };

  const excluirDiaria = async () => {
    if (!editModal.diaria) return;
    if (confirm(`Tem certeza que deseja excluir a Diária ${editModal.diaria.numero}? Os gastos vinculados a ela serão desvinculados, mas NÃO serão apagados.`)) {
      const diariaId = editModal.diaria.id;
      // Desvincular despesas
      const despesasVinculadas = despesas.filter(d => d.diaria === diariaId || d.diaria_id === diariaId);
      for (const d of despesasVinculadas) {
        await db.despesas.update(d.id, { diaria: undefined, diaria_id: undefined });
      }
      await db.diarias.delete(diariaId);
      setEditModal({ open: false, diaria: null, num: '', date: '' });
    }
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
            <Calendar size={24} color="var(--accent)" /> Diárias & Eventos
          </h1>
          <p className="text-sm text-secondary">A Ordem do Dia e o que mais a produção tem marcado</p>
        </div>
        {aba === 'diarias' && (
          <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Criar Diária
          </button>
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {([
          { id: 'diarias' as const, nome: 'Diárias', contagem: diarias.length },
          { id: 'eventos' as const, nome: 'Eventos', contagem: eventosFuturos },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            style={{
              flex: 1, padding: '12px', border: 'none', background: 'none',
              color: aba === t.id ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: aba === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {t.nome}
            {t.contagem > 0 && (
              <span
                className="text-xs"
                style={{
                  backgroundColor: aba === t.id ? 'var(--accent)' : 'var(--bg-surface)',
                  color: aba === t.id ? '#000' : 'var(--text-muted)',
                  borderRadius: '20px', padding: '1px 8px', fontWeight: 700,
                }}
              >
                {t.contagem}
              </span>
            )}
          </button>
        ))}
      </div>

      {aba === 'eventos' && <EventosPanel projetoId={projetoId!} />}

      {aba === 'diarias' && showForm && (
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

      {aba === 'diarias' && diarias.length === 0 && !showForm && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhuma diária cadastrada. Comece o seu plano de filmagem criando a Diária 01.
        </div>
      )}

      {/* `display: none` e não `&&`: desmontar a grade a cada troca de aba
          descartaria o estado interno dos cards e faria a lista piscar na
          volta. Escondida, ela continua montada e reaparece pronta. */}
      <div style={{ display: aba === 'diarias' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '16px' }}>
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
                    {dinheiro(totalDespesas)}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditModal({ open: true, diaria: d, num: String(d.numero), date: d.data });
                    }} 
                    className="btn-icon"
                  >
                    <Edit2 size={18} />
                  </button>
                  <ChevronRight className="text-muted" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editModal.open && editModal.diaria && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-bold">Editar Diária {editModal.diaria.numero}</h3>
              <button onClick={() => setEditModal({ open: false, diaria: null, num: '', date: '' })} className="btn-icon"><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Número</label>
                <input type="number" value={editModal.num} onChange={e => setEditModal({ ...editModal, num: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }} />
              </div>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Data</label>
                <input type="date" value={editModal.date} onChange={e => setEditModal({ ...editModal, date: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button onClick={() => setEditModal({ open: false, diaria: null, num: '', date: '' })} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>Cancelar</button>
              <button onClick={salvarEdicao} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
              <button onClick={excluirDiaria} className="btn-primary" style={{ backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }} title="Excluir Diária">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
