import { useState, createContext, useContext, useEffect, useRef, Suspense } from 'react';
import { useMinhaFuncao } from '../hooks/useMinhaFuncao';
import { limparFichasQueNaoPossoVer } from '../lib/fichaEmCamadas';
import { useParams, useNavigate, Outlet, useLocation, Link } from 'react-router-dom';
import { voltarDe } from '../lib/navegacao';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useOcuparRodape } from '../components/ui/slotFlutuante';
import { DockDoProjeto } from '../components/menu/DockDoProjeto';
import { FolhaDeModulos } from '../components/menu/FolhaDeModulos';
import { abrirAjuda, abrirRelatarProblema, useAjudaNoMenu } from '../components/menu/ajudaNoMenu';
import { EditorDaDock } from '../components/menu/EditorDaDock';
import {
  MODULOS, caminhoDo, moduloDoCaminho, moduloPorId, quartoLugar, useFixosDaDock,
  lerUltima, guardarUltima, EVENTO_EDITAR_DOCK, type IdModulo,
} from '../components/menu/modulosDaDock';
import { NotificacoesBell } from '../components/NotificacoesBell';
import { 
  LayoutDashboard, Film, Receipt, Settings, 
  ChevronLeft, MapPin, CheckSquare, CalendarDays, CalendarClock, Search,
  LogOut, X, Users, FileText, Truck, Database, Clapperboard, HelpCircle, Bug,
  PanelLeftClose, PanelLeftOpen, Pencil
} from 'lucide-react';
import { CompartilharModal } from '../components/CompartilharModal';
import { StatusSync } from '../components/StatusSync';
import { AvisoConflito } from '../components/AvisoConflito';
import { AvisoSemFicha } from '../components/AvisoSemFicha';
import { AvisoDeAcesso } from '../components/AvisoDeAcesso';
import { ConflitosPanel } from '../components/ConflitosPanel';
import { ProvedorDeAvisos } from '../components/avisos/CentralDeAvisos';
import { useAuth } from '../hooks/useAuth';
import { participacaoLocal, garantirParticipacao, sincronizarParticipacoes } from '../lib/membros';
import { supabase, supabaseConfigurado } from '../lib/supabase';
import { ShieldAlert } from 'lucide-react';
import { manterSincronizado } from '../lib/sincronizacaoAutomatica';
import { confirmar } from '../components/ui/Confirmacao';
import { useRole } from '../hooks/useRole';
import { definirContextoDeEscrita, esquecerContextoDeEscrita } from '../lib/travaDeEscrita';

export /** O menu lateral preso (com nomes) ou em trilho. Por aparelho. */
const CHAVE_MENU_PRESO = 'setprod:menu:preso';

/**
 * Quando a produção usa a dock do celular em vez da barra lateral: tela
 * estreita, ou tela de toque de pé (iPad em retrato) ou deitada e baixa
 * (celular deitado). A mesma consulta mora no `layout.css`.
 */
const CONSULTA_DA_DOCK =
  '(max-width: 767px), (hover: none) and (pointer: coarse) and (orientation: portrait), (hover: none) and (pointer: coarse) and (max-height: 500px)';

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

  /*
    O que a trava de escrita precisa saber sobre mim nesta produção — ver
    `lib/travaDeEscrita.ts`. Enquanto a ficha carrega, o contexto não existe e
    a trava deixa o departamental passar (falha abrindo, como o resto).
  */
  const { perfilId: meuPerfilId } = useRole();
  const minhaFuncao = useMinhaFuncao();
  const meuDepartamentoId = minhaFuncao.perfil?.departamento_id ?? null;
  useEffect(() => {
    if (minhaFuncao.carregando || projeto === undefined) return;
    definirContextoDeEscrita(id!, {
      meuPerfilId: meuPerfilId || undefined,
      meuDepartamentoId,
      usuarioId: user?.id,
      meuEmail: user?.email ?? undefined,
      liberadosLogagem: projeto?.logagem_liberados,
    });
    return () => esquecerContextoDeEscrita(id!);
  }, [id, meuPerfilId, meuDepartamentoId, minhaFuncao.carregando, projeto, user?.id, user?.email]);

  /*
    A cor da minha função como variável CSS (ROADMAP, Etapa 9), e não como cor
    em linha: a fase visual muda o app inteiro mexendo em CSS, sem tocar em
    componente. Sem ficha ou sem departamento, vale o neutro do :root.
  */
  useEffect(() => {
    const raiz = document.documentElement;
    if (minhaFuncao.cor) raiz.style.setProperty('--cor-funcao', minhaFuncao.cor);
    else raiz.style.removeProperty('--cor-funcao');
    return () => { raiz.style.removeProperty('--cor-funcao'); };
  }, [minhaFuncao.cor]);

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

  /*
    A ficha em camadas (fichaEmCamadas.ts): antes dela, o CPF e a ficha médica
    de todo mundo chegavam a todo aparelho. Com o papel conhecido, o que esta
    conta não pode ver sai daqui — e não volta, porque o servidor não manda.
  */
  useEffect(() => {
    if (participacao) limparFichasQueNaoPossoVer(id!).catch(() => {});
  }, [id, participacao?.papel, participacao?.perfil_id]);

  /*
    O PAPEL PODE MUDAR COM A TELA ABERTA (ROADMAP, Etapa 8). Quem administra
    rebaixa alguém para "leitura", e essa pessoa, com o app aberto desde de
    manhã, continuava vendo os botões que o servidor já não honra. Voltar para
    a aba (ou para o app, no celular) relê as participações — no máximo uma vez
    a cada 30 segundos, que trocar de aba toda hora não é motivo para consulta.
  */
  useEffect(() => {
    let ultima = 0;
    const reler = () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultima < 30_000) return;
      ultima = Date.now();
      sincronizarParticipacoes().then(() => setParticipacao(participacaoLocal(id!))).catch(() => {});
    };
    window.addEventListener('focus', reler);
    document.addEventListener('visibilitychange', reler);
    return () => {
      window.removeEventListener('focus', reler);
      document.removeEventListener('visibilitychange', reler);
    };
  }, [id]);

  /*
    MODO ADMINISTRADOR (ROADMAP, Etapa 8). O super-admin entra em qualquer
    produção pelo `e_admin()` do servidor, sem ser membro — e, sem aviso, é
    fácil editar a produção de alguém achando que é a própria. A faixa também
    explica por que ele vê botões que o dono não vê.
  */
  const [souSuperAdmin, setSouSuperAdmin] = useState(false);
  useEffect(() => {
    if (!supabaseConfigurado || !user) return;
    let vivo = true;
    supabase.rpc('e_admin').then(({ data }) => { if (vivo) setSouSuperAdmin(Boolean(data)); });
    return () => { vivo = false; };
  }, [user]);
  const modoAdministrador = souSuperAdmin && !participacao;

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
  /** A folha aberta no editor da dock, e em qual dos três lugares. */
  const [editandoDock, setEditandoDock] = useState<number | null>(null);
  const fecharFolha = () => { setMobileSidebarOpen(false); setEditandoDock(null); };

  /*
    A DOCK É DE QUEM USA (pedido do Lucas, 18/09/2026): três fixos que cada um
    escolhe e um quarto lugar que acompanha o último módulo aberto — assim ela
    sempre mostra onde você está. Ver `modulosDaDock.ts`.
  */
  const fixos = useFixosDaDock();
  const moduloAtual = moduloDoCaminho(currentPath, id!);
  const [ultima, setUltima] = useState<IdModulo | null>(() => lerUltima(id!));
  useEffect(() => { setUltima(lerUltima(id!)); }, [id]);
  useEffect(() => {
    if (moduloAtual && !fixos.includes(moduloAtual)) {
      setUltima(moduloAtual);
      guardarUltima(id!, moduloAtual);
    }
  }, [moduloAtual, fixos, id]);
  const quarto = quartoLugar(fixos, moduloAtual, ultima);
  const idsDaDock = [...fixos, quarto];

  // A tela de Config também abre o editor.
  useEffect(() => {
    const abrir = () => { setMobileSidebarOpen(true); setEditandoDock(0); };
    window.addEventListener(EVENTO_EDITAR_DOCK, abrir);
    return () => window.removeEventListener(EVENTO_EDITAR_DOCK, abrir);
  }, []);

  /*
    No celular, a ajuda e o "relatar problema" moram no menu do "Mais", e o
    botão flutuante sai da tela — o canto de baixo é da dock. No computador a
    barra lateral não tem esse menu, então o botão continua.
  */
  const temDock = useMedia(CONSULTA_DA_DOCK);
  /** Tela de toque: não existe "passar o mouse", então não existe trilho. */
  const soToque = useMedia('(hover: none) and (pointer: coarse)');
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
  const menuPreso = soToque || (escolhaDoMenu === null ? ehComputador : escolhaDoMenu === 'sim');
  const trocarMenuPreso = () => {
    const novo = menuPreso ? 'nao' : 'sim';
    setEscolhaDoMenu(novo);
    try { localStorage.setItem(CHAVE_MENU_PRESO, novo); } catch { /* fica só nesta visita */ }
  };

  const [menuAberto, setMenuAberto] = useState(false);
  const esperaDoMenu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ondeParou = useRef({ x: 0, y: 0 });
  /** Clicou num ícone: o trilho não abre até o mouse sair e voltar. */
  const clicouNoTrilho = useRef(false);
  /*
    O TRILHO ABRE POR "INTENÇÃO", NÃO POR PASSAGEM (18/09/2026).

    O clique abria o menu na hora — e o foco que o clique dá ao link também —,
    e em seguida a troca de tela o fechava: meio segundo de menu aberto a cada
    clique, que era o "esquisito" que o Lucas via. Agora é o padrão de hover
    intent das barras que se expandem:

    - abre só quando o mouse PARA sobre o trilho por 400ms. Mexer mais que
      alguns pixels recomeça a conta — quem está passando a caminho de um
      ícone nunca vê o menu abrir;
    - clicar num ícone NUNCA abre. Quem clicou já sabia onde ia;
    - fecha 200ms depois de o mouse sair, e não no mesmo instante: escorregar
      um pixel para fora da borda não derruba o menu;
    - pelo teclado (Tab), abre na hora, porque aí não há ícone para mirar.
  */
  const armarAbertura = () => {
    clearTimeout(esperaDoMenu.current);
    if (clicouNoTrilho.current) return;
    esperaDoMenu.current = setTimeout(() => setMenuAberto(true), 400);
  };
  const entrouNoMenu = (e: React.PointerEvent) => {
    ondeParou.current = { x: e.clientX, y: e.clientY };
    armarAbertura();
  };
  const moveuNoMenu = (e: React.PointerEvent) => {
    if (menuAberto || e.pointerType === 'touch') return;
    if (Math.hypot(e.clientX - ondeParou.current.x, e.clientY - ondeParou.current.y) < 6) return;
    ondeParou.current = { x: e.clientX, y: e.clientY };
    armarAbertura();
  };
  const saiuDoMenu = () => {
    clicouNoTrilho.current = false;
    clearTimeout(esperaDoMenu.current);
    esperaDoMenu.current = setTimeout(() => setMenuAberto(false), 200);
  };
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

  const quadroDoAcesso = {
    nome: 'Acesso', icone: Users, cor: 'var(--cor-equipe)', aoTocar: () => setMostrarCompartilhar(true),
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
        onPointerEnter={e => { if (!menuPreso && e.pointerType !== 'touch') entrouNoMenu(e); }}
        onPointerMove={e => { if (!menuPreso) moveuNoMenu(e); }}
        onPointerLeave={e => { if (!menuPreso && e.pointerType !== 'touch') saiuDoMenu(); }}
        onPointerDown={() => {
          if (menuPreso || menuAberto) return;
          clicouNoTrilho.current = true;
          clearTimeout(esperaDoMenu.current);
        }}
        onFocus={e => {
          // Só o foco do teclado: o do clique é o clique, e clique não abre.
          if (!menuPreso && (e.target as HTMLElement).matches(':focus-visible')) setMenuAberto(true);
        }}
        onBlur={e => {
          if (!menuPreso && !e.currentTarget.contains(e.relatedTarget as Node | null)) setMenuAberto(false);
        }}
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
        aoFechar={fecharFolha}
        ativo={currentPath}
        rotulo={editandoDock !== null ? 'Editar a barra de baixo' : 'Mais'}
        substituto={editandoDock !== null
          ? <EditorDaDock key={editandoDock} vagaInicial={editandoDock} aoConcluir={() => setEditandoDock(null)} />
          : undefined}
        acaoDoTopo={editandoDock === null && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => setEditandoDock(0)}
            title="Escolher os módulos da barra de baixo"
            aria-label="Editar a barra de baixo"
          >
            <Pencil size={16} />
          </button>
        )}
        /*
          A grade do "Mais": todo módulo que não é um dos três fixos — o do
          quarto lugar fica também, para a grade não trocar de desenho a cada
          tela aberta. Depois o "Quem tem acesso", a ajuda (neutra) e o
          "relatar problema" (vermelho). Config mora no rodapé, com a Busca e
          o Sair (pedido do Lucas, 18/09/2026). Com os fixos padrão são 12
          quadros: a grade 3×4 do Lucas.
        */
        itens={[
          ...MODULOS.filter(m => m.id !== 'config' && !fixos.includes(m.id)).flatMap(m => {
            const quadro = {
              nome: m.nome, icone: m.icone, cor: m.cor,
              path: caminhoDo(id!, m), exact: m.trecho === '', aqui: moduloAtual === m.id,
            };
            // "Acesso" entra logo depois da Produção: é da mesma área.
            return m.id === 'producao' ? [quadro, quadroDoAcesso] : [quadro];
          }),
          // Produção virou fixo: o Acesso fica sem vizinho e vai para o fim.
          ...(fixos.includes('producao') ? [quadroDoAcesso] : []),
          { nome: 'Como funciona', icone: HelpCircle, cor: 'var(--text-secondary)', aoTocar: abrirAjuda },
          { nome: 'Relatar problema', icone: Bug, cor: 'var(--color-danger)', aoTocar: abrirRelatarProblema },
        ]}
        rodape={
          <>
            <button
              className="sidebar-link"
              onClick={() => { fecharFolha(); window.dispatchEvent(new Event('open-command-palette')); }}
            >
              <Search size={18} />
              <span>Busca</span>
            </button>
            <Link to={`/projeto/${id}/config`} className="sidebar-link" onClick={fecharFolha}>
              <Settings size={18} />
              <span>Configurações</span>
            </Link>
            <button className="sidebar-link" onClick={() => { fecharFolha(); navigate('/'); }}>
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
        {modoAdministrador && (
          <div
            role="status"
            style={{
              position: 'sticky', top: 0, zIndex: 45,
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
              backgroundColor: 'var(--color-warning-bg)', borderBottom: '1px solid var(--color-warning)',
              color: 'var(--text-primary)', fontSize: '12px', fontWeight: 600,
            }}
          >
            <ShieldAlert size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
            Modo administrador · esta produção não é sua. O que você mudar aqui muda para a equipe dela.
          </div>
        )}
        
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
                {/* Os três publicam na central, que decide quem aparece;
                    nenhum deles desenha faixa por conta própria. */}
                <ProvedorDeAvisos>
                  <AvisoDeAcesso projetoId={id!} aoAbrirAcesso={() => setMostrarCompartilhar(true)} />
                  <ConflitosPanel projetoId={id!} />
                  <AvisoSemFicha projetoId={id!} meuEmail={user?.email} />
                </ProvedorDeAvisos>

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
        aberta={mobileSidebarOpen}
        aoAbrirMais={() => { setEditandoDock(null); setMobileSidebarOpen(true); }}
        aoSegurar={n => { setEditandoDock(n > 2 ? 0 : n); setMobileSidebarOpen(true); }}
        indiceAtivo={moduloAtual ? idsDaDock.indexOf(moduloAtual) : -1}
        fluido={3}
        itens={idsDaDock.map(mid => {
          const m = moduloPorId(mid);
          return { nome: m.curto ?? m.nome, path: caminhoDo(id!, m), icone: m.icone, exact: m.trecho === '' };
        })}
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
