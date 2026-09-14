import { dinheiro } from '../lib/formato';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Calendar, Plus, ChevronRight, Users, CheckSquare, Edit2, Trash2, X, AlertTriangle, List, Columns3, Copy } from 'lucide-react';
import type { Diaria } from '../types';
import { logAction } from '../lib/audit';
import { estadoDa, ROTULO_ESTADO, type EstadoDiaria } from '../lib/sincronizaOD';
import { numeroPrevisto, renumerarPorData } from '../lib/numeracao';
import { criarDiaria, dataSugerida } from '../lib/criarDiaria';
import { duplicarDiaria } from '../lib/duplicarDiaria';
import { CampoData } from '../components/ui/CampoData';
import { despesasDaDiaria, totalDaDiaria } from '../lib/despesasDaDiaria';
import { paraData, dataCurta } from '../lib/formato';
import { PlanoDaSemana } from '../components/PlanoDaSemana';

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
   * As diárias NA ORDEM EM QUE ACONTECEM. Só isso.
   *
   * ⚠️ NÃO VOLTE A JOGAR AS PASSADAS PARA O FIM.
   *
   * Era assim: as futuras primeiro, e as que já aconteceram no fim, da mais
   * recente para a mais antiga. A ideia era boa no papel — deixar o próximo dia
   * sempre no topo — e o efeito na tela era outro: numa produção com a Diária
   * 01 no dia 3 e a Diária 02 no dia 26, aberta no dia 8, a lista mostrava a
   * **02 acima da 01**. Uma lista de dias numerados fora da ordem dos números
   * lê como defeito, e nenhum texto na tela explicava a regra.
   *
   * A data continua sendo a chave, e não o número — mas os dois quase nunca
   * divergem, porque `renumerarPorData` reatribui os números pela data a cada
   * criação, edição ou exclusão. O número desempata a diária remarcada para o
   * mesmo dia de outra.
   *
   * Quem procura "onde eu estou" tem a visão Detalhada, que abre
   * centralizada no dia de hoje — essa é a pergunta que ela existe para
   * responder, e responder duas vezes de jeitos diferentes era o problema.
   */
  const diarias = useLiveQuery(
    async () => {
      const arr = await db.diarias.where('projeto_id').equals(projetoId!).toArray();
      // Diária sem data ainda vai para o fim: ela não aconteceu em lugar nenhum
      // da linha do tempo, e chutar um lugar para ela seria inventar um dia.
      return arr.sort((a, b) => {
        if (!a.data && !b.data) return a.numero - b.numero;
        if (!a.data) return 1;
        if (!b.data) return -1;
        return a.data.localeCompare(b.data) || a.numero - b.numero;
      });
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
  /**
   * A data da cópia, enquanto o painel de duplicar está aberto.
   * `null` = painel fechado. É o mesmo desenho da exclusão: a decisão acontece
   * dentro do modal, sem caixa do navegador.
   */
  const [dataDaCopia, setDataDaCopia] = useState<string | null>(null);
  const [duplicando, setDuplicando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const [erroAoApagar, setErroAoApagar] = useState<string | null>(null);

  /** Abre o modal de edição. As duas visões chamam daqui — é um modal só. */
  const abrirEdicao = (d: Diaria) => {
    setConfirmandoExclusao(false);
    setErroAoApagar(null);
    setDataDaCopia(null);
    setEditModal({ open: true, diaria: d, date: d.data });
  };

  const fecharEdicao = () => {
    setEditModal({ open: false, diaria: null, date: '' });
    setConfirmandoExclusao(false);
    setDataDaCopia(null);
    setErroAoApagar(null);
  };

  /*
    DUAS FORMAS DE VER AS MESMAS DIÁRIAS — e não abas de assuntos diferentes.

    Antes eram três abas: "Diárias", "Plano da semana" e "Eventos". As duas
    primeiras mostravam a MESMA coisa em densidades diferentes, e a terceira
    era outro assunto. Pô-las lado a lado sugeria que eram três coisas do mesmo
    tamanho. Eventos virou página própria, e o que sobrou aqui virou o que é:
    um seletor de densidade.

      simplificada — um cartão por dia: número, data, estado, equipe, gasto.
      detalhada    — os dias em colunas, com a linha do dia inteira de cada um.

    A escolha fica lembrada NESTE aparelho. É preferência de quem olha, não dado
    da produção: o AD que vive na detalhada não pode trocar a tela do produtor
    que só quer ver os gastos.
  */
  const [modo, setModoEstado] = useState<'simplificada' | 'detalhada'>(() => {
    try { return localStorage.getItem('setprod:diarias:modo') === 'detalhada' ? 'detalhada' : 'simplificada'; }
    catch { return 'simplificada'; }
  });
  const setModo = (m: 'simplificada' | 'detalhada') => {
    setModoEstado(m);
    try { localStorage.setItem('setprod:diarias:modo', m); } catch { /* modo privado */ }
  };

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

  /*
    A criação mora em `lib/criarDiaria.ts`, e não aqui.

    O stripboard também cria diárias agora, direto do "Virar OD". Duas telas
    criando a mesma coisa por caminhos próprios divergem em uma versão: uma
    esquece de renumerar, a outra esquece o registro de auditoria, e o projeto
    fica com dois tipos de diária conforme onde ela foi feita.
  */
  const criarNovaDiaria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const { renumeracao } = await criarDiaria(projetoId!, data);
    if (renumeracao.jaCirculavam.length) {
      setRenumeradas(renumeracao.jaCirculavam.map(x => ({ de: x.de, para: x.para })));
    }
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
   * Duplica a diária e abre a cópia.
   *
   * Abre a cópia, e não fica na lista: ninguém duplica um dia para deixá-lo
   * igual. O próximo gesto é sempre mexer nela — trocar as cenas, a data da
   * chamada, a locação —, e voltar para a lista obrigaria a procurar o dia que
   * acabou de nascer.
   */
  const confirmarDuplicacao = async () => {
    if (!editModal.diaria || !dataDaCopia) return;
    setDuplicando(true);
    setErroAoApagar(null);
    try {
      const { diaria: copia, renumeracao } = await duplicarDiaria(editModal.diaria.id, dataDaCopia);
      if (renumeracao.jaCirculavam.length) {
        setRenumeradas(renumeracao.jaCirculavam.map(x => ({ de: x.de, para: x.para })));
      }
      fecharEdicao();
      navigate(`/projeto/${projetoId}/diaria/${copia.id}`);
    } catch (e) {
      setErroAoApagar(e instanceof Error ? e.message : 'Não consegui duplicar a diária.');
    } finally {
      setDuplicando(false);
    }
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
      const vinculadas = despesasDaDiaria(despesas, diariaId);
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

  /*
    A data do cartão tem o dia da semana, e não é mais miudinha.

    Ela era `text-xs text-muted` — cinza claro, doze pixels — e num celular de
    432px era a menor coisa da tela, competindo com o número da diária que já
    está gigante ao lado. Só que numa lista de diárias a data é o que se procura,
    e o dia da semana é metade da pergunta: "a 03 é na quinta ou no sábado?".
  */
  const formataData = (d: string) => {
    const dt = paraData(d);
    if (!dt) return '—';
    const semana = dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
    return `${semana}, ${dataCurta(d)}`;
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={24} color="var(--accent)" /> Diárias
          </h1>
          <p className="text-sm text-secondary">Os dias de filmagem e a Ordem do Dia de cada um</p>
        </div>
        <button
          onClick={() => (showForm ? fecharFormulario() : abrirFormulario())}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Criar Diária
        </button>
      </div>

      {diarias.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Como ver as diárias"
          style={{
            display: 'inline-flex', alignSelf: 'flex-start', padding: '4px', gap: '4px',
            backgroundColor: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--border-light)',
          }}
        >
          {([
            { id: 'simplificada' as const, nome: 'Simplificada', icone: List },
            { id: 'detalhada' as const, nome: 'Detalhada', icone: Columns3 },
          ]).map(m => {
            const ativo = modo === m.id;
            const Icone = m.icone;
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={ativo}
                onClick={() => setModo(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '13px',
                  backgroundColor: ativo ? 'var(--bg-active)' : 'transparent',
                  color: ativo ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Icone size={15} style={{ color: ativo ? 'var(--accent)' : 'inherit' }} /> {m.nome}
              </button>
            );
          })}
        </div>
      )}

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

      {showForm && (
        <>
        <form onSubmit={criarNovaDiaria} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', borderLeft: '4px solid var(--accent)', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '170px' }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
              Data da filmagem
            </label>
            <CampoData required autoFocus value={data} onChange={setData} />
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

      {diarias.length === 0 && !showForm && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Nenhuma diária cadastrada. Comece o seu plano de filmagem criando a Diária 01.
        </div>
      )}

      {/*
        A DETALHADA é o antigo "Plano da semana": os dias em colunas, com a
        linha do dia inteira. A SIMPLIFICADA é a lista de cartões.

        `display: none` e não `&&` na simplificada: desmontar a grade a cada
        troca descartaria o estado interno dos cartões e faria a lista piscar na
        volta. Escondida, ela continua montada e reaparece pronta.

        O padrão da Ordem do Dia e a comemoração do wrap saíram daqui para as
        Configurações: são ajustes da produção, e esta tela é sobre os dias.
      */}
      {modo === 'detalhada' && diarias.length > 0 && <PlanoDaSemana projetoId={projetoId!} diarias={diarias} aoEditar={abrirEdicao} />}

      <div style={{ display: modo === 'simplificada' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fill, minmax(min(380px, 100%), 1fr))', gap: '16px' }}>
        {diarias.map(d => {
          const totalDespesas = totalDaDiaria(despesas, d.id);

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
                  <div className="text-base text-secondary font-bold" style={{ marginTop: '3px' }}>
                    {formataData(d.data)}
                    {d.data === hojeISO() && <span className="text-accent"> · é hoje</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px', rowGap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
                      abrirEdicao(d);
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
                <CampoData value={editModal.date} onChange={d => setEditModal({ ...editModal, date: d })} style={{ width: '100%' }} />
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

            {dataDaCopia !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--accent)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Copy size={15} style={{ color: 'var(--accent)' }} />
                  Duplicar a Diária {String(editModal.diaria.numero).padStart(2, '0')}
                </div>

                <div>
                  <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Data da cópia</label>
                  <CampoData value={dataDaCopia} onChange={d => setDataDaCopia(d)} style={{ width: '100%' }} />
                  {dataDaCopia && (
                    <div className="text-xs text-muted" style={{ marginTop: '6px' }}>
                      Vai ser a <b>Diária {String(numeroPrevisto(diarias, dataDaCopia)).padStart(2, '0')}</b>.
                    </div>
                  )}
                </div>

                {/*
                  O que vem e o que não vem, dito ANTES de clicar.

                  A pergunta de quem duplica é "vai vir tudo?", e a resposta
                  honesta é "o plano sim, o registro não". Descobrir depois que a
                  presença não veio parece bug; saber antes é a regra.
                */}
                <div className="text-xs text-secondary" style={{ lineHeight: 1.6 }}>
                  <b>Vem junto:</b> linha do dia, cenas, equipe escalada, locações, transporte,
                  base, horários do elenco e a checklist (toda desmarcada).
                  <br />
                  <b>Não vem:</b> presença, confirmações, cenas gravadas, gastos e a OD
                  publicada — a cópia nasce como <b>rascunho</b>, e solta do stripboard.
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setDataDaCopia(null)} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>
                    Voltar
                  </button>
                  <button
                    onClick={confirmarDuplicacao}
                    disabled={duplicando || !dataDaCopia}
                    className="btn-primary"
                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
                  >
                    <Copy size={14} /> {duplicando ? 'Duplicando…' : 'Duplicar e abrir'}
                  </button>
                </div>
              </div>
            ) : confirmandoExclusao ? (
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
                {/*
                  A data sugerida é o dia seguinte ao ÚLTIMO dia da produção, e
                  não ao dia duplicado. Enfiar a cópia logo depois da original
                  renumeraria todos os dias seguintes — e as ODs que já saíram
                  passariam a dizer o número errado. Quem quer a cópia no meio
                  escolhe a data, e o número aparece antes de confirmar.
                */}
                <button
                  onClick={() => { setConfirmandoExclusao(false); setDataDaCopia(dataSugerida(diarias)); }}
                  className="btn-secondary"
                  style={{ backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Duplicar esta diária"
                  aria-label="Duplicar esta diária"
                >
                  <Copy size={16} />
                </button>
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
