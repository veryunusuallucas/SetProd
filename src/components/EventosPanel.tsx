import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MapPin, Clock, Users, X, CalendarPlus, ChevronRight,
} from 'lucide-react';
import { db } from '../db/db';
import type { Evento, TipoEvento } from '../types';
import { data as fmtData, dataCurta } from '../lib/formato';
import { MOLA, useMovimentoReduzido } from './ui/movimento';
import { BotaoTatil } from './ui/BotaoTatil';
import { logAction } from '../lib/audit';

/**
 * Os compromissos da produção que não são diária.
 *
 * Visita de locação, teste de elenco, reunião com o cliente, leitura de mesa.
 * Tudo isso já acontecia — no grupo do WhatsApp. E é por isso que ninguém sabia
 * direito quem tinha sido chamado nem que horas era: a mensagem rola para cima
 * e some, e a única forma de conferir era rolar de volta.
 *
 * ⚠️ POR QUE NÃO É UMA DIÁRIA COM OUTRO NOME. Diária tem número, cenas, oitavos
 * gravados e relatório no fim — ela é a unidade em que o filme anda. Um evento
 * não move o filme. Se os dois morassem na mesma tabela, a numeração das
 * diárias e a conta de páginas gravadas passariam a incluir uma visita de
 * locação, e as duas medidas parariam de significar o que significam.
 *
 * Mora aqui dentro da Ordem do Dia porque é a mesma pergunta — "o que a
 * produção tem marcado" —, mas em abas separadas, pelo motivo acima.
 */

export const TIPOS: { id: TipoEvento; nome: string; emoji: string; cor: string }[] = [
  { id: 'visita_locacao', nome: 'Visita de locação', emoji: '📍', cor: '#4cc9f0' },
  { id: 'teste_elenco', nome: 'Teste de elenco', emoji: '🎭', cor: '#f72585' },
  { id: 'reuniao', nome: 'Reunião', emoji: '💬', cor: '#a29bfe' },
  { id: 'leitura', nome: 'Leitura de mesa', emoji: '📖', cor: '#ffc658' },
  { id: 'outro', nome: 'Outro', emoji: '📌', cor: 'var(--text-muted)' },
];

export const tipoDoEvento = (t: TipoEvento) => TIPOS.find(x => x.id === t) ?? TIPOS[4];

const hojeISO = () => new Date().toISOString().slice(0, 10);

export function EventosPanel({ projetoId }: { projetoId: string }) {
  const eventos = useLiveQuery(
    async () => {
      const arr = await db.eventos.where('projeto_id').equals(projetoId).toArray();
      // Por data e depois por hora: dois compromissos no mesmo dia têm que sair
      // na ordem em que vão acontecer, não na ordem em que foram criados.
      return arr.sort((a, b) => (a.data + (a.hora_inicio || '')).localeCompare(b.data + (b.hora_inicio || '')));
    },
    [projetoId]
  ) || [];

  const locacoes = useLiveQuery(() => db.locacoes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const equipe = perfis.filter(p => p.id !== 'caixa_central');

  const reduzido = useMovimentoReduzido();
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const editando = eventos.find(e => e.id === editandoId) ?? null;

  const hoje = hojeISO();
  const futuros = eventos.filter(e => e.data >= hoje);
  const passados = eventos.filter(e => e.data < hoje).reverse();
  const [verPassados, setVerPassados] = useState(false);

  const criar = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const titulo = String(f.get('titulo') || '').trim();
    const data = String(f.get('data') || '');
    if (!titulo || !data) return;

    const novo: Evento = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      tipo: String(f.get('tipo') || 'visita_locacao') as TipoEvento,
      titulo,
      data,
      hora_inicio: String(f.get('hora') || '') || undefined,
      locacao_id: String(f.get('locacao') || '') || undefined,
      participantes: [],
      data_criacao: Date.now(),
    };

    await db.eventos.add(novo);
    try { await logAction(projetoId, 'criar', 'evento', novo.id, `Marcou "${titulo}" para ${fmtData(data)}`); } catch { /* ignore */ }
    setCriando(false);
    // Abre já: o que a pessoa quer em seguida é dizer quem vai.
    setEditandoId(novo.id);
  };

  const excluir = async (id: string) => {
    if (!confirm('Apagar este evento?')) return;
    await db.eventos.delete(id);
    setEditandoId(null);
  };

  const alternarParticipante = (ev: Evento, perfilId: string) => {
    const atuais = ev.participantes || [];
    const novos = atuais.includes(perfilId)
      ? atuais.filter(p => p !== perfilId)
      : [...atuais, perfilId];
    db.eventos.update(ev.id, { participantes: novos });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          Visita de locação, teste, reunião — o que está marcado e quem foi chamado.
        </p>
        <BotaoTatil onClick={() => setCriando(v => !v)} className="btn-primary" style={{ flexShrink: 0 }}>
          <Plus size={16} /> Marcar evento
        </BotaoTatil>
      </div>

      <AnimatePresence>
        {criando && (
          <motion.form
            onSubmit={criar}
            initial={reduzido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduzido ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="card" style={{ borderLeft: '3px solid var(--accent)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">O que é</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {TIPOS.map((t, i) => (
                    <label key={t.id} className="btn-chip" style={{ cursor: 'pointer', gap: '6px' }}>
                      <input type="radio" name="tipo" value={t.id} defaultChecked={i === 0} style={{ margin: 0 }} />
                      {t.emoji} {t.nome}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Nome</label>
                <input name="titulo" required placeholder="Ex: Visita ao Casarão da Rua Augusta" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                <div>
                  <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Data</label>
                  <input type="date" name="data" required defaultValue={hoje} />
                </div>
                <div>
                  <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Hora</label>
                  <input type="time" name="hora" />
                </div>
                <div>
                  <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Locação</label>
                  <select name="locacao" style={{ width: '100%' }}>
                    <option value="">—</option>
                    {locacoes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>
              </div>

              <div className="acoes-form">
                <button type="button" onClick={() => setCriando(false)} className="btn-secondary">Cancelar</button>
                <BotaoTatil type="submit" className="btn-primary">Marcar</BotaoTatil>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {futuros.length === 0 && !criando && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <CalendarPlus size={28} className="text-muted" style={{ marginBottom: '10px' }} />
          <div className="text-sm font-bold">Nada marcado</div>
          <div className="text-xs text-muted" style={{ marginTop: '4px', lineHeight: 1.5 }}>
            Visita de locação, teste de elenco, reunião — o que não é diária mas tem hora e lugar.
          </div>
        </div>
      )}

      {futuros.map(ev => (
        <CartaoEvento
          key={ev.id}
          evento={ev}
          locacao={locacoes.find(l => l.id === ev.locacao_id)}
          quantos={(ev.participantes || []).length}
          aoAbrir={() => setEditandoId(ev.id)}
        />
      ))}

      {passados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => setVerPassados(v => !v)}
            className="text-xs font-bold uppercase tracking-widest text-muted"
            style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px 0' }}
          >
            <ChevronRight size={14} style={{ transform: verPassados ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            Já aconteceram ({passados.length})
          </button>
          {verPassados && passados.map(ev => (
            <CartaoEvento
              key={ev.id}
              evento={ev}
              locacao={locacoes.find(l => l.id === ev.locacao_id)}
              quantos={(ev.participantes || []).length}
              passado
              aoAbrir={() => setEditandoId(ev.id)}
            />
          ))}
        </div>
      )}

      {/* ---- detalhe ---- */}
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
              onClick={e => e.stopPropagation()}
              className="card"
              style={{
                width: '100%', maxWidth: '520px', maxHeight: '88vh',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '22px', flexShrink: 0 }}>{tipoDoEvento(editando.tipo).emoji}</span>
                <input
                  value={editando.titulo}
                  onChange={e => db.eventos.update(editando.id, { titulo: e.target.value })}
                  className="font-bold text-lg"
                  style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', padding: 0, color: 'var(--text-primary)' }}
                />
                <button onClick={() => setEditandoId(null)} className="btn-icon" aria-label="Fechar" style={{ flexShrink: 0 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '18px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                  <div>
                    <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Data</div>
                    <input
                      type="date"
                      value={editando.data}
                      onChange={e => e.target.value && db.eventos.update(editando.id, { data: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Hora</div>
                    <input
                      type="time"
                      value={editando.hora_inicio || ''}
                      onChange={e => db.eventos.update(editando.id, { hora_inicio: e.target.value || undefined })}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Tipo</div>
                  <select
                    value={editando.tipo}
                    onChange={e => db.eventos.update(editando.id, { tipo: e.target.value as TipoEvento })}
                    style={{ width: '100%' }}
                  >
                    {TIPOS.map(t => <option key={t.id} value={t.id}>{t.emoji} {t.nome}</option>)}
                  </select>
                </div>

                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Locação</div>
                  <select
                    value={editando.locacao_id || ''}
                    onChange={e => db.eventos.update(editando.id, { locacao_id: e.target.value || undefined })}
                    style={{ width: '100%' }}
                  >
                    <option value="">Sem locação</option>
                    {locacoes.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                  {/* O endereço vem junto: quem abre o evento na véspera quer
                      saber para onde ir, e não ter que pular para outra tela. */}
                  {locacoes.find(l => l.id === editando.locacao_id)?.endereco && (
                    <div className="text-xs text-muted" style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MapPin size={11} /> {locacoes.find(l => l.id === editando.locacao_id)!.endereco}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={12} /> Quem vai
                    <span className="text-muted" style={{ fontWeight: 400 }}>· {(editando.participantes || []).length}</span>
                  </div>

                  {equipe.length === 0 ? (
                    <div className="text-xs text-muted">Cadastre a equipe em Produção para poder chamar alguém.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {equipe.map(p => {
                        const vai = (editando.participantes || []).includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => alternarParticipante(editando, p.id)}
                            className="btn-chip"
                            style={{
                              borderColor: vai ? 'var(--accent)' : 'var(--border-color)',
                              backgroundColor: vai ? 'var(--bg-active)' : 'var(--bg-surface)',
                              color: vai ? 'var(--text-primary)' : 'var(--text-secondary)',
                              fontWeight: vai ? 700 : 500,
                            }}
                          >
                            {p.nome} {p.sobrenome || ''}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs text-muted uppercase tracking-widest font-bold mb-2">Observação</div>
                  <textarea
                    value={editando.observacao || ''}
                    onChange={e => db.eventos.update(editando.id, { observacao: e.target.value || undefined })}
                    rows={3}
                    placeholder="Levar trena, falar com o zelador…"
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => excluir(editando.id)}
                  className="text-danger font-bold text-sm"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Apagar evento
                </button>
                {/* "Pronto" e não "Salvar": tudo já foi gravado a cada toque. */}
                <BotaoTatil onClick={() => setEditandoId(null)} className="btn-primary">Pronto</BotaoTatil>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CartaoEvento({ evento, locacao, quantos, passado, aoAbrir }: {
  evento: Evento;
  locacao?: { nome: string };
  quantos: number;
  passado?: boolean;
  aoAbrir: () => void;
}) {
  const t = tipoDoEvento(evento.tipo);
  return (
    <div
      className="card"
      onClick={aoAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer',
        borderLeft: `3px solid ${t.cor}`,
        opacity: passado ? 0.6 : 1,
      }}
    >
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{t.emoji}</span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="font-bold text-sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {evento.titulo}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '3px' }}>
          <span className="text-xs text-muted">{t.nome}</span>
          {locacao && (
            <span className="text-xs text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={11} /> {locacao.nome}
            </span>
          )}
          {quantos > 0 && (
            <span className="text-xs text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Users size={11} /> {quantos}
            </span>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div className="text-sm font-bold" style={{ color: t.cor }}>{dataCurta(evento.data)}</div>
        {evento.hora_inicio && (
          <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
            <Clock size={10} /> {evento.hora_inicio}
          </div>
        )}
      </div>
    </div>
  );
}
