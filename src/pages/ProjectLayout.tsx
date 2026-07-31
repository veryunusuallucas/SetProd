import { useState, createContext, useContext, useEffect } from 'react';
import { useParams, useNavigate, Outlet, useLocation, Link, NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { HelpButton } from '../components/HelpButton';
import { NotificacoesBell } from '../components/NotificacoesBell';
import { 
  LayoutDashboard, Film, Receipt, Settings, 
  ChevronLeft, MapPin, Camera, CheckSquare, CalendarDays, Search,
  LogOut, Calendar, DollarSign, ListTodo, Shield, X
} from 'lucide-react';

export const LayoutContext = createContext<{
  openPanel: (content: React.ReactNode) => void;
  closePanel: () => void;
}>({ openPanel: () => {}, closePanel: () => {} });

export function useLayoutContext() {
  return useContext(LayoutContext);
}

export function ProjectLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const projeto = useLiveQuery(() => db.projetos.get(id!), [id]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(id!).toArray(), [id]) || [];
  
  const [rightPanelContent, setRightPanelContent] = useState<React.ReactNode | null>(null);
  
  const [meuPerfilId, setMeuPerfilId] = useState(() => localStorage.getItem('mock_perfil_id') || '');
  
  const mudarMeuPerfil = (id: string) => {
    setMeuPerfilId(id);
    localStorage.setItem('mock_perfil_id', id);
    const p = perfis.find(x => x.id === id);
    if (p && p.funcao?.toLowerCase().includes('foto')) {
      localStorage.setItem('mock_papel', 'fotografia');
    } else {
      localStorage.setItem('mock_papel', 'producao');
    }
    window.dispatchEvent(new Event('storage'));
  };

  const currentPath = location.pathname;

  // Clear right panel on navigation
  useEffect(() => {
    setRightPanelContent(null);
  }, [currentPath]);

  if (!projeto) return <div>Carregando...</div>;

  const navItems = [
    { name: 'Dashboard', path: `/projeto/${id}`, icon: LayoutDashboard, exact: true },
    { name: 'Produção', path: `/projeto/${id}/producao`, icon: Film, exact: false },
    { name: 'Diárias / OD', path: `/projeto/${id}/diarias`, icon: CalendarDays, exact: false },
    { name: 'Financeiro', path: `/projeto/${id}/financeiro`, icon: Receipt, exact: false },
    { name: 'Locações', path: `/projeto/${id}/locacoes`, icon: MapPin, exact: false },
    { name: 'Equipamentos', path: `/projeto/${id}/equipamentos`, icon: Camera, exact: false },
    { name: 'Tasks', path: `/projeto/${id}/tasks`, icon: CheckSquare, exact: false },
    { name: 'Configurações', path: `/projeto/${id}/config`, icon: Settings, exact: false },
  ];

  const isActive = (path: string, exact: boolean) => {
    if (exact) return currentPath === path;
    return currentPath.startsWith(path);
  };

  return (
    <div className="project-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-header">
          <button onClick={() => navigate('/')} className="btn-icon">
            <ChevronLeft size={24} />
          </button>
          <div className="sidebar-title">
            <h2 className="text-base font-bold truncate" title={projeto.nome}>{projeto.nome}</h2>
            <span className="text-xs text-muted">SetProd</span>
          </div>
        </div>
        
        <div className="sidebar-nav">
          <div className="text-xs text-secondary font-bold uppercase tracking-widest px-4 mb-2 mt-4">Principal</div>
          {navItems.map(item => (
            <Link 
              key={item.name} 
              to={item.path} 
              className={`sidebar-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
            >
              <item.icon size={18} />
              <span>{item.name}</span>
            </Link>
          ))}
        </div>
        
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
            <NotificacoesBell projetoId={id} />
            <span className="text-xs text-muted">Notificações</span>
          </div>
          <button className="sidebar-link" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
            <Search size={18} />
            <span>Busca (Cmd+K)</span>
          </button>
          <button className="sidebar-link" onClick={() => navigate('/')}>
            <LogOut size={18} /> Sair do Projeto
          </button>
        </div>

        {/* Seletor Mock de Usuário Logado */}
        <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
          <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-2" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} /> Quem está usando?
          </div>
          <select 
            value={meuPerfilId} 
            onChange={e => mudarMeuPerfil(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', fontSize: '13px' }}
          >
            <option value="">-- Modo Root / Admin --</option>
            {perfis.filter(p => p.id !== 'caixa_central').map(p => (
              <option key={p.id} value={p.id}>{p.nome} {p.sobrenome} ({p.funcao || 'Membro'})</option>
            ))}
          </select>
          <div className="text-xs text-muted mt-2" style={{ lineHeight: 1.3 }}>
            Simula login. Afeta permissões e filtros "Minhas Tasks".
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ paddingBottom: '90px' }}>
        
        {/* Mobile Header */}
        <header className="mobile-header mobile-only" style={{ 
          position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'var(--bg-primary)', 
          padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <button onClick={() => navigate('/')} className="btn-icon" style={{ padding: 0 }}>
            <ChevronLeft size={24} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="text-lg font-bold truncate">{projeto.nome}</h2>
          </div>
          <button className="btn-icon text-muted" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
            <Search size={20} />
          </button>
          <NotificacoesBell projetoId={id} />
          <HelpButton />
        </header>

        <div className="screen-padding" style={{ paddingTop: '24px' }}>
          <LayoutContext.Provider value={{
            openPanel: (content) => setRightPanelContent(content),
            closePanel: () => setRightPanelContent(null)
          }}>
            <div className="master-detail-container">
              <div className="master-detail-master">
                <Outlet />
              </div>
              
              {rightPanelContent && (
                <div className="master-detail-detail">
                  <div style={{ padding: '8px', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-primary)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <button onClick={() => setRightPanelContent(null)} className="btn-icon">
                      <X size={20} />
                    </button>
                  </div>
                  {rightPanelContent}
                </div>
              )}
            </div>
          </LayoutContext.Provider>
        </div>

      </main>

      {/* Mobile Bottom Nav */}
      <nav className="glass-nav mobile-only">
        <NavLink to={`/projeto/${id}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Dash</span>
        </NavLink>

        <NavLink to={`/projeto/${id}/diarias`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Calendar size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>OD</span>
        </NavLink>

        <NavLink to={`/projeto/${id}/tasks`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <ListTodo size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Tasks</span>
        </NavLink>

        <NavLink to={`/projeto/${id}/financeiro`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <DollarSign size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>$$$</span>
        </NavLink>
      </nav>

    </div>
  );
}
