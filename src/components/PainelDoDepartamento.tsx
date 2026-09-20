import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Receipt } from 'lucide-react';
import { db } from '../db/db';
import { dinheiro } from '../lib/formato';
import type { Departamento } from '../types';

/**
 * O financeiro de UM departamento — o que a equipe dele precisa saber.
 *
 * POR QUE NÃO É O DASHBOARD DO FILME COM UM FILTRO
 * O painel da produção responde "quanto sobra no caixa?", que é pergunta de
 * quem administra. Para quem é da Arte, a pergunta é outra: "quanto ainda
 * posso gastar?". São números diferentes, e o segundo não se obtém escondendo
 * partes do primeiro — ele se calcula do orçamento da área contra o que ela já
 * gastou.
 *
 * Aporte não aparece aqui de propósito: dinheiro que entra é do caixa do filme,
 * e não existe "aporte da Fotografia".
 */
export function PainelDoDepartamento({
  projetoId, departamento,
}: { projetoId: string; departamento: Departamento }) {
  const despesas = useLiveQuery(
    () => db.despesas.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  const minhas = despesas.filter(d => d.departamento_id === departamento.id);
  const gasto = minhas.reduce((soma, d) => soma + (d.valor_total || 0), 0);
  const orcamento = departamento.orcamento_departamento || 0;
  const temOrcamento = orcamento > 0;
  const sobra = orcamento - gasto;
  const estourou = temOrcamento && gasto > orcamento;
  const fatia = temOrcamento ? Math.min((gasto / orcamento) * 100, 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderColor: estourou ? 'var(--color-danger)' : 'var(--border-color)' }}>
        <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <PieChart size={14} /> {departamento.nome}
        </span>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '4px' }}>
              {temOrcamento ? 'Ainda dá para gastar' : 'Gasto do departamento'}
            </div>
            <div className="text-2xl font-bold" style={{ color: estourou ? 'var(--color-danger)' : 'var(--text-primary)' }}>
              {dinheiro(temOrcamento ? sobra : gasto)}
            </div>
          </div>

          {temOrcamento && (
            <div style={{ textAlign: 'right' }}>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '4px' }}>Gasto de {dinheiro(orcamento)}</div>
              <div className="text-lg font-bold">{dinheiro(gasto)}</div>
            </div>
          )}
        </div>

        {temOrcamento && (
          <div style={{ height: '6px', borderRadius: 'var(--radius-full)', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <div style={{
              width: `${fatia}%`, height: '100%',
              background: estourou ? 'var(--color-danger)' : (departamento.cor || 'var(--accent)'),
            }} />
          </div>
        )}

        <span className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
          {temOrcamento
            ? 'O caixa do filme inteiro é de quem administra a produção; aqui é o seu departamento.'
            : 'Seu departamento ainda não tem orçamento definido — quem administra a produção define.'}
        </span>
      </div>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Receipt size={16} style={{ color: 'var(--text-muted)' }} />
        <span className="text-sm text-secondary">
          {minhas.length === 0
            ? 'Nenhuma despesa lançada no seu departamento ainda.'
            : `${minhas.length} ${minhas.length === 1 ? 'despesa lançada' : 'despesas lançadas'} no seu departamento.`}
        </span>
      </div>
    </div>
  );
}
