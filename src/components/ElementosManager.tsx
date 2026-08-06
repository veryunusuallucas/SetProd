import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Merge, Scissors, Search, Users, ChevronRight } from 'lucide-react';
import { db } from '../db/db';
import { categoriasDisponiveis, temaDe } from '../lib/decupagem';
import { AIRecommendation, AISuggestion, AISuggestionList } from './ui/ia';
import { mesclarElementos, separarAlias, sugerirMerges, chaveNome } from '../lib/elementos';

/**
 * Inventário do breakdown: tudo que foi marcado no roteiro, agrupado por
 * departamento, com o perfil de cada elemento (em que cenas aparece) e as duas
 * operações que faltavam — juntar dois nomes da mesma coisa e voltar atrás.
 */
export function ElementosManager({ projetoId }: { projetoId: string }) {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [sugestoesOcultas, setSugestoesOcultas] = useState<string[]>([]);

  const elementos = useLiveQuery(
    () => db.elementos.where('projeto_id').equals(projetoId).toArray(), [projetoId]
  ) || [];
  const tags = useLiveQuery(
    () => db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(), [projetoId]
  ) || [];
  const cenas = useLiveQuery(
    () => db.cenas.where('projeto_id').equals(projetoId).toArray(), [projetoId]
  ) || [];

  const ocorrenciasDe = (id: string) => tags.filter(t => t.elemento_id === id);

  /** Cenas em que o elemento aparece, pelo vínculo gravado na ocorrência. */
  const cenasDe = (id: string) => {
    const ids = new Set(ocorrenciasDe(id).map(t => t.cena_id).filter(Boolean));
    return cenas.filter(c => ids.has(c.id));
  };

  const filtrados = elementos.filter(e => {
    if (!busca.trim()) return true;
    const alvo = chaveNome(busca);
    return chaveNome(e.nome).includes(alvo) ||
      (e.aliases || []).some(a => chaveNome(a).includes(alvo));
  });

  const sugestoes = sugerirMerges(elementos, tags)
    .filter(s => !sugestoesOcultas.includes(`${s.principal.id}|${s.candidato.id}`));

  const alternar = (id: string) => {
    setSelecionados(atual =>
      atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]
    );
  };

  const mesclarSelecionados = async () => {
    if (selecionados.length < 2) return;
    const [principal, ...resto] = selecionados;
    const nome = elementos.find(e => e.id === principal)?.nome;
    if (!confirm(`Juntar ${selecionados.length} itens em "${nome}"? Os outros nomes viram apelidos dele.`)) return;
    await mesclarElementos(principal, resto);
    setSelecionados([]);
  };

  const porCategoria = categoriasDisponiveis()
    .map(cat => ({ cat, itens: filtrados.filter(e => e.categoria === cat.chave) }))
    .filter(g => g.itens.length > 0);

  if (elementos.length === 0) {
    return (
      <div className="card text-muted text-center" style={{ padding: '40px 16px' }}>
        Nada marcado ainda. Marque trechos na aba <strong>Roteiro</strong> — ou deixe a IA
        analisar — e os elementos aparecem aqui.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Sugestões de merge — momento de IA, com a linguagem visual dela. */}
      <AnimatePresence>
        {sugestoes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
          >
            <AIRecommendation titulo="Parecem a mesma coisa">
              {sugestoes.length === 1
                ? 'Achei dois nomes que provavelmente são o mesmo elemento. Confirme para contar como um só nos relatórios.'
                : `Achei ${sugestoes.length} pares que provavelmente são o mesmo elemento. Confirme os que fizerem sentido — nos relatórios eles passam a contar como um.`}
            </AIRecommendation>

            <AISuggestionList>
              {sugestoes.slice(0, 5).map(s => {
                const chave = `${s.principal.id}|${s.candidato.id}`;
                return (
                  <AISuggestion
                    key={chave}
                    cor={temaDe(s.principal.categoria).border}
                    rotuloAceitar="Juntar"
                    onAceitar={() => { mesclarElementos(s.principal.id, [s.candidato.id]); }}
                    onRecusar={() => setSugestoesOcultas(o => [...o, chave])}
                  >
                    <strong>"{s.candidato.nome}"</strong> é o mesmo que <strong>"{s.principal.nome}"</strong>?
                    <span className="text-muted text-xs"> — {s.motivo}</span>
                  </AISuggestion>
                );
              })}
            </AISuggestionList>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de busca e ação de merge */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} className="text-muted" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar elemento..."
            style={{ width: '100%', padding: '9px 12px 9px 32px' }}
          />
        </div>
        <span className="text-xs text-muted">{elementos.length} elemento(s)</span>
        {selecionados.length >= 2 && (
          <button className="btn-chip" onClick={mesclarSelecionados}>
            <Merge size={14} /> Juntar {selecionados.length}
          </button>
        )}
      </div>

      {porCategoria.map(({ cat, itens }) => (
        <div key={cat.chave} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cat.text }}>
            {cat.rotulo} ({itens.length})
          </span>

          {itens.map(el => {
            const ocorrencias = ocorrenciasDe(el.id);
            const paginas = [...new Set(ocorrencias.map(t => t.pagina))].sort((a, b) => a - b);
            const expandido = aberto === el.id;
            const marcado = selecionados.includes(el.id);

            return (
              <div
                key={el.id}
                className="card"
                style={{ padding: '12px 14px', borderLeft: `3px solid ${cat.border}`, gap: '8px', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() => alternar(el.id)}
                    title="Selecionar para juntar"
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                  />
                  {el.cast_id !== undefined && (
                    <span
                      title="Cast ID"
                      style={{
                        minWidth: '24px', textAlign: 'center', padding: '2px 6px', borderRadius: '6px',
                        backgroundColor: cat.bg, color: cat.text, fontSize: '11px', fontWeight: 700,
                      }}
                    >
                      {el.cast_id}
                    </span>
                  )}
                  <button
                    onClick={() => setAberto(expandido ? null : el.id)}
                    style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <motion.span animate={{ rotate: expandido ? 90 : 0 }}>
                      <ChevronRight size={14} className="text-muted" />
                    </motion.span>
                    <span className="font-bold text-sm">{el.nome}</span>
                    {(el.aliases?.length || 0) > 0 && (
                      <span className="text-xs text-muted">+{el.aliases!.length} apelido(s)</span>
                    )}
                  </button>
                  <span className="text-xs text-muted">
                    {ocorrencias.length}x · pág {paginas.join(', ') || '—'}
                  </span>
                </div>

                {expandido && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    style={{ overflow: 'hidden', paddingLeft: '30px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                  >
                    {(el.aliases?.length || 0) > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                        <span className="text-xs text-muted">Também chamado de:</span>
                        {el.aliases!.map(a => (
                          <button
                            key={a}
                            className="btn-chip"
                            title="Separar de novo"
                            onClick={() => separarAlias(el.id, a)}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            {a} <Scissors size={11} />
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span className="text-xs text-muted">Cenas</span>
                      <span className="text-sm">
                        {cenasDe(el.id).map(c => c.numero).join(', ') || 'Nenhuma cena vinculada ainda.'}
                      </span>
                    </div>

                    <textarea
                      value={el.notas || ''}
                      onChange={e => db.elementos.update(el.id, { notas: e.target.value })}
                      placeholder="Notas (onde conseguir, tamanho, contato...)"
                      rows={2}
                      style={{ width: '100%', fontSize: '13px', resize: 'vertical' }}
                    />
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {selecionados.length === 1 && (
        <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={13} /> Marque pelo menos dois para juntar. O primeiro marcado vira o nome principal.
        </div>
      )}
    </div>
  );
}
