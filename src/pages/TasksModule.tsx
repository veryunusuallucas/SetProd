import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, CheckCircle2, Trash2, ListChecks, Lock, AlertTriangle, CalendarClock } from 'lucide-react';
import type { Task } from '../types';
import { logAction } from '../lib/audit';
import { notificar } from '../lib/notificacoes';

export function TasksModule() {
  const { id: projetoId } = useParams();

  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  // Puxar mock do Perfil Atual (pra "Minhas Tasks")
  const meuPerfilId = localStorage.getItem('mock_perfil_id') || '';

  const [filtro, setFiltro] = useState<'todas' | 'minhas'>('todas');
  
  const [novaTaskTitulo, setNovaTaskTitulo] = useState('');
  const [editandoTask, setEditandoTask] = useState<Task | null>(null);
  const [toastMsg, setToastMsg] = useState('');

  // DFS para detectar ciclo
  const wouldCreateCycle = (taskId: string, targetDepId: string): boolean => {
    if (taskId === targetDepId) return true;
    const targetTask = tasks.find(t => t.id === targetDepId);
    if (!targetTask || !targetTask.depends_on) return false;
    
    for (const dep of targetTask.depends_on) {
      if (dep === taskId) return true;
      if (wouldCreateCycle(taskId, dep)) return true;
    }
    return false;
  };

  const isTaskLocked = (task: Task) => {
    if (!task.depends_on || task.depends_on.length === 0) return false;
    return task.depends_on.some(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask && depTask.status !== 'done';
    });
  };

  const getDependenciesNames = (task: Task) => {
    if (!task.depends_on) return '';
    return task.depends_on.map(depId => {
      const depTask = tasks.find(t => t.id === depId);
      return depTask ? depTask.titulo : 'Task excluída';
    }).join(', ');
  };

  const adicionarTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTaskTitulo.trim()) return;
    if (!projetoId) { setToastMsg('Erro: projeto não identificado.'); setTimeout(() => setToastMsg(''), 4000); return; }
    const task: Task = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      titulo: novaTaskTitulo.trim(),
      status: 'todo',
      responsavel_id: meuPerfilId || undefined,
      subtarefas: [],
      depends_on: [],
      data_criacao: Date.now()
    };
    try {
      await db.tasks.add(task);
      setNovaTaskTitulo('');
    } catch (err: any) {
      console.error('[SetProd] Erro ao criar task:', err);
      setToastMsg(`Erro ao criar task: ${err?.name || ''} ${err?.message || err}`);
      setTimeout(() => setToastMsg(''), 8000);
      return;
    }
    // Log de auditoria não deve derrubar a criação se falhar
    try { await logAction(projetoId, 'criar', 'task', task.id, `Criou task: ${task.titulo}`); } catch { /* ignore */ }
  };

  const mudarStatus = async (taskId: string, status: Task['status']) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (status !== 'todo' && isTaskLocked(task)) {
      setToastMsg('Não é possível iniciar ou concluir uma task bloqueada.');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    const antes = task.status;
    await db.tasks.update(taskId, { status });

    // Status de cada dep considerando a mudança que acabou de acontecer
    const statusDe = (id: string) => id === taskId ? status : tasks.find(t => t.id === id)?.status;
    const bloqueada = (t: Task) => (t.depends_on || []).some(dep => statusDe(dep) !== 'done');
    const bloqueadaAntes = (t: Task) => (t.depends_on || []).some(dep => tasks.find(x => x.id === dep)?.status !== 'done');
    const dependentes = tasks.filter(t => t.depends_on?.includes(taskId));

    if (status === 'done' && antes !== 'done') {
      for (const t of dependentes) {
        if (bloqueadaAntes(t) && !bloqueada(t)) {
          await notificar(projetoId!, `Task liberada: "${t.titulo}" (dependência concluída)`, { perfil_id: t.responsavel_id, task_id: t.id });
        }
      }
    } else if (antes === 'done' && status !== 'done') {
      for (const t of dependentes) {
        if (bloqueada(t)) {
          await notificar(projetoId!, `Task bloqueada de novo: "${t.titulo}" (dependência reaberta)`, { perfil_id: t.responsavel_id, task_id: t.id });
        }
      }
    }
  };

  const deletarTask = async (taskId: string) => {
    const isDependency = tasks.some(t => t.depends_on?.includes(taskId));
    if (isDependency) {
      if (!confirm('Outras tasks dependem desta. Se excluir, a dependência será removida delas. Continuar?')) return;
    } else {
      if (!confirm('Deletar esta task?')) return;
    }

    // Remover dependências órfãs
    const dependentes = tasks.filter(t => t.depends_on?.includes(taskId));
    for (const d of dependentes) {
      await db.tasks.update(d.id, { depends_on: d.depends_on!.filter(id => id !== taskId) });
    }

    await db.tasks.delete(taskId);
  };

  const tasksFiltradas = tasks.filter(t => filtro === 'todas' || t.responsavel_id === meuPerfilId);

  /**
   * Card inteiro na cor do departamento (estilo ClickUp, v4 §5.3).
   * A cor vem como hex do cadastro de departamentos; usamos ela em opacidade baixa
   * no fundo para o texto continuar legível nos dois temas.
   */
  const corDeFundo = (hex?: string, locked?: boolean) => {
    if (locked) return 'var(--bg-default)';
    if (!hex) return 'var(--bg-surface)';
    const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
    if (!m) return 'var(--bg-surface)';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const formataPrazo = (iso: string) => {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a.slice(-2)}`;
  };

  const renderColuna = (status: Task['status'], titulo: string, cor: string) => {
    const ts = tasksFiltradas.filter(t => t.status === status);
    
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessário para permitir o drop
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('taskId');
      if (taskId) {
        mudarStatus(taskId, status);
      }
    };
    
    return (
      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ flex: 1, minWidth: '280px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', border: `1px solid var(--border-light)` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="font-bold text-sm uppercase tracking-widest" style={{ color: cor }}>{titulo} ({ts.length})</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {ts.map(t => {
            const resp = perfis.find(p => p.id === t.responsavel_id);
            const numSubs = (t.subtarefas || []).length;
            const subsFeitas = (t.subtarefas || []).filter(s => s.concluida).length;
            const locked = isTaskLocked(t);
            const depto = departamentos.find(d => d.id === t.departamento_id);

            return (
              <div 
                key={t.id} 
                className="card" 
                draggable={!locked}
                onDragStart={(e) => {
                  e.dataTransfer.setData('taskId', t.id);
                }}
                style={{
                  padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'grab',
                  borderLeft: `3px solid ${depto?.cor || cor}`,
                  opacity: locked ? 0.6 : 1,
                  backgroundColor: corDeFundo(depto?.cor, locked),
                  position: 'relative'
                }}
              >
                {/* Tag do Departamento */}
                {depto && (
                  <div style={{ position: 'absolute', top: '-10px', right: '12px', backgroundColor: depto.cor || '#8884d8', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', zIndex: 1 }}>
                    {depto.nome}
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }} onClick={() => setEditandoTask(t)}>
                  <div className="font-bold" style={{ fontSize: '14px', textDecoration: locked ? 'line-through' : 'none', color: locked ? 'var(--text-muted)' : 'inherit', marginTop: depto ? '4px' : '0' }}>
                    {t.titulo}
                  </div>
                  {locked && <span title={`Aguardando: ${getDependenciesNames(t)}`} style={{ display: 'inline-flex', marginTop: depto ? '4px' : '0' }}><Lock size={14} className="text-warning" /></span>}
                </div>
                
                {locked && (
                  <div className="text-xs text-warning" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Aguardando dependências
                  </div>
                )}

                {t.data_conclusao && (
                  <div
                    className="text-xs"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      color: t.status !== 'done' && t.data_conclusao < hoje ? 'var(--color-danger)' : 'var(--text-secondary)',
                      fontWeight: t.status !== 'done' && t.data_conclusao < hoje ? 'bold' : 'normal'
                    }}
                  >
                    <CalendarClock size={12} /> {formataPrazo(t.data_conclusao)}
                    {t.status !== 'done' && t.data_conclusao < hoje ? ' · atrasada' : ''}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {resp ? `${resp.nome} ${resp.sobrenome || ''}` : 'Sem dono'}
                  </div>
                  {numSubs > 0 && (
                    <div className="text-xs font-bold" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: subsFeitas === numSubs ? 'var(--color-success)' : 'var(--text-secondary)' }}>
                      <ListChecks size={12} /> {subsFeitas}/{numSubs}
                    </div>
                  )}
                </div>

                {/* Setas para mover no Mobile (Ocultas no Desktop via CSS, mas faremos visível se a tela for pequena, ou apenas deixaremos sutis) */}
                {!locked && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '4px' }}>
                    {status !== 'todo' ? (
                      <button onClick={(e) => { e.stopPropagation(); mudarStatus(t.id, status === 'done' ? 'doing' : 'todo'); }} className="text-muted" style={{ background: 'none', border: 'none', fontSize: '16px', padding: '0 8px', cursor: 'pointer' }}>&larr;</button>
                    ) : <span />}
                    {status !== 'done' ? (
                      <button onClick={(e) => { e.stopPropagation(); mudarStatus(t.id, status === 'todo' ? 'doing' : 'done'); }} className="text-muted" style={{ background: 'none', border: 'none', fontSize: '16px', padding: '0 8px', cursor: 'pointer' }}>&rarr;</button>
                    ) : <span />}
                  </div>
                )}
              </div>
            );
          })}
          {ts.length === 0 && <div className="text-muted text-xs text-center" style={{ padding: '20px 0' }}>Vazio</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', height: '100vh', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h1 className="text-xl font-bold">Tasks (Kanban)</h1>
          <p className="text-sm text-secondary">Acompanhamento de tarefas da produção</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '8px' }}>
          <button onClick={() => setFiltro('todas')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', background: filtro === 'todas' ? 'var(--accent)' : 'transparent', color: filtro === 'todas' ? '#000' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
            Todas as Tasks
          </button>
          <button onClick={() => setFiltro('minhas')} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', background: filtro === 'minhas' ? 'var(--accent)' : 'transparent', color: filtro === 'minhas' ? '#000' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
            Minhas Tasks
          </button>
        </div>
      </div>

      <form onSubmit={adicionarTask} style={{ display: 'flex', gap: '12px' }}>
        <input 
          placeholder="Nova tarefa... (ex: Confirmar van para sexta)" 
          value={novaTaskTitulo} 
          onChange={e => setNovaTaskTitulo(e.target.value)} 
          style={{ flex: 1, padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
        />
        <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '12px' }}>
          <Plus size={18} /> Adicionar
        </button>
      </form>

      <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', flex: 1, paddingBottom: '20px' }} className="hide-scrollbar">
        {renderColuna('todo', 'A Fazer', 'var(--text-secondary)')}
        {renderColuna('doing', 'Fazendo', 'var(--color-warning)')}
        {renderColuna('done', 'Feito', 'var(--color-success)')}
      </div>

      {/* Modal Edição da Task */}
      {editandoTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <input 
              value={editandoTask.titulo} 
              onChange={e => db.tasks.update(editandoTask.id, { titulo: e.target.value })} 
              style={{ fontSize: '18px', fontWeight: 'bold', border: 'none', background: 'transparent', padding: 0 }}
            />
            
            <div>
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Status</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => mudarStatus(editandoTask.id, 'todo')} 
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${editandoTask.status === 'todo' ? 'var(--text-secondary)' : 'var(--border-light)'}`, background: editandoTask.status === 'todo' ? 'rgba(255,255,255,0.1)' : 'transparent', opacity: isTaskLocked(editandoTask) ? 0.5 : 1 }}
                >
                  A Fazer
                </button>
                <button 
                  onClick={() => mudarStatus(editandoTask.id, 'doing')} 
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${editandoTask.status === 'doing' ? 'var(--color-warning)' : 'var(--border-light)'}`, background: editandoTask.status === 'doing' ? 'rgba(255,165,0,0.1)' : 'transparent', color: editandoTask.status === 'doing' ? 'var(--color-warning)' : 'var(--text-primary)', opacity: isTaskLocked(editandoTask) ? 0.5 : 1, cursor: isTaskLocked(editandoTask) ? 'not-allowed' : 'pointer' }}
                  disabled={isTaskLocked(editandoTask)}
                >
                  Fazendo
                </button>
                <button 
                  onClick={() => mudarStatus(editandoTask.id, 'done')} 
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${editandoTask.status === 'done' ? 'var(--color-success)' : 'var(--border-light)'}`, background: editandoTask.status === 'done' ? 'rgba(0,255,0,0.1)' : 'transparent', color: editandoTask.status === 'done' ? 'var(--color-success)' : 'var(--text-primary)', opacity: isTaskLocked(editandoTask) ? 0.5 : 1, cursor: isTaskLocked(editandoTask) ? 'not-allowed' : 'pointer' }}
                  disabled={isTaskLocked(editandoTask)}
                >
                  Feito
                </button>
              </div>
              {isTaskLocked(editandoTask) && <div className="text-xs text-warning mt-1">Status bloqueado. Conclua as dependências primeiro.</div>}
            </div>

            <div>
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Responsável & Departamento</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={editandoTask.responsavel_id || ''} 
                  onChange={e => db.tasks.update(editandoTask.id, { responsavel_id: e.target.value || undefined })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', flex: 1 }}
                >
                  <option value="">Sem dono</option>
                  {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                    <option key={p.id} value={p.id}>{p.nome} {p.sobrenome} ({p.funcao || 'Equipe'})</option>
                  ))}
                </select>
                <select 
                  value={editandoTask.departamento_id || ''} 
                  onChange={e => db.tasks.update(editandoTask.id, { departamento_id: e.target.value || undefined })}
                  style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', flex: 1 }}
                >
                  <option value="">Geral (Sem Depto)</option>
                  {departamentos.map(d => (
                    <option key={d.id} value={d.id}>{d.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Prazo / Data de Conclusão</div>
              <input
                type="date"
                value={editandoTask.data_conclusao || ''}
                onChange={e => {
                  const valor = e.target.value || undefined;
                  db.tasks.update(editandoTask.id, { data_conclusao: valor });
                  setEditandoTask({ ...editandoTask, data_conclusao: valor });
                }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', width: '100%' }}
              />
              <div className="text-xs text-muted mt-1">Aparece no calendário do Dashboard.</div>
            </div>

            <div>
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Depende de: (Bloqueadores)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                {(editandoTask.depends_on || []).map(depId => {
                  const dt = tasks.find(t => t.id === depId);
                  return (
                    <div key={depId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-primary)', padding: '6px 12px', borderRadius: '8px' }}>
                      <span className="text-sm">{dt ? dt.titulo : 'Task Desconhecida'} {dt?.status === 'done' && <CheckCircle2 size={14} color="var(--color-success)" style={{ display: 'inline' }} />}</span>
                      <button onClick={() => {
                        const nd = editandoTask.depends_on!.filter(d => d !== depId);
                        db.tasks.update(editandoTask.id, { depends_on: nd });
                        setEditandoTask({ ...editandoTask, depends_on: nd });
                      }} className="btn-icon text-muted" style={{ padding: '4px' }}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
              <select 
                onChange={(e) => {
                  const targetId = e.target.value;
                  if (!targetId) return;
                  if (targetId === editandoTask.id) return alert('Task não pode depender de si mesma.');
                  if (wouldCreateCycle(editandoTask.id, targetId)) return alert('Erro: Isso criaria uma dependência circular.');
                  if (editandoTask.depends_on?.includes(targetId)) return;
                  
                  const nd = [...(editandoTask.depends_on || []), targetId];
                  db.tasks.update(editandoTask.id, { depends_on: nd });
                  setEditandoTask({ ...editandoTask, depends_on: nd });
                  e.target.value = ''; // reset select
                }}
                style={{ padding: '10px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', width: '100%' }}
              >
                <option value="">+ Adicionar Dependência</option>
                {tasks.filter(t => t.id !== editandoTask.id).map(t => (
                  <option key={t.id} value={t.id}>{t.titulo} ({t.status === 'done' ? 'Concluída' : 'Pendente'})</option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-muted uppercase tracking-widest mb-1">Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                {(editandoTask.subtarefas || []).map(sub => (
                  <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      checked={sub.concluida} 
                      onChange={e => {
                        const subs = (editandoTask.subtarefas || []).map(s => s.id === sub.id ? { ...s, concluida: e.target.checked } : s);
                        db.tasks.update(editandoTask.id, { subtarefas: subs });
                      }}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }}
                    />
                    <input 
                      value={sub.titulo} 
                      onChange={e => {
                        const subs = (editandoTask.subtarefas || []).map(s => s.id === sub.id ? { ...s, titulo: e.target.value } : s);
                        db.tasks.update(editandoTask.id, { subtarefas: subs });
                      }}
                      style={{ flex: 1, padding: '4px', border: 'none', background: 'transparent', textDecoration: sub.concluida ? 'line-through' : 'none', color: sub.concluida ? 'var(--text-muted)' : 'var(--text-primary)' }}
                    />
                    <button onClick={() => {
                      const subs = (editandoTask.subtarefas || []).filter(s => s.id !== sub.id);
                      db.tasks.update(editandoTask.id, { subtarefas: subs });
                    }} className="btn-icon text-muted" style={{ padding: '4px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => {
                const subs = [...(editandoTask.subtarefas || []), { id: crypto.randomUUID(), titulo: 'Nova subtarefa...', concluida: false }];
                db.tasks.update(editandoTask.id, { subtarefas: subs });
              }} className="text-xs font-bold" style={{ background: 'none', border: 'none', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
              <button onClick={() => { deletarTask(editandoTask.id); setEditandoTask(null); }} className="text-danger font-bold text-sm" style={{ background: 'none', border: 'none' }}>Excluir Task</button>
              <button onClick={() => setEditandoTask(null)} className="btn-primary" style={{ padding: '8px 24px' }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-danger)', color: 'white', padding: '12px 24px', borderRadius: '24px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontWeight: 'bold' }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}
