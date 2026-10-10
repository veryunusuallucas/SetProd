import { useState } from 'react';
import { useComportamentoDeJanela } from './ui/Janela';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Archive, X, AlertTriangle, Check, CircleDashed, CircleSlash, Scissors, GripVertical, ListOrdered } from 'lucide-react';
import { oitavosParaPaginas } from '../lib/decupagem';
import { marcarCena, relatorioDoDia, ROTULO, MOTIVOS } from '../lib/registroSet';
import { db } from '../db/db';
import { MOLA } from './ui/ia';
import type { Cena, ItemDoDia, RegistroCena, StatusCena } from '../types';
import { ordemDeGravacao } from '../lib/linhaDoDia';
import { ResumoDaLogagem } from './ResumoDaLogagem';

/**
 * Fechar a diária deixa de ser só arquivar.
 *
 * O nome disto na indústria é Daily Production Report — no Brasil, relatório de
 * produção, preenchido no wrap pelo 1º AD ou pela continuísta. É o documento que
 * fecha o ciclo: o stripboard planeja, a Ordem do Dia manda para o set, e o
 * relatório diz o que de fato saiu. Sem ele o app só sabe planejar.
 *
 * A tela SUGERE a partir do que foi marcado durante o dia e pede confirmação.
 * O que ela não faz é assumir: cena escalada que ninguém marcou aparece
 * destacada, porque "não marcou" e "não gravou" são coisas diferentes — e
 * tratar uma como a outra encheria a fila de repescagem de cena que talvez
 * tenha sido gravada e ninguém anotou.
 */

interface Props {
  numero: number;
  projetoId: string;
  diariaId: string;
  cenas: Cena[];
  registros: RegistroCena[];
  /** A linha do dia planejada — de onde sai a ordem das cenas. */
  itens: ItemDoDia[];
  /** `Diaria.ordem_gravacao`: a ordem em que de fato foi gravado. */
  ordemSalva?: string[];
  meuPerfilId?: string;
  aoFechar: (notas: string) => void;
  aoCancelar: () => void;
}

const ICONE: Record<StatusCena, React.ReactNode> = {
  gravada: <Check size={14} />,
  parcial: <CircleDashed size={14} />,
  nao_gravada: <CircleSlash size={14} />,
  cortada: <Scissors size={14} />,
};

export function FechamentoDiaria({
  numero, projetoId, diariaId, cenas, registros, itens, ordemSalva, meuPerfilId, aoFechar, aoCancelar,
}: Props) {
  // Esc fecha, o fundo para de rolar e o foco volta para o botão que abriu.
  useComportamentoDeJanela(aoCancelar);
  const [notas, setNotas] = useState('');
  const [fechando, setFechando] = useState(false);

  const r = relatorioDoDia(cenas, registros);

  /**
   * O que ficou para trás e ainda não está explicado.
   *
   * ⚠️ SÃO DOIS CAMPOS OBRIGATÓRIOS, E ESTE É O ÚNICO LUGAR DO APP QUE TRANCA
   * UM BOTÃO.
   *
   * A ETIQUETA (chuva, luz, elenco…) é o que o app consegue somar depois:
   * "três dias perdidos por chuva" só existe porque alguém clicou na etiqueta.
   *
   * A FRASE é o que a pessoa vai ler daqui a um mês. "Cena 42 não filmada" não
   * serve para decidir nada; "Cena 42 adiada por problema de iluminação, será
   * filmada amanhã de manhã" decide o dia seguinte inteiro. A etiqueta sozinha
   * diz a categoria e perde o caso.
   *
   * Exigir as duas parece pesado, e é — de propósito. O momento de escrever é
   * agora, no wrap, com o dia fresco. Amanhã ninguém lembra, e a repescagem
   * vira uma lista de dívidas sem explicação.
   */
  const naoExplicadas = [...r.naoGravadas, ...r.parciais].filter(cena => {
    const reg = registros.find(x => x.cena_id === cena.id);
    return !reg?.motivo || !reg?.observacao?.trim();
  });
  const cumprimento = r.oitavosPrevistos > 0
    ? Math.round((r.oitavosGravados / r.oitavosPrevistos) * 100)
    : null;

  /*
    EM QUE ORDEM FOI GRAVADO. O plano diz uma ordem; o set, às vezes, outra —
    na Diária 1 da Canção de Outono a cena 4 entrou antes da 2 por causa do
    tempo. Arrastar aqui grava a ordem real ao lado do plano, sem mexer nele.
    Cena que não saiu (não gravada, cortada) não tem lugar nessa fila.
  */
  const planejados = itens.filter(i => i.tipo === 'cena');
  const statusDa = (cenaId?: string) => registros.find(x => x.cena_id === cenaId)?.status;
  const saiu = (i: ItemDoDia) => statusDa(i.cena_id) !== 'nao_gravada' && statusDa(i.cena_id) !== 'cortada';
  const ordem = ordemDeGravacao(itens, ordemSalva);
  const gravados = ordem.filter(saiu);
  /** "Cena 2 · parte 2" quando a mesma cena foi partida em dois trechos. */
  const rotulo = (i: ItemDoDia) => {
    const cena = cenas.find(c => c.id === i.cena_id);
    const mesmas = planejados.filter(p => p.cena_id === i.cena_id);
    const parte = mesmas.length > 1 ? ` · parte ${mesmas.indexOf(i) + 1}` : '';
    return { titulo: `Cena ${cena?.numero ?? '?'}${i.parte || ''}${parte}`, descricao: cena?.descricao };
  };
  const aoSoltar = async (r: DropResult) => {
    if (!r.destination || r.destination.index === r.source.index) return;
    const nova = [...gravados];
    const [movido] = nova.splice(r.source.index, 1);
    nova.splice(r.destination.index, 0, movido);
    // Quem não saiu vai para o fim, para a lista continuar tendo todo mundo.
    await db.diarias.update(diariaId, { ordem_gravacao: [...nova, ...ordem.filter(i => !saiu(i))].map(i => i.id) });
  };
  const mudouAOrdem = gravados.some((i, n) => planejados.filter(saiu)[n]?.id !== i.id);

  /** Resolve uma cena que ficou sem marcação, ali mesmo. */
  const resolver = async (cenaId: string, status: StatusCena) => {
    await marcarCena(projetoId, diariaId, cenaId, status, { registrado_por: meuPerfilId });
  };

  /** Grava o porquê na marcação que já existe. */
  const definirMotivo = async (cenaId: string, motivo: string) => {
    const atual = registros.find(x => x.cena_id === cenaId);
    if (atual) await db.registros_cena.update(atual.id, { motivo });
  };

  const confirmar = async () => {
    if (naoExplicadas.length > 0) return;
    setFechando(true);
    aoFechar(notas.trim());
  };

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 250, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={aoCancelar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '540px', maxHeight: '88vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '18px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Archive size={20} /> Fechar a Diária {String(numero).padStart(2, '0')}
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: '4px', lineHeight: 1.5 }}>
              Confira o que saiu hoje. O que ficou para trás vai para a fila de
              repescagem e pode ser reencaixado em outro dia.
            </p>
          </div>
          <button className="btn-icon" onClick={aoCancelar} aria-label="Cancelar"><X size={20} /></button>
        </div>

        {/* ---- números do dia ---- */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <Numero rotulo="Gravadas" valor={`${r.gravadas.length}`} />
          <Numero rotulo="Parciais" valor={`${r.parciais.length}`} />
          <Numero rotulo="Não gravadas" valor={`${r.naoGravadas.length}`} />
          <Numero
            rotulo="Páginas"
            valor={`${oitavosParaPaginas(r.oitavosGravados)} / ${oitavosParaPaginas(r.oitavosPrevistos)}`}
          />
          {cumprimento !== null && (
            <Numero
              rotulo="Do previsto"
              valor={`${cumprimento}%`}
              alerta={cumprimento < 80}
            />
          )}
        </div>

        {/*
          As cenas sem marcação vêm PRIMEIRO e destacadas.

          "Ninguém marcou" não é "não gravou". Assumir o segundo encheria a fila
          de repescagem de cena que talvez tenha saído e só não foi anotada — e
          uma fila em que não se confia é uma fila que ninguém olha.
        */}
        {r.semRegistro.length > 0 && (
          <section style={{ marginBottom: '20px', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning, #fbbf24)', background: 'rgba(251,191,36,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-warning, #fbbf24)' }} />
              <span className="text-sm font-bold">
                {r.semRegistro.length === 1
                  ? '1 cena ficou sem marcação'
                  : `${r.semRegistro.length} cenas ficaram sem marcação`}
              </span>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: '12px', lineHeight: 1.5 }}>
              Marque agora — depois ninguém lembra. Se deixar em branco, elas ficam
              como não gravadas, e aí vão pedir a explicação abaixo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {r.semRegistro.map(cena => (
                <div key={cena.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="text-sm" style={{ flex: 1, minWidth: '120px' }}>
                    <strong>Cena {cena.numero}</strong>
                    <span className="text-muted"> · {cena.descricao}</span>
                  </span>
                  {(['gravada', 'parcial', 'nao_gravada'] as StatusCena[]).map(s => (
                    <button
                      key={s}
                      onClick={() => resolver(cena.id, s)}
                      className="text-xs"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '4px 9px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                        border: '1px solid var(--border-light)', background: 'transparent',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {ICONE[s]} {ROTULO[s]}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ---- o que ficou para trás ---- */}
        {(r.naoGravadas.length > 0 || r.parciais.length > 0) && (
          <section style={{ marginBottom: '20px' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginBottom: '10px' }}>
              Vai para a repescagem
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[...r.naoGravadas, ...r.parciais].map(cena => {
                const reg = registros.find(x => x.cena_id === cena.id);
                return (
                  <div
                    key={cena.id}
                    style={{
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-primary)',
                      border: `1px solid ${reg?.motivo && reg?.observacao?.trim() ? 'var(--border-light)' : 'var(--color-danger)'}`,
                    }}
                  >
                    <div className="text-sm" style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{reg && ICONE[reg.status]}</span>
                      <span style={{ flex: 1 }}>
                        <strong>Cena {cena.numero}</strong> · {cena.descricao}
                        {reg?.observacao && <span className="text-muted"> ({reg.observacao})</span>}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>por quê:</span>
                      {MOTIVOS.map(m => {
                        const escolhido = reg?.motivo === m;
                        return (
                          <button
                            key={m}
                            onClick={() => definirMotivo(cena.id, m)}
                            className="text-xs"
                            style={{
                              padding: '3px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                              border: `1px solid ${escolhido ? 'var(--accent)' : 'var(--border-light)'}`,
                              background: escolhido ? 'var(--accent)' : 'transparent',
                              color: escolhido ? '#000' : 'var(--text-secondary)',
                            }}
                          >
                            {m}
                          </button>
                        );
                      })}
                    </div>

                    {/*
                      O texto livre fica ao lado da etiqueta, não no lugar dela —
                      e é obrigatório junto com ela. O placeholder faz metade do
                      trabalho: mostrar uma frase boa é o jeito barato de
                      conseguir outra frase boa, em vez de "atrasou".
                    */}
                    {/*
                      Controlado, e gravando a cada tecla — NÃO no `onBlur`.

                      Este campo destrava o botão de fechar. Com `onBlur`, o
                      botão desabilitado não é focável: clicar nele não tira o
                      foco do input, o texto nunca é gravado, e a pessoa fica
                      batendo num botão morto sem entender por quê. Um campo que
                      controla um botão precisa valer no instante em que é
                      digitado.
                    */}
                    <input
                      value={reg?.observacao || ''}
                      onChange={e => {
                        if (reg) void db.registros_cena.update(reg.id, { observacao: e.target.value || undefined });
                      }}
                      placeholder="Ex: adiada por problema de iluminação, será filmada amanhã de manhã"
                      className="text-xs"
                      style={{
                        width: '100%', marginTop: '8px', padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${reg?.observacao?.trim() ? 'var(--border-light)' : 'var(--color-danger)'}`,
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {gravados.length > 1 && (
          <section style={{ marginBottom: '20px' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ListOrdered size={13} /> Em que ordem foi gravado
            </h3>
            <p className="text-xs text-muted" style={{ marginBottom: '10px', lineHeight: 1.5 }}>
              Arraste se o set mudou a ordem. O plano que saiu na OD continua guardado — o DPR mostra os dois.
            </p>
            <DragDropContext onDragEnd={aoSoltar}>
              <Droppable droppableId="ordem-gravacao">
                {area => (
                  <div ref={area.innerRef} {...area.droppableProps}>
                    {gravados.map((i, n) => {
                      const { titulo, descricao } = rotulo(i);
                      const noPlano = planejados.filter(saiu).indexOf(i) + 1;
                      return (
                        <Draggable key={i.id} draggableId={i.id} index={n}>
                          {(arraste, estado) => (
                            <div
                              ref={arraste.innerRef}
                              {...arraste.draggableProps}
                              {...arraste.dragHandleProps}
                              aria-label={`${titulo}, gravada em ${n + 1}º. Arraste para mudar a ordem.`}
                              style={{
                                ...arraste.draggableProps.style,
                                display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px',
                                padding: '9px 12px', borderRadius: 'var(--radius-md)', cursor: 'grab',
                                background: 'var(--bg-primary)',
                                border: `1px solid ${estado.isDragging ? 'var(--accent)' : 'var(--border-light)'}`,
                              }}
                            >
                              <GripVertical size={15} className="text-muted" />
                              <span className="font-bold text-sm" style={{ minWidth: '22px' }}>{n + 1}º</span>
                              <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
                                <strong>{titulo}</strong>
                                {descricao && <span className="text-muted"> · {descricao}</span>}
                              </span>
                              {noPlano !== n + 1 && (
                                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>no plano: {noPlano}º</span>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {area.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            {mudouAOrdem && (
              <button
                className="text-xs"
                onClick={() => db.diarias.update(diariaId, { ordem_gravacao: undefined })}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
              >
                Voltar para a ordem do plano
              </button>
            )}
          </section>
        )}

        {/*
          A câmera entra no relatório como números, logo antes das notas: é o
          momento de escrever "cartão 002 ainda sem backup" se for o caso. A
          Logagem não marca cena como gravada — isso continua sendo decisão de
          quem fecha, acima (PLANO-logagem §1.5).
        */}
        <section style={{ marginBottom: '20px' }}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginBottom: '10px' }}>
            Câmera
          </h3>
          <ResumoDaLogagem projetoId={projetoId} diariaId={diariaId} compacto />
        </section>

        <div style={{ marginBottom: '20px' }}>
          <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
            Notas do dia
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="O que a produção precisa saber amanhã…"
            style={{
              width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', fontSize: '14px',
              border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={aoCancelar} style={{ flex: 1, justifyContent: 'center' }}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={confirmar}
            disabled={fechando || naoExplicadas.length > 0}
            style={{ flex: 2, justifyContent: 'center', opacity: naoExplicadas.length > 0 ? 0.5 : 1 }}
            title={naoExplicadas.length > 0 ? 'Falta explicar por que cada cena não saiu' : undefined}
          >
            <Archive size={16} /> {fechando ? 'Fechando…' : 'Fechar e gerar o DPR'}
          </button>
        </div>

        <p className="text-xs" style={{ marginTop: '10px', textAlign: 'center', lineHeight: 1.5, color: naoExplicadas.length > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
          {naoExplicadas.length > 0
            ? `Falta a etiqueta e a explicação de ${naoExplicadas.map(c => `Cena ${c.numero}`).join(', ')}.`
            : 'A diária pode ser reaberta depois. Nada é apagado.'}
        </p>
      </motion.div>
    </div>,
    document.body
  );
}

function Numero({ rotulo, valor, alerta }: { rotulo: string; valor: string; alerta?: boolean }) {
  return (
    <div style={{
      flex: '1 1 90px', padding: '10px 12px', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-light)', background: 'var(--bg-primary)',
    }}>
      <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '10px' }}>
        {rotulo}
      </div>
      <div className="font-bold" style={{ fontSize: '17px', marginTop: '2px', color: alerta ? 'var(--color-warning, #fbbf24)' : 'var(--text-primary)' }}>
        {valor}
      </div>
    </div>
  );
}
