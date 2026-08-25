import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, MapPin, Calendar, CheckSquare, Clock, Film, FileText } from 'lucide-react';
import { CalendarioDashboard } from './CalendarioDashboard';
import { FilaRepescagem } from './FilaRepescagem';
import { calcularProgresso } from '../lib/registroSet';
import { oitavosParaPaginas } from '../lib/decupagem';

export function DashboardGeral({ projetoId }: { projetoId: string, onNovaDiaria?: () => void }) {
  const navigate = useNavigate();
  
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  /*
    O andamento vem do que aconteceu, não de um número guardado.

    Antes este card lia `localStorage['diaria_atual_<projeto>']` — uma chave que
    NADA no app jamais escreveu. Só era lida, aqui. Sobrou de uma versão antiga,
    e por isso o card mostrava "Diária 1" para sempre, com 2 ou com 40 diárias.
    O denominador vinha de `num_diarias`, um campo digitado à mão que quase
    ninguém preenche — daí a barra parada em 0%.

    Agora sai dos registros de filmagem, que existem de verdade: diárias
    fechadas e páginas gravadas.
  */
  const cenasProjeto = useLiveQuery(() => db.cenas.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const registrosCena = useLiveQuery(() => db.registros_cena.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  const progresso = calcularProgresso(cenasProjeto, registrosCena);

  // Contadores animados
  const [animatedSaldo, setAnimatedSaldo] = useState(0);
  const [animatedGasto, setAnimatedGasto] = useState(0);



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

  const [subAba, setSubAba] = useState<'geral' | 'calendario'>('geral');

  if (!projeto || !despesas || !aportes) return <div style={{ padding: '24px' }}>Carregando panorama...</div>;

  const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
  const totalAportes = aportes.reduce((acc, a) => acc + a.valor, 0);
  const saldoAtual = totalAportes - totalGasto;
  const isEstourado = totalGasto > (projeto.limite_gasto || Infinity);
  const totalPlanejado = projeto.num_diarias || 0;



  // Últimas Tasks (Pendentes)
  const recentes = (tasks || [])
    .filter(t => t.status !== 'done')
    .sort((a, b) => b.data_criacao - a.data_criacao)
    .slice(0, 3);

  const totalDiarias = diarias.length;
  const diariasFechadas = diarias.filter(d => d.fechada).length;

  /*
    A barra mede PÁGINAS quando há decupagem, e diárias quando não há.

    Página gravada é a medida honesta: dez diárias fechadas de meia página cada
    não são metade de um filme. Mas quem ainda não decupou o roteiro não teria
    barra nenhuma — e aí diárias fechadas é o melhor que dá para dizer.
  */
  const progressoDiaria = progresso.oitavosTotal > 0
    ? Math.min((progresso.oitavosGravados / progresso.oitavosTotal) * 100, 100)
    : (totalDiarias > 0 ? (diariasFechadas / totalDiarias) * 100 : 0);

  // Semana à frente (v4 §1.1): 7 dias a partir de hoje, com diárias e prazos de tasks.
  const semana = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      iso,
      rotulo: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
      dia: d.getDate(),
      hoje: i === 0,
      diarias: diarias.filter(x => x.data === iso),
      prazos: (tasks || []).filter(t => t.data_conclusao === iso && t.status !== 'done'),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
      
      {/* Título e Progresso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>{projeto.nome}</h2>
        </div>
      </div>

      {/* No topo, e não no fim: cena que ficou para trás é a informação mais
          perecível do app. Enterrada no rodapé, ela vira descoberta na véspera
          do último dia. Some sozinha quando a fila está vazia. */}
      <FilaRepescagem projetoId={projetoId} />

      <div style={{ display: 'flex', gap: '8px', padding: '0 4px' }}>
        <button 
          onClick={() => setSubAba('geral')}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: subAba === 'geral' ? 'var(--accent)' : 'var(--bg-surface)', color: subAba === 'geral' ? '#fff' : 'var(--text-primary)', border: 'none', fontWeight: 'bold' }}
        >
          Visão Geral
        </button>
        <button 
          onClick={() => setSubAba('calendario')}
          style={{ flex: 1, padding: '8px', borderRadius: '8px', backgroundColor: subAba === 'calendario' ? 'var(--accent)' : 'var(--bg-surface)', color: subAba === 'calendario' ? '#fff' : 'var(--text-primary)', border: 'none', fontWeight: 'bold' }}
        >
          Calendário
        </button>
      </div>

      {subAba === 'calendario' ? (
        <CalendarioDashboard projetoId={projeto.id} />
      ) : (
        <>
          {/* Info Rápida */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {projeto.fonte_orcamento && <span className="text-xs text-muted"><strong>Fonte:</strong> {projeto.fonte_orcamento}</span>}
            {projeto.produtor_executivo && <span className="text-xs text-muted"><strong>Executivo:</strong> {projeto.produtor_executivo}</span>}
            <span className="text-xs text-muted"><strong>Colaboradores:</strong> {perfis?.length || 0} pessoas</span>
          </div>

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
            <button onClick={() => navigate('documentos')} className="btn-primary" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
              <FileText size={24} style={{ color: '#e85d04' }} />
              <span className="text-xs font-bold uppercase tracking-widest">Documentos</span>
            </button>
          </div>

          {/* SEMANA À FRENTE */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} /> Próximos 7 dias
              </span>
              <button onClick={() => setSubAba('calendario')} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Ver mês
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '8px' }}>
              {semana.map(d => {
                const temDiaria = d.diarias.length > 0;
                return (
                  <div
                    key={d.iso}
                    onClick={() => temDiaria && navigate(`diaria/${d.diarias[0].id}`)}
                    style={{
                      minHeight: '84px', padding: '8px', borderRadius: '10px',
                      backgroundColor: d.hoje ? 'var(--bg-surface)' : 'var(--bg-primary)',
                      border: d.hoje ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                      display: 'flex', flexDirection: 'column', gap: '4px',
                      cursor: temDiaria ? 'pointer' : 'default'
                    }}
                    title={temDiaria ? `Abrir Diária ${d.diarias[0].numero}` : undefined}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{d.rotulo}</span>
                      <span className="text-sm font-bold" style={{ color: d.hoje ? 'var(--accent)' : 'inherit' }}>{d.dia}</span>
                    </div>
                    {d.diarias.map(x => (
                      <div key={x.id} style={{ fontSize: '10px', backgroundColor: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        D{String(x.numero).padStart(2, '0')}
                      </div>
                    ))}
                    {d.prazos.length > 0 && (
                      <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-warning)' }}>
                        <CheckSquare size={10} /> {d.prazos.length}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
                <span className="text-3xl font-bold">
                  {diariasFechadas} <span className="text-secondary" style={{ fontSize: '18px', fontWeight: 400 }}>
                    de {totalDiarias || '—'} {totalDiarias === 1 ? 'diária' : 'diárias'}
                  </span>
                </span>
              </div>

              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progressoDiaria}%`, height: '100%', backgroundColor: 'var(--accent)', transition: 'width 0.5s ease-out' }}></div>
              </div>

              {/* O que realmente diz se a produção está andando: páginas de
                  roteiro gravadas. Diária fechada mede o calendário; página
                  gravada mede o filme. */}
              {progresso.cenasTotal > 0 && (
                <div className="text-xs text-secondary" style={{ lineHeight: 1.6 }}>
                  <div>
                    <strong>{oitavosParaPaginas(progresso.oitavosGravados)}</strong> de{' '}
                    <strong>{oitavosParaPaginas(progresso.oitavosTotal)}</strong> páginas gravadas
                  </div>
                  <div className="text-muted">
                    {progresso.gravadas} cena(s) prontas
                    {progresso.parciais > 0 && ` · ${progresso.parciais} pela metade`}
                    {progresso.pendentes > 0 && ` · ${progresso.pendentes} a gravar`}
                    {progresso.cortadas > 0 && ` · ${progresso.cortadas} cortada(s)`}
                  </div>
                </div>
              )}

              {progresso.cenasTotal === 0 && (
                <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                  Decupe o roteiro e marque as cenas na diária para ver quanto do
                  filme já saiu.
                </div>
              )}

              {totalPlanejado > 0 && totalDiarias > totalPlanejado && (
                <div className="text-xs text-danger font-bold">
                  ⚠️ {totalDiarias} diárias criadas, {totalPlanejado} planejadas.
                </div>
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
        </>
      )}

    </div>
  );
}
