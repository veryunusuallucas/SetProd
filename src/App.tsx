import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { ProjectLayout } from './pages/ProjectLayout';
import { CommandPalette } from './components/CommandPalette';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { BugReportModal } from './components/BugReportModal';
import { PenseNisso } from './components/PenseNisso';
import { lazy, Suspense, useState } from 'react';
import { Bug } from 'lucide-react';

/**
 * As telas de dentro do app carregam sob demanda.
 *
 * Antes tudo vinha num pacote só, e a conta era pesada: o pdf.js entra pela
 * Decupagem e sozinho responde por metade do arquivo — mesmo para quem abriu o
 * app só para lançar uma despesa, ou para quem está no 4G do set esperando a
 * tela de login aparecer.
 *
 * Ficam de fora deste corte a Home e o Login: são a porta de entrada, e
 * dividi-las só adicionaria uma espera antes da primeira tela.
 */
const DashboardGeral = lazy(() => import('./components/DashboardGeral').then(m => ({ default: m.DashboardGeral })));
const InfoProducao = lazy(() => import('./components/InfoProducao').then(m => ({ default: m.InfoProducao })));
const Configuracoes = lazy(() => import('./components/Configuracoes').then(m => ({ default: m.Configuracoes })));
const CriarConta = lazy(() => import('./pages/CriarConta').then(m => ({ default: m.CriarConta })));
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha').then(m => ({ default: m.EsqueciSenha })));
const NovaSenha = lazy(() => import('./pages/NovaSenha').then(m => ({ default: m.NovaSenha })));
const CadastroEquipe = lazy(() => import('./pages/CadastroEquipe').then(m => ({ default: m.CadastroEquipe })));
const ResponderPesquisa = lazy(() => import('./pages/ResponderPesquisa').then(m => ({ default: m.ResponderPesquisa })));
const AceitarConvite = lazy(() => import('./pages/AceitarConvite').then(m => ({ default: m.AceitarConvite })));
const LocacoesModule = lazy(() => import('./pages/LocacoesModule').then(m => ({ default: m.LocacoesModule })));
const DiariasList = lazy(() => import('./pages/DiariasList').then(m => ({ default: m.DiariasList })));
const DiariaModule = lazy(() => import('./pages/DiariaModule').then(m => ({ default: m.DiariaModule })));
const FinanceiroModule = lazy(() => import('./pages/FinanceiroModule').then(m => ({ default: m.FinanceiroModule })));
const TasksModule = lazy(() => import('./pages/TasksModule').then(m => ({ default: m.TasksModule })));
const DecupagemModule = lazy(() => import('./pages/DecupagemModule').then(m => ({ default: m.DecupagemModule })));
const DocumentosModule = lazy(() => import('./pages/DocumentosModule').then(m => ({ default: m.DocumentosModule })));
const TransporteModule = lazy(() => import('./pages/TransporteModule').then(m => ({ default: m.TransporteModule })));
const GestaoDados = lazy(() => import('./pages/GestaoDados').then(m => ({ default: m.GestaoDados })));

/** O que aparece durante o instante em que a tela está chegando. */
function Carregando() {
  return (
    <div className="screen-padding" style={{ padding: '40px 24px', color: 'var(--text-secondary)' }}>
      Carregando…
    </div>
  );
}

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
          {/* Rede de segurança das rotas de fora do projeto. As de dentro têm
              a própria, junto do Outlet, para a barra lateral não piscar a cada
              troca de aba. */}
          <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            {/* Autocadastro. É `/criar-conta` e não `/cadastro` porque
                `/cadastro/:projetoId` logo abaixo já é outra coisa — a ficha
                pública da equipe. Nomes parecidos para telas diferentes é como
                se acaba mandando o link errado para a pessoa errada. */}
            <Route path="/criar-conta" element={<CriarConta />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            {/* Onde o e-mail de recuperação desemboca. O token vem na própria
                URL e o supabase-js o troca por sessão sozinho. */}
            <Route path="/nova-senha" element={<NovaSenha />} />
            <Route path="/cadastro/:projetoId" element={<CadastroEquipe />} />
            {/* Link publico da pesquisa: sem login, como o de cadastro. */}
            <Route path="/pesquisa/:pesquisaId" element={<ResponderPesquisa />} />
            {/* Fora do ProtectedRoute: quem chega pelo link de convite pode não
                ter conta ainda, e a tela explica antes de mandar para o login. */}
            <Route path="/convite/:token" element={<AceitarConvite />} />
            
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
          </Suspense>
          <GlobalBugButton />
          <PenseNissoQuandoLogado />
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

/**
 * O aviso do J. Martins só existe dentro do app.
 *
 * Fora dele ficam as telas públicas — cadastro da equipe, pesquisa e convite —
 * abertas por gente de fora respondendo um formulário. A piada é interna, e
 * numa dessas telas ela viraria só um pop-up estranho num site desconhecido.
 */
function PenseNissoQuandoLogado() {
  const { user } = useAuth();
  const location = useLocation();

  // `nova-senha` entra nesta lista mesmo tendo sessão: o link de recuperação
  // já loga a pessoa, e o aviso apareceria por cima da troca de senha.
  const publica = /^\/(login|cadastro|criar-conta|esqueci-senha|nova-senha|pesquisa|convite)(\/|$)/.test(location.pathname);
  if (!user || publica) return null;

  return <PenseNisso />;
}

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
