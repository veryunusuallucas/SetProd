import { useLiveQuery } from 'dexie-react-hooks';
import { Target } from 'lucide-react';
import { db } from '../db/db';
import { dinheiro } from '../lib/formato';
import { emCentavos, emReais } from '../core/dinheiro';
import { CATEGORIAS_DESPESA } from '../core/categoriasDespesa';

/**
 * "Para alimentação precisamos de X, até agora temos Y."
 *
 * A sugestão veio do botão de relatar (16/09/2026). O `GastoPorArea` já
 * respondia "a Arte estourou?", mas alimentação, transporte e moradia não são
 * de área nenhuma — são de todo mundo, e não tinham onde ter um teto.
 *
 * SÓ QUEM ADMINISTRA VÊ (decisão do Lucas, 27/09/2026). Quem monta a tela é que
 * decide: este componente não se esconde sozinho, porque quem o usa já sabe o
 * papel de quem está olhando — ver `FinanceiroModule`.
 *
 * As metas são definidas na aba Controle. A conta é em centavos
 * (`core/dinheiro.ts`): somar reais em ponto flutuante dá R$ 0,30000000000000004.
 */
export function MetasPorCategoria({ projetoId, aoDefinir }: {
  projetoId: string;
  /** Leva para onde as metas se editam (a aba Controle). */
  aoDefinir: () => void;
}) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const despesas = useLiveQuery(
    () => db.despesas.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  if (!projeto) return null;
  const metas = projeto.metas_categoria || {};

  const gastoCentavos = new Map<string, number>();
  for (const d of despesas) {
    if (!d.categoria) continue;
    gastoCentavos.set(d.categoria, (gastoCentavos.get(d.categoria) || 0) + emCentavos(d.valor_total));
  }

  // Na ordem da lista de categorias, e não por valor: quem administra procura
  // "Alimentação" sempre no mesmo lugar, semana após semana.
  const linhas = CATEGORIAS_DESPESA
    .filter(c => (metas[c.id] || 0) > 0)
    .map(c => ({
      ...c,
      meta: metas[c.id],
      gasto: emReais(gastoCentavos.get(c.id) || 0),
    }));

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Target size={16} /> Metas por categoria
        </h2>
        {linhas.length > 0 && (
          <button className="text-xs" onClick={aoDefinir} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
            Editar metas
          </button>
        )}
      </div>

      {linhas.length === 0 ? (
        // Seção dentro de cartão: frase curta, não um `Vazio` inteiro (guia visual).
        <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Nenhuma meta definida. Dê um teto para alimentação, transporte ou moradia e acompanhe aqui quanto já foi.{' '}
          <button onClick={aoDefinir} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            Definir metas
          </button>
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {linhas.map(l => {
            const pct = (l.gasto / l.meta) * 100;
            const estourou = l.gasto > l.meta;
            const falta = l.meta - l.gasto;

            return (
              <div key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                  <span className="text-sm font-bold" style={{ minWidth: 0 }}>{l.emoji} {l.label}</span>
                  <span className="text-sm" style={{ whiteSpace: 'nowrap', color: estourou ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                    {dinheiro(l.gasto)}
                    <span className="text-muted" style={{ fontWeight: 400 }}> de {dinheiro(l.meta)}</span>
                  </span>
                </div>

                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    background: estourou ? 'var(--color-danger)' : 'var(--accent)',
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>

                <div className="text-xs text-muted" style={{ marginTop: '3px' }}>
                  {estourou
                    ? <strong style={{ color: 'var(--color-danger)' }}>Passou {dinheiro(-falta)} da meta</strong>
                    : <>Faltam {dinheiro(falta)} · {Math.round(pct)}% da meta</>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
