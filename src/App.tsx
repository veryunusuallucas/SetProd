import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { ProjectLayout } from './pages/ProjectLayout';
import { DashboardGeral } from './components/DashboardGeral';
import { InfoProducao } from './components/InfoProducao';
import { Configuracoes } from './components/Configuracoes';
import { CommandPalette } from './components/CommandPalette';
import { Login } from './pages/Login';
import { CadastroEquipe } from './pages/CadastroEquipe';
import { LocacoesModule } from './pages/LocacoesModule';
import { DiariasList } from './pages/DiariasList';
import { DiariaModule } from './pages/DiariaModule';
import { FinanceiroModule } from './pages/FinanceiroModule';
import { TasksModule } from './pages/TasksModule';
import { DecupagemModule } from './pages/DecupagemModule';
import { DocumentosModule } from './pages/DocumentosModule';
import { TransporteModule } from './pages/TransporteModule';
import { GestaoDados } from './pages/GestaoDados';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BugReportModal } from './components/BugReportModal';
import { useState } from 'react';
import { Bug } from 'lucide-react';

// Placeholder components for new v3 modules
const EquipamentosModule = () => <div className="screen-padding">Módulo de Equipamentos - Em breve</div>;

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <CommandPaletteWrapper />
        <div className="app-container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro/:projetoId" element={<CadastroEquipe />} />
            
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            
            <Route path="/projeto/:id" element={<ProtectedRoute><ProjectLayout /></ProtectedRoute>}>
              <Route index element={<DashboardGeralWrapper />} />
              <Route path="producao" element={<InfoProducaoWrapper />} />
              <Route path="financeiro" element={<FinanceiroModule />} />
              <Route path="config" element={<ConfiguracoesWrapper />} />
              
              {/* New v3 Routes */}
              <Route path="diarias" element={<DiariasList />} />
              <Route path="diaria/:diariaId" element={<DiariaModule />} />
              <Route path="locacoes" element={<LocacoesModule />} />
              <Route path="equipamentos" element={<EquipamentosModule />} />
              <Route path="tasks" element={<TasksModule />} />
              <Route path="decupagem" element={<DecupagemModule />} />
              {/* Roteiro virou uma aba dentro de Decupagem; link antigo redireciona */}
              <Route path="breakdown" element={<Navigate to="../decupagem" replace />} />
              <Route path="documentos" element={<DocumentosModule />} />
              <Route path="transporte" element={<TransporteModule />} />
              <Route path="dados" element={<GestaoDados />} />
            </Route>
          </Routes>
          <GlobalBugButton />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

function GlobalBugButton() {
  const [show, setShow] = useState(false);

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="btn-primary"
        style={{
          position: 'fixed',
          bottom: '96px',
          right: '24px',
          zIndex: 9999,
          borderRadius: '50px',
          width: '48px',
          height: '48px',
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}
        title="Relatar Bug ou Sugestão"
      >
        <Bug size={24} className="text-danger" />
      </button>
      {show && <BugReportModal onClose={() => setShow(false)} />}
    </>
  );
}

// Wrappers to pass projetoId from context/params since previously they received it via props

function CommandPaletteWrapper() {
  const location = useLocation();
  const match = location.pathname.match(/\/projeto\/([a-zA-Z0-9-]+)/);
  const projetoId = match ? match[1] : undefined;
  
  const { user } = useAuth();
  if (!user) return null; // Don't show command palette on login

  return <CommandPalette projetoId={projetoId} />;
}

function DashboardGeralWrapper() {
  const { id } = useParams();
  return <DashboardGeral projetoId={id!} onNovaDiaria={() => {}} />;
}

function InfoProducaoWrapper() {
  const { id } = useParams();
  return <InfoProducao projetoId={id!} />;
}

function ConfiguracoesWrapper() {
  const { id } = useParams();
  return <Configuracoes projetoId={id!} />;
}

export default App;
