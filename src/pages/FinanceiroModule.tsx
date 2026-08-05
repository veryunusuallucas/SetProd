import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { DespesasList } from '../components/DespesasList';
import { ResumoList } from '../components/ResumoList';
import { DashboardFinanceiro } from '../components/DashboardFinanceiro';
import { EntradasList } from '../components/EntradasList';
import { ControleFinanceiro } from '../components/ControleFinanceiro';
import { MovimentoList } from '../components/MovimentoList';
import { LayoutDashboard, HandCoins, List, Settings, ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { useLayoutContext } from './ProjectLayout';
import { DetalhesUsuario } from '../components/DetalhesUsuario';

type AbaFinanceiro = 'visao' | 'movimento' | 'controle' | 'entradas' | 'saidas' | 'distribuicao';

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
          <LayoutDashboard size={18} /> <span style={{ fontSize: '12px' }}>Dashboard</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('movimento')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'movimento' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'movimento' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <List size={18} /> <span style={{ fontSize: '12px' }}>Extrato</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('controle')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'controle' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'controle' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Settings size={18} /> <span style={{ fontSize: '12px' }}>Controle</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('entradas')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'entradas' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'entradas' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <ArrowDownToLine size={18} /> <span style={{ fontSize: '12px' }}>Entradas</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('saidas')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'saidas' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'saidas' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <ArrowUpToLine size={18} /> <span style={{ fontSize: '12px' }}>Saídas</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('distribuicao')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'distribuicao' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'distribuicao' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <HandCoins size={18} /> <span style={{ fontSize: '12px' }}>Acertos</span>
        </button>
      </div>

      {/* Conteúdo Dinâmico */}
      {abaAtiva === 'visao' && <DashboardFinanceiro projetoId={id} />}
      {abaAtiva === 'movimento' && <MovimentoList projetoId={id} />}
      {abaAtiva === 'controle' && <ControleFinanceiro projetoId={id} />}
      {abaAtiva === 'entradas' && <EntradasList projetoId={id} />}
      {abaAtiva === 'saidas' && <DespesasList projetoId={id} />}
      {abaAtiva === 'distribuicao' && (
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
