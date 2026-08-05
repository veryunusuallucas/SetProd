import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface AIButtonProps {
  onClick?: () => void;
  children?: React.ReactNode;
  /** Estado de processamento: troca o rótulo e liga a animação contínua. */
  loading?: boolean;
  loadingText?: string;
  disabled?: boolean;
  /** 'full' = botão com texto; 'icon' = só o ícone (para barras de ação). */
  variante?: 'full' | 'icon';
  title?: string;
  style?: React.CSSProperties;
}

/**
 * Botão das ações de IA: borda com gradiente girando, brilho que atravessa no hover
 * e faíscas que sobem ao clicar. Enquanto processa, as faíscas orbitam.
 * Tudo em CSS + framer-motion (já no projeto), sem dependência nova.
 */
export function AIButton({
  onClick,
  children,
  loading = false,
  loadingText = 'Gerando...',
  disabled = false,
  variante = 'full',
  title,
  style,
}: AIButtonProps) {
  const [faiscas, setFaiscas] = useState<{ id: number; x: number }[]>([]);

  const dispararFaiscas = () => {
    const novas = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 60,
    }));
    setFaiscas(f => [...f, ...novas]);
    setTimeout(() => {
      setFaiscas(f => f.filter(s => !novas.some(n => n.id === s.id)));
    }, 900);
  };

  const handleClick = () => {
    if (disabled || loading) return;
    dispararFaiscas();
    onClick?.();
  };

  const inativo = disabled || loading;
  const isIcon = variante === 'icon';

  return (
    <>
      <style>{`
        @keyframes ai-borda-gira {
          to { --ai-angulo: 360deg; }
        }
        @property --ai-angulo {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        .ai-btn {
          --ai-angulo: 0deg;
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 12px;
          padding: 2px;
          cursor: pointer;
          background: conic-gradient(
            from var(--ai-angulo),
            #9d4edd, #4cc9f0, #f72585, #fca311, #9d4edd
          );
          animation: ai-borda-gira 6s linear infinite;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          font-family: inherit;
        }
        .ai-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(157, 78, 221, 0.35);
        }
        .ai-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .ai-btn:disabled { cursor: not-allowed; opacity: 0.65; }

        .ai-btn__interior {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          border-radius: 10px;
          background: var(--bg-surface, #16161a);
          color: var(--text-primary, #fff);
          font-weight: 700;
          font-size: 14px;
          overflow: hidden;
          white-space: nowrap;
        }
        .ai-btn__interior--full { padding: 10px 18px; }
        .ai-btn__interior--icon { padding: 8px; }

        /* Brilho que atravessa o botão no hover */
        .ai-btn__interior::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 0.7s ease;
          pointer-events: none;
        }
        .ai-btn:hover:not(:disabled) .ai-btn__interior::after { transform: translateX(120%); }

        @media (prefers-reduced-motion: reduce) {
          .ai-btn { animation: none; }
          .ai-btn__interior::after { transition: none; }
        }
      `}</style>

      <button
        type="button"
        className="ai-btn"
        onClick={handleClick}
        disabled={inativo}
        title={title}
        style={style}
      >
        <span className={`ai-btn__interior ai-btn__interior--${variante}`}>
          <motion.span
            style={{ display: 'inline-flex' }}
            animate={loading ? { rotate: 360, scale: [1, 1.25, 1] } : { rotate: 0, scale: 1 }}
            transition={loading
              ? { rotate: { duration: 1.6, repeat: Infinity, ease: 'linear' }, scale: { duration: 1, repeat: Infinity } }
              : { duration: 0.3 }}
          >
            <Sparkles size={isIcon ? 18 : 16} color="#c77dff" />
          </motion.span>

          {!isIcon && <span>{loading ? loadingText : children}</span>}

          {/* Faíscas que sobem ao clicar */}
          <AnimatePresence>
            {faiscas.map(f => (
              <motion.span
                key={f.id}
                initial={{ opacity: 1, y: 0, x: f.x, scale: 0.4 }}
                animate={{ opacity: 0, y: -34, scale: 1.1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.85, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#c77dff',
                  boxShadow: '0 0 8px #c77dff',
                  pointerEvents: 'none',
                }}
              />
            ))}
          </AnimatePresence>
        </span>
      </button>
    </>
  );
}

export default AIButton;
