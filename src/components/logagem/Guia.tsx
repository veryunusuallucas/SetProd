import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { Abre } from './pecas';

export interface PassoDoGuia {
  titulo: string;
  texto: React.ReactNode;
}

const chave = (id: string) => `setprod:logagem:guia:${id}`;

function jaViu(id: string): boolean {
  try { return localStorage.getItem(chave(id)) === 'visto'; } catch { return false; }
}

/**
 * "Como funciona", em passos numerados.
 *
 * Backup e Ingest são o que a Fotografia menos faz no dia a dia — o pedido
 * (16/09/2026) foi que a tela explicasse o caminho. O guia abre sozinho até a
 * pessoa dizer "entendi"; depois fica recolhido numa linha, para quem quiser
 * relembrar, sem ocupar a tela de quem já sabe.
 */
export function Guia({ id, titulo, passos, fecho }: {
  id: string;
  titulo: string;
  passos: PassoDoGuia[];
  /** A frase depois dos passos: o que se ganha no fim. */
  fecho?: React.ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  const [aberto, setAberto] = useState(() => !jaViu(id));

  const entendi = () => {
    try { localStorage.setItem(chave(id), 'visto'); } catch { /* vale só agora */ }
    setAberto(false);
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', padding: aberto ? '18px 22px' : '6px 16px', transition: 'padding 0.2s' }}>
      <button
        type="button"
        onClick={() => setAberto(v => !v)}
        aria-expanded={aberto}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', width: '100%', padding: 0,
          border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <Lightbulb size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} aria-hidden />
        <span className="text-sm font-bold" style={{ flex: 1 }}>{titulo}</span>
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={reduzido ? { duration: 0 } : MOLA} style={{ display: 'flex' }}>
          <ChevronDown size={16} className="text-muted" />
        </motion.span>
      </button>

      <Abre aberto={aberto}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {passos.map((p, i) => (
              <li key={p.titulo} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span
                  aria-hidden
                  style={{
                    width: '26px', height: '26px', borderRadius: '999px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--bg-active)', fontSize: '13px', fontWeight: 800,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                  <span className="text-sm font-bold">{p.titulo}</span>
                  <span className="text-sm text-secondary" style={{ lineHeight: 1.55 }}>{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
          {fecho && <p className="text-sm" style={{ margin: 0, lineHeight: 1.55 }}>{fecho}</p>}
          <button
            type="button"
            onClick={entendi}
            className="btn-secondary"
            style={{ alignSelf: 'flex-start', minHeight: '44px' }}
          >
            Entendi
          </button>
        </div>
      </Abre>
    </section>
  );
}
