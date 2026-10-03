import { dinheiro } from '../lib/formato';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { emCentavos, emReais } from '../core/dinheiro';
import { Wallet, TrendingUp, HandCoins, Flag } from 'lucide-react';

interface DashboardProps {
  projetoId: string;
  /** Leva para onde o orçamento se define (a aba Ajustes). */
  aoDefinirOrcamento: () => void;
}

/**
 * O topo da Visão de quem administra: a pergunta da reunião.
 *
 * O QUE MUDOU (leva 4, passo 4)
 * · O ORÇAMENTO aparece. Ele se definia em Controle ("Orçamento máximo") e não
 *   era mostrado em lugar nenhum do Financeiro — a tela dizia quanto entrou,
 *   quanto saiu e o saldo, mas não "quanto do orçamento já foi", que é a
 *   primeira coisa que alguém pergunta numa reunião de produção.
 * · A pizza de categorias saiu: virou o quadro "Por tipo de gasto" (ver
 *   `GastoPorTipo`), com o valor escrito em cada linha.
 * · As somas são em CENTAVOS. Em ponto flutuante, R$ 0,10 + R$ 0,20 dá
 *   0,30000000000000004 — o saldo não chega a mostrar isso, mas uma conta de
 *   "estourou?" feita em cima dele pode errar por um centavo.
 * · `saldo_inicial` ainda entra na soma: ele vira entrada ao abrir o
 *   Financeiro (`lib/saldoInicial.ts`), e até lá não pode sumir da conta.
 */
export function DashboardFinanceiro({ projetoId, aoDefinirOrcamento }: DashboardProps) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  if (!projeto) return <div>Carregando...</div>;

  const entradasC = emCentavos(projeto.saldo_inicial) + aportes.reduce((s, a) => s + emCentavos(a.valor), 0);
  const gastoC = despesas.reduce((s, d) => s + emCentavos(d.valor_total), 0);
  const saldoC = entradasC - gastoC;
  const orcamentoC = emCentavos(projeto.limite_gasto);

  const pct = orcamentoC > 0 ? (gastoC / orcamentoC) * 100 : 0;
  const estourou = orcamentoC > 0 && gastoC > orcamentoC;

  const kpi = (icone: React.ReactNode, rotulo: string, valor: number, cor?: string) => (
    <div className="card kpi" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)', display: 'flex' }}>{icone}</div>
      <div>
        <div className="text-xs text-muted font-bold uppercase tracking-widest">{rotulo}</div>
        <div className="text-xl font-bold mt-1" style={cor ? { color: cor } : undefined}>{dinheiro(emReais(valor))}</div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* O orçamento: a primeira pergunta. */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Flag size={16} /> Orçamento
          </h2>
          <button className="text-xs" onClick={aoDefinirOrcamento} style={{ background: 'none', border: 'none', color: 'var(--accent-texto)', cursor: 'pointer', padding: 0 }}>
            {orcamentoC > 0 ? 'Editar' : 'Definir'}
          </button>
        </div>

        {orcamentoC > 0 ? (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <span className="text-xl font-bold" style={{ color: estourou ? 'var(--color-danger)' : 'var(--text-primary)' }}>{dinheiro(emReais(gastoC))}</span>
              <span className="text-sm text-muted">de {dinheiro(emReais(orcamentoC))}</span>
            </div>
            <div style={{ height: '8px', borderRadius: '4px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(pct, 100)}%`, height: '100%',
                background: estourou ? 'var(--color-danger)' : 'var(--accent)',
                transition: 'width 0.4s ease-out',
              }} />
            </div>
            <div className="text-xs text-muted">
              {estourou
                ? <strong style={{ color: 'var(--color-danger)' }}>Passou {dinheiro(emReais(gastoC - orcamentoC))} do orçamento</strong>
                : <>Faltam {dinheiro(emReais(orcamentoC - gastoC))} · {Math.round(pct)}% do orçamento</>}
            </div>
          </>
        ) : (
          // Seção dentro de cartão: frase curta (guia visual).
          <p className="text-sm text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
            Sem orçamento definido. Com ele, aqui aparece quanto do filme já foi gasto e quanto ainda dá para gastar.
          </p>
        )}
      </div>

      <div className="kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {kpi(<Wallet size={24} className="text-secondary" />, 'Entradas', entradasC)}
        {kpi(<TrendingUp size={24} className="text-danger" />, 'Gasto', gastoC)}
        {kpi(<HandCoins size={24} className={saldoC >= 0 ? 'text-accent' : 'text-danger'} />, 'Saldo', saldoC, saldoC < 0 ? 'var(--color-danger)' : undefined)}
      </div>

    </div>
  );
}
