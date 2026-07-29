import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, LayoutDashboard, Film, CalendarDays, Receipt, HandCoins, MapPin, Settings, Home } from 'lucide-react';

interface Comando {
  label: string;
  atalho?: string;
  icon: any;
  path: string;
}

export function CommandPalette({ projetoId }: { projetoId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [ativo, setAtivo] = useState(0);
  const navigate = useNavigate();

  const comandos = useMemo<Comando[]>(() => {
    const base: Comando[] = [{ label: 'Ir para Projetos', icon: Home, path: '/' }];
    if (!projetoId) return base;
    const p = `/projeto/${projetoId}`;
    return [
      { label: 'Dashboard', icon: LayoutDashboard, path: p },
      { label: 'Produção / Equipe', icon: Film, path: `${p}/producao` },
      { label: 'Diárias / Ordem do Dia', icon: CalendarDays, path: `${p}/diarias` },
      { label: 'Nova despesa', atalho: 'Financeiro', icon: Receipt, path: `${p}/despesas` },
      { label: 'Acertos', icon: HandCoins, path: `${p}/acertos` },
      { label: 'Locações', icon: MapPin, path: `${p}/locacoes` },
      { label: 'Configurações', icon: Settings, path: `${p}/config` },
      ...base,
    ];
  }, [projetoId]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comandos;
    return comandos.filter(c => (c.label + ' ' + (c.atalho || '')).toLowerCase().includes(q));
  }, [query, comandos]);

  useEffect(() => {
    const abrir = () => { setQuery(''); setAtivo(0); setIsOpen(true); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); abrir(); }
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', abrir as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', abrir as EventListener);
    };
  }, []);

  useEffect(() => { setAtivo(0); }, [query]);

  if (!isOpen) return null;

  const executar = (c?: Comando) => {
    const alvo = c || filtrados[ativo];
    if (!alvo) return;
    setIsOpen(false);
    navigate(alvo.path);
  };

  const onKeyList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo(a => Math.min(a + 1, filtrados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); executar(); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh' }} onClick={() => setIsOpen(false)}>
      <div className="card" style={{ width: '100%', maxWidth: '520px', margin: '0 16px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
          <Search size={20} className="text-muted" style={{ marginRight: '8px' }} />
          <input
            autoFocus
            placeholder="Buscar ação ou tela… (ex: despesa, equipe, OD)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyList}
            style={{ border: 'none', backgroundColor: 'transparent', padding: 0, fontSize: '16px' }}
          />
          <button className="btn-icon text-muted" onClick={() => setIsOpen(false)} style={{ width: '28px', height: '28px', marginLeft: '8px', border: 'none', backgroundColor: 'transparent' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '50vh', overflowY: 'auto' }}>
          {filtrados.length === 0 && <div className="px-2 text-sm text-muted" style={{ padding: '12px' }}>Nada encontrado.</div>}
          {filtrados.map((c, i) => (
            <button
              key={c.path + c.label}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => executar(c)}
              className="sidebar-link"
              style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left', backgroundColor: i === ativo ? 'var(--bg-active)' : 'transparent', border: 'none', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <c.icon size={16} className="text-muted" />
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.atalho && <span className="text-xs text-muted">{c.atalho}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
