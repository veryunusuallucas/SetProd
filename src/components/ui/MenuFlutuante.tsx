import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MOLA, MOLA_GESTO, useMovimentoReduzido } from './ia';

/**
 * O botão flutuante que abre um punhado de ações — o padrão que a indústria
 * chama de **Speed Dial**.
 *
 * Vale seguir o padrão consagrado em vez de inventar: ele já resolve teclado,
 * leitor de tela e o comportamento de fechar, que é onde menus caseiros erram.
 *
 * NÃO ENTRA BIBLIOTECA NOVA PARA ISTO. MUI, PrimeReact e Syncfusion têm Speed
 * Dial pronto, mas trazem um design system inteiro junto — e o app tem o dele.
 * O `framer-motion` já está aqui e faz o escalonamento em quinze linhas.
 */

export interface AcaoFlutuante {
  id: string;
  icone: React.ReactNode;
  rotulo: string;
  onClick: () => void;
  /** A ação principal. Ganha a cor de acento e vem por último (mais perto do polegar). */
  destaque?: boolean;
}

interface Props {
  acoes: AcaoFlutuante[];
  /** O ícone do botão fechado. */
  icone: React.ReactNode;
  rotulo: string;
  /** Distância do rodapé. A barra de navegação do celular ocupa os 64px de baixo. */
  base?: number;
  /**
   * Abaixo dos modais que ele abre, de propósito.
   *
   * O `HelpButton` já teve esse problema e a solução está documentada lá. Se o
   * menu ficasse acima, ele desenharia por cima do próprio conteúdo que abriu.
   */
  z?: number;
}

/** Entre um item e o outro. Com dois ou três, mais que isso já parece lento. */
const ESCALONAMENTO = 0.035;

export function MenuFlutuante({ acoes, icone, rotulo, base = 96, z = 2000 }: Props) {
  const [aberto, setAberto] = useState(false);
  const reduzido = useMovimentoReduzido();
  const caixa = useRef<HTMLDivElement>(null);

  /*
    Fechar no Esc e no clique fora.

    Menu flutuante que só fecha no próprio botão é a reclamação número um deste
    padrão — a pessoa abre sem querer, tenta clicar em qualquer lugar para
    dispensar, e o menu fica lá.
  */
  useEffect(() => {
    if (!aberto) return;

    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    const aoClicar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };

    window.addEventListener('keydown', aoTeclar);
    // `capture` para pegar o clique antes de qualquer `stopPropagation` da tela.
    window.addEventListener('mousedown', aoClicar, true);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('mousedown', aoClicar, true);
    };
  }, [aberto]);

  const acionar = (a: AcaoFlutuante) => {
    setAberto(false);
    a.onClick();
  };

  return createPortal(
    <div
      ref={caixa}
      style={{
        position: 'fixed', right: '24px', bottom: `${base}px`, zIndex: z,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px',
      }}
    >
      <AnimatePresence>
        {aberto && (
          <motion.div
            role="menu"
            aria-label={rotulo}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}
          >
            {acoes.map((a, i) => (
              <motion.button
                key={a.id}
                role="menuitem"
                onClick={() => acionar(a)}
                initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduzido ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.92 }}
                transition={{ ...MOLA, delay: reduzido ? 0 : i * ESCALONAMENTO }}
                whileTap={reduzido ? undefined : { scale: 0.95, transition: MOLA_GESTO }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px', borderRadius: '50px', cursor: 'pointer',
                  border: `1px solid ${a.destaque ? 'var(--accent)' : 'var(--border-color)'}`,
                  background: a.destaque ? 'var(--accent)' : 'var(--bg-surface)',
                  color: a.destaque ? '#1a1508' : 'var(--text-primary)',
                  fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                  fontFamily: 'inherit',
                }}
              >
                {/* RÓTULO VISÍVEL, não tooltip. No celular não existe hover, e
                    ícone sozinho vira adivinhação. */}
                {a.rotulo}
                {a.icone}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setAberto(v => !v)}
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        whileTap={reduzido ? undefined : { scale: 0.92, transition: MOLA_GESTO }}
        animate={reduzido ? undefined : { rotate: aberto ? 90 : 0 }}
        transition={MOLA}
        style={{
          width: '52px', height: '52px', borderRadius: '50%', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
        }}
      >
        {aberto ? <X size={22} /> : icone}
      </motion.button>
    </div>,
    document.body
  );
}
