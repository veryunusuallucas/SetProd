import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Clapperboard, ArrowRight } from 'lucide-react';
import { Fogos } from './ui/Fogos';
import { GifDoMomento } from './ui/GifDoMomento';
import { MOLA, useMovimentoReduzido } from './ui/movimento';
import { MOMENTOS } from '../lib/gifs';

/**
 * A carta de abertura: a produção acabou de nascer.
 *
 * Pedido do Lucas (03/10/2026): criar um projeto merece uma cena de abertura,
 * como o wrap merece a dele. É o par do wrap — começo e fim do set —, e por
 * isso usa a mesma linguagem: fogos curtos, um gif (tag "abertura") e uma
 * frase. Diferente do wrap, não tem números: ainda não aconteceu nada.
 *
 * Só aparece se a pessoa deixou os gifs ligados (Configurações → Diversão);
 * desligados, criar a produção leva direto para ela, como antes. Quem decide
 * isso é a tela inicial, antes de montar a carta.
 *
 * Esc, o botão e o fundo levam para dentro da produção — fechar a carta e
 * ficar na lista seria voltar um passo que ninguém pediu.
 */
export function CartaDeAbertura({ nome, aoEntrar }: { nome: string; aoEntrar: () => void }) {
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') aoEntrar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoEntrar]);

  return createPortal(
    <>
      <Fogos duracaoMs={2600} quantidade={5} />
      <div
        onClick={aoEntrar}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
          backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
        }}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={MOLA}
          className="card"
          style={{
            width: '100%', maxWidth: '460px', textAlign: 'center',
            padding: '26px 24px 22px', display: 'flex', flexDirection: 'column', gap: '14px',
            border: '1px solid var(--accent)',
          }}
        >
          <div className="text-xs uppercase tracking-widest" style={{ color: 'var(--accent-texto)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800 }}>
            <Clapperboard size={14} /> Cena 1 · Take 1
          </div>

          <h2 className="font-bold" style={{ fontSize: 'clamp(24px, 6vw, 32px)', lineHeight: 1.15, margin: 0 }}>
            {nome}
          </h2>

          <GifDoMomento humor={MOMENTOS.abertura} altura={200} />

          <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
            Claquete batida. A produção está criada — agora é montar a equipe,
            subir o roteiro e marcar a primeira diária.
          </p>

          <button
            onClick={aoEntrar}
            className="btn-primary"
            autoFocus
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px 18px', marginTop: '4px' }}
          >
            Entrar na produção <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    </>,
    document.body
  );
}
