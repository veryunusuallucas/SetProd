import { useLiveQuery } from 'dexie-react-hooks';
import { Target } from 'lucide-react';
import { db } from '../db/db';
import { dinheiro } from '../lib/formato';
import { emCentavos, emReais } from '../core/dinheiro';
import { CATEGORIAS_DESPESA, rotuloDaCategoria } from '../core/categoriasDespesa';

/**
 * Quanto foi para cada tipo de gasto — e, quando há meta, quanto dela já foi.
 *
 * UM QUADRO SÓ (leva 4, passo 4). A Visão tinha dois: um gráfico de pizza com
 * o gasto por categoria (sem valor legível — só a fatia e a porcentagem) e o
 * "Metas por categoria". Era a mesma pergunta respondida duas vezes, uma delas
 * sem o número. Aqui cada tipo tem uma linha: o valor, e a barra contra a meta
 * quando ela existe, ou contra o total gasto quando não.
 *
 * A meta nasceu de uma sugestão do botão de relatar (16/09/2026): "para
 * alimentação precisamos de X, até agora temos Y". SÓ QUEM ADMINISTRA VÊ —
 * quem monta a tela decide (ver `FinanceiroModule`). As metas se definem em
 * Ajustes. Toda conta em centavos (`core/dinheiro.ts`).
 */
export function GastoPorTipo({ projetoId, aoDefinir }: {
  projetoId: string;
  /** Leva para onde as metas se definem (a aba Ajustes). */
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
    const chave = d.categoria || '__sem__';
    gastoCentavos.set(chave, (gastoCentavos.get(chave) || 0) + emCentavos(d.valor_total));
  }
  const totalCentavos = [...gastoCentavos.values()].reduce((s, v) => s + v, 0);

  const conhecidos = new Set(CATEGORIAS_DESPESA.map(c => c.id));
  const linhas = [
    // Na ordem da lista de tipos, e não por valor: quem administra procura
    // "Alimentação" sempre no mesmo lugar, semana após semana.
    ...CATEGORIAS_DESPESA
      .map(c => ({ id: c.id, nome: `${c.emoji} ${c.label}`, gasto: gastoCentavos.get(c.id) || 0, meta: emCentavos(metas[c.id]) }))
      .filter(l => l.gasto > 0 || l.meta > 0),
    // Tipo guardado que não está na lista (de alguma versão antiga) e despesa sem
    // tipo: aparecem no fim, para a soma do quadro fechar com o total gasto.
    ...[...gastoCentavos.entries()]
      .filter(([id]) => !conhecidos.has(id))
      .map(([id, gasto]) => ({ id, nome: id === '__sem__' ? 'Sem tipo' : rotuloDaCategoria(id), gasto, meta: 0 })),
  ];

  const temMeta = linhas.some(l => l.meta > 0);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Target size={16} /> Por tipo de gasto
        </h2>
        <button className="text-xs" onClick={aoDefinir} style={{ background: 'none', border: 'none', color: 'var(--accent-texto)', cursor: 'pointer', padding: 0 }}>
          {temMeta ? 'Editar metas' : 'Definir metas'}
        </button>
      </div>

      {linhas.length === 0 ? (
        // Seção dentro de cartão: frase curta, não um `Vazio` inteiro (guia visual).
        <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          Nenhum gasto ainda. Quando houver, aqui aparece quanto foi para alimentação, transporte, moradia — e quanto falta para a meta de cada um, se você definir.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {linhas.map(l => {
            const comMeta = l.meta > 0;
            const pct = comMeta ? (l.gasto / l.meta) * 100 : (totalCentavos > 0 ? (l.gasto / totalCentavos) * 100 : 0);
            const estourou = comMeta && l.gasto > l.meta;

            return (
              <div key={l.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                  <span className="text-sm font-bold" style={{ minWidth: 0 }}>{l.nome}</span>
                  <span className="text-sm" style={{ whiteSpace: 'nowrap', color: estourou ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                    {dinheiro(emReais(l.gasto))}
                    {comMeta && <span className="text-muted" style={{ fontWeight: 400 }}> de {dinheiro(emReais(l.meta))}</span>}
                  </span>
                </div>

                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(pct, 100)}%`,
                    height: '100%',
                    // Barra de meta em destaque; barra de fatia do total, discreta —
                    // as duas medem coisas diferentes e não podem parecer iguais.
                    background: estourou ? 'var(--color-danger)' : comMeta ? 'var(--accent)' : 'var(--text-muted)',
                    transition: 'width 0.4s ease-out',
                  }} />
                </div>

                <div className="text-xs text-muted" style={{ marginTop: '3px' }}>
                  {!comMeta
                    ? `${Math.round(pct)}% do gasto`
                    : estourou
                      ? <strong style={{ color: 'var(--color-danger)' }}>Passou {dinheiro(emReais(l.gasto - l.meta))} da meta</strong>
                      : <>Faltam {dinheiro(emReais(l.meta - l.gasto))} · {Math.round(pct)}% da meta</>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
