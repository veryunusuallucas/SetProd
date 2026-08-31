import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, GripVertical, Trash2, Plus, Lock, Unlock, Utensils, Truck,
  Flag, StickyNote, CircleDot, Timer,
} from 'lucide-react';
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
  almoco: Utensils,
  move: Truck,
  nota: StickyNote,
};

const NOVOS: { tipo: Exclude<TipoItemDia, 'cena'>; rotulo: string; titulo: string }[] = [
  { tipo: 'marco', rotulo: 'Marco', titulo: 'Chamada geral' },
  { tipo: 'almoco', rotulo: 'Refeição', titulo: 'Almoço' },
  { tipo: 'move', rotulo: 'Deslocamento', titulo: 'Company move' },
  { tipo: 'nota', rotulo: 'Nota', titulo: '' },
];

export function LinhaDoDia({
  diaria, visao, cenas, registros, meuPerfilId, podeMarcar, planosPorCena,
  chamada, aoGravar, aoMudarChamada,
}: {
  diaria: Diaria;
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
  const [modo, setModo] = useState<'criacao' | 'interativo'>('criacao');
  const [arrastando, setArrastando] = useState<number | null>(null);
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

  const emAtraso = atraso.marcados > 0 && Math.abs(atraso.minutos) >= 5;

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

        {/*
          O seletor de modo não grava nada, e é de propósito.

          O modo é sobre quem está olhando — a produção montando o dia na
          véspera, ou o AD marcando o dia acontecendo. Guardá-lo na diária faria
          uma pessoa mudar a tela da outra do outro lado do set.
        */}
        <div style={{ display: 'flex', gap: '2px', padding: '2px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
          {(['criacao', 'interativo'] as const).map(m => (
            <button
              key={m}
              onClick={() => setModo(m)}
              className="text-xs font-bold"
              style={{
                padding: '5px 14px', borderRadius: 'var(--radius-full)', border: 'none', cursor: 'pointer',
                backgroundColor: modo === m ? 'var(--accent)' : 'transparent',
                color: modo === m ? '#000' : 'var(--text-secondary)',
              }}
              title={m === 'criacao' ? 'Montar o dia' : 'Marcar o dia acontecendo'}
            >
              {m === 'criacao' ? 'Montar' : 'No set'}
            </button>
          ))}
        </div>
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
                draggable={modo === 'criacao'}
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
                      <input
                        defaultValue={c.item.titulo || ''}
                        onBlur={e => {
                          if ((c.item.titulo || '') !== e.target.value) mudarItem(c.item.id, { titulo: e.target.value });
                        }}
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
                style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
              >
                {NOVOS.map(n => {
                  const I = ICONE[n.tipo];
                  return (
                    <button
                      key={n.tipo}
                      onClick={() => adicionar(n.tipo, n.titulo)}
                      className="text-xs font-bold"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: 'var(--radius-full)', cursor: 'pointer', border: `1px solid ${COR_TIPO[n.tipo]}`, backgroundColor: 'transparent', color: COR_TIPO[n.tipo] }}
                    >
                      <I size={13} /> {n.rotulo}
                    </button>
                  );
                })}
                <button onClick={() => setAdicionando(false)} className="text-xs text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '7px 8px' }}>
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

/** As mesmas cores de status do resto do app: cor diz *como as coisas estão*. */
function corDoStatus(status: string): string {
  if (status === 'gravada') return 'var(--color-success)';
  if (status === 'parcial') return 'var(--color-warning)';
  if (status === 'nao_gravada') return 'var(--color-danger)';
  return 'var(--text-muted)';
}
