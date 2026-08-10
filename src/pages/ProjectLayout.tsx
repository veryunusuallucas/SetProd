import { useState, createContext, useContext, useEffect, Suspense } from 'react';
import { useParams, useNavigate, Outlet, useLocation, Link, NavLink } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { HelpButton } from '../components/HelpButton';
import { NotificacoesBell } from '../components/NotificacoesBell';
import { 
  LayoutDashboard, Film, Receipt, Settings, 
  ChevronLeft, MapPin, Camera, CheckSquare, CalendarDays, Search,
  LogOut, DollarSign, ListTodo, X, Menu, Users, FileText, Truck, Database
} from 'lucide-react';
import { CompartilharModal } from '../components/CompartilharModal';
import { StatusSync } from '../components/StatusSync';
import { participacaoLocal, garantirParticipacao } from '../lib/membros';
import { manterSincronizado } from '../lib/sincronizacaoAutomatica';

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

  // O `?? null` é o que separa "ainda procurando" de "procurei e não existe":
  // o Dexie devolve `undefined` nos dois casos, e sem esta distinção a tela
  // fica em "Carregando..." para sempre quando o projeto não está aqui.
  const projeto = useLiveQuery(async () => (await db.projetos.get(id!)) ?? null, [id]);

  const [rightPanelContent, setRightPanelContent] = useState<React.ReactNode | null>(null);
  
  const [mostrarCompartilhar, setMostrarCompartilhar] = useState(false);
  const [participacao, setParticipacao] = useState(() => participacaoLocal(id!));

  // A participação é buscada de novo ao abrir o projeto: quem entrou por
  // convite em outro aparelho precisa aparecer aqui sem ter que sair e voltar.
  useEffect(() => {
    let vivo = true;
    let parar: (() => void) | undefined;

    // `garantir` e não só `sincronizar`: se o registro do fundador falhou na
    // criação (sem internet), abrir o projeto é a segunda chance dele.
    //
    // E a participação vem ANTES de ligar o sync: sem ela a RLS recusa tudo, e
    // a primeira rodada seria só um 42501 inútil.
    garantirParticipacao(id!).then(() => {
      if (!vivo) return;
      setParticipacao(participacaoLocal(id!));
      parar = manterSincronizado(id!);
    });

    return () => { vivo = false; parar?.(); };
  }, [id]);

  const currentPath = location.pathname;

  // Clear right panel on navigation
  useEffect(() => {
    setRightPanelContent(null);
  }, [currentPath]);

  // Mobile sidebar state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // `undefined` é o Dexie ainda respondendo; `null` é resposta dada e não achou.
  if (projeto === undefined) return <div className="screen-padding">Carregando...</div>;

  if (!projeto) {
    // Beco sem saída que o compartilhamento cria: você entrou na produção pelo
    // convite, mas o dado ainda mora no aparelho de quem te convidou. Antes só
    // dava para abrir projeto que já estava aqui, então isto não existia — e
    // sem este aviso a tela ficaria em "Carregando..." para sempre.
    return (
      <div className="screen-padding" style={{ maxWidth: '520px', margin: '10vh auto', textAlign: 'center' }}>
        <Users size={32} style={{ opacity: 0.6 }} />
        <h2 className="text-xl font-bold" style={{ marginTop: '16px' }}>
          {participacao ? 'Produção ainda não está neste aparelho' : 'Produção não encontrada'}
        </h2>
        <p className="text-sm text-muted" style={{ marginTop: '10px', lineHeight: 1.5 }}>
          {participacao
            ? 'Você tem acesso, mas o conteúdo ainda vive no aparelho de quem te convidou. A sincronização entre equipes é a próxima etapa.'
            : 'Ela não existe neste navegador e você não participa dela.'}
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/')} style={{ marginTop: '20px' }}>
          Voltar ao início
        </button>
      </div>
    );
  }

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

      {/*
        Aqui ficava o seletor "Quem está usando?", que deixava escolher o
        próprio papel num dropdown. Com login de verdade isso não faz mais
        sentido: o papel vem da conta, e quem decide o que ela pode é a RLS do
        servidor — não um <select> que qualquer um mexe.
      */}
      <button
        className="sidebar-link"
        onClick={() => setMostrarCompartilhar(true)}
        style={{ marginTop: '12px' }}
      >
        <Users size={18} />
        <span>Quem tem acesso</span>
        {participacao?.apelido && (
          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            {participacao.apelido}
          </span>
        )}
      </button>

      <StatusSync projetoId={id!} />
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
                {/* Suspense aqui, e não só lá no App: as telas do projeto
                    carregam sob demanda, e sem esta fronteira mais interna a
                    troca de aba derrubaria a barra lateral inteira por um
                    instante — o app pareceria recarregar a cada clique. */}
                <Suspense fallback={<div className="screen-padding" style={{ padding: '40px 0', color: 'var(--text-secondary)' }}>Carregando…</div>}>
                  <Outlet />
                </Suspense>
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

        {/*
          Este slot mudava conforme o papel simulado (fotografia via
          Equipamentos, resto via Tasks). Com A e B no mesmo nível não há mais
          de onde tirar essa escolha, então fica Tasks, que serve a todo mundo —
          Equipamentos continua a um toque, pelo "Mais".
        */}
        <NavLink to={`/projeto/${id}/tasks`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <ListTodo size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Tasks</span>
        </NavLink>

        {/* More Button */}
        <button className="nav-item" onClick={() => setMobileSidebarOpen(true)}>
          <Menu size={20} />
          <span style={{ fontSize: '10px', fontWeight: 600 }}>Mais</span>
        </button>
      </nav>

      {mostrarCompartilhar && (
        <CompartilharModal
          projetoId={id!}
          nomeProjeto={projeto.nome}
          aoFechar={() => {
            setMostrarCompartilhar(false);
            setParticipacao(participacaoLocal(id!));
          }}
        />
      )}
    </div>
  );
}
