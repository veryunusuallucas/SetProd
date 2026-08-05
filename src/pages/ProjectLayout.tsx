import { useState, createContext, useContext, useEffect } from 'react';
import { useParams, useNavigate, Outlet, useLocation, Link, NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { HelpButton } from '../components/HelpButton';
import { NotificacoesBell } from '../components/NotificacoesBell';
import { 
  LayoutDashboard, Film, Receipt, Settings, 
  ChevronLeft, MapPin, Camera, CheckSquare, CalendarDays, Search,
  LogOut, DollarSign, ListTodo, Shield, X, Menu, Users, FileText, Truck, Database
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
  const [meuPapel, setMeuPapel] = useState(() => localStorage.getItem('mock_papel') || 'producao');
  
  const mudarMeuPerfil = (id: string) => {
    setMeuPerfilId(id);
    localStorage.setItem('mock_perfil_id', id);
    const p = perfis.find(x => x.id === id);
    let novoPapel = 'producao';
    if (p && p.funcao?.toLowerCase().includes('foto')) {
      novoPapel = 'fotografia';
    } else if (p && p.funcao?.toLowerCase().includes('ac')) {
      novoPapel = 'ac';
    }
    setMeuPapel(novoPapel);
    localStorage.setItem('mock_papel', novoPapel);
    window.dispatchEvent(new Event('storage'));
  };

  const currentPath = location.pathname;

  // Clear right panel on navigation
  useEffect(() => {
    setRightPanelContent(null);
  }, [currentPath]);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!projeto) return <div>Carregando...</div>;

  const navGroups = [
    {
      title: 'SET',
      items: [
        { name: 'Dashboard', path: `/projeto/${id}`, icon: LayoutDashboard, exact: true },
        { name: 'Diárias / OD', path: `/projeto/${id}/diarias`, icon: CalendarDays, exact: false },
        { name: 'Tasks', path: `/projeto/${id}/tasks`, icon: CheckSquare, exact: false },
      ]
    },
    {
      title: 'EQUIPE',
      items: [
        { name: 'Produção', path: `/projeto/${id}/producao`, icon: Users, exact: false },
        { name: 'Equipamentos', path: `/projeto/${id}/equipamentos`, icon: Camera, exact: false },
      ]
    },
    {
      title: 'CRIATIVO',
      items: [
        { name: 'Decupagem & Storyboard', path: `/projeto/${id}/decupagem`, icon: Film, exact: false },
        { name: 'Documentos', path: `/projeto/${id}/documentos`, icon: FileText, exact: false },
      ]
    },
    {
      title: 'LOGÍSTICA',
      items: [
        { name: 'Locações', path: `/projeto/${id}/locacoes`, icon: MapPin, exact: false },
        { name: 'Transporte', path: `/projeto/${id}/transporte`, icon: Truck, exact: false },
      ]
    },
    {
      title: 'FINANCEIRO',
      items: [
        { name: 'Financeiro', path: `/projeto/${id}/financeiro`, icon: Receipt, exact: false },
      ]
    }
  ];

  const isActive = (path: string, exact: boolean) => {
    if (exact) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const renderSidebarContent = () => (
    <>
      <div className="sidebar-header">
        <button onClick={() => navigate('/')} className="btn-icon">
          <ChevronLeft size={24} />
        </button>
        <div className="sidebar-title">
          <h2 className="text-base font-bold truncate" title={projeto.nome}>{projeto.nome}</h2>
          <span className="text-xs text-muted">SetProd v4</span>
        </div>
      </div>
      
      <div className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group) => (
          <div key={group.title} style={{ marginBottom: '16px' }}>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest px-4 mb-2 mt-2">{group.title}</div>
            {group.items.map(item => (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`sidebar-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
                onClick={() => setMobileSidebarOpen(false)}
              >
                <item.icon size={18} />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <Link
            to={`/projeto/${id}/dados`}
            className={`sidebar-link ${isActive(`/projeto/${id}/dados`, false) ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <Database size={18} />
            <span>Gestão de Dados</span>
          </Link>
          <Link
            to={`/projeto/${id}/config`}
            className={`sidebar-link ${isActive(`/projeto/${id}/config`, false) ? 'active' : ''}`}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <Settings size={18} />
            <span>Configurações</span>
          </Link>
        </div>
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
      <div style={{ marginTop: '12px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
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
          Papel atual: <strong>{meuPapel}</strong>
        </div>
      </div>
    </>
  );

  return (
    <div className="project-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Sidebar (Overlay) */}
      {mobileSidebarOpen && (
        <div className="mobile-only" style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <aside className="sidebar" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '280px', transform: 'translateX(0)', transition: 'transform 0.3s' }}>
            <div style={{ position: 'absolute', right: '-48px', top: '16px' }}>
              <button onClick={() => setMobileSidebarOpen(false)} className="btn-icon" style={{ backgroundColor: 'var(--bg-primary)' }}>
                <X size={24} />
              </button>
            </div>
            {renderSidebarContent()}
          </aside>
        </div>
      )}

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
        <NavLink to={`/projeto/${id}`} className={({ isActive }) => `nav-item ${isActive && currentPath === `/projeto/${id}` ? 'active' : ''}`} end>
          <LayoutDashboard size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Dash</span>
        </NavLink>

        <NavLink to={`/projeto/${id}/diarias`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <CalendarDays size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>OD</span>
        </NavLink>

        <NavLink to={`/projeto/${id}/financeiro`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <DollarSign size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>$$$</span>
        </NavLink>

        {/* 4th Adaptive Slot */}
        {meuPapel === 'fotografia' ? (
          <NavLink to={`/projeto/${id}/equipamentos`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Camera size={20} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>Equips</span>
          </NavLink>
        ) : (
          <NavLink to={`/projeto/${id}/tasks`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ListTodo size={20} />
            <span style={{ fontSize: '10px', fontWeight: 600 }}>Tasks</span>
          </NavLink>
        )}

        {/* More Button */}
        <button className="nav-item" onClick={() => setMobileSidebarOpen(true)}>
          <Menu size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Mais</span>
        </button>
      </nav>

    </div>
  );
}
