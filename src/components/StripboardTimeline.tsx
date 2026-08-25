import { useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { CalendarPlus, GripVertical, Trash2, Utensils, Truck, StickyNote, Scissors, Shuffle, FileText } from 'lucide-react';
import { db } from '../db/db';
import type { Cena, Locacao, StripboardItem, TipoStripboardItem } from '../types';
import { getStripboardColor } from '../lib/decupagem';
import {
  montarLinha, resumirDias, agruparPorLocacao, cenasDoDia, diaNaPosicao,
  ROTULOS, CORES_MARCADOR, formatarDuracao, ULTIMO_BLOCO, type ItemLinha,
} from '../lib/stripboard';

interface Props {
  projetoId: string;
  cenas: Cena[];
  itens: StripboardItem[];
  locacoes: Locacao[];
  /** Abre a aba Roteiro na página da cena clicada. */
  onVerNoRoteiro: (pagina: number) => void;
  /**
   * Manda as cenas de um dia para uma diária do projeto.
   *
   * `quebraId` é o vínculo duradouro: enquanto a diária estiver em rascunho, ela
   * espelha o bloco daquela quebra. O número do dia serve só para a mensagem —
   * ele é posicional e muda quando alguém insere uma quebra antes.
   */
  onExportarDia: (cenas: Cena[], numeroDoDia: number, quebraId?: string) => void;
  paginaDaCena: (cena: Cena) => number | undefined;
}

export function StripboardTimeline({
  projetoId, cenas, itens, locacoes, onVerNoRoteiro, onExportarDia, paginaDaCena,
}: Props) {
  const [salvando, setSalvando] = useState(false);

  const nomeLocacao = (c: Cena) => locacoes.find(l => l.id === c.locacao_id)?.nome || '';

  const linha = useMemo(() => montarLinha(cenas, itens), [cenas, itens]);
  const resumos = useMemo(() => resumirDias(linha, nomeLocacao), [linha, locacoes]);

  /**
   * Grava a ordem de todos os itens de uma vez.
   *
   * Cenas e marcadores dividem a mesma numeração, então a gravação precisa ser
   * feita junto — atualizar só um dos dois embaralharia a linha inteira.
   */
  const persistirOrdem = async (nova: ItemLinha[]) => {
    setSalvando(true);
    try {
      await db.transaction('rw', db.cenas, db.stripboard_itens, async () => {
        for (let i = 0; i < nova.length; i++) {
          const it = nova[i];
          if (it.tipo === 'SCENE') await db.cenas.update(it.id, { ordem: i });
          else await db.stripboard_itens.update(it.id, { ordem: i });
        }
      });
    } finally {
      setSalvando(false);
    }
  };

  const aoSoltar = async (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const nova = [...linha];
    const [movido] = nova.splice(r.source.index, 1);
    nova.splice(r.destination.index, 0, movido);
    await persistirOrdem(nova);
  };

  /** Insere um marcador no fim da linha; a pessoa arrasta para o lugar certo. */
  const inserir = async (tipo: TipoStripboardItem) => {
    const padrao: Partial<StripboardItem> =
      tipo === 'BANNER_LUNCH' ? { titulo: 'Almoço', duracao_min: 60 }
      : tipo === 'BANNER_MOVE' ? { titulo: 'Mudança de locação', duracao_min: 45 }
      : tipo === 'BANNER_NOTE' ? { titulo: 'Nota' }
      : {};

    await db.stripboard_itens.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      tipo,
      ordem: linha.length,
      ...padrao,
    } as StripboardItem);
  };

  const agrupar = async () => {
    if (!confirm('Reorganizar as cenas juntando as da mesma locação? As quebras de diária ficam onde estão.')) return;
    await persistirOrdem(agruparPorLocacao(linha, nomeLocacao));
  };

  const totalDias = 1 + linha.filter(i => i.tipo === 'DAY_BREAK').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Barra de ferramentas */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => inserir('DAY_BREAK')} className="btn-chip">
          <Scissors size={14} /> Quebra de diária
        </button>
        <button onClick={() => inserir('BANNER_LUNCH')} className="btn-chip">
          <Utensils size={14} /> Almoço
        </button>
        <button onClick={() => inserir('BANNER_MOVE')} className="btn-chip">
          <Truck size={14} /> Mudança de locação
        </button>
        <button onClick={() => inserir('BANNER_NOTE')} className="btn-chip">
          <StickyNote size={14} /> Nota
        </button>
        <button onClick={agrupar} className="btn-chip" disabled={cenas.length < 2}>
          <Shuffle size={14} /> Agrupar por locação
        </button>
        <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
          {totalDias} diária(s) · {cenas.length} cena(s){salvando ? ' · salvando...' : ''}
        </span>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {[['INT', 'dia'], ['EXT', 'dia'], ['INT', 'noite'], ['EXT', 'noite']].map(([a, p]) => {
          const c = getStripboardColor(a, p);
          return (
            <span key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-muted)' }}>
              <span style={{ width: '14px', height: '10px', borderRadius: '2px', backgroundColor: c.bg, border: '1px solid var(--border-light)' }} />
              {c.label}
            </span>
          );
        })}
      </div>

      <DragDropContext onDragEnd={aoSoltar}>
        <Droppable droppableId="stripboard">
          {(area) => (
            <div
              ref={area.innerRef}
              {...area.droppableProps}
              style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
            >
              {linha.map((it, indice) => (
                <Draggable key={it.id} draggableId={it.id} index={indice}>
                  {(arraste, estado) => (
                    <div
                      ref={arraste.innerRef}
                      {...arraste.draggableProps}
                      style={{
                        ...arraste.draggableProps.style,
                        opacity: estado.isDragging ? 0.85 : 1,
                      }}
                    >
                      {it.tipo === 'SCENE' ? (
                        <TiraCena
                          cena={it.cena}
                          locacao={nomeLocacao(it.cena)}
                          alca={arraste.dragHandleProps}
                          onVerNoRoteiro={() => {
                            const p = paginaDaCena(it.cena);
                            if (p) onVerNoRoteiro(p);
                          }}
                        />
                      ) : (
                        <Marcador
                          item={it.item}
                          alca={arraste.dragHandleProps}
                          resumo={it.tipo === 'DAY_BREAK' ? resumos.get(it.id) : undefined}
                          onExportar={() => {
                            const dia = diaNaPosicao(linha, indice);
                            // O id da quebra viaja junto: é ele que amarra a
                            // diária a ESTE bloco. O número do dia é posicional
                            // e muda quando alguém insere uma quebra antes.
                            onExportarDia(cenasDoDia(linha, dia), dia, it.id);
                          }}
                        />
                      )}
                    </div>
                  )}
                </Draggable>
              ))}
              {area.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Rodapé do último dia: sem quebra depois dele, o total ficaria invisível. */}
      {resumos.get('__ultimo__') && (
        <RodapeDia
          resumo={resumos.get('__ultimo__')!}
          onExportar={() => onExportarDia(cenasDoDia(linha, totalDias), totalDias, ULTIMO_BLOCO)}
        />
      )}
    </div>
  );
}

// ---- Tira de cena ----

function TiraCena({ cena, locacao, alca, onVerNoRoteiro }: {
  cena: Cena;
  locacao: string;
  alca: any;
  onVerNoRoteiro: () => void;
}) {
  const strip = getStripboardColor(cena.ambiente, cena.periodo);
  const campo: React.CSSProperties = {
    padding: '4px 6px', fontSize: '12px', borderRadius: '4px',
    border: '1px solid rgba(0,0,0,0.15)', backgroundColor: 'rgba(255,255,255,0.25)',
    color: strip.text, fontWeight: 'bold',
  };

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px',
      backgroundColor: strip.bg, color: strip.text, borderRadius: '4px',
    }}>
      <span {...alca} style={{ cursor: 'grab', display: 'flex', flexShrink: 0, opacity: 0.6 }}>
        <GripVertical size={16} />
      </span>

      <button
        onClick={onVerNoRoteiro}
        title="Ver esta cena no roteiro"
        style={{
          width: '38px', flexShrink: 0, fontWeight: 'bold', background: 'none',
          border: 'none', color: strip.text, cursor: 'pointer', textAlign: 'left',
          textDecoration: 'underline', textDecorationStyle: 'dotted', padding: 0,
        }}
      >
        {cena.numero}
      </button>

      <span style={{ flex: 1, minWidth: 0, fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {cena.descricao}
      </span>
      <span className="desktop-only" style={{ width: '76px', flexShrink: 0, fontSize: '10px', fontWeight: 'bold', opacity: 0.85 }}>
        {strip.label}
      </span>
      <span className="desktop-only" style={{ width: '120px', flexShrink: 0, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {locacao || '—'}
      </span>

      <input
        value={cena.paginas || ''}
        onChange={e => db.cenas.update(cena.id, { paginas: e.target.value })}
        placeholder="1 2/8"
        title="Páginas em oitavos"
        style={{ ...campo, width: '58px', flexShrink: 0 }}
      />
      <select
        value={cena.unidade || 'A'}
        onChange={e => db.cenas.update(cena.id, { unidade: e.target.value as 'A' | 'B' })}
        style={{ ...campo, width: '44px', flexShrink: 0 }}
      >
        <option value="A">A</option>
        <option value="B">B</option>
      </select>
      <input
        value={cena.estimativa || ''}
        onChange={e => db.cenas.update(cena.id, { estimativa: e.target.value })}
        placeholder="45min"
        title="Tempo estimado (45min, 2h, 1h30)"
        style={{ ...campo, width: '66px', flexShrink: 0 }}
      />
    </div>
  );
}

// ---- Quebra de diária e banners ----

function Marcador({ item, alca, resumo, onExportar }: {
  item: StripboardItem;
  alca: any;
  resumo?: import('../lib/stripboard').ResumoDia;
  onExportar: () => void;
}) {
  const cor = CORES_MARCADOR[item.tipo];
  const ehQuebra = item.tipo === 'DAY_BREAK';

  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
      padding: ehQuebra ? '10px 12px' : '7px 12px',
      backgroundColor: cor.bg, color: cor.text, borderRadius: '4px',
      marginTop: ehQuebra ? '10px' : 0,
    }}>
      <span {...alca} style={{ cursor: 'grab', display: 'flex', flexShrink: 0, opacity: 0.6 }}>
        <GripVertical size={16} />
      </span>

      <span style={{ fontWeight: 700, fontSize: ehQuebra ? '13px' : '12px', letterSpacing: '0.04em' }}>
        {ehQuebra ? `FIM DA DIÁRIA ${resumo?.numero ?? ''}` : (item.titulo || ROTULOS[item.tipo]).toUpperCase()}
      </span>

      {/* Síntese do dia que acabou de fechar. */}
      {ehQuebra && resumo && (
        <span style={{ fontSize: '11px', opacity: 0.85 }}>
          {resumo.cenas} cena(s) · {resumo.paginas} páginas · {resumo.duracao}
          {resumo.locacoes.length > 1 && ` · ${resumo.locacoes.length} locações`}
        </span>
      )}

      {!ehQuebra && (
        <>
          <input
            value={item.titulo || ''}
            onChange={e => db.stripboard_itens.update(item.id, { titulo: e.target.value })}
            placeholder={ROTULOS[item.tipo]}
            style={{
              flex: 1, minWidth: '120px', padding: '3px 6px', fontSize: '12px', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.15)', color: cor.text,
            }}
          />
          <input
            type="number"
            value={item.duracao_min ?? ''}
            onChange={e => db.stripboard_itens.update(item.id, { duracao_min: parseInt(e.target.value, 10) || 0 })}
            placeholder="min"
            title="Minutos que este evento consome do dia"
            style={{
              width: '62px', padding: '3px 6px', fontSize: '12px', borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.15)', color: cor.text,
            }}
          />
        </>
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px', alignItems: 'center' }}>
        {ehQuebra && (
          <button
            onClick={onExportar}
            title="Mandar as cenas deste dia para uma Ordem do Dia"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.12)', color: cor.text,
              fontSize: '11px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            <CalendarPlus size={13} /> Virar OD
          </button>
        )}
        <button
          onClick={() => db.stripboard_itens.delete(item.id)}
          title="Remover"
          style={{ background: 'none', border: 'none', color: cor.text, opacity: 0.7, cursor: 'pointer', display: 'flex', padding: '4px' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function RodapeDia({ resumo, onExportar }: {
  resumo: import('../lib/stripboard').ResumoDia;
  onExportar: () => void;
}) {
  return (
    <div style={{
      display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
      padding: '10px 12px', borderRadius: '4px', marginTop: '6px',
      border: '1px dashed var(--border-color)', color: 'var(--text-secondary)',
    }}>
      <FileText size={15} style={{ opacity: 0.6 }} />
      <span style={{ fontWeight: 700, fontSize: '13px' }}>DIÁRIA {resumo.numero} (em aberto)</span>
      <span style={{ fontSize: '11px', opacity: 0.85 }}>
        {resumo.cenas} cena(s) · {resumo.paginas} páginas · {resumo.duracao}
        {resumo.locacoes.length > 1 && ` · ${resumo.locacoes.length} locações`}
      </span>
      <button onClick={onExportar} className="btn-chip" style={{ marginLeft: 'auto' }} disabled={resumo.cenas === 0}>
        <CalendarPlus size={13} /> Virar OD
      </button>
    </div>
  );
}

export { formatarDuracao };
