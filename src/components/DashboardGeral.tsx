import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, MapPin, Calendar, CheckSquare, Clock, Film, FileText, AlertTriangle } from 'lucide-react';
import { ordenarPorPrazo, urgenciaDe } from '../lib/urgencia';
import { CalendarioDashboard } from './CalendarioDashboard';
import { FilaRepescagem } from './FilaRepescagem';
import { AvisoDeRitmo } from './AvisoDeRitmo';
import { calcularProgresso } from '../lib/registroSet';
import { oitavosParaPaginas } from '../lib/decupagem';
import { Numero } from './ui/Numero';
import { tipoDoEvento } from './EventosPanel';

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
  const eventos = useLiveQuery(() => db.eventos.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  const progresso = calcularProgresso(cenasProjeto, registrosCena);

  /*
    O contador à mão saiu daqui: virou <Numero>, em ui/Numero.tsx.

    O que estava aqui contava em linha reta (sem desaceleração), ignorava quem
    pede menos movimento, e escrevia "R$ 1234.56" — notação inglesa num app
    brasileiro, enquanto o campo de digitar despesa já usava o formato certo.

    E tinha um defeito silencioso: o efeito lia `aportes` mas não o listava nas
    dependências, então um aporte novo não mexia no saldo da tela até alguma
    despesa mudar. O número ficava desatualizado sem nada indicar isso.
  */

  const [subAba, setSubAba] = useState<'geral' | 'calendario'>('geral');

  if (!projeto || !despesas || !aportes) return <div style={{ padding: '24px' }}>Carregando panorama...</div>;

  const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
  const totalAportes = aportes.reduce((acc, a) => acc + a.valor, 0);
  const saldoAtual = totalAportes - totalGasto;
  const isEstourado = totalGasto > (projeto.limite_gasto || Infinity);
  const totalPlanejado = projeto.num_diarias || 0;



  /*
    As tarefas do painel: as mais URGENTES, e não as mais recentes.

    Era `sort(data_criacao)` — o painel mostrava as três últimas que alguém
    escreveu. A tarefa criada há um mês, que venceu ontem, nunca aparecia; a
    anotada hoje de manhã para daqui a três semanas aparecia sempre. O painel
    respondia "o que eu escrevi por último", que é uma pergunta que ninguém faz.

    Agora ele responde "o que está pegando fogo": atrasadas primeiro, depois as
    de hoje, depois prazo curto — a mesma ordem da coluna de Tasks, que é a
    mesma ordem em que o dia cobra. Ver `lib/urgencia.ts`.
  */
  const pendentes = ordenarPorPrazo((tasks || []).filter(t => t.status !== 'done'));
  const comUrgencia = pendentes.map(t => ({ task: t, urgencia: urgenciaDe(t) }));
  const atrasadas = comUrgencia.filter(x => x.urgencia.nivel === 'atrasada');
  const paraHoje = comUrgencia.filter(x => x.urgencia.nivel === 'hoje');

  /*
    Cinco quando há atraso, três quando não há.

    A lista cresce só quando existe motivo: um painel que mostra sempre cinco
    tarefas fica pesado nos dias em que não há nada urgente, e um que mostra
    sempre três esconde justamente o acúmulo que é o problema.
  */
  const urgentes = comUrgencia.slice(0, atrasadas.length > 0 ? 5 : 3);

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
      eventos: eventos.filter(e => e.data === iso),
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

      {/*
        O ritmo vem ANTES da fila, e a ordem importa.

        A fila diz "estas cenas ficaram para trás"; o ritmo diz "e por isso o
        filme não cabe mais nos dias que sobraram". Uma é a lista de tarefas, a
        outra é a consequência — e é a consequência que faz alguém marcar mais
        um dia enquanto ainda dá tempo.
      */}
      <AvisoDeRitmo projetoId={projetoId} />

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
                    {/* O evento entra na semana à frente porque é justamente
                        aqui que ele importa: visita de locação marcada para
                        quinta só serve se aparecer antes de quinta. */}
                    {d.eventos.map(e => {
                      const t = tipoDoEvento(e.tipo);
                      return (
                        <div
                          key={e.id}
                          title={`${t.nome}: ${e.titulo}${e.hora_inicio ? ` · ${e.hora_inicio}` : ''}`}
                          style={{
                            fontSize: '10px', backgroundColor: 'var(--bg-surface)',
                            borderLeft: `3px solid ${t.cor}`, padding: '2px 5px',
                            borderRadius: '4px', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                        >
                          {t.emoji} {e.hora_inicio || e.titulo}
                        </div>
                      );
                    })}
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
                    <Numero valor={saldoAtual} moeda />
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '4px', color: isEstourado ? 'var(--color-danger)' : 'var(--text-secondary)' }}>Total Gasto</span>
                  <span className="text-lg font-bold" style={{ color: isEstourado ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                    <Numero valor={totalGasto} moeda />
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* O QUE ESTÁ PEGANDO FOGO */}
          <div
            className="card"
            style={{
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
              // A borda vermelha é o alarme do painel inteiro: dá para ver que
              // há atraso sem ler uma linha, de longe, com o celular na mão.
              borderLeft: atrasadas.length > 0 ? '3px solid var(--color-danger)' : undefined,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {atrasadas.length > 0
                  ? <><AlertTriangle size={14} style={{ color: 'var(--color-danger)' }} /> O que está atrasado</>
                  : <><CheckSquare size={14} /> Tarefas pendentes</>}
              </span>
              <button onClick={() => navigate('tasks')} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                Ver todas
              </button>
            </div>

            {/* O resumo em uma linha, para quem só passa o olho. Cada número só
                existe quando é maior que zero: "0 atrasadas" ocupa espaço para
                dizer que não há nada a dizer. */}
            {(atrasadas.length > 0 || paraHoje.length > 0) && (
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {atrasadas.length > 0 && (
                  <span className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>
                    {atrasadas.length} {atrasadas.length === 1 ? 'atrasada' : 'atrasadas'}
                  </span>
                )}
                {paraHoje.length > 0 && (
                  <span className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
                    {paraHoje.length} {paraHoje.length === 1 ? 'vence hoje' : 'vencem hoje'}
                  </span>
                )}
              </div>
            )}

            {urgentes.length === 0 ? (
              <div className="text-sm text-secondary" style={{ textAlign: 'center', padding: '16px' }}>
                Nenhuma tarefa pendente no momento.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {urgentes.map(({ task, urgencia }) => {
                  const grave = urgencia.nivel === 'atrasada' || urgencia.nivel === 'hoje';
                  return (
                    <button
                      key={task.id}
                      onClick={() => navigate('tasks')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                        backgroundColor: grave ? `color-mix(in srgb, ${urgencia.cor} 10%, var(--bg-primary))` : 'var(--bg-primary)',
                        borderRadius: '12px', textAlign: 'left', cursor: 'pointer', width: '100%',
                        border: `1px solid ${grave ? urgencia.cor : 'var(--border-light)'}`,
                      }}
                    >
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, backgroundColor: urgencia.rotulo ? urgencia.cor : task.status === 'doing' ? 'var(--accent)' : 'var(--text-muted)' }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                        {/* A etiqueta vem ANTES do título, e não depois: quando
                            a lista tem cinco linhas, é ela que decide qual das
                            cinco a pessoa lê primeiro. */}
                        {urgencia.rotulo && (
                          <span className="text-xs font-bold" style={{ color: urgencia.cor, letterSpacing: '0.04em' }}>
                            {urgencia.rotulo}
                          </span>
                        )}
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{task.titulo}</span>
                        {task.descricao && (
                          <span className="text-xs text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {task.descricao}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {pendentes.length > urgentes.length && (
                  <div className="text-xs text-muted" style={{ textAlign: 'center', paddingTop: '2px' }}>
                    e mais {pendentes.length - urgentes.length} pendente{pendentes.length - urgentes.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
