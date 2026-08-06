import React, { useRef, useState } from 'react';

interface CreepyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
}

type Coords = { x: number; y: number };

/**
 * Botão com olhos que seguem o cursor.
 *
 * A mecânica do original: os olhos ficam ATRÁS da capa colorida, no canto de
 * baixo. Ao passar o mouse, a capa gira e se afasta — e é isso que descobre os
 * olhos espiando. Eles não aparecem por mudança de opacidade; aparecem porque
 * algo saiu da frente. É essa relação de camadas que faz a piada funcionar.
 *
 * A versão anterior daqui tinha invertido isso: os olhos flutuavam acima da
 * borda, revelados por opacidade, e a capa girava tão pouco (-5°) que nunca
 * chegava a descobrir nada.
 */
export function CreepyButton({ children, className, onClick, ...props }: CreepyButtonProps) {
  const olhosRef = useRef<HTMLSpanElement>(null);
  const [pupila, setPupila] = useState<Coords>({ x: 0, y: 0 });

  // -50% centraliza a pupila; o resto é o desvio na direção do cursor.
  const estiloPupila: React.CSSProperties = {
    transform: `translate(${-50 + pupila.x * 50}%, ${-50 + pupila.y * 50}%)`,
  };

  const seguir = (e: React.MouseEvent | React.TouchEvent) => {
    const evento = 'touches' in e ? (e as React.TouchEvent).touches[0] : (e as React.MouseEvent);
    if (!olhosRef.current || !evento) return;

    const caixa = olhosRef.current.getBoundingClientRect();
    const dx = evento.clientX - (caixa.left + caixa.width / 2);
    const dy = evento.clientY - (caixa.top + caixa.height / 2);

    // O ângulo entra em seno/cosseno para a pupila descrever um círculo dentro
    // do olho — sem isso ela andaria em quadrado nas diagonais.
    const angulo = Math.atan2(-dy, dx) + Math.PI / 2;
    const distancia = Math.min(Math.hypot(dx, dy), 200);

    setPupila({
      x: (Math.sin(angulo) * distancia) / 150,
      y: (Math.cos(angulo) * distancia) / 100,
    });
  };

  const centralizar = () => setPupila({ x: 0, y: 0 });

  return (
    <>
      <style>
        {`
          /* Escopo no próprio botão. Antes isto vivia em :root e redefinia
             variáveis para o app inteiro. */
          .creepy-btn {
            --cb-claro: hsl(0 10% 95%);
            --cb-preto: hsl(0 0% 0%);
            --cb-foco: hsl(0 90% 75%);
            --cb-cor: var(--color-danger, hsl(0 90% 45%));
            --cb-cor-hover: hsl(0 90% 35%);
            --cb-dur: 0.3s;

            position: relative;
            display: inline-block;
            min-width: 9em;
            padding: 0;
            border: 0;
            border-radius: 1.25em;
            background-color: transparent;
            color: var(--cb-claro);
            font-family: inherit;
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 1px;
            cursor: pointer;
            outline: 0.1875em solid transparent;
            transition: outline 0.1s linear;
            -webkit-tap-highlight-color: transparent;
          }

          /* Os olhos ficam no fundo (z-index 0) e a capa por cima (z-index 1). */
          .creepy-btn__olhos {
            position: absolute;
            right: 1em;
            bottom: 0.6em;
            z-index: 0;
            display: flex;
            align-items: center;
            gap: 0.375em;
            height: 0.75em;
            pointer-events: none;
          }

          .creepy-btn__olho {
            position: relative;
            display: block;
            width: 0.75em;
            height: 0.75em;
            border-radius: 50%;
            background-color: var(--cb-claro);
            overflow: hidden;
            animation: cb-piscar 3s infinite;
          }

          .creepy-btn__pupila {
            position: absolute;
            top: 50%;
            left: 50%;
            display: block;
            width: 0.375em;
            height: 0.375em;
            border-radius: 50%;
            background-color: var(--cb-preto);
          }

          .creepy-btn__capa {
            position: relative;
            z-index: 1;
            display: block;
            inset: 0;
            padding: 0.6em 1.4em;
            border-radius: inherit;
            background-color: var(--cb-cor);
            box-shadow: 0 0 0 0.125em var(--cb-preto) inset;
            /* Gira em torno da ponta esquerda: é o que faz o lado direito
               levantar e descobrir os olhos. */
            transform-origin: 1.25em 50%;
            transition:
              background-color var(--cb-dur),
              transform var(--cb-dur) cubic-bezier(0.65, 0, 0.35, 1);
          }

          .creepy-btn:hover .creepy-btn__capa,
          .creepy-btn:focus-visible .creepy-btn__capa {
            background-color: var(--cb-cor-hover);
            transform: rotate(-12deg);
            transition-timing-function: cubic-bezier(0.65, 0, 0.35, 1.65);
          }

          .creepy-btn:active .creepy-btn__capa {
            transform: rotate(0);
            transition-timing-function: cubic-bezier(0.65, 0, 0.35, 1);
          }

          .creepy-btn:focus-visible { outline-color: var(--cb-foco); }

          @keyframes cb-piscar {
            0%, 92%, 100% {
              animation-timing-function: cubic-bezier(0.32, 0, 0.67, 0);
              height: 0.75em;
            }
            96% {
              animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
              height: 0;
            }
          }

          /* Quem pediu menos movimento não leva o giro nem o piscar. */
          @media (prefers-reduced-motion: reduce) {
            .creepy-btn__capa { transition: background-color var(--cb-dur); }
            .creepy-btn:hover .creepy-btn__capa,
            .creepy-btn:focus-visible .creepy-btn__capa { transform: none; }
            .creepy-btn__olho { animation: none; }
          }
        `}
      </style>

      <button
        type="button"
        className={`creepy-btn ${className || ''}`}
        onClick={onClick}
        onMouseMove={seguir}
        onTouchMove={seguir}
        onMouseLeave={centralizar}
        {...props}
      >
        {/* Ordem importa: olhos primeiro, capa depois — a capa desenha por cima. */}
        <span className="creepy-btn__olhos" ref={olhosRef} aria-hidden>
          <span className="creepy-btn__olho">
            <span className="creepy-btn__pupila" style={estiloPupila} />
          </span>
          <span className="creepy-btn__olho">
            <span className="creepy-btn__pupila" style={estiloPupila} />
          </span>
        </span>
        <span className="creepy-btn__capa">{children}</span>
      </button>
    </>
  );
}

export default CreepyButton;
