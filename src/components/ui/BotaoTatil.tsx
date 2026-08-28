import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { MOLA_GESTO, useMovimentoReduzido } from './movimento';

/**
 * Botão que responde no dedo encostar, não no soltar.
 *
 * O `click` só dispara quando a pessoa SOLTA. São uns 100ms de silêncio entre o
 * toque e a tela reagir — tempo suficiente para achar que não funcionou e
 * apertar de novo. Latência entre o dedo e a tela é o que faz uma interface
 * parecer morta.
 *
 * Aqui o afundamento é imediato e a ação continua no clique, para arrastar o
 * dedo para fora ainda cancelar. As duas coisas juntas: instantâneo e
 * desistível.
 *
 * ⚠️ POR QUE NÃO BASTA O `:active` DO CSS
 * O `:active` também dispara no pointer-down — isso o app já fazia certo. Mas o
 * `transition` dos botões EXCLUI `transform` de propósito (ver o comentário no
 * `index.css`, que documenta um bug real: transição CSS sobre `transform` amassa
 * a mola do framer-motion quadro a quadro). Sem transição, o `scale(0.95)` do
 * `:active` é um corte seco — some com a sensação de material justamente onde
 * ela mais importa. A mola tem que vir do framer, e é isso que este componente
 * traz.
 *
 * Nasceu como `BotaoDecisao`, dentro de `ia.tsx`, atendendo aos botões de
 * aceitar/recusar sugestão. Não havia nada de "IA" nele.
 */

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  children: ReactNode;
  /** Quanto afunda. O padrão serve para botão de barra; peça menos em cartão grande. */
  escala?: number;
}

export function BotaoTatil({ children, escala = 0.94, style, ...resto }: Props) {
  const [pressionado, setPressionado] = useState(false);
  const reduzido = useMovimentoReduzido();

  return (
    <motion.button
      type="button"
      {...resto}
      onPointerDown={e => { setPressionado(true); resto.onPointerDown?.(e); }}
      onPointerUp={e => { setPressionado(false); resto.onPointerUp?.(e); }}
      /*
        `pointercancel` junto do `leave`, e não só ele.

        No celular, rolar a tela com o dedo em cima do botão cancela o ponteiro
        SEM disparar `pointerleave` — e o botão ficaria afundado para sempre,
        parecendo travado. É um caso que só aparece no toque, nunca no mouse.
      */
      onPointerLeave={e => { setPressionado(false); resto.onPointerLeave?.(e); }}
      onPointerCancel={e => { setPressionado(false); resto.onPointerCancel?.(e); }}
      animate={{ scale: pressionado && !reduzido ? escala : 1 }}
      transition={MOLA_GESTO}
      style={style}
    >
      {children}
    </motion.button>
  );
}
