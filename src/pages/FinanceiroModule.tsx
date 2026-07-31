import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DespesasList } from '../components/DespesasList';
import { ResumoList } from '../components/ResumoList';
import { DashboardFinanceiro } from '../components/DashboardFinanceiro';
import { LayoutDashboard, Receipt, HandCoins } from 'lucide-react';
import { useLayoutContext } from './ProjectLayout';
import { DetalhesUsuario } from '../components/DetalhesUsuario';

type AbaFinanceiro = 'visao' | 'despesas' | 'acertos';

export function FinanceiroModule() {
  const { id } = useParams<{ id: string }>();
  const [abaAtiva, setAbaAtiva] = useState<AbaFinanceiro>('visao');
  const { openPanel, closePanel } = useLayoutContext();

  if (!id) return <div>ID do projeto não encontrado.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub Navbar Financeiro */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
        <button 
          onClick={() => setAbaAtiva('visao')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'visao' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'visao' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <LayoutDashboard size={18} /> <span style={{ fontSize: '12px' }}>Visão Geral</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('despesas')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'despesas' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'despesas' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Receipt size={18} /> <span style={{ fontSize: '12px' }}>Despesas</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('acertos')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'acertos' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'acertos' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <HandCoins size={18} /> <span style={{ fontSize: '12px' }}>Acertos</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      {abaAtiva === 'visao' && <DashboardFinanceiro projetoId={id} />}
      {abaAtiva === 'despesas' && <DespesasList projetoId={id} />}
      {abaAtiva === 'acertos' && (
        <ResumoList 
          projetoId={id} 
          onVerFicha={(uid) => {
            openPanel(
              <DetalhesUsuario 
                projetoId={id} 
                usuarioId={uid} 
                origem="acertos" 
                onVoltar={closePanel} 
              />
            );
          }} 
        />
      )}
      
    </div>
  );
}
