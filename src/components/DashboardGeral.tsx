import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
export function DashboardGeral({ projetoId }: { projetoId: string, onNovaDiaria?: () => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  const [diariaAtual, setDiariaAtual] = useState(() => {
    const salva = localStorage.getItem(`diaria_atual_${projetoId}`);
    return salva ? parseInt(salva.replace(/\D/g, '')) || 1 : 1;
  });

  const alterarDiaria = (nova: number) => {
    setDiariaAtual(nova);
    localStorage.setItem(`diaria_atual_${projetoId}`, `Diária ${nova}`);
  };

  // Contadores animados
  const [animatedSaldo, setAnimatedSaldo] = useState(0);
  const [animatedGasto, setAnimatedGasto] = useState(0);

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (projeto && !editMode) setForm(projeto);
  }, [projeto, editMode]);

  useEffect(() => {
    if (!projeto || !despesas) return;
    
    const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
    const saldoAtual = (projeto.saldo_inicial || 0) - totalGasto;

    // Animação simples de counter
    let start: number | null = null;
    const duration = 600;
    const initialGasto = animatedGasto;
    const initialSaldo = animatedSaldo;

    const step = (timestamp: number) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      
      setAnimatedGasto(initialGasto + (totalGasto - initialGasto) * progress);
      setAnimatedSaldo(initialSaldo + (saldoAtual - initialSaldo) * progress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setAnimatedGasto(totalGasto);
        setAnimatedSaldo(saldoAtual);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [projeto, despesas]);


  if (!projeto || !despesas) return <div style={{ padding: '24px' }}>Carregando dashboard...</div>;

  const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
  const saldoAtual = (projeto.saldo_inicial || 0) - totalGasto;
  const isEstourado = totalGasto > (projeto.limite_gasto || Infinity);

  // Maior gasto
  let topSpenderId = '';
  let topSpenderValue = 0;
  const gastosPorPessoa: Record<string, number> = {};
  despesas.forEach(d => {
    d.pagadores.forEach(pg => {
      const pagador = pg.id_ref || 'caixa_central';
      gastosPorPessoa[pagador] = (gastosPorPessoa[pagador] || 0) + pg.valor;
      if (gastosPorPessoa[pagador] > topSpenderValue) {
        topSpenderValue = gastosPorPessoa[pagador];
        topSpenderId = pagador;
      }
    });
  });

  const getNomeMembro = (id: string) => {
    if (id === 'caixa_central') return 'Caixa';
    const p = perfis?.find(x => x.id === id);
    return p ? p.nome : 'Desconhecido';
  };

  // Último gasto
  const gastoRecente = despesas.length > 0 ? despesas.sort((a,b) => b.data - a.data)[0] : null;

  // Montar Faixa de Diárias
  const totalPlanejado = projeto.num_diarias || 0;
  
  // Agrupar gastos por diária
  const gastosPorDiaria: Record<string, number> = {};
  despesas.forEach(d => {
    const nomeD = d.diaria || 'Geral';
    gastosPorDiaria[nomeD] = (gastosPorDiaria[nomeD] || 0) + d.valor_total;
  });

  // Gerar lista de diárias para a faixa (Pré-produção + 1 até N)
  const listaDiarias = ['Pré-produção'];
  for (let i = 1; i <= Math.max(totalPlanejado, diariaAtual); i++) {
    listaDiarias.push(`Diária ${i}`);
  }

  const salvarConfig = async () => {
    if (!form) return;
    await db.projetos.put(form);
    setEditMode(false);
  };

  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
      
      {/* Título e Progresso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>{projeto.nome}</h2>
          {totalPlanejado > 0 && (
            <div className="text-sm text-secondary" style={{ marginTop: '4px' }}>
              Diária {diariaAtual} de {totalPlanejado}
              {diariaAtual > totalPlanejado && <span className="text-danger" style={{ marginLeft: '8px' }}>⚠️ Excedido</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => editMode ? salvarConfig() : setEditMode(true)}
          className="text-xs font-bold"
          style={{ backgroundColor: editMode ? 'var(--accent)' : 'var(--bg-surface)', color: editMode ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 12px' }}
        >
          {editMode ? 'Salvar Config. Financeira' : 'Editar Configuração'}
        </button>
      </div>

      {editMode && form && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--accent)' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2">Configurações Financeiras do Projeto</div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Fonte do Orçamento</label><input value={form.fonte_orcamento || ''} onChange={e => setForm({ ...form, fonte_orcamento: e.target.value })} placeholder="Ex: Netflix, Edital X" /></div>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Produtor Executivo</label><input value={form.produtor_executivo || ''} onChange={e => setForm({ ...form, produtor_executivo: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Saldo Inicial / Caixa</label><input type="number" value={form.saldo_inicial ?? ''} onChange={e => setForm({ ...form, saldo_inicial: num(e.target.value) })} /></div>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">Orçamento Máximo</label><input type="number" value={form.limite_gasto ?? ''} onChange={e => setForm({ ...form, limite_gasto: num(e.target.value) })} /></div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}><label className="text-xs text-muted font-bold uppercase">PIX do Caixa / Produtora</label><input value={form.pix_caixa || ''} onChange={e => setForm({ ...form, pix_caixa: e.target.value })} /></div>
            <div style={{ flex: 1 }}>
              <label className="text-xs text-muted font-bold uppercase">Modo de Acerto</label>
              <select 
                value={form.modo_acerto || 'direto'} 
                onChange={e => setForm({ ...form, modo_acerto: e.target.value })} 
                disabled={despesas.length > 0}
                style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: despesas.length > 0 ? 'var(--bg-primary)' : 'var(--bg-surface)', width: '100%', opacity: despesas.length > 0 ? 0.7 : 1 }}
              >
                <option value="direto">Compensado (Líquido) - Cada um paga quem deve direto</option>
                <option value="centralizado">Banco do Projeto - Todos pagam/recebem do Caixa</option>
              </select>
            </div>
          </div>
          <div className="text-xs text-muted mt-2">
            <strong>Atenção:</strong> {despesas.length > 0 ? 'O Modo de Acerto não pode ser alterado pois já existem despesas lançadas neste projeto.' : 'O Modo de Acerto altera como o sistema calcula quem deve quem. Evite alterar após o início das despesas.'}
          </div>
        </div>
      )}

      {/* Info Rápida */}
      {!editMode && (
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {projeto.fonte_orcamento && <span className="text-xs text-muted"><strong>Fonte:</strong> {projeto.fonte_orcamento}</span>}
          {projeto.produtor_executivo && <span className="text-xs text-muted"><strong>Executivo:</strong> {projeto.produtor_executivo}</span>}
          <span className="text-xs text-muted"><strong>Colaboradores:</strong> {perfis?.length || 0} pessoas</span>
          <span className="text-xs text-muted"><strong>Modo de Acerto:</strong> {projeto.modo_acerto === 'centralizado' ? 'Banco do Projeto' : 'Compensado (Líquido)'}</span>
        </div>
      )}

      {/* Grid de Cards Principais */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', 
        gap: '16px' 
      }}>
        {/* Saldo Disponível */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Saldo Disp.</span>
          <span className="text-2xl font-bold" style={{ color: saldoAtual < 0 ? 'var(--color-danger)' : 'var(--text-primary)', transition: 'color 0.3s ease' }}>
            R$ {animatedSaldo.toFixed(2)}
          </span>
          <span className="text-xs text-muted" style={{ marginTop: '4px' }}>
            Inicial: R$ {(projeto.saldo_inicial || 0).toFixed(2)}
          </span>
        </div>

        {/* Total Gasto (ou Gasto Recente) */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', borderColor: isEstourado ? 'var(--color-danger)' : 'var(--border-color)', transition: 'border-color 0.3s ease' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px', color: isEstourado ? 'var(--color-danger)' : 'var(--text-secondary)' }}>Total Gasto</span>
          <span className="text-lg font-bold" style={{ color: isEstourado ? 'var(--color-danger)' : 'var(--text-primary)' }}>R$ {animatedGasto.toFixed(2)}</span>
          <span className="text-xs text-muted" style={{ marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {gastoRecente ? `Último: ${gastoRecente.descricao}` : 'Nenhum gasto'}
          </span>
        </div>

        {/* Top Spender */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Maior Gasto</span>
          <span className="text-lg font-bold text-accent">R$ {topSpenderValue.toFixed(2)}</span>
          <span className="text-xs text-muted" style={{ marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getNomeMembro(topSpenderId)}
          </span>
        </div>
      </div>

      {/* Faixa de Diárias */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest">Faixa de Diárias</span>
        </div>
        
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          overflowX: 'auto', 
          paddingBottom: '12px',
          scrollBehavior: 'smooth'
        }} className="hide-scrollbar">
          
          {listaDiarias.map((dStr) => {
            // Se for Pré-produção, o index p/ alterar não é número simples. Vamos tratar.
            const isPre = dStr === 'Pré-produção';
            const numDaDiaria = isPre ? 0 : parseInt(dStr.replace(/\D/g, '')) || 1;
            
            // Ativo se for a diária atual selecionada
            const isActive = isPre ? (diariaAtual === 0) : (diariaAtual === numDaDiaria);
            
            const gastoNesta = gastosPorDiaria[dStr] || 0;

            return (
              <div 
                key={dStr} 
                onClick={() => alterarDiaria(numDaDiaria)}
                style={{ 
                  flex: '0 0 auto', 
                  minWidth: '120px',
                  padding: '12px', 
                  borderRadius: '16px', 
                  backgroundColor: isActive ? 'var(--bg-active)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-light)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transform: isActive ? 'translateY(-2px)' : 'none',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <span className="text-sm font-bold" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {isPre ? 'Pré-prod.' : dStr}
                </span>
                <span className="text-xs font-bold" style={{ color: gastoNesta > 0 ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                  R$ {gastoNesta.toFixed(2)}
                </span>
              </div>
            );
          })}

        </div>
      </div>

    </div>
  );
}
