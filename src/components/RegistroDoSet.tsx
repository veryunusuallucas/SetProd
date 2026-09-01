import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserCheck, Clock, AlertTriangle, Plus, Trash2, ChevronDown, Film, Users2,
} from 'lucide-react';
import { db } from '../db/db';
import type {
  Diaria, Perfil, Ocorrencia, TipoOcorrencia, PresencaMembro, StatusPresenca,
} from '../types';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * O que se registra enquanto o dia acontece, fora das cenas (spec §3.2 e §3.3).
 *
 * As cenas se marcam na própria linha do dia, onde elas já estão. Aqui fica o
 * resto do relatório de produção: quem apareceu, a jornada de cada um, a
 * figuração, os rolos e o que deu errado.
 *
 * ⚠️ TUDO AQUI É CARIMBADO COM QUEM MARCOU (§3.4).
 *
 * A indústria resolve isso com um campo de assinatura no rodapé do DPR. Como
 * cada pessoa entra com a conta dela, o app consegue fazer melhor: a autoria é
 * por anotação, não por documento. "Mari marcou a cena 4 às 14h32" responde uma
 * pergunta que uma assinatura no pé da página nunca responde.
 */

const STATUS: { valor: StatusPresenca; rotulo: string; cor: string }[] = [
  { valor: 'chegou', rotulo: 'chegou', cor: 'var(--color-success)' },
  { valor: 'atrasado', rotulo: 'atrasou', cor: 'var(--color-warning)' },
  { valor: 'faltou', rotulo: 'faltou', cor: 'var(--color-danger)' },
];

const TIPOS_OCORRENCIA: { valor: TipoOcorrencia; rotulo: string }[] = [
  { valor: 'atraso', rotulo: 'Atraso' },
  { valor: 'equipamento', rotulo: 'Equipamento' },
  { valor: 'incidente', rotulo: 'Incidente' },
  { valor: 'clima', rotulo: 'Clima' },
  { valor: 'locacao', rotulo: 'Locação' },
  { valor: 'transporte', rotulo: 'Transporte' },
];

/**
 * O placeholder é parte da funcionalidade, não enfeite (spec §3.1).
 *
 * "Atrasou" não serve para nada daqui a três semanas. "Company move levou 90min
 * a mais por estacionamento e carga" explica o dia inteiro. O jeito barato de
 * conseguir a segunda frase é mostrar uma como exemplo no campo vazio.
 */
const EXEMPLO = 'Ex: company move levou 90min a mais por estacionamento e carga na garagem';

export function RegistroDoSet({ diaria, escalados, meuPerfilId, podeMarcar }: {
  diaria: Diaria;
  escalados: Perfil[];
  meuPerfilId?: string;
  podeMarcar: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const [aberto, setAberto] = useState<string | null>(null);
  const [novaOcorrencia, setNovaOcorrencia] = useState<{ tipo: TipoOcorrencia; descricao: string; minutos: string } | null>(null);

  const presencas = diaria.presencas || {};
  const ocorrencias = diaria.ocorrencias || [];

  const carimbo = () => ({ registrado_por: meuPerfilId, registrado_em: Date.now() });

  const marcarPresenca = async (perfilId: string, status: StatusPresenca) => {
    const atual = presencas[perfilId];
    /*
      Tocar de novo no mesmo status APAGA a marcação.

      É a única saída de quem marcou a pessoa errada — e "eu ainda não sei" é um
      estado legítimo às 7h da manhã, diferente de "faltou". Sem isso os três
      botões viravam um caminho sem volta, como o ciclo das cenas já foi.
    */
    const nova = { ...presencas };
    if (atual?.status === status) delete nova[perfilId];
    else nova[perfilId] = { ...(atual || {}), status, ...carimbo() };
    await db.diarias.update(diaria.id, { presencas: nova });
  };

  const mudarHorario = async (perfilId: string, campo: keyof PresencaMembro, valor: string) => {
    const atual = presencas[perfilId];
    // Horário sem status ainda assim vale: quem digitou a chegada está dizendo
    // que a pessoa chegou, mesmo sem tocar no botão.
    const base: PresencaMembro = atual || { status: 'chegou' };
    await db.diarias.update(diaria.id, {
      presencas: { ...presencas, [perfilId]: { ...base, [campo]: valor || undefined, ...carimbo() } },
    });
  };

  const addOcorrencia = async () => {
    if (!novaOcorrencia?.descricao.trim()) return;
    const agora = new Date();
    const item: Ocorrencia = {
      id: crypto.randomUUID(),
      tipo: novaOcorrencia.tipo,
      hora: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
      descricao: novaOcorrencia.descricao.trim(),
      minutos_perdidos: novaOcorrencia.minutos ? Number(novaOcorrencia.minutos) : undefined,
      registrado_por: meuPerfilId,
      registrado_em: Date.now(),
    };
    await db.diarias.update(diaria.id, { ocorrencias: [...ocorrencias, item] });
    setNovaOcorrencia(null);
  };

  const removeOcorrencia = (id: string) =>
    db.diarias.update(diaria.id, { ocorrencias: ocorrencias.filter(o => o.id !== id) });

  const mudarFiguracao = (campo: string, valor: string | number | undefined) =>
    db.diarias.update(diaria.id, { figuracao: { ...(diaria.figuracao || {}), [campo]: valor } });

  const mudarRolo = (campo: 'camera' | 'som', valor: string) =>
    db.diarias.update(diaria.id, { rolos: { ...(diaria.rolos || {}), [campo]: valor || undefined } });

  const nomeDe = (perfilId?: string) => {
    if (!perfilId) return null;
    const p = escalados.find(x => x.id === perfilId);
    return p ? p.nome : null;
  };

  const contagem = STATUS.map(s => ({
    ...s,
    n: Object.values(presencas).filter(p => p.status === s.valor).length,
  }));
  const minutosPerdidos = ocorrencias.reduce((a, o) => a + (o.minutos_perdidos || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/* ---- Presença e jornada ---- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '3px solid var(--cor-equipe)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <UserCheck size={15} style={{ color: 'var(--cor-equipe)' }} /> Presença e jornada
          </h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            {contagem.filter(c => c.n > 0).map(c => (
              <span key={c.valor} className="text-xs font-bold" style={{ color: c.cor }}>
                {c.n} {c.rotulo}
              </span>
            ))}
          </div>
        </div>

        {escalados.length === 0 ? (
          <div className="text-sm text-muted">Ninguém escalado neste dia.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {escalados.map(p => {
              const reg = presencas[p.id];
              const expandido = aberto === p.id;
              const corDoStatus = STATUS.find(s => s.valor === reg?.status)?.cor;

              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)',
                    border: `1px solid ${corDoStatus || 'var(--border-light)'}`,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setAberto(a => (a === p.id ? null : p.id))}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '140px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', padding: 0 }}
                      title="Abrir os horários desta pessoa"
                    >
                      <ChevronDown size={13} className="text-muted" style={{ transform: expandido ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s', flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span className="text-sm">{p.nome} {p.sobrenome || ''}</span>
                        <span className="text-xs text-muted"> · {p.funcao || 'Equipe'}</span>
                      </span>
                    </button>

                    <div style={{ display: 'flex', gap: '5px' }}>
                      {STATUS.map(s => {
                        const ativo = reg?.status === s.valor;
                        return (
                          <button
                            key={s.valor}
                            onClick={() => podeMarcar && marcarPresenca(p.id, s.valor)}
                            disabled={!podeMarcar}
                            className="text-xs font-bold"
                            style={{
                              padding: '4px 10px', borderRadius: 'var(--radius-full)',
                              cursor: podeMarcar ? 'pointer' : 'not-allowed',
                              border: `1px solid ${ativo ? s.cor : 'var(--border-light)'}`,
                              backgroundColor: ativo ? s.cor : 'transparent',
                              color: ativo ? '#000' : 'var(--text-muted)',
                              opacity: podeMarcar ? 1 : 0.5,
                            }}
                          >
                            {s.rotulo}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expandido && (
                      <motion.div
                        initial={reduzido ? undefined : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduzido ? undefined : { height: 0, opacity: 0 }}
                        transition={MOLA}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '0 12px 12px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {([
                            ['chegada', 'Chegada'],
                            ['inicio', 'Início'],
                            ['refeicao_saida', 'Saiu p/ refeição'],
                            ['refeicao_volta', 'Voltou'],
                            ['fim', 'Fim'],
                          ] as const).map(([campo, rotulo]) => (
                            <label key={campo} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <span className="text-xs text-muted uppercase">{rotulo}</span>
                              <input
                                type="time"
                                value={(reg?.[campo] as string) || ''}
                                onChange={e => podeMarcar && mudarHorario(p.id, campo, e.target.value)}
                                disabled={!podeMarcar}
                                style={{ padding: '5px 7px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                              />
                            </label>
                          ))}
                          <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '180px' }}>
                            <span className="text-xs text-muted uppercase">Nota</span>
                            <input
                              defaultValue={reg?.nota || ''}
                              onBlur={e => podeMarcar && (reg?.nota || '') !== e.target.value && mudarHorario(p.id, 'nota', e.target.value)}
                              disabled={!podeMarcar}
                              placeholder="Ex: liberado às 16h para outra produção"
                              style={{ padding: '5px 7px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                            />
                          </label>
                        </div>
                        {reg?.registrado_por && (
                          <div className="text-xs text-muted" style={{ padding: '0 12px 10px' }}>
                            Marcado por {nomeDe(reg.registrado_por) || 'alguém da produção'}
                            {reg.registrado_em ? ` às ${new Date(reg.registrado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}.
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Figuração e rolos ---- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '3px solid var(--cor-criativo)' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Film size={15} style={{ color: 'var(--cor-criativo)' }} /> Cobertura do dia
        </h2>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <Campo rotulo="Rolos de câmera" largura="150px">
            <input
              defaultValue={diaria.rolos?.camera || ''}
              onBlur={e => podeMarcar && (diaria.rolos?.camera || '') !== e.target.value && mudarRolo('camera', e.target.value)}
              disabled={!podeMarcar}
              placeholder="A001–A004"
              style={entrada}
            />
          </Campo>
          <Campo rotulo="Rolos de som" largura="150px">
            <input
              defaultValue={diaria.rolos?.som || ''}
              onBlur={e => podeMarcar && (diaria.rolos?.som || '') !== e.target.value && mudarRolo('som', e.target.value)}
              disabled={!podeMarcar}
              placeholder="S01–S03"
              style={entrada}
            />
          </Campo>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <div className="text-xs text-muted uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <Users2 size={13} /> Figuração e stand-ins
          </div>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <Campo rotulo="Quantas pessoas" largura="120px">
              <input
                type="number"
                min={0}
                value={diaria.figuracao?.quantidade ?? ''}
                onChange={e => podeMarcar && mudarFiguracao('quantidade', e.target.value === '' ? undefined : Number(e.target.value))}
                disabled={!podeMarcar}
                placeholder="0"
                style={entrada}
              />
            </Campo>
            <Campo rotulo="Chamada" largura="110px">
              <input type="time" value={diaria.figuracao?.chamada || ''} onChange={e => podeMarcar && mudarFiguracao('chamada', e.target.value)} disabled={!podeMarcar} style={entrada} />
            </Campo>
            <Campo rotulo="Liberação" largura="110px">
              <input type="time" value={diaria.figuracao?.wrap || ''} onChange={e => podeMarcar && mudarFiguracao('wrap', e.target.value)} disabled={!podeMarcar} style={entrada} />
            </Campo>
            <Campo rotulo="Notas" largura="220px" cresce>
              <input
                defaultValue={diaria.figuracao?.notas || ''}
                onBlur={e => podeMarcar && (diaria.figuracao?.notas || '') !== e.target.value && mudarFiguracao('notas', e.target.value)}
                disabled={!podeMarcar}
                placeholder="Ex: 12 de figuração, 2 stand-ins do protagonista"
                style={entrada}
              />
            </Campo>
          </div>
        </div>
      </div>

      {/* ---- Ocorrências ---- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '3px solid var(--color-warning)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <AlertTriangle size={15} style={{ color: 'var(--color-warning)' }} /> Ocorrências
          </h2>
          {minutosPerdidos > 0 && (
            <span className="text-xs font-bold" style={{ color: 'var(--color-warning)' }}>
              {minutosPerdidos}min perdidos
            </span>
          )}
          {podeMarcar && !novaOcorrencia && (
            <button
              onClick={() => setNovaOcorrencia({ tipo: 'atraso', descricao: '', minutos: '' })}
              className="btn-secondary text-xs"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={13} /> Registrar
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {novaOcorrencia && (
            <motion.div
              initial={reduzido ? undefined : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduzido ? undefined : { opacity: 0 }}
              transition={MOLA}
              style={{ padding: '14px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {TIPOS_OCORRENCIA.map(t => {
                  const ativo = novaOcorrencia.tipo === t.valor;
                  return (
                    <button
                      key={t.valor}
                      onClick={() => setNovaOcorrencia({ ...novaOcorrencia, tipo: t.valor })}
                      className="text-xs font-bold"
                      style={{
                        padding: '4px 11px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                        border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-light)'}`,
                        backgroundColor: ativo ? 'var(--accent)' : 'transparent',
                        color: ativo ? '#000' : 'var(--text-secondary)',
                      }}
                    >
                      {t.rotulo}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={novaOcorrencia.descricao}
                onChange={e => setNovaOcorrencia({ ...novaOcorrencia, descricao: e.target.value })}
                rows={2}
                placeholder={EXEMPLO}
                autoFocus
                style={{ width: '100%', padding: '9px', borderRadius: '8px', fontSize: '14px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }}
              />

              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <Campo rotulo="Minutos perdidos" largura="140px">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={novaOcorrencia.minutos}
                    onChange={e => setNovaOcorrencia({ ...novaOcorrencia, minutos: e.target.value })}
                    placeholder="opcional"
                    style={entrada}
                  />
                </Campo>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                  <button onClick={() => setNovaOcorrencia(null)} className="text-xs text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px' }}>
                    cancelar
                  </button>
                  <button onClick={addOcorrencia} className="btn-primary text-xs" disabled={!novaOcorrencia.descricao.trim()}>
                    Registrar
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {ocorrencias.length === 0 && !novaOcorrencia ? (
          <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
            Nada registrado. Atraso, pane de equipamento, chuva, problema na locação —
            é aqui que o DPR encontra a explicação do dia.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {ocorrencias.map(o => (
              <div key={o.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 12px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
                <span className="text-xs font-bold" style={{ minWidth: '42px', color: 'var(--color-warning)' }}>{o.hora || '--:--'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm">
                    <span className="font-bold">{TIPOS_OCORRENCIA.find(t => t.valor === o.tipo)?.rotulo}</span>
                    {o.minutos_perdidos ? <span className="text-muted"> · {o.minutos_perdidos}min</span> : null}
                  </div>
                  <div className="text-sm text-secondary" style={{ lineHeight: 1.5 }}>{o.descricao}</div>
                  {o.registrado_por && (
                    <div className="text-xs text-muted" style={{ marginTop: '3px' }}>
                      por {nomeDe(o.registrado_por) || 'alguém da produção'}
                    </div>
                  )}
                </div>
                {podeMarcar && (
                  <button onClick={() => removeOcorrencia(o.id)} className="btn-icon text-muted" style={{ padding: '5px', border: 'none', background: 'transparent' }}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!podeMarcar && (
        <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1.5 }}>
          <Clock size={13} style={{ flexShrink: 0 }} />
          Você está acompanhando o dia ao vivo. Marcar é do AD e da produção — as
          marcações aparecem aqui sozinhas, conforme eles registram.
        </div>
      )}
    </div>
  );
}

const entrada: React.CSSProperties = {
  width: '100%', padding: '6px 8px', fontSize: '13px', borderRadius: '6px',
  border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)',
};

function Campo({ rotulo, largura, cresce, children }: {
  rotulo: string; largura: string; cresce?: boolean; children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: largura, flex: cresce ? '1 1 auto' : undefined }}>
      <span className="text-xs text-muted uppercase">{rotulo}</span>
      {children}
    </label>
  );
}
