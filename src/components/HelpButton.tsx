import { useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, Info } from 'lucide-react';
import { MANUAL } from '../lib/manual';




export function HelpButton({ style }: { style?: React.CSSProperties }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="btn-icon"
        title="Ajuda / Como funciona"
        style={{ padding: 0, ...style }}
      >
        <HelpCircle size={20} />
      </button>

      {/*
        Vai para o `body` por portal, e não fica onde o componente mora.

        O botão de ajuda vive dentro do cabeçalho, que tem `position: relative`
        e `z-index: 1` — e isso cria um contexto de empilhamento. Dentro dele, o
        `z-index: 3000` do modal só disputa com irmãos do próprio cabeçalho: o
        cabeçalho inteiro continua valendo 1, e o título e os cards, que vêm
        depois no DOM, desenhavam por cima do manual.

        Número maior não resolveria — 3000 já era maior que tudo. O que resolve
        é sair do contexto, e é isso que o portal faz.
      */}
      {aberto && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '560px', maxHeight: '88vh', backgroundColor: 'var(--bg-primary)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', cursor: 'default', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Info size={18} className="text-accent" /> Manual do Usuário
                </button>
              </div>
              <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {MANUAL.map(s => (
                <div key={s.titulo}>
                  <h3 className="font-bold" style={{ marginBottom: '6px' }}>{s.titulo}</h3>
                  <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>{s.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
