import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, GripVertical, Trash2, Plus, Lock, Unlock, Utensils, Truck,
  Flag, StickyNote, CircleDot, Timer, ClipboardList, Lightbulb, Drama, Brush,
  Coffee, PackageOpen,
} from 'lucide-react';
import { db } from '../db/db';
import type { Cena, Diaria, ItemDoDia, TipoItemDia, RegistroCena } from '../types';
import {
  montarLinhaDoDia, calcularDia, calcularAtraso, descreverAtraso,
  duracaoDoItem, COR_TIPO, emHora, type VisaoDoDia,
} from '../lib/linhaDoDia';
import { getStripboardColor } from '../lib/decupagem';
import { formatarDuracao } from '../lib/stripboard';
import { registroDe, proximoStatus, marcarCena, limparMarcacao, ROTULO } from '../lib/registroSet';
import { faiscar } from './ui/Faisca';
import { MOLA, useMovimentoReduzido } from './ui/movimento';
import { CampoTexto } from './ui/CampoTexto';

/**
 * A Timeline Única — o protagonista da tela da diária.
 *
 * O dia inteiro numa lista só: chamada, cenas, refeições, deslocamentos e wrap,
 * cada um com o seu horário. Antes isto eram duas caixas ("Horários" e "Cenas
 * Programadas") que não se falavam, e as cenas nem horário tinham.
 *
 * DOIS MODOS, UMA LISTA
 * `criacao` monta o dia; `interativo` marca o dia acontecendo. É a mesma lista
 * nos dois — de propósito. Uma tela de execução separada obrigaria a equipe a
 * procurar em outro lugar a mesma cena que acabou de ler, e no set ninguém
 * procura: escreve no papel.
 */

const ICONE: Record<TipoItemDia, typeof Flag> = {
  cena: CircleDot,
  marco: Flag,
  prelight: Lightbulb,
  ensaio: Drama,
  preparacao: Brush,
  almoco: Utensils,
  coffee: Coffee,
  move: Truck,
  wrap: PackageOpen,
  nota: StickyNote,
};

/**
 * O menu do "+", agrupado.
 *
 * Nove opções numa fileira só viram uma parede de botões, e a pessoa lê todos
 * para achar um. Em três grupos — o que prepara, o que pausa, o que registra —
 * ela vai direto ao terço certo. O `titulo` é o texto que já entra escrito:
 * item novo em branco obriga a digitar o óbvio toda vez.
 */
const GRUPOS_NOVOS: { grupo: string; itens: { tipo: Exclude<TipoItemDia, 'cena'>; rotulo: string; titulo: string }[] }[] = [
  {
    grupo: 'Preparação',
    itens: [
      { tipo: 'prelight', rotulo: 'Pré-light', titulo: 'Pré-light' },
      { tipo: 'preparacao', rotulo: 'Maquiagem e figurino', titulo: 'Maquiagem e figurino' },
      { tipo: 'ensaio', rotulo: 'Ensaio', titulo: 'Ensaio com elenco' },
    ],
  },
  {
    grupo: 'Pausas e trajetos',
    itens: [
      { tipo: 'almoco', rotulo: 'Refeição', titulo: 'Almoço' },
      { tipo: 'coffee', rotulo: 'Coffee break', titulo: 'Coffee break' },
      { tipo: 'move', rotulo: 'Deslocamento', titulo: 'Company move' },
    ],
  },
  {
    grupo: 'Marcos do dia',
    itens: [
      { tipo: 'marco', rotulo: 'Marco', titulo: 'Chamada geral' },
      { tipo: 'wrap', rotulo: 'Desprodução', titulo: 'Wrap / desprodução' },
      { tipo: 'nota', rotulo: 'Nota', titulo: '' },
    ],
  },
];

export function LinhaDoDia({
  diaria, visao, cenas, registros, meuPerfilId, podeMarcar, planosPorCena,
  chamada, aoGravar, aoMudarChamada, modo, travada = false,
}: {
  /**
   * Diária TRAVADA: o plano está congelado esperando publicação.
   *
   * Os campos e botões daqui já são desligados de fora, por um `fieldset
   * disabled` (ver `DiariaModule`). O que o fieldset não alcança é o arrastar,
   * que não é controle de formulário — e reordenar o dia numa diária travada é
   * justamente o tipo de mudança acidental que travar existe para impedir.
   */
  travada?: boolean;
  diaria: Diaria;
  /**
   * ⚠️ VEM DE FORA, E NÃO É UM SELETOR NA TELA.
   *
   * A primeira versão tinha um botão "Montar / No set" que cada pessoa
   * escolhia. Funcionava e estava errado: dois AD podiam olhar a mesma diária
   * em modos diferentes sem saber. O modo é do DIA, não de quem está olhando —
   * ele vira interativo quando a OD é exportada. Ver `lib/faseDoDia.ts`.
   */
  modo: 'criacao' | 'interativo';
  /**
   * De onde sai a linha. Normalmente a própria diária; quando o dia está
   * dividido, a frente que está na aba aberta.
   */
  visao: VisaoDoDia;
  cenas: Cena[];
  registros: RegistroCena[];
  meuPerfilId?: string;
  podeMarcar: boolean;
  planosPorCena: Map<string, unknown[]>;
  chamada?: string;
  /**
   * Quem grava é quem chamou.
   *
   * O componente não sabe (nem deve saber) se está mexendo na diária ou numa
   * frente dentro dela — a decisão de ONDE guardar é de quem montou a tela. Sem
   * isso, cada nova forma de dividir o dia obrigaria a mexer aqui dentro.
   */
  aoGravar: (linha: ItemDoDia[]) => void;
  aoMudarChamada: (hora: string) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const [arrastando, setArrastando] = useState<number | null>(null);
  /** Qual cena está com o painel de cobertura aberto. */
  const [cobertura, setCobertura] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  const linha = montarLinhaDoDia(visao);
  const porId = new Map(cenas.map(c => [c.id, c]));
  const dia = calcularDia(linha, chamada, id => porId.get(id));
  const atraso = calcularAtraso(dia);

  /**
   * Grava a linha inteira.
   *
   * Sempre a lista toda, nunca um item avulso: os horários são encadeados, e
   * mexer num item muda o horário mostrado de todos os seguintes. Gravar em
   * pedaços deixaria a linha meio recalculada em qualquer interrupção.
   */
  const gravar = (nova: ItemDoDia[]) => aoGravar(nova);

  const mudarItem = (id: string, campos: Partial<ItemDoDia>) =>
    gravar(linha.map(i => (i.id === id ? { ...i, ...campos } : i)));

  const remover = (id: string) => gravar(linha.filter(i => i.id !== id));

  const adicionar = (tipo: Exclude<TipoItemDia, 'cena'>, titulo: string) => {
    setAdicionando(false);
    gravar([...linha, { id: crypto.randomUUID(), tipo, titulo }]);
  };

  const soltar = (destino: number) => {
    setAlvo(null);
    if (arrastando === null || arrastando === destino) { setArrastando(null); return; }
    const nova = [...linha];
    const [movido] = nova.splice(arrastando, 1);
    nova.splice(destino, 0, movido);
    setArrastando(null);
    gravar(nova);
  };

  /**
   * Trava ou destrava o horário de um item.
   *
   * Destravar não apaga o horário: devolve o item ao encadeamento, e ele passa
   * a mostrar o horário calculado. Travar de novo congela o que estiver na tela
   * naquele instante — que é o que a pessoa está vendo e concordando.
   */
  const alternarTrava = (c: (typeof dia.itens)[number]) =>
    mudarItem(c.item.id, { hora_travada: c.travado ? undefined : c.hora });

  const marcarAgora = (item: ItemDoDia) => {
    const agora = new Date();
    mudarItem(item.id, {
      hora_real: item.hora_real
        ? undefined
        : emHora(agora.getHours() * 60 + agora.getMinutes()),
    });
  };

  const alternarStatus = async (cenaId: string, e: React.MouseEvent) => {
    const atual = registroDe(registros, diaria.id, cenaId);
    const proximo = proximoStatus(atual?.status);
    if (proximo === 'gravada') faiscar(e);
    if (!proximo) { await limparMarcacao(diaria.id, cenaId); return; }
    await marcarCena(diaria.projeto_id, diaria.id, cenaId, proximo, {
      registrado_por: meuPerfilId || undefined,
    });
  };

  /*
    O aviso de atraso aqui só existe enquanto NÃO há o relógio do set em cima.

    Os dois dizem a mesma coisa, e ver "45min de atraso" duas vezes na mesma
    tela não informa o dobro — faz a pessoa procurar a diferença entre eles. No
    modo de registro quem manda é o relógio, que é grande e fica no topo.
  */
  const emAtraso = modo === 'criacao' && atraso.marcados > 0 && Math.abs(atraso.minutos) >= 5;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ---- Cabeçalho: chamada, wrap e o radar de atraso ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2
          className="text-sm font-bold uppercase tracking-widest text-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}
        >
          <Clock size={16} /> Linha do Dia
        </h2>

        {/* Um rótulo, não um botão: a fase é consequência da exportação. */}
        <span
          className="text-xs font-bold"
          style={{
            padding: '4px 12px', borderRadius: 'var(--radius-full)',
            border: `1px solid ${modo === 'interativo' ? 'var(--accent)' : 'var(--border-light)'}`,
            color: modo === 'interativo' ? 'var(--accent)' : 'var(--text-muted)',
          }}
          title={modo === 'criacao'
            ? 'A OD ainda não saiu — o plano está livre'
            : 'A OD foi exportada. Aqui se registra o que acontece, não se muda o plano'}
        >
          {modo === 'criacao' ? 'montando o dia' : 'registrando o dia'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">Chamada</div>
          <input
            type="time"
            value={chamada || ''}
            onChange={e => aoMudarChamada(e.target.value)}
            style={{ padding: '4px 0', width: '104px', fontSize: '20px', fontWeight: 'bold', backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', borderRadius: 0, color: 'var(--accent)' }}
          />
        </div>
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">Wrap previsto</div>
          <div className="font-bold" style={{ fontSize: '20px', color: emAtraso && atraso.minutos > 0 ? 'var(--color-warning)' : 'var(--text-primary)' }}>
            {atraso.wrapPrevisto || '—'}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">Duração</div>
          <div className="font-bold" style={{ fontSize: '20px' }}>{formatarDuracao(dia.duracaoTotal)}</div>
        </div>

        {/*
          O radar da §5.1 só aparece quando há o que dizer. Um "no horário"
          permanente vira ruído, e quando o dia atrasa de verdade ninguém repara
          que o texto mudou.
        */}
        {emAtraso && (
          <motion.div
            initial={reduzido ? undefined : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={MOLA}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
              borderRadius: 'var(--radius-md)', marginLeft: 'auto',
              backgroundColor: atraso.minutos > 0 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
              color: atraso.minutos > 0 ? 'var(--color-warning)' : 'var(--color-success)',
            }}
          >
            <Timer size={16} />
            <div>
              <div className="text-sm font-bold">O dia está {descreverAtraso(atraso.minutos)}</div>
              <div className="text-xs" style={{ opacity: 0.8 }}>
                Wrap agora às {atraso.wrapPrevisto} — planejado {atraso.wrapPlanejado}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ---- A linha ---- */}
      {dia.itens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 12px' }}>
          <div className="text-sm text-secondary font-bold">O dia ainda não tem nada.</div>
          <div className="text-xs text-muted" style={{ marginTop: '6px', lineHeight: 1.6, maxWidth: '340px', margin: '6px auto 0' }}>
            Envie um dia do Stripboard para trazer as cenas já em ordem e com estimativa,
            ou monte à mão começando pela chamada.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {dia.itens.map((c, i) => {
            const Icone = ICONE[c.item.tipo];
            const cor = c.item.tipo === 'cena' ? 'var(--accent)' : COR_TIPO[c.item.tipo];
            const registro = c.cena ? registroDe(registros, diaria.id, c.cena.id) : undefined;
            const tira = c.cena ? getStripboardColor(c.cena.ambiente, c.cena.periodo) : null;
            const planos = c.cena ? (planosPorCena.get(c.cena.id) || []).length : 0;

            return (
              <div
                key={c.item.id}
                draggable={modo === 'criacao' && !travada}
                onDragStart={() => setArrastando(i)}
                onDragOver={e => { e.preventDefault(); setAlvo(i); }}
                onDragLeave={() => setAlvo(a => (a === i ? null : a))}
                onDrop={() => soltar(i)}
                onDragEnd={() => { setArrastando(null); setAlvo(null); }}
                style={{
                  display: 'flex', gap: '12px', alignItems: 'stretch',
                  opacity: arrastando === i ? 0.4 : 1,
                  borderTop: alvo === i && arrastando !== null && arrastando !== i
                    ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                {/* Coluna do horário + o fio que liga os itens. É o fio que faz
                    a lista parecer um dia, e não um monte de linhas. */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '62px', flexShrink: 0 }}>
                  <button
                    onClick={() => alternarTrava(c)}
                    title={c.travado ? 'Horário travado à mão — toque para voltar ao calculado' : 'Horário calculado — toque para travar'}
                    className="font-bold"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '3px', padding: '6px 0',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px',
                      color: c.travado ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >
                    {c.hora}
                    {c.travado ? <Lock size={10} /> : <Unlock size={10} style={{ opacity: 0.35 }} />}
                  </button>
                  {i < dia.itens.length - 1 && (
                    <div style={{ flex: 1, width: '2px', backgroundColor: 'var(--border-light)', minHeight: '12px' }} />
                  )}
                </div>

                {/* O corpo do item */}
                <div
                  style={{
                    flex: 1, minWidth: 0, marginBottom: '8px', padding: '10px 12px',
                    borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)', borderLeft: `3px solid ${cor}`,
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                  }}
                >
                  {modo === 'criacao' && (
                    <GripVertical size={14} className="text-muted" style={{ cursor: 'grab', flexShrink: 0 }} />
                  )}
                  <Icone size={15} style={{ color: cor, flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: '140px' }}>
                    {c.cena ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className="font-bold">Cena {c.cena.numero}</span>
                          {tira && (
                            <span
                              className="text-xs font-bold"
                              style={{ padding: '1px 7px', borderRadius: 'var(--radius-full)', backgroundColor: tira.bg, color: tira.text }}
                            >
                              {tira.label}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.cena.descricao}
                          {planos > 0 && <span className="text-xs text-muted"> · {planos} plano{planos > 1 ? 's' : ''}</span>}
                        </div>
                      </>
                    ) : modo === 'criacao' ? (
                      /*
                        Era `defaultValue` + `onBlur`, que só gravava ao sair do
                        campo — quem escrevia o título e clicava direto na
                        lixeira de outro item perdia o que digitou. O
                        `CampoTexto` grava sozinho depois da pausa, e continua
                        gravando ao sair.
                      */
                      <CampoTexto
                        value={c.item.titulo || ''}
                        aoGravar={v => mudarItem(c.item.id, { titulo: v })}
                        placeholder="Ex: Chamada geral, Almoço, Wrap"
                        style={{ width: '100%', padding: '4px 0', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-light)', borderRadius: 0, fontWeight: 'bold' }}
                      />
                    ) : (
                      <span className="font-bold">{c.item.titulo || '—'}</span>
                    )}
                  </div>

                  {/* Duração. Marco e nota não consomem tempo por padrão, e
                      mostrar "0min" neles seria ruído; mas dá para dar duração
                      a qualquer um, porque uma nota pode ser uma pausa. */}
                  {modo === 'criacao' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} title="Quanto tempo este item consome do dia">
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={duracaoDoItem(c.item, c.cena)}
                        onChange={e => mudarItem(c.item.id, { duracao_min: Math.max(0, Number(e.target.value) || 0) })}
                        style={{ width: '64px', padding: '4px 6px', fontSize: '13px', textAlign: 'right', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px' }}
                      />
                      <span className="text-xs text-muted">min</span>
                    </label>
                  ) : (
                    c.duracao > 0 && <span className="text-xs text-muted" style={{ flexShrink: 0 }}>{formatarDuracao(c.duracao)}</span>
                  )}

                  {/* ---- Modo no set ---- */}
                  {modo === 'interativo' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => marcarAgora(c.item)}
                        disabled={!podeMarcar}
                        className="text-xs font-bold"
                        style={{
                          padding: '5px 10px', borderRadius: 'var(--radius-full)', cursor: podeMarcar ? 'pointer' : 'not-allowed',
                          border: `1px solid ${c.item.hora_real ? 'var(--accent)' : 'var(--border-light)'}`,
                          backgroundColor: c.item.hora_real ? 'var(--accent)' : 'transparent',
                          color: c.item.hora_real ? '#000' : 'var(--text-secondary)',
                          opacity: podeMarcar ? 1 : 0.5,
                        }}
                        title={
                          !podeMarcar ? 'Só AD e produção marcam o dia'
                            : c.item.hora_real ? 'Toque para apagar a hora real'
                            : 'Começou agora'
                        }
                      >
                        {c.item.hora_real ? `real ${c.item.hora_real}` : 'começou'}
                      </button>

                      {c.cena && registro && (
                        <button
                          onClick={() => setCobertura(a => (a === c.cena!.id ? null : c.cena!.id))}
                          className="text-xs"
                          style={{
                            padding: '5px 9px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                            border: '1px solid var(--border-light)', background: 'transparent',
                            color: coberturaPreenchida(registro) ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                          title="Páginas, setups e o que exatamente saiu da cena"
                        >
                          <ClipboardList size={12} />
                        </button>
                      )}

                      {c.cena && (
                        <button
                          onClick={e => podeMarcar && alternarStatus(c.cena!.id, e)}
                          disabled={!podeMarcar}
                          className="text-xs font-bold"
                          style={{
                            padding: '5px 10px', borderRadius: 'var(--radius-full)',
                            cursor: podeMarcar ? 'pointer' : 'not-allowed',
                            border: '1px solid var(--border-light)',
                            backgroundColor: registro ? corDoStatus(registro.status) : 'transparent',
                            color: registro ? '#000' : 'var(--text-muted)',
                            opacity: podeMarcar ? 1 : 0.5,
                          }}
                          title={podeMarcar ? 'Toque para mudar o status da cena' : 'Só AD e produção marcam o dia'}
                        >
                          {registro ? ROTULO[registro.status] : 'marcar'}
                        </button>
                      )}
                    </div>
                  )}

                  {/*
                    A COBERTURA: o que exatamente saiu da cena (spec §3.1).

                    Fica escondida atrás de um toque porque é o campo mais
                    detalhado do dia e o menos urgente: no meio da correria
                    marca-se "gravada"; os oitavos e os setups entram na virada,
                    ou no fim do dia. Deixá-la sempre aberta encheria a linha de
                    caixinhas vazias e faria a marcação rápida ficar mais lenta.
                  */}
                  {modo === 'interativo' && c.cena && registro && cobertura === c.cena.id && (
                    <div style={{ flexBasis: '100%', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', paddingTop: '10px', marginTop: '4px', borderTop: '1px dashed var(--border-light)' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '104px' }}>
                        <span className="text-xs text-muted uppercase">Oitavos</span>
                        <input
                          type="number"
                          min={0}
                          value={registro.oitavos_gravados ?? ''}
                          onChange={e => podeMarcar && db.registros_cena.update(registro.id, {
                            oitavos_gravados: e.target.value === '' ? undefined : Number(e.target.value),
                          })}
                          disabled={!podeMarcar}
                          placeholder="—"
                          style={campoCobertura}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '90px' }}>
                        <span className="text-xs text-muted uppercase">Setups</span>
                        <input
                          type="number"
                          min={0}
                          value={registro.setups ?? ''}
                          onChange={e => podeMarcar && db.registros_cena.update(registro.id, {
                            setups: e.target.value === '' ? undefined : Number(e.target.value),
                          })}
                          disabled={!podeMarcar}
                          placeholder="—"
                          style={campoCobertura}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '200px' }}>
                        <span className="text-xs text-muted uppercase">O que saiu</span>
                        <input
                          defaultValue={registro.cobertura || ''}
                          onBlur={e => podeMarcar && (registro.cobertura || '') !== e.target.value && db.registros_cena.update(registro.id, {
                            cobertura: e.target.value || undefined,
                          })}
                          disabled={!podeMarcar}
                          placeholder="Ex: só a primeira metade da cena, do plano 3 em diante"
                          style={campoCobertura}
                        />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '6px', cursor: podeMarcar ? 'pointer' : 'default' }}>
                        <input
                          type="checkbox"
                          checked={Boolean(registro.som_wild)}
                          onChange={e => podeMarcar && db.registros_cena.update(registro.id, { som_wild: e.target.checked || undefined })}
                          disabled={!podeMarcar}
                        />
                        <span className="text-xs text-secondary">som wild</span>
                      </label>
                    </div>
                  )}

                  {/* Cena não se apaga daqui: quem escala é o Stripboard e a
                      Shot List, e um botão de lixeira aqui apagaria a cena do
                      dia sem que a pessoa soubesse que mexeu na escalação. */}
                  {modo === 'criacao' && !c.cena && (
                    <button
                      onClick={() => remover(c.item.id)}
                      className="btn-icon text-muted"
                      style={{ padding: '6px', border: 'none', background: 'transparent', flexShrink: 0 }}
                      title="Tirar do dia"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Acrescentar ---- */}
      {modo === 'criacao' && (
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {adicionando ? (
              <motion.div
                key="opcoes"
                initial={reduzido ? undefined : { opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduzido ? undefined : { opacity: 0 }}
                transition={MOLA}
                style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
              >
                {GRUPOS_NOVOS.map(g => (
                  <div key={g.grupo} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="text-xs text-muted uppercase tracking-widest" style={{ width: '110px', flexShrink: 0 }}>
                      {g.grupo}
                    </span>
                    {g.itens.map(n => {
                      const I = ICONE[n.tipo];
                      return (
                        <button
                          key={n.tipo}
                          onClick={() => adicionar(n.tipo, n.titulo)}
                          className="text-xs font-bold"
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: 'var(--radius-full)', cursor: 'pointer', border: `1px solid ${COR_TIPO[n.tipo]}`, backgroundColor: `color-mix(in srgb, ${COR_TIPO[n.tipo]} 10%, transparent)`, color: COR_TIPO[n.tipo] }}
                        >
                          <I size={13} /> {n.rotulo}
                        </button>
                      );
                    })}
                  </div>
                ))}
                <button onClick={() => setAdicionando(false)} className="text-xs text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', alignSelf: 'flex-start' }}>
                  cancelar
                </button>
              </motion.div>
            ) : (
              <motion.button
                key="abrir"
                initial={reduzido ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduzido ? undefined : { opacity: 0 }}
                onClick={() => setAdicionando(true)}
                className="btn-secondary text-xs"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Acrescentar ao dia
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      )}

      {/*
        A régua de leitura. Fica no rodapé porque quem já entendeu a tela não
        precisa dela, e quem chegou agora precisa — e no rodapé ela não empurra
        o dia para baixo.
      */}
      <div className="text-xs text-muted" style={{ lineHeight: 1.6, borderTop: '1px solid var(--border-light)', paddingTop: '10px' }}>
        Os horários são encadeados a partir da chamada. Toque num horário para{' '}
        <b>travá-lo</b> — daí em diante a conta recomeça dele, e o resto do dia
        se ajusta sozinho.
      </div>
    </div>
  );
}

const campoCobertura: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px',
  border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)',
};

/** O ícone de cobertura acende quando há algo escrito ali dentro. */
function coberturaPreenchida(r: RegistroCena): boolean {
  return r.oitavos_gravados !== undefined || r.setups !== undefined || Boolean(r.cobertura) || Boolean(r.som_wild);
}

/** As mesmas cores de status do resto do app: cor diz *como as coisas estão*. */
function corDoStatus(status: string): string {
  if (status === 'gravada') return 'var(--color-success)';
  if (status === 'parcial') return 'var(--color-warning)';
  if (status === 'nao_gravada') return 'var(--color-danger)';
  return 'var(--text-muted)';
}
