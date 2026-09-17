import { useState, createContext, useContext, useEffect, useRef, Suspense } from 'react';
import { useParams, useNavigate, Outlet, useLocation, Link } from 'react-router-dom';
import { voltarDe } from '../lib/navegacao';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useOcuparRodape } from '../components/ui/slotFlutuante';
import { DockDoProjeto } from '../components/menu/DockDoProjeto';
import { FolhaDeModulos } from '../components/menu/FolhaDeModulos';
import { abrirAjuda, abrirRelatarProblema, useAjudaNoMenu } from '../components/menu/ajudaNoMenu';
import { NotificacoesBell } from '../components/NotificacoesBell';
import { 
  LayoutDashboard, Film, Receipt, Settings, 
  ChevronLeft, MapPin, CheckSquare, CalendarDays, CalendarClock, Search,
  LogOut, DollarSign, ListTodo, X, Users, FileText, Truck, Database, Clapperboard, HelpCircle, Bug,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { CompartilharModal } from '../components/CompartilharModal';
import { StatusSync } from '../components/StatusSync';
import { AvisoConflito } from '../components/AvisoConflito';
import { AvisoSemFicha } from '../components/AvisoSemFicha';
import { useAuth } from '../hooks/useAuth';
import { participacaoLocal, garantirParticipacao } from '../lib/membros';
import { manterSincronizado } from '../lib/sincronizacaoAutomatica';
import { confirmar } from '../components/ui/Confirmacao';

export /** O menu lateral preso (com nomes) ou em trilho. Por aparelho. */
const CHAVE_MENU_PRESO = 'setprod:menu:preso';

/** Uma media query como estado, para a tela reagir a girar e redimensionar. */
function useMedia(consulta: string) {
  const [vale, setVale] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia(consulta);
    const mudar = () => setVale(m.matches);
    m.addEventListener('change', mudar);
    // O 'resize' é reforço: em navegador embarcado e em janela redimensionada
    // no braço, o 'change' às vezes não chega, e a tela ficava no layout errado.
    window.addEventListener('resize', mudar);
    setVale(m.matches);
    return () => {
      m.removeEventListener('change', mudar);
      window.removeEventListener('resize', mudar);
    };
  }, [consulta]);
  return vale;
}

const LayoutContext = createContext<{
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
  const { user } = useAuth();

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

  /*
    O botão ao lado do nome do projeto SOBE UM NÍVEL, não sai direto.

    Ele mandava para a tela inicial de qualquer lugar do app: quem estava numa
    diária perdia o projeto inteiro com um clique, e voltar custava três. Agora
    ele segue a hierarquia — diária → lista de diárias → painel → sair — e a
    saída do projeto, que é a única irreversível na navegação, pergunta antes.
  */
  const destinoDoVoltar = voltarDe(currentPath, id || '');

  const voltar = async () => {
    if (destinoDoVoltar.caminho) { navigate(destinoDoVoltar.caminho); return; }
    /*
      No painel do projeto, o voltar SAI — e sair é a única parada da navegação
      que custa caro para desfazer: quem estava no meio de uma diária perde o
      caminho inteiro e refaz três cliques para voltar.
    */
    const ok = await confirmar({
      titulo: 'Sair do projeto?',
      detalhe: `Você volta para a lista de produções. ${projeto?.nome || 'O projeto'} continua exatamente como está.`,
      confirmar: 'Sair do projeto',
      cancelar: 'Ficar aqui',
    });
    if (ok) navigate('/');
  };

  // Clear right panel on navigation
  useEffect(() => {
    setRightPanelContent(null);
  }, [currentPath]);

  // Mobile sidebar state
  /** A barra de baixo do celular, medida para o menu flutuante não cair em cima dela. */
  const barraDeBaixo = useOcuparRodape();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /*
    No celular, a ajuda e o "relatar problema" moram no menu do "Mais", e o
    botão flutuante sai da tela — o canto de baixo é da dock. No computador a
    barra lateral não tem esse menu, então o botão continua.
  */
  const temDock = useMedia('(max-width: 767px)');
  useAjudaNoMenu(temDock);

  /*
    O MENU LATERAL VIRA TRILHO (fase 2 da leva dos menus, 17/09/2026).

    Preso, é a barra de sempre, com os nomes, empurrando o conteúdo. Solto,
    encolhe para só ícones e abre POR CIMA quando o mouse chega — por cima, e
    não empurrando, porque senão a tela inteira dançaria toda vez que o mouse
    passasse por ali a caminho de outra coisa.

    O padrão muda com o aparelho: no computador começa preso (é a barra que a
    equipe já conhece), no tablet começa em trilho, que é onde a largura faz
    falta. A escolha da pessoa vale mais, e fica guardada no aparelho.
  */
  const ehComputador = useMedia('(min-width: 1024px)');
  const [escolhaDoMenu, setEscolhaDoMenu] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAVE_MENU_PRESO); } catch { return null; }
  });
  const menuPreso = escolhaDoMenu === null ? ehComputador : escolhaDoMenu === 'sim';
  const trocarMenuPreso = () => {
    const novo = menuPreso ? 'nao' : 'sim';
    setEscolhaDoMenu(novo);
    try { localStorage.setItem(CHAVE_MENU_PRESO, novo); } catch { /* fica só nesta visita */ }
  };

  const [menuAberto, setMenuAberto] = useState(false);
  const esperaDoMenu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /*
    450ms, e não os 160 do primeiro corte (pedido do Lucas, 17/09/2026): quem
    já sabe qual ícone é o dele mira e clica sem querer ver nome nenhum, e o
    menu abria no caminho. Meio segundo é o tempo de quem PAROU ali para ler.
    Quem quiser na hora, clica: o clique abre sem esperar.
  */
  const entrouNoMenu = () => {
    clearTimeout(esperaDoMenu.current);
    esperaDoMenu.current = setTimeout(() => setMenuAberto(true), 450);
  };
  const saiuDoMenu = () => { clearTimeout(esperaDoMenu.current); setMenuAberto(false); };
  // No toque não existe "tirar o mouse": trocar de módulo fecha o trilho.
  useEffect(() => { setMenuAberto(false); }, [currentPath]);
  useEffect(() => () => clearTimeout(esperaDoMenu.current), []);

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
        { name: 'Diárias', path: `/projeto/${id}/diarias`, icon: CalendarDays, exact: false },
        { name: 'Eventos', path: `/projeto/${id}/eventos`, icon: CalendarClock, exact: false },
        { name: 'Tasks', path: `/projeto/${id}/tasks`, icon: CheckSquare, exact: false },
      ]
    },
    {
      title: 'EQUIPE',
      items: [
        { name: 'Produção', path: `/projeto/${id}/producao`, icon: Users, exact: false },
      ]
    },
    {
      title: 'CRIATIVO',
      items: [
        { name: 'Decupagem & Storyboard', path: `/projeto/${id}/decupagem`, icon: Film, exact: false },
        { name: 'Logagem', path: `/projeto/${id}/logagem`, icon: Clapperboard, exact: false },
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
        <button onClick={voltar} className="btn-icon" title={destinoDoVoltar.rotulo} aria-label={destinoDoVoltar.rotulo}>
          <ChevronLeft size={24} />
        </button>
        <div className="sidebar-title">
          <h2 className="text-base font-bold truncate" title={projeto.nome}>{projeto.nome}</h2>
          <span className="text-xs text-muted">SetProd v4</span>
        </div>
      </div>
      
      <div className="sidebar-nav" style={{ flex: 1, overflowY: 'auto' }}>
        {navGroups.map((group) => (
          // Sem título de grupo (pedido do Lucas, 17/09/2026): a ordem já diz o
          // agrupamento, e cinco títulos numa barra estreita só faziam volume.
          <div key={group.title} className="sidebar-bloco">
            {group.items.map(item => (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`sidebar-link ${isActive(item.path, item.exact) ? 'active' : ''}`}
                title={item.name}
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
        <div className="sidebar-notificacoes" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px' }}>
          <NotificacoesBell projetoId={id} />
          <span className="text-xs text-muted">Notificações</span>
        </div>
        <button className="sidebar-link" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
          <Search size={18} />
          <span>Busca (Cmd+K)</span>
        </button>
        <button className="sidebar-link" onClick={() => navigate('/')}>
          <LogOut size={18} /> <span>Sair do Projeto</span>
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
    <div
      className="project-layout"
      style={{ ['--menu-largura' as string]: menuPreso ? '240px' : '58px' } as React.CSSProperties}
    >
      {/* O menu lateral: barra no computador, trilho de ícones quando solto. */}
      <aside
        className={`sidebar menu-lateral ${menuPreso ? 'preso' : 'trilho'} ${!menuPreso && menuAberto ? 'aberto' : ''}`}
        onPointerEnter={e => { if (!menuPreso && e.pointerType !== 'touch') entrouNoMenu(); }}
        onPointerLeave={saiuDoMenu}
        onFocus={() => { if (!menuPreso) setMenuAberto(true); }}
        onClick={() => { if (!menuPreso) setMenuAberto(true); }}
      >
        {renderSidebarContent()}
        <button
          type="button"
          className="alfinete-menu"
          onClick={e => { e.stopPropagation(); trocarMenuPreso(); setMenuAberto(false); }}
          aria-pressed={menuPreso}
          title={menuPreso ? 'Encolher o menu (só ícones)' : 'Prender o menu aberto'}
          aria-label={menuPreso ? 'Encolher o menu' : 'Prender o menu aberto'}
        >
          {menuPreso ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </aside>

      {/*
        No celular, o "Mais" abre uma FOLHA de baixo, e não mais a barra
        lateral do computador por cima da tela: quem está no set segura o
        aparelho com uma mão, e o dedo que tocou no rodapé já está no lugar do
        próximo toque. Ver `.md/PLANO-menus.md`.
      */}
      <FolhaDeModulos
        aberta={mobileSidebarOpen}
        aoFechar={() => setMobileSidebarOpen(false)}
        ativo={currentPath}
        /*
          A grade do "Mais": o que NÃO está na dock, na cor da sua área, e no
          fim as duas de aviso — a ajuda e o "relatar problema", que antes
          moravam no botão flutuante do canto.
        */
        itens={[
          { nome: 'Logagem', path: `/projeto/${id}/logagem`, icone: Clapperboard, cor: 'var(--cor-criativo)' },
          { nome: 'Decupagem', path: `/projeto/${id}/decupagem`, icone: Film, cor: 'var(--cor-criativo)' },
          { nome: 'Documentos', path: `/projeto/${id}/documentos`, icone: FileText, cor: 'var(--cor-criativo)' },
          { nome: 'Produção', path: `/projeto/${id}/producao`, icone: Users, cor: 'var(--cor-equipe)' },
          { nome: 'Eventos', path: `/projeto/${id}/eventos`, icone: CalendarClock, cor: 'var(--cor-set)' },
          { nome: 'Locações', path: `/projeto/${id}/locacoes`, icone: MapPin, cor: 'var(--cor-logistica)' },
          { nome: 'Transporte', path: `/projeto/${id}/transporte`, icone: Truck, cor: 'var(--cor-logistica)' },
          { nome: 'Dados', path: `/projeto/${id}/dados`, icone: Database, cor: 'var(--cor-logistica)' },
          { nome: 'Acesso', icone: Users, cor: 'var(--cor-equipe)', aoTocar: () => setMostrarCompartilhar(true) },
          { nome: 'Config', path: `/projeto/${id}/config`, icone: Settings, cor: 'var(--text-muted)' },
          { nome: 'Como funciona', icone: HelpCircle, cor: 'var(--color-danger)', aoTocar: abrirAjuda },
          { nome: 'Relatar problema', icone: Bug, cor: 'var(--color-danger)', aoTocar: abrirRelatarProblema },
        ]}
        rodape={
          <>
            <button
              className="sidebar-link"
              onClick={() => { setMobileSidebarOpen(false); window.dispatchEvent(new Event('open-command-palette')); }}
            >
              <Search size={18} />
              <span>Busca</span>
            </button>
            <button className="sidebar-link" onClick={() => { setMobileSidebarOpen(false); navigate('/'); }}>
              <LogOut size={18} />
              <span>Sair do Projeto</span>
            </button>
          </>
        }
      />

      {/* Main Content Area */}
      {/* O espaço embaixo mora no CSS (.main-content), e não aqui: no celular ele
          depende da altura da barra de baixo e da faixa de gestos do aparelho,
          e estilo inline não obedece a media query. */}
      <main className="main-content">
        
        {/* O cabeçalho do celular. No tablet e no computador, quem tem o voltar e
            o nome da produção é o menu lateral. */}
        {temDock && <header className="mobile-header" style={{ 
          position: 'sticky', top: 0, zIndex: 40, backgroundColor: 'var(--bg-primary)', 
          display: 'flex', alignItems: 'center', gap: '16px',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <button onClick={voltar} className="btn-icon" style={{ padding: 0 }} title={destinoDoVoltar.rotulo} aria-label={destinoDoVoltar.rotulo}>
            <ChevronLeft size={24} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="text-lg font-bold truncate">{projeto.nome}</h2>
          </div>
          <button className="btn-icon text-muted" onClick={() => window.dispatchEvent(new Event('open-command-palette'))}>
            <Search size={20} />
          </button>
          <NotificacoesBell projetoId={id} />
          {/* Aqui havia um segundo "?". O menu flutuante do canto já abre a
              ajuda em toda tela, e os dois lado a lado espremiam o nome da
              produção em duas linhas. */}
        </header>}

        <div className="screen-padding" style={{ paddingTop: '24px' }}>
          <LayoutContext.Provider value={{
            openPanel: (content) => setRightPanelContent(content),
            closePanel: () => setRightPanelContent(null)
          }}>
            <div className="master-detail-container">
              <div className="master-detail-master">
                {/* Fora do Suspense: o aviso não depende da tela que está
                    carregando, e é o mesmo em todas as abas da produção. */}
                <AvisoSemFicha projetoId={id!} meuEmail={user?.email} />

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
      {/* Ela se anuncia como ocupante do rodapé, para o menu de ajuda ficar
          acima dela em vez de por cima do "Mais". No desktop ela vira barra
          lateral e a medida vai a zero sozinha. */}
      <DockDoProjeto
        refDaBarra={barraDeBaixo}
        ativo={currentPath}
        aberta={mobileSidebarOpen}
        aoAbrirMais={() => setMobileSidebarOpen(true)}
        itens={[
          { nome: 'Dash', path: `/projeto/${id}`, icone: LayoutDashboard, exact: true },
          { nome: 'Diárias', path: `/projeto/${id}/diarias`, icone: CalendarDays },
          { nome: '$$$', path: `/projeto/${id}/financeiro`, icone: DollarSign },
          { nome: 'Tasks', path: `/projeto/${id}/tasks`, icone: ListTodo },
        ]}
      />

      {/* Fica montado sempre: o conflito chega quando chega, e um aviso que só
          existe se alguma tela específica estiver aberta não avisaria ninguém. */}
      <AvisoConflito projetoId={id} />

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
