import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import { AuthProvider, useAuth } from './hooks/useAuth';

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
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

// Wrappers to pass projetoId from context/params since previously they received it via props
import { useParams, useLocation } from 'react-router-dom';

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
