import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, MapPin, Calendar, CheckSquare, Clock, Film, FileText } from 'lucide-react';

export function DashboardGeral({ projetoId }: { projetoId: string, onNovaDiaria?: () => void }) {
  const navigate = useNavigate();
  
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  const [diariaAtual] = useState(() => {
    const salva = localStorage.getItem(`diaria_atual_${projetoId}`);
    return salva ? parseInt(salva.replace(/\D/g, '')) || 1 : 1;
  });

  // Contadores animados
  const [animatedSaldo, setAnimatedSaldo] = useState(0);
  const [animatedGasto, setAnimatedGasto] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (projeto && !editMode) setForm(projeto);
  }, [projeto, editMode]);

  useEffect(() => {
    if (!projeto || !despesas || !aportes) return;
    
    const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
    const totalAportes = aportes.reduce((acc, a) => acc + a.valor, 0);
    const saldoAtual = totalAportes - totalGasto;

    let start: number | null = null;
    const duration = 600;
    const initialGasto = animatedGasto;
    const initialSaldo = animatedSaldo;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      
      setAnimatedGasto(initialGasto + (totalGasto - initialGasto) * progress);
      setAnimatedSaldo(initialSaldo + (saldoAtual - initialSaldo) * progress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setAnimatedGasto(totalGasto);
        setAnimatedSaldo(saldoAtual);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [projeto, despesas]);

  if (!projeto || !despesas || !aportes) return <div style={{ padding: '24px' }}>Carregando panorama...</div>;

  const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
  const totalAportes = aportes.reduce((acc, a) => acc + a.valor, 0);
  const saldoAtual = totalAportes - totalGasto;
  const isEstourado = totalGasto > (projeto.limite_gasto || Infinity);
  const totalPlanejado = projeto.num_diarias || 0;

  const salvarConfig = async () => {
    if (!form) return;
    await db.projetos.put(form);
    setEditMode(false);
  };
  const num = (v: string) => (v === '' ? undefined : Number(v));

  // Últimas Tasks (Pendentes)
  const recentes = (tasks || [])
    .filter(t => t.status !== 'done')
    .sort((a, b) => b.data_criacao - a.data_criacao)
    .slice(0, 3);

  const progressoDiaria = totalPlanejado > 0 ? Math.min((diariaAtual / totalPlanejado) * 100, 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
      
      {/* Título e Progresso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>{projeto.nome}</h2>
        </div>
        <button
          onClick={() => editMode ? salvarConfig() : setEditMode(true)}
          className="text-xs font-bold"
          style={{ backgroundColor: editMode ? 'var(--accent)' : 'var(--bg-surface)', color: editMode ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 12px' }}
        >
          {editMode ? 'Salvar Config. Financeira' : 'Editar Configuração'}
        </button>
      </div>

      {editMode && form && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--accent)' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2">Configurações Financeiras do Projeto</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Fonte do Orçamento</label><input value={form.fonte_orcamento || ''} onChange={e => setForm({ ...form, fonte_orcamento: e.target.value })} placeholder="Ex: Netflix, Edital X" /></div>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Produtor Executivo</label><input value={form.produtor_executivo || ''} onChange={e => setForm({ ...form, produtor_executivo: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Orçamento Máximo</label><input type="number" value={form.limite_gasto ?? ''} onChange={e => setForm({ ...form, limite_gasto: num(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">PIX do Caixa / Produtora</label><input value={form.pix_caixa || ''} onChange={e => setForm({ ...form, pix_caixa: e.target.value })} /></div>
            <div style={{ flex: 1 }}>
              <label className="text-xs text-muted font-bold uppercase">Modo de Acerto</label>
              <select 
                value={form.modo_acerto || 'direto'} 
                onChange={e => setForm({ ...form, modo_acerto: e.target.value })} 
                disabled={despesas.length > 0}
                style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: despesas.length > 0 ? 'var(--bg-primary)' : 'var(--bg-surface)', width: '100%', opacity: despesas.length > 0 ? 0.7 : 1 }}
              >
                <option value="direto">Compensado (Líquido) - Cada um paga quem deve direto</option>
                <option value="centralizado">Banco do Projeto - Todos pagam/recebem do Caixa</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-muted mt-2">
            <strong>Atenção:</strong> {despesas.length > 0 ? 'O Modo de Acerto não pode ser alterado pois já existem despesas lançadas neste projeto.' : 'O Modo de Acerto altera como o sistema calcula quem deve quem. Evite alterar após o início das despesas.'}
          </div>
        </div>
      )}

      {/* Info Rápida */}
      {!editMode && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {projeto.fonte_orcamento && <span className="text-xs text-muted"><strong>Fonte:</strong> {projeto.fonte_orcamento}</span>}
          {projeto.produtor_executivo && <span className="text-xs text-muted"><strong>Executivo:</strong> {projeto.produtor_executivo}</span>}
          <span className="text-xs text-muted"><strong>Colaboradores:</strong> {perfis?.length || 0} pessoas</span>
        </div>
      )}

      {/* ATALHOS RÁPIDOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
        <button onClick={() => navigate('producao')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <Users size={24} className="text-accent" />
          <span className="text-xs font-bold uppercase tracking-widest">Equipe</span>
        </button>
        <button onClick={() => navigate('financeiro')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <DollarSign size={24} className="text-success" />
          <span className="text-xs font-bold uppercase tracking-widest">Dinheiro</span>
        </button>
        <button onClick={() => navigate('diarias')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <Calendar size={24} style={{ color: '#9d4edd' }} />
          <span className="text-xs font-bold uppercase tracking-widest">Diárias</span>
        </button>
        <button onClick={() => navigate('locacoes')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <MapPin size={24} style={{ color: '#ff6b6b' }} />
          <span className="text-xs font-bold uppercase tracking-widest">Locações</span>
        </button>
        <button onClick={() => navigate('tasks')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <CheckSquare size={24} style={{ color: '#4cc9f0' }} />
          <span className="text-xs font-bold uppercase tracking-widest">Tarefas</span>
        </button>
        <button onClick={() => navigate('decupagem')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <Film size={24} style={{ color: '#fca311' }} />
          <span className="text-xs font-bold uppercase tracking-widest">Decupagem</span>
        </button>
        <button onClick={() => navigate('breakdown')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
          <FileText size={24} style={{ color: '#e85d04' }} />
          <span className="text-xs font-bold uppercase tracking-widest">Roteiro</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        
        {/* PROGRESSO DE DIÁRIAS */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /> Andamento do Projeto
            </span>
            {totalPlanejado > 0 && (
              <span className="text-sm font-bold text-accent">{Math.round(progressoDiaria)}%</span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span className="text-3xl font-bold">Diária {diariaAtual}</span>
            {totalPlanejado > 0 && <span className="text-secondary font-bold">de {totalPlanejado}</span>}
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progressoDiaria}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.5s ease-out' }}></div>
          </div>
          
          {diariaAtual > totalPlanejado && totalPlanejado > 0 && (
            <div className="text-xs text-danger font-bold">⚠️ Número de diárias ultrapassou o planejado.</div>
          )}
        </div>

        {/* RESUMO FINANCEIRO */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderColor: isEstourado ? 'var(--color-danger)' : 'var(--border-color)' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <DollarSign size={14} /> Resumo Financeiro
          </span>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '4px' }}>Saldo Disponível</span>
              <span className="text-2xl font-bold" style={{ color: saldoAtual < 0 ? 'var(--color-danger)' : 'var(--text-primary)', transition: 'color 0.3s ease' }}>
                R$ {animatedSaldo.toFixed(2)}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '4px', color: isEstourado ? 'var(--color-danger)' : 'var(--text-secondary)' }}>Total Gasto</span>
              <span className="text-lg font-bold" style={{ color: isEstourado ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                R$ {animatedGasto.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* TAREFAS RECENTES */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckSquare size={14} /> Tarefas Pendentes
          </span>
          <button onClick={() => navigate('tasks')} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Ver Todas
          </button>
        </div>

        {recentes.length === 0 ? (
          <div className="text-sm text-secondary" style={{ textAlign: 'center', padding: '16px' }}>
            Nenhuma tarefa pendente no momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentes.map(task => (
              <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: task.status === 'doing' ? 'var(--accent)' : 'var(--text-muted)' }}></div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span className="text-sm font-bold">{task.titulo}</span>
                  {task.descricao && <span className="text-xs text-secondary">{task.descricao.substring(0, 50)}{task.descricao.length > 50 ? '...' : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
