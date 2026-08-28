import { useLiveQuery } from 'dexie-react-hooks';
import { dinheiro } from '../lib/formato';
import { db } from '../db/db';
import { PieChart } from 'lucide-react';

/**
 * Quanto cada área gastou.
 *
 * É a pergunta de toda reunião de produção — "a Arte estourou?" — e o app não
 * sabia responder, porque `Despesa` não tinha de quem o gasto era. O que existia
 * era o departamento dentro de `pagadores`/`devedores`, mas aquilo é QUEM PAGA:
 * a Arte pode comprar uma lente da Fotografia, e o produtor pode pagar a tinta
 * da Arte. Somar por ali daria um número errado com cara de certo.
 *
 * `Departamento.orcamento` já existia e nunca teve com o que ser comparado.
 * Agora tem.
 */
export function GastoPorArea({ projetoId }: { projetoId: string }) {
  const despesas = useLiveQuery(
    () => db.despesas.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];
  const departamentos = useLiveQuery(
    () => db.departamentos.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  if (despesas.length === 0) return null;

  const porArea = new Map<string, number>();
  for (const d of despesas) {
    const chave = d.departamento_id || '__producao__';
    porArea.set(chave, (porArea.get(chave) || 0) + d.valor_total);
  }

  const total = despesas.reduce((s, d) => s + d.valor_total, 0);

  const linhas = [
    ...departamentos
      .map(dep => ({
        id: dep.id,
        nome: dep.nome,
        cor: dep.cor,
        gasto: porArea.get(dep.id) || 0,
        orcamento: dep.orcamento_departamento || 0,
      }))
      .filter(l => l.gasto > 0 || l.orcamento > 0),
    // "Da produção" por último e sem orçamento próprio: seguro, taxa e caixa
    // geral não são de área nenhuma, e inventar um teto para eles seria inventar
    // uma cobrança que ninguém combinou.
    ...(porArea.get('__producao__')
      ? [{ id: '__producao__', nome: 'Da produção', cor: undefined, gasto: porArea.get('__producao__')!, orcamento: 0 }]
      : []),
  ].sort((a, b) => b.gasto - a.gasto);

  if (linhas.length === 0) return null;

  const naoClassificado = despesas.filter(d => !d.departamento_id).length;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <PieChart size={16} /> Gasto por área
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {linhas.map(l => {
          const fatia = total > 0 ? (l.gasto / total) * 100 : 0;
          const estourou = l.orcamento > 0 && l.gasto > l.orcamento;
          const doOrcamento = l.orcamento > 0 ? (l.gasto / l.orcamento) * 100 : null;

          return (
            <div key={l.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
                <span className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  {/* Cor do departamento quando ela existe, mas o nome sempre —
                      a cor sozinha não diz nada em preto e branco nem para quem
                      não distingue os tons. */}
                  {l.cor && <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: l.cor, flexShrink: 0 }} />}
                  {l.nome}
                </span>
                <span className="text-sm" style={{ whiteSpace: 'nowrap', color: estourou ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                  {dinheiro(l.gasto)}
                  {l.orcamento > 0 && (
                    <span className="text-muted" style={{ fontWeight: 400 }}> de {l.orcamento.toFixed(2)}</span>
                  )}
                </span>
              </div>

              <div style={{ height: '6px', borderRadius: '3px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
                <div style={{
                  // A barra mede o ORÇAMENTO quando ele existe (é o que responde
                  // "estourou?") e a fatia do total quando não existe.
                  width: `${Math.min(doOrcamento ?? fatia, 100)}%`,
                  height: '100%',
                  background: estourou ? 'var(--color-danger)' : (l.cor || 'var(--accent)'),
                  transition: 'width 0.4s ease-out',
                }} />
              </div>

              <div className="text-xs text-muted" style={{ marginTop: '3px' }}>
                {doOrcamento !== null
                  ? `${Math.round(doOrcamento)}% do orçamento da área`
                  : `${Math.round(fatia)}% do gasto total`}
                {estourou && <strong style={{ color: 'var(--color-danger)' }}> · estourou</strong>}
              </div>
            </div>
          );
        })}
      </div>

      {naoClassificado > 0 && (
        <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
          {naoClassificado} despesa(s) sem área definida entram em “Da produção”. Se
          alguma for de um setor, edite e escolha a área — é o que faz este quadro
          valer.
        </div>
      )}
    </div>
  );
}
