import { useLiveQuery } from 'dexie-react-hooks';
import { dinheiro, paraData } from '../lib/formato';
import { db } from '../db/db';
import { ArrowDownToLine, ArrowUpToLine, Calendar, FileText } from 'lucide-react';

export function MovimentoList({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  if (!projeto) return <div>Carregando...</div>;

  // Montar o extrato cronológico
  const movimentos: any[] = [];

  // Saldo Inicial
  if (projeto.saldo_inicial && projeto.saldo_inicial > 0) {
    movimentos.push({
      id: 'saldo_inicial',
      tipo: 'entrada',
      data: projeto.data_criacao || 0,
      descricao: 'Saldo Inicial (Configuração)',
      valor: projeto.saldo_inicial,
      detalhes: 'Configuração do projeto'
    });
  }

  // Aportes
  aportes.forEach(a => {
    movimentos.push({
      id: `aporte_${a.id}`,
      tipo: 'entrada',
      data: a.data,
      descricao: `Aporte: ${a.origem}`,
      valor: a.valor,
      detalhes: a.obs || 'Sem observação'
    });
  });

  // Despesas
  despesas.forEach(d => {
    const pagador = perfis.find(p => p.id === d.pagadores[0]?.id_ref);
    const pagadorNome = pagador ? `${pagador.nome} ${pagador.sobrenome || ''}` : 'Caixa';
    
    movimentos.push({
      id: `despesa_${d.id}`,
      tipo: 'saida',
      /*
        `new Date('2026-08-28')` daria meia-noite em UTC — 21h do dia 27 aqui.
        O extrato mostrava a despesa um dia antes do que a pessoa digitou, e no
        dia 1º do mês ela pulava para o mês anterior.
      */
      data: (paraData(d.data_ocorrencia) ?? paraData(d.data))?.getTime() ?? 0,
      descricao: d.descricao,
      valor: d.valor_total,
      detalhes: `Pago por: ${pagadorNome} | Categ: ${d.categoria}${d.diaria ? ` | ${d.diaria}` : ''}`
    });
  });

  // Ordenar do mais recente pro mais antigo
  movimentos.sort((a, b) => b.data - a.data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <FileText size={20} className="text-accent" />
          <h3 className="text-lg font-bold">Extrato de Movimentação</h3>
        </div>

        {movimentos.length === 0 ? (
          <div className="text-center text-muted py-8">Nenhuma movimentação registrada no projeto ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {movimentos.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: m.tipo === 'entrada' ? 'rgba(0, 196, 159, 0.1)' : 'rgba(255, 128, 66, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.tipo === 'entrada' ? <ArrowDownToLine size={20} className="text-success" /> : <ArrowUpToLine size={20} className="text-danger" />}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="font-bold text-base" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.descricao}</div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
                    <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      {new Date(m.data).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-xs text-secondary">{m.detalhes}</div>
                  </div>
                </div>

                <div className={`font-bold text-lg ${m.tipo === 'entrada' ? 'text-success' : 'text-danger'}`} style={{ whiteSpace: 'nowrap' }}>
                  {m.tipo === 'entrada' ? '+' : '-'} {dinheiro(m.valor)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
