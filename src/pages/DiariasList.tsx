import { dinheiro } from '../lib/formato';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Plus, ChevronRight, Users, CheckSquare, Edit2, Trash2, X, AlertTriangle } from 'lucide-react';
import type { Diaria } from '../types';
import { logAction } from '../lib/audit';
import { EventosPanel } from '../components/EventosPanel';
import { estadoDa, ROTULO_ESTADO, type EstadoDiaria } from '../lib/sincronizaOD';
import { numeroPrevisto, renumerarPorData } from '../lib/numeracao';

/**
 * Hoje em `YYYY-MM-DD`, montado a partir do relógio local.
 *
 * `toISOString().slice(0,10)` daria o dia em UTC — que no Brasil é o dia
 * seguinte a partir das 21h. Uma diária de hoje apareceria como passada, no fim
 * da lista, justamente na noite em que ela importa.
 */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const corDoEstado = (e: EstadoDiaria) =>
  e === 'fechada' ? 'var(--color-success)'
    : e === 'publicada' ? 'var(--accent)'
    : e === 'travada' ? 'var(--cor-logistica)'
    : 'var(--text-muted)';

export function DiariasList() {
  const { id: projetoId } = useParams();
  const navigate = useNavigate();

  /**
   * As diárias em ordem de DATA, não de número.
   *
   * O número é do plano; a data é do calendário, e é ela que responde a
   * pergunta de quem abre a tela: "qual é o próximo dia?". Numa produção real
   * os dois divergem o tempo todo — a Diária 07 é remarcada para antes da 05, e
   * ordenar por número deixaria o próximo dia no meio da lista.
   *
   * As que já passaram vão para o FIM, da mais recente para a mais antiga.
   * Elas não somem (o histórico importa), mas param de empurrar o que ainda vai
   * acontecer para baixo.
   */
  const diarias = useLiveQuery(
    async () => {
      const arr = await db.diarias.where('projeto_id').equals(projetoId!).toArray();
      const hoje = hojeISO();
      const futuras = arr.filter(d => !d.data || d.data >= hoje).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
      const passadas = arr.filter(d => d.data && d.data < hoje).sort((a, b) => b.data.localeCompare(a.data));
      return [...futuras, ...passadas];
    },
    [projetoId]
  ) || [];

  /** Quantas tarefas cada diária tem, e quantas já foram feitas. */
  const tarefasPorDiaria = useLiveQuery(async () => {
    const todas = await db.diaria_tasks.where('projeto_id').equals(projetoId!).toArray();
    const mapa = new Map<string, { feitas: number; total: number }>();
    for (const t of todas) {
      const atual = mapa.get(t.diaria_id) || { feitas: 0, total: 0 };
      atual.total += 1;
      if (t.status === 'concluido') atual.feitas += 1;
      mapa.set(t.diaria_id, atual);
    }
    return mapa;
  }, [projetoId]) || new Map<string, { feitas: number; total: number }>();

  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  
  const [showForm, setShowForm] = useState(false);
  const [data, setData] = useState('');
  
  const [editModal, setEditModal] = useState<{ open: boolean, diaria: Diaria | null, date: string }>({ open: false, diaria: null, date: '' });
  /** `true` enquanto a exclusão espera confirmação dentro do próprio modal. */
  /** Diárias já publicadas que mudaram de número na última renumeração. */
  const [renumeradas, setRenumeradas] = useState<{ de: number; para: number }[]>([]);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erroAoApagar, setErroAoApagar] = useState<string | null>(null);

  const fecharEdicao = () => {
    setEditModal({ open: false, diaria: null, date: '' });
    setConfirmandoExclusao(false);
    setErroAoApagar(null);
  };

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

  const abrirFormulario = () => {
    setData('');
    setShowForm(true);
  };

  const fecharFormulario = () => {
    setShowForm(false);
    setData('');
  };

  /**
   * Renumera e guarda o que precisa de aviso.
   *
   * Chamado depois de tudo que mexe na ordem: criar, mudar a data, apagar.
   */
  const renumerar = async () => {
    const r = await renumerarPorData(projetoId!);
    if (r.jaCirculavam.length) {
      setRenumeradas(r.jaCirculavam.map(x => ({ de: x.de, para: x.para })));
    }
  };

  const criarDiaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    /*
      Nasce com o número previsto e é renumerada logo em seguida.

      O previsto já é o certo em quase todo caso; a renumeração existe para o
      resto do projeto acompanhar quando o dia novo entra no meio da sequência.
    */
    const nova: Diaria = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      numero: numeroPrevisto(diarias, data),
      data,
      tem_unidade_b: false,
      equipe_escalada: [],
      locacoes_ids: []
    };

    await db.diarias.add(nova);
    await renumerar();
    await logAction(projetoId!, 'criar', 'diaria', nova.id, `Criou uma diária para o dia ${data}`);
    fecharFormulario();
  };

  const salvarEdicao = async () => {
    if (!editModal.diaria) return;
    // Só a data: o número é consequência dela, e mexer nos dois deixaria o app
    // com duas verdades sobre a mesma coisa.
    await db.diarias.update(editModal.diaria.id, { data: editModal.date });
    await renumerar();
    fecharEdicao();
  };

  /**
   * Apaga a diária.
   *
   * ⚠️ A CONFIRMAÇÃO É DA TELA, NÃO O `confirm()` DO NAVEGADOR.
   *
   * O `confirm()` nativo tem um jeito de falhar que ninguém consegue
   * diagnosticar: depois de alguns diálogos seguidos, o navegador oferece
   * "impedir que esta página crie mais caixas de diálogo" — e a partir daí ele
   * devolve `false` na hora, sem mostrar nada. O clique em apagar simplesmente
   * não faz nada, e não há erro em lugar nenhum para explicar.
   *
   * A confirmação aqui dentro também dá espaço para dizer o que vai acontecer
   * com os gastos, que é a pergunta real de quem hesita.
   */
  const excluirDiaria = async () => {
    if (!editModal.diaria) return;
    const diariaId = editModal.diaria.id;
    setApagando(true);
    setErroAoApagar(null);

    try {
      /*
        Os gastos são DESVINCULADOS, não apagados: dinheiro que saiu do caixa
        continua tendo saído, mesmo que o dia tenha sido cancelado. Some o
        vínculo com a diária, fica o lançamento.
      */
      const vinculadas = despesas.filter(d => d.diaria === diariaId || d.diaria_id === diariaId);
      for (const d of vinculadas) {
        await db.despesas.update(d.id, { diaria: undefined, diaria_id: undefined });
      }

      // O que pertence à diária e não faz sentido sem ela. Sem esta limpeza as
      // linhas ficam órfãs no banco, subindo para o servidor para sempre.
      await db.diaria_tasks.where('diaria_id').equals(diariaId).delete();
      await db.registros_cena.where('diaria_id').equals(diariaId).delete();

      await db.diarias.delete(diariaId);
      // Sem isto sobraria um buraco na sequência: apagar a 02 deixaria 01, 03, 04.
      await renumerar();
      await logAction(projetoId!, 'deletar', 'diaria', diariaId, `Excluiu a Diária ${editModal.diaria.numero}`);
      fecharEdicao();
    } catch (e) {
      // Falha ao apagar era invisível: o modal continuava aberto e a diária
      // continuava na lista, sem nada dizendo por quê.
      setErroAoApagar(e instanceof Error ? e.message : 'Não consegui apagar a diária.');
    } finally {
      setApagando(false);
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
          <button
            onClick={() => (showForm ? fecharFormulario() : abrirFormulario())}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
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

      {/*
        As diárias que JÁ TINHAM SAÍDO e mudaram de número.

        A renumeração é silenciosa para rascunho — ninguém viu aqueles números.
        Para uma OD publicada não pode ser: existe um papel na mão da equipe
        dizendo o número antigo, e ele passou a apontar para outro dia.
      */}
      {renumeradas.length > 0 && (
        <div className="card" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', borderLeft: '3px solid var(--color-warning)', backgroundColor: 'var(--color-warning-bg)' }}>
          <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="text-sm font-bold" style={{ color: 'var(--color-warning)' }}>
              {renumeradas.length === 1
                ? 'Uma diária que já tinha saído mudou de número'
                : `${renumeradas.length} diárias que já tinham saído mudaram de número`}
            </div>
            <div className="text-xs text-secondary" style={{ lineHeight: 1.6, marginTop: '4px' }}>
              {renumeradas.map(r => `Diária ${String(r.de).padStart(2, '0')} → ${String(r.para).padStart(2, '0')}`).join(' · ')}.
              <br />
              A equipe está com a OD antiga, que diz o número velho. Reexporte e avise
              — a nova sai com o número certo.
            </div>
          </div>
          <button onClick={() => setRenumeradas([])} className="btn-icon text-muted" style={{ padding: '4px', border: 'none', background: 'transparent' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {aba === 'eventos' && <EventosPanel projetoId={projetoId!} />}

      {aba === 'diarias' && showForm && (
        <>
        <form onSubmit={criarDiaria} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', borderLeft: '4px solid var(--accent)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '170px' }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
              Data da filmagem
            </label>
            <input type="date" required autoFocus value={data} onChange={e => setData(e.target.value)} />
          </div>

          {/*
            O NÚMERO NÃO É MAIS UM CAMPO — é o que a data faz com ele.

            Ele aparece aqui só para a pessoa ver a consequência antes de
            confirmar: escolher uma data no meio do calendário mostra na hora
            que aquele dia vai ser o 05, e que os seguintes andam.
          */}
          <div style={{ minWidth: '150px' }}>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2">Vai ser a</div>
            <div className="font-bold" style={{ fontSize: '22px', color: data ? 'var(--accent)' : 'var(--text-muted)' }}>
              {data ? `Diária ${String(numeroPrevisto(diarias, data)).padStart(2, '0')}` : '—'}
            </div>
          </div>

          {/* Cancelar antes de Adicionar: quem abriu sem querer procura a saída
              primeiro, e ela não pode estar escondida atrás do botão que cria. */}
          <button type="button" onClick={fecharFormulario} className="btn-secondary">Cancelar</button>
          <button type="submit" className="btn-primary" disabled={!data}>Adicionar</button>
        </form>

        {data && diarias.some(d => d.data > data) && (
          <div className="text-xs text-muted" style={{ marginTop: '-16px', lineHeight: 1.5 }}>
            Este dia entra no meio do calendário — as diárias seguintes andam um número.
          </div>
        )}
        </>
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
                  <div className="font-bold text-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    Diária {String(d.numero).padStart(2, '0')}
                    <span
                      className="text-xs font-bold uppercase tracking-widest"
                      style={{ color: corDoEstado(estadoDa(d)) }}
                    >
                      {ROTULO_ESTADO[estadoDa(d)]}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    {formataData(d.data)}
                    {d.data === hojeISO() && <span className="text-accent font-bold"> · é hoje</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Users size={14} /> {d.equipe_escalada?.length || 0} na equipe
                  </div>
                  {/* Era "Tasks (em breve)" desde que a tela nasceu — um lugar
                      reservado para um número que já existia no banco. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <CheckSquare size={14} />
                    {(() => {
                      const t = tarefasPorDiaria.get(d.id);
                      if (!t) return <span className="text-muted">sem checklist</span>;
                      return <>{t.feitas}/{t.total} na checklist</>;
                    })()}
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
                      setConfirmandoExclusao(false);
                      setErroAoApagar(null);
                      setEditModal({ open: true, diaria: d, date: d.data });
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
              <button onClick={fecharEdicao} className="btn-icon"><X size={16} /></button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Data</label>
                <input type="date" value={editModal.date} onChange={e => setEditModal({ ...editModal, date: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }} />
              </div>
              {/* O número não se edita: mude a data e ele segue. Dizer isso aqui
                  evita a busca pelo campo que sumiu. */}
              <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                O número vem da ordem das datas — mudando o dia, ele se ajusta sozinho
                {editModal.date && editModal.date !== editModal.diaria.data
                  ? `. Nesta data, ela passa a ser a Diária ${String(numeroPrevisto(diarias.filter(x => x.id !== editModal.diaria!.id), editModal.date)).padStart(2, '0')}.`
                  : '.'}
              </div>
            </div>

            {erroAoApagar && (
              <div className="text-xs" style={{ color: 'var(--color-danger)', lineHeight: 1.5 }}>{erroAoApagar}</div>
            )}

            {confirmandoExclusao ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-danger)', backgroundColor: 'var(--color-danger-bg)' }}>
                <div className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>
                  Apagar a Diária {String(editModal.diaria.numero).padStart(2, '0')}?
                </div>
                <div className="text-xs text-secondary" style={{ lineHeight: 1.6 }}>
                  Some o dia, a checklist dele e as marcações de cena. Os <b>gastos não
                  são apagados</b> — eles só deixam de estar ligados a esta diária e
                  continuam no financeiro do projeto.
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setConfirmandoExclusao(false)} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>
                    Não apagar
                  </button>
                  <button
                    onClick={excluirDiaria}
                    disabled={apagando}
                    className="btn-primary"
                    style={{ flex: 1, backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}
                  >
                    {apagando ? 'Apagando…' : 'Apagar mesmo'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button onClick={fecharEdicao} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>Cancelar</button>
                <button onClick={salvarEdicao} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
                <button
                  onClick={() => setConfirmandoExclusao(true)}
                  className="btn-primary"
                  style={{ backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}
                  title="Apagar esta diária"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
