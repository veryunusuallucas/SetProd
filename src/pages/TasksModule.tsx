import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db/db';
import {
  Plus, CheckCircle2, Trash2, ListChecks, Lock, AlertTriangle, CalendarClock,
  Circle, CircleDashed, X, User, Building2, Link2, GripVertical,
} from 'lucide-react';
import type { Task } from '../types';
import { logAction } from '../lib/audit';
import { notificar } from '../lib/notificacoes';
import { useRole } from '../hooks/useRole';
import { dataCurta } from '../lib/formato';
import { MOLA, useMovimentoReduzido } from '../components/ui/movimento';
import { useOrigemAncorada } from '../components/ui/origemAncorada';
import { BotaoTatil } from '../components/ui/BotaoTatil';
import { faiscar } from '../components/ui/Faisca';

/**
 * As tarefas da produção — três colunas, arrastáveis.
 *
 * A palavra "Kanban" saiu do título a pedido: ela nomeia o formato para quem
 * conhece o formato, e não diz nada para o resto. O que a tela é continua
 * sendo o que ela sempre foi.
 *
 * ⚠️ A ALTURA DAS COLUNAS É SOLTA, E ISSO NÃO É DESCUIDO.
 *
 * A versão anterior tinha `height: 100vh` na tela e `flex: 1` nas colunas. Item
 * de flex numa linha ESTICA na altura por padrão, então cada coluna ficava com a
 * altura da linha — travada — e o cartão que não coubesse transbordava para fora
 * da moldura: aparecia solto embaixo do retângulo arredondado, sem barra de
 * rolagem que o alcançasse.
 *
 * Com `alignItems: flex-start`, cada coluna toma a altura do próprio conteúdo e
 * quem rola é a página. Coluna comprida fica comprida — o contador no topo já
 * avisa que ali tem muita coisa, e esconder o excesso atrás de um limite é
 * exatamente o que fazia o cartão sumir.
 */

type Status = Task['status'];

const GRUPOS: { status: Status; titulo: string; cor: string; icone: React.ReactNode }[] = [
  { status: 'todo', titulo: 'A fazer', cor: 'var(--text-secondary)', icone: <Circle size={15} /> },
  { status: 'doing', titulo: 'Fazendo', cor: 'var(--color-warning)', icone: <CircleDashed size={15} /> },
  { status: 'done', titulo: 'Feito', cor: 'var(--color-success)', icone: <CheckCircle2 size={15} /> },
];

/** O próximo estado quando a pessoa toca no círculo da esquerda. */
const AVANCA: Record<Status, Status> = { todo: 'doing', doing: 'done', done: 'todo' };

export function TasksModule() {
  const { id: projetoId } = useParams();

  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  const { perfilId: meuPerfilId } = useRole();
  const reduzido = useMovimentoReduzido();

  const [filtro, setFiltro] = useState<'todas' | 'minhas'>('todas');
  const [novaTaskTitulo, setNovaTaskTitulo] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  /** Sobre qual coluna o cartão está sendo arrastado, para destacar o alvo. */
  const [arrastandoSobre, setArrastandoSobre] = useState<Status | null>(null);

  /*
    GUARDA O ID, NÃO A TAREFA.

    Antes isto era `useState<Task | null>` com uma CÓPIA da tarefa, tirada no
    momento em que o modal abria. Toda edição escrevia no banco, mas a cópia na
    tela nunca era atualizada — e o resultado eram dois defeitos que pareciam
    não ter relação:

      · criar uma subtarefa atualizava o cartão atrás e NÃO aparecia no modal;
      · digitar o nome de uma subtarefa não pegava, porque o campo voltava ao
        valor congelado a cada tecla.

    Alguns campos funcionavam (prazo, dependências) porque tinham um
    `setEditandoTask({...})` remendado junto do gravar. Um remendo por campo é o
    aviso de que o modelo está errado: quem esquecer o remendo cria o mesmo
    defeito de novo.

    Com o id, a tarefa vem sempre da consulta viva. Não há cópia para
    dessincronizar.
  */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = tasks.find(t => t.id === editandoId) ?? null;

  /** A subtarefa recém-criada, para o campo já nascer com o cursor dentro. */
  const [subEmFoco, setSubEmFoco] = useState<string | null>(null);

  const ancora = useOrigemAncorada();

  // ---- regras ----

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

  const getDependenciesNames = (task: Task) =>
    (task.depends_on || [])
      .map(depId => tasks.find(t => t.id === depId)?.titulo ?? 'Task excluída')
      .join(', ');

  const avisar = (msg: string, ms = 4000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), ms);
  };

  // ---- ações ----

  const adicionarTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaTaskTitulo.trim()) return;
    if (!projetoId) return avisar('Erro: projeto não identificado.');

    const task: Task = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      titulo: novaTaskTitulo.trim(),
      status: 'todo',
      responsavel_id: meuPerfilId || undefined,
      subtarefas: [],
      depends_on: [],
      data_criacao: Date.now(),
    };

    try {
      await db.tasks.add(task);
      setNovaTaskTitulo('');
    } catch (err: any) {
      console.error('[SetProd] Erro ao criar task:', err);
      return avisar(`Erro ao criar task: ${err?.name || ''} ${err?.message || err}`, 8000);
    }
    // O log de auditoria não pode derrubar a criação se falhar.
    try { await logAction(projetoId, 'criar', 'task', task.id, `Criou task: ${task.titulo}`); } catch { /* ignore */ }
  };

  const mudarStatus = async (taskId: string, status: Status, evento?: { clientX: number; clientY: number }) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (status !== 'todo' && isTaskLocked(task)) {
      return avisar('Não dá para iniciar ou concluir uma task bloqueada.', 3000);
    }

    // Concluir é confirmação — faísca no ponto do dedo. Voltar para "a fazer"
    // não é, e por isso não faísca: o sinal precisa querer dizer uma coisa só.
    if (status === 'done' && task.status !== 'done' && evento) faiscar(evento);

    const antes = task.status;
    await db.tasks.update(taskId, { status });

    const statusDe = (id: string) => (id === taskId ? status : tasks.find(t => t.id === id)?.status);
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
    const dependentes = tasks.filter(t => t.depends_on?.includes(taskId));
    const aviso = dependentes.length
      ? 'Outras tasks dependem desta. Se excluir, a dependência sai delas. Continuar?'
      : 'Deletar esta task?';
    if (!confirm(aviso)) return;

    for (const d of dependentes) {
      await db.tasks.update(d.id, { depends_on: d.depends_on!.filter(id => id !== taskId) });
    }
    await db.tasks.delete(taskId);
  };

  // ---- subtarefas ----

  const gravarSubs = (t: Task, subs: NonNullable<Task['subtarefas']>) =>
    db.tasks.update(t.id, { subtarefas: subs });

  const novaSub = (t: Task) => {
    const id = crypto.randomUUID();
    // Nasce VAZIA, e não com "Nova subtarefa..." escrito dentro. Texto de
    // exemplo dentro do campo é texto que alguém esquece de apagar — e vira
    // item de checklist chamado "Nova subtarefa..." na lista de verdade.
    gravarSubs(t, [...(t.subtarefas || []), { id, titulo: '', concluida: false }]);
    setSubEmFoco(id);
  };

  const tarefasVisiveis = tasks.filter(t => filtro === 'todas' || t.responsavel_id === meuPerfilId);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="text-xl font-bold">Tasks</h1>
          <p className="text-sm text-secondary">O que a produção precisa fazer</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '10px' }}>
          {(['todas', 'minhas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              style={{
                padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700,
                background: filtro === f ? 'var(--accent)' : 'transparent',
                color: filtro === f ? '#000' : 'var(--text-secondary)',
                border: 'none', cursor: 'pointer',
              }}
            >
              {f === 'todas' ? 'Todas' : 'Minhas'}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={adicionarTask} className="acoes-form">
        <input
          placeholder="Nova tarefa… (ex: Confirmar van para sexta)"
          value={novaTaskTitulo}
          onChange={e => setNovaTaskTitulo(e.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <BotaoTatil type="submit" className="btn-primary" style={{ flexShrink: 0 }}>
          <Plus size={18} /> Adicionar
        </BotaoTatil>
      </form>

      {/*
        O QUADRO DE COLUNAS, COM A ALTURA SOLTA.

        Ele voltou a pedido, e o que muda em relação à versão que vazava é uma
        linha: `alignItems: flex-start`.

        Antes a tela era `height: 100vh` e as colunas eram itens de flex com
        `flex: 1`. O padrão de um item de flex numa linha é ESTICAR na altura
        (`stretch`), então cada coluna ficava com a altura da linha — travada —
        e os cartões que não cabiam transbordavam para fora da moldura,
        aparecendo soltos embaixo do retângulo arredondado, sem barra de rolagem
        que os alcançasse.

        Com `flex-start`, cada coluna toma a altura do próprio conteúdo. Quem
        rola é a página. Coluna comprida fica comprida — que é o certo: a
        contagem no topo já diz que ali tem muita coisa, e esconder o excesso
        atrás de um limite é o que fazia o cartão sumir.
      */}
      <div
        style={{
          display: 'flex', gap: '14px', overflowX: 'auto', alignItems: 'flex-start',
          paddingBottom: '8px',
        }}
        className="hide-scrollbar"
      >
        {GRUPOS.map(g => {
          const doGrupo = tarefasVisiveis.filter(t => t.status === g.status);
          const recebendo = arrastandoSobre === g.status;

          return (
            <div
              key={g.status}
              onDragOver={e => { e.preventDefault(); setArrastandoSobre(g.status); }}
              onDragLeave={() => setArrastandoSobre(a => (a === g.status ? null : a))}
              onDrop={e => {
                e.preventDefault();
                setArrastandoSobre(null);
                const taskId = e.dataTransfer.getData('taskId');
                if (taskId) mudarStatus(taskId, g.status);
              }}
              style={{
                // `1 0 280px`: cresce para dividir a largura no desktop, NÃO
                // encolhe abaixo de 280 no celular — aí a linha rola de lado, em
                // vez de espremer três colunas ilegíveis na mesma tela.
                flex: '1 0 280px', minWidth: '280px',
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '14px', padding: '12px',
                display: 'flex', flexDirection: 'column', gap: '10px',
                border: `1px solid ${recebendo ? g.cor : 'var(--border-light)'}`,
                // O destaque ao arrastar por cima diz ONDE vai cair, antes de
                // soltar. Sem ele o alvo é um chute.
                transition: 'border-color 0.15s ease, background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2px 4px' }}>
                <span style={{ color: g.cor, display: 'inline-flex' }}>{g.icone}</span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: g.cor, flex: 1 }}>
                  {g.titulo}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{
                    color: g.cor, backgroundColor: 'var(--bg-surface)',
                    borderRadius: '20px', padding: '2px 9px', minWidth: '24px', textAlign: 'center',
                  }}
                >
                  {doGrupo.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {doGrupo.length === 0 && (
                  <div className="text-xs text-muted" style={{ padding: '18px 4px', textAlign: 'center' }}>
                    {recebendo ? 'Solte aqui' : 'Vazio'}
                  </div>
                )}

                {doGrupo.map(t => (
                  <CartaoTask
                    key={t.id}
                    task={t}
                    depto={departamentos.find(d => d.id === t.departamento_id)}
                    responsavel={perfis.find(p => p.id === t.responsavel_id)}
                    bloqueada={isTaskLocked(t)}
                    motivoBloqueio={getDependenciesNames(t)}
                    atrasada={!!t.data_conclusao && t.status !== 'done' && t.data_conclusao < hoje}
                    aoAbrir={() => setEditandoId(t.id)}
                    aoAvancar={e => mudarStatus(t.id, AVANCA[t.status], e)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- Modal ---------------- */}
      <AnimatePresence>
        {editando && (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 1000, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '16px',
              backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            }}
            onClick={() => setEditandoId(null)}
          >
            <motion.div
              initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={MOLA}
              ref={ancora}
              onClick={e => e.stopPropagation()}
              className="card"
              style={{
                width: '100%', maxWidth: '560px', maxHeight: '88vh',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
              }}
            >
              {/* Cabeçalho fixo: o título é o campo, sem rótulo em cima dele. */}
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <textarea
                  value={editando.titulo}
                  onChange={e => db.tasks.update(editando.id, { titulo: e.target.value })}
                  rows={1}
                  className="font-bold text-lg"
                  style={{
                    flex: 1, minWidth: 0, resize: 'none', border: 'none', background: 'transparent',
                    color: 'var(--text-primary)', padding: 0, fontFamily: 'inherit', lineHeight: 1.3,
                  }}
                />
                <button onClick={() => setEditandoId(null)} className="btn-icon" aria-label="Fechar" style={{ flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Status */}
                <Campo rotulo="Status">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {GRUPOS.map(g => {
                      const ativo = editando.status === g.status;
                      const travado = g.status !== 'todo' && isTaskLocked(editando);
                      return (
                        <button
                          key={g.status}
                          onClick={e => mudarStatus(editando.id, g.status, e)}
                          disabled={travado}
                          style={{
                            flex: 1, padding: '10px 6px', borderRadius: '10px', cursor: travado ? 'not-allowed' : 'pointer',
                            border: `1px solid ${ativo ? g.cor : 'var(--border-light)'}`,
                            background: ativo ? 'var(--bg-active)' : 'transparent',
                            color: ativo ? g.cor : 'var(--text-secondary)',
                            fontWeight: ativo ? 700 : 600, fontSize: '12px',
                            opacity: travado ? 0.45 : 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          }}
                        >
                          {g.icone} {g.titulo}
                        </button>
                      );
                    })}
                  </div>
                  {isTaskLocked(editando) && (
                    <div className="text-xs text-warning" style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Lock size={12} /> Bloqueada por: {getDependenciesNames(editando)}
                    </div>
                  )}
                </Campo>

                {/* Quem e onde — dois campos com rótulo próprio, e não um rótulo
                    para os dois: "Responsável & Departamento" obrigava a ler a
                    ordem para saber qual seletor era qual. */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px' }}>
                  <Campo rotulo="Responsável" icone={<User size={12} />}>
                    <select
                      value={editando.responsavel_id || ''}
                      onChange={e => db.tasks.update(editando.id, { responsavel_id: e.target.value || undefined })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Sem dono</option>
                      {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                        <option key={p.id} value={p.id}>{p.nome} {p.sobrenome} ({p.funcao || 'Equipe'})</option>
                      ))}
                    </select>
                  </Campo>

                  <Campo rotulo="Departamento" icone={<Building2 size={12} />}>
                    <select
                      value={editando.departamento_id || ''}
                      onChange={e => db.tasks.update(editando.id, { departamento_id: e.target.value || undefined })}
                      style={{ width: '100%' }}
                    >
                      <option value="">Geral (sem departamento)</option>
                      {departamentos.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                    </select>
                  </Campo>
                </div>

                <Campo rotulo="Prazo" icone={<CalendarClock size={12} />} ajuda="Aparece no calendário do painel.">
                  <input
                    type="date"
                    value={editando.data_conclusao || ''}
                    onChange={e => db.tasks.update(editando.id, { data_conclusao: e.target.value || undefined })}
                    style={{ width: '100%' }}
                  />
                </Campo>

                {/* Checklist */}
                <Campo
                  rotulo="Checklist"
                  icone={<ListChecks size={12} />}
                  contador={(editando.subtarefas || []).length > 0
                    ? `${(editando.subtarefas || []).filter(s => s.concluida).length}/${(editando.subtarefas || []).length}`
                    : undefined}
                >
                  {(editando.subtarefas || []).length > 0 && (
                    <BarraProgresso
                      feito={(editando.subtarefas || []).filter(s => s.concluida).length}
                      total={(editando.subtarefas || []).length}
                    />
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                    {(editando.subtarefas || []).map(sub => (
                      <div
                        key={sub.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '6px 8px', borderRadius: '8px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={sub.concluida}
                          onChange={e => gravarSubs(editando, (editando.subtarefas || []).map(s => s.id === sub.id ? { ...s, concluida: e.target.checked } : s))}
                          style={{ width: '17px', height: '17px', accentColor: 'var(--accent)', flexShrink: 0 }}
                        />
                        <input
                          value={sub.titulo}
                          autoFocus={sub.id === subEmFoco}
                          onFocus={() => setSubEmFoco(sub.id)}
                          placeholder="O que precisa ser feito?"
                          onChange={e => gravarSubs(editando, (editando.subtarefas || []).map(s => s.id === sub.id ? { ...s, titulo: e.target.value } : s))}
                          // Enter cria a próxima: escrever cinco itens seguidos
                          // sem tirar a mão do teclado é o uso normal de checklist.
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); novaSub(editando); } }}
                          style={{
                            flex: 1, minWidth: 0, padding: '4px 0', border: 'none', background: 'transparent',
                            fontSize: '13px',
                            textDecoration: sub.concluida ? 'line-through' : 'none',
                            color: sub.concluida ? 'var(--text-muted)' : 'var(--text-primary)',
                          }}
                        />
                        <button
                          onClick={() => gravarSubs(editando, (editando.subtarefas || []).filter(s => s.id !== sub.id))}
                          className="btn-icon text-muted"
                          aria-label="Remover item"
                          style={{ padding: 0, width: '28px', height: '28px', flexShrink: 0, border: 'none', background: 'transparent' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => novaSub(editando)}
                    className="text-xs font-bold"
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 8px', cursor: 'pointer' }}
                  >
                    <Plus size={14} /> Adicionar item
                  </button>
                </Campo>

                {/* Dependências */}
                <Campo rotulo="Depende de" icone={<Link2 size={12} />} ajuda="Enquanto não concluírem, esta fica bloqueada.">
                  {(editando.depends_on || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
                      {(editando.depends_on || []).map(depId => {
                        const dt = tasks.find(t => t.id === depId);
                        const feita = dt?.status === 'done';
                        return (
                          <div key={depId} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '7px 10px', borderRadius: '8px' }}>
                            {feita
                              ? <CheckCircle2 size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />
                              : <Circle size={14} className="text-muted" style={{ flexShrink: 0 }} />}
                            <span className="text-sm" style={{ flex: 1, minWidth: 0, color: feita ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {dt ? dt.titulo : 'Task excluída'}
                            </span>
                            <button
                              onClick={() => db.tasks.update(editando.id, { depends_on: (editando.depends_on || []).filter(d => d !== depId) })}
                              className="btn-icon text-muted"
                              aria-label="Remover dependência"
                              style={{ padding: 0, width: '26px', height: '26px', flexShrink: 0, border: 'none', background: 'transparent' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <select
                    value=""
                    onChange={e => {
                      const alvo = e.target.value;
                      if (!alvo) return;
                      if (alvo === editando.id) return avisar('Uma task não pode depender de si mesma.');
                      if (wouldCreateCycle(editando.id, alvo)) return avisar('Isso criaria uma dependência circular.');
                      if (editando.depends_on?.includes(alvo)) return;
                      db.tasks.update(editando.id, { depends_on: [...(editando.depends_on || []), alvo] });
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">+ Adicionar dependência</option>
                    {tasks.filter(t => t.id !== editando.id).map(t => (
                      <option key={t.id} value={t.id}>{t.titulo} {t.status === 'done' ? '(concluída)' : ''}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              {/* Rodapé fixo. "Salvar" só FECHA — tudo já foi gravado a cada
                  toque, e é por isso que ele diz "Pronto": um botão chamado
                  Salvar sugere que sair sem clicar perderia o trabalho. */}
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => { deletarTask(editando.id); setEditandoId(null); }}
                  className="text-danger font-bold text-sm"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Excluir task
                </button>
                <BotaoTatil onClick={() => setEditandoId(null)} className="btn-primary">
                  Pronto
                </BotaoTatil>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--color-danger)', color: 'white', padding: '12px 24px', borderRadius: '24px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', fontWeight: 'bold' }}>
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Uma seção do modal: rótulo, contador opcional, e a linha de ajuda embaixo. */
function Campo({ rotulo, icone, contador, ajuda, children }: {
  rotulo: string;
  icone?: React.ReactNode;
  contador?: string;
  ajuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        {icone && <span className="text-muted" style={{ display: 'inline-flex' }}>{icone}</span>}
        <span className="text-xs text-muted uppercase tracking-widest font-bold">{rotulo}</span>
        {contador && <span className="text-xs text-muted">· {contador}</span>}
      </div>
      {children}
      {ajuda && <div className="text-xs text-muted" style={{ marginTop: '6px' }}>{ajuda}</div>}
    </div>
  );
}

function BarraProgresso({ feito, total }: { feito: number; total: number }) {
  const pct = total > 0 ? (feito / total) * 100 : 0;
  const completo = total > 0 && feito === total;
  return (
    <div style={{ height: '5px', borderRadius: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <motion.div
        animate={{ width: `${pct}%` }}
        transition={MOLA}
        style={{ height: '100%', background: completo ? 'var(--color-success)' : 'var(--accent)' }}
      />
    </div>
  );
}

/**
 * Uma tarefa dentro da coluna.
 *
 * Arrasta para mudar de coluna, no computador. E o círculo da esquerda avança o
 * estado num toque — que é o caminho do celular, onde arrastar entre colunas
 * que nem cabem na mesma tela não funciona. Ele fica fora da área que abre a
 * janela de propósito: marcar como feito é o gesto mais comum da tela, e abrir
 * um modal para isso seriam três toques onde cabe um.
 */
function CartaoTask({ task, depto, responsavel, bloqueada, motivoBloqueio, atrasada, aoAbrir, aoAvancar }: {
  task: Task;
  depto?: { nome: string; cor?: string };
  responsavel?: { nome: string; sobrenome?: string };
  bloqueada: boolean;
  motivoBloqueio: string;
  atrasada: boolean;
  aoAbrir: () => void;
  aoAvancar: (e: React.MouseEvent) => void;
}) {
  const feito = task.status === 'done';
  const subs = task.subtarefas || [];
  const subsFeitas = subs.filter(s => s.concluida).length;

  const icone = feito
    ? <CheckCircle2 size={19} color="var(--color-success)" />
    : task.status === 'doing'
      ? <CircleDashed size={19} color="var(--color-warning)" />
      : <Circle size={19} className="text-muted" />;

  return (
    <div
      className="card"
      /*
        Tarefa bloqueada não arrasta: ela não pode mudar de coluna enquanto o
        que ela espera não estiver feito, e deixar arrastar para depois recusar
        no solto seria prometer uma coisa e fazer outra.
      */
      draggable={!bloqueada}
      onDragStart={e => {
        e.dataTransfer.setData('taskId', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{
        padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '10px',
        borderLeft: `3px solid ${depto?.cor || 'var(--border-color)'}`,
        opacity: bloqueada ? 0.65 : 1,
        cursor: bloqueada ? 'default' : 'grab',
      }}
    >
      {/* A alça existe para dizer que o cartão se pega. Sem um sinal visível, a
          única forma de descobrir que dá para arrastar é tentar por acaso. */}
      {!bloqueada && (
        <GripVertical size={14} className="text-muted" style={{ flexShrink: 0, opacity: 0.45 }} />
      )}

      <button
        onClick={aoAvancar}
        disabled={bloqueada && !feito}
        title={bloqueada ? `Aguardando: ${motivoBloqueio}` : 'Mudar o estado'}
        style={{
          background: 'none', border: 'none', padding: 0, flexShrink: 0,
          cursor: bloqueada && !feito ? 'not-allowed' : 'pointer', display: 'inline-flex',
        }}
      >
        {bloqueada && !feito ? <Lock size={17} className="text-warning" /> : icone}
      </button>

      <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={aoAbrir}>
        <div
          className="font-bold"
          style={{
            fontSize: '14px',
            textDecoration: feito ? 'line-through' : 'none',
            color: feito ? 'var(--text-muted)' : 'var(--text-primary)',
            // Título longo não empurra os chips para fora nem estica a linha:
            // corta com reticências, e o modal mostra ele inteiro.
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {task.titulo || 'Sem título'}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '3px' }}>
          {depto && (
            <span className="text-xs" style={{ color: depto.cor || 'var(--text-muted)', fontWeight: 700 }}>
              {depto.nome}
            </span>
          )}
          <span className="text-xs text-muted">
            {responsavel ? `${responsavel.nome} ${responsavel.sobrenome || ''}`.trim() : 'Sem dono'}
          </span>
          {task.data_conclusao && (
            <span
              className="text-xs"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: atrasada ? 'var(--color-danger)' : 'var(--text-muted)',
                fontWeight: atrasada ? 700 : 400,
              }}
            >
              <CalendarClock size={11} /> {dataCurta(task.data_conclusao)}{atrasada ? ' · atrasada' : ''}
            </span>
          )}
          {subs.length > 0 && (
            <span
              className="text-xs"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: subsFeitas === subs.length ? 'var(--color-success)' : 'var(--text-muted)',
              }}
            >
              <ListChecks size={11} /> {subsFeitas}/{subs.length}
            </span>
          )}
          {bloqueada && !feito && (
            <span className="text-xs text-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <AlertTriangle size={11} /> bloqueada
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
