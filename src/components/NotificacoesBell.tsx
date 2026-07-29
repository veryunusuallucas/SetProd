import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Bell, Check } from 'lucide-react';
import type { Notificacao } from '../types';

export function NotificacoesBell({ projetoId }: { projetoId?: string }) {
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<React.CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  const notificacoes = useLiveQuery<Notificacao[]>(
    () => projetoId ? db.notificacoes.where('projeto_id').equals(projetoId).reverse().sortBy('data') : Promise.resolve([] as Notificacao[]),
    [projetoId]
  ) || [];

  if (!projetoId) return null;

  const naoLidas = notificacoes.filter(n => !n.lida);

  const toggle = () => {
    if (!aberto && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const largura = Math.min(320, window.innerWidth - 24);
      const left = Math.min(Math.max(12, r.left), window.innerWidth - largura - 12);
      // Abre pra baixo, ou pra cima se não couber
      const abaixo = r.bottom + 380 < window.innerHeight;
      const vertical: React.CSSProperties = abaixo
        ? { top: r.bottom + 8 }
        : { bottom: window.innerHeight - r.top + 8 };
      setPos({ position: 'fixed', left, width: largura, ...vertical });
    }
    setAberto(!aberto);
  };

  const abrirNotificacao = async (id: string, taskId?: string) => {
    await db.notificacoes.update(id, { lida: true });
    setAberto(false);
    if (taskId) navigate(`/projeto/${projetoId}/tasks`);
  };

  const marcarTodasLidas = async () => {
    await Promise.all(naoLidas.map(n => db.notificacoes.update(n.id, { lida: true })));
  };

  return (
    <>
      <button ref={btnRef} onClick={toggle} className="btn-icon" title="Notificações" style={{ padding: 0, position: 'relative' }}>
        <Bell size={20} />
        {naoLidas.length > 0 && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', backgroundColor: 'var(--color-danger)', color: '#fff', borderRadius: '999px', minWidth: '16px', height: '16px', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
            {naoLidas.length}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div onClick={() => setAberto(false)} style={{ position: 'fixed', inset: 0, zIndex: 3998 }} />
          <div className="card" style={{ ...pos, maxHeight: '380px', overflowY: 'auto', zIndex: 3999, padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
              <span className="text-xs text-secondary font-bold uppercase tracking-widest">Notificações</span>
              {naoLidas.length > 0 && (
                <button onClick={marcarTodasLidas} className="text-xs" style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Check size={12} /> Marcar lidas
                </button>
              )}
            </div>
            {notificacoes.length === 0 && (
              <div className="text-muted text-sm" style={{ padding: '24px', textAlign: 'center' }}>Nenhuma notificação.</div>
            )}
            {notificacoes.slice(0, 30).map(n => (
              <button
                key={n.id}
                onClick={() => abrirNotificacao(n.id, n.task_id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: n.lida ? 'transparent' : 'var(--bg-active)', border: 'none', borderRadius: '8px', padding: '10px 12px', marginTop: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}
              >
                <div style={{ fontSize: '13px', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                  {!n.lida && <span style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: 'var(--accent)', marginTop: '6px', flexShrink: 0 }} />}
                  <span>{n.texto}</span>
                </div>
                <div className="text-xs text-muted" style={{ marginTop: '2px' }}>{new Date(n.data).toLocaleString('pt-BR')}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
