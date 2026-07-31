import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { DashboardGeral } from '../components/DashboardGeral';
import { InfoProducao } from '../components/InfoProducao';
import { DespesasList } from '../components/DespesasList';
import { ResumoList } from '../components/ResumoList';
import { Configuracoes } from '../components/Configuracoes';
import { DetalhesUsuario } from '../components/DetalhesUsuario';
import { HelpButton } from '../components/HelpButton';

import { LayoutDashboard, Film, Receipt, HandCoins, Settings, ChevronLeft } from 'lucide-react';

type Aba = 'dashboard' | 'producao' | 'despesas' | 'acertos' | 'config';

export function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const projeto = useLiveQuery(() => db.projetos.get(id!), [id]);

  const [abaAtiva, setAbaAtiva] = useState<Aba>('dashboard');
  const [usuarioSelecionadoId, setUsuarioSelecionadoId] = useState<string | null>(null);
  const [origemDetalhe, setOrigemDetalhe] = useState<'producao' | 'acertos'>('acertos');



  // Trocar de aba pelo menu SEMPRE fecha qualquer detalhe/sub-tela aberto (§6.1)
  const irParaAba = (aba: Aba) => {
    setUsuarioSelecionadoId(null);
    setAbaAtiva(aba);
  };

  // "Ver ficha completa" a partir dos Acertos: leva pra Produção com o membro aberto
  const verFichaCompleta = (uid: string) => {
    setOrigemDetalhe('producao');
    setAbaAtiva('producao');
    setUsuarioSelecionadoId(uid);
  };

  if (!projeto) return <div>Carregando...</div>;

  return (
    <div className="dash-shell" style={{ paddingBottom: '90px' }}>
      
      {/* Top Header */}
      <header style={{ 
        position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'var(--bg-primary)', 
        padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <button onClick={() => navigate('/')} className="btn-icon" style={{ padding: 0 }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="text-lg font-bold">{projeto.nome}</h2>
        </div>
        <HelpButton />
      </header>

      {/* Content */}
      <div className="screen-padding" style={{ paddingTop: '24px' }}>
        {usuarioSelecionadoId ? (
          <DetalhesUsuario projetoId={projeto.id} usuarioId={usuarioSelecionadoId} origem={origemDetalhe} onVoltar={() => setUsuarioSelecionadoId(null)} onVerFicha={verFichaCompleta} />
        ) : (
          <>
            {abaAtiva === 'dashboard' && <DashboardGeral projetoId={projeto.id} onNovaDiaria={() => setAbaAtiva('despesas')} />}
            {abaAtiva === 'producao' && <InfoProducao projetoId={projeto.id} />}
            {abaAtiva === 'despesas' && <DespesasList projetoId={projeto.id} />}
            {abaAtiva === 'acertos' && <ResumoList projetoId={projeto.id} onVerFicha={verFichaCompleta} />}
            {abaAtiva === 'config' && <Configuracoes projetoId={projeto.id} />}
          </>
        )}
      </div>

      {/* Glass Bottom Nav */}
      <nav className="glass-nav">
        
        <button className={`nav-item ${abaAtiva === 'dashboard' ? 'active' : ''}`} onClick={() => irParaAba('dashboard')}>
          <LayoutDashboard size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Dashboard</span>
        </button>

        <button className={`nav-item ${abaAtiva === 'producao' ? 'active' : ''}`} onClick={() => irParaAba('producao')}>
          <Film size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Produção</span>
        </button>

        {/* FAB Central */}
        <button className="fab" onClick={() => irParaAba('despesas')}>
          <Receipt size={24} />
        </button>

        <button className={`nav-item ${abaAtiva === 'acertos' ? 'active' : ''}`} onClick={() => irParaAba('acertos')}>
          <HandCoins size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Acertos</span>
        </button>

        <button className={`nav-item ${abaAtiva === 'config' ? 'active' : ''}`} onClick={() => irParaAba('config')}>
          <Settings size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Config</span>
        </button>

      </nav>

    </div>
  );
}
