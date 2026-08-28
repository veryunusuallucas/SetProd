import { useEffect, useRef, useState } from 'react';
import { useMovimentoReduzido } from './movimento';

/**
 * Um brilho suave que segue o ponteiro dentro do card.
 *
 * Reforça o que a elevação do hover já diz — "isto responde" — com uma vantagem
 * que a elevação não tem: ela é igual em qualquer ponto do card, e o holofote
 * diz ONDE o ponteiro está. Numa lista de produções todas parecidas, é o que
 * separa a que está sob o cursor das vizinhas.
 *
 * ⚠️ NO CELULAR ELE NÃO EXISTE, e isso não é omissão. Sem cursor não há o que
 * seguir: o brilho apareceria no ponto do toque e ficaria parado ali, como uma
 * mancha. Por isso o `pointermove` de dedo é ignorado.
 *
 * É COMPONENTE E NÃO HOOK. A primeira versão era um `useHolofote()`, e não
 * servia: os cards são renderizados dentro de um `.map()`, e hook dentro de
 * laço não existe. Como componente, cada card carrega o seu.
 *
 * USO: coloque como primeiro filho do card. Ele se prende ao elemento pai
 * sozinho, que precisa ter `position: relative` — o `.card` da Home já tem.
 */

const RAIO = 260;

export function Holofote() {
  const eu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    if (reduzido) return;
    const pai = eu.current?.parentElement;
    if (!pai) return;

    const mover = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = pai.getBoundingClientRect();
      setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const sair = () => setPos(null);

    pai.addEventListener('pointermove', mover);
    pai.addEventListener('pointerleave', sair);
    // `pointercancel` também: rolar com o ponteiro em cima encerra o evento sem
    // passar por `leave`, e o brilho ficaria congelado no último ponto.
    pai.addEventListener('pointercancel', sair);
    return () => {
      pai.removeEventListener('pointermove', mover);
      pai.removeEventListener('pointerleave', sair);
      pai.removeEventListener('pointercancel', sair);
    };
  }, [reduzido]);

  return (
    <div
      ref={eu}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        // Herda o arredondamento do card: sem isto o brilho vira um retângulo
        // saindo pelos cantos.
        borderRadius: 'inherit',
        // Nunca rouba o clique do card.
        pointerEvents: 'none',
        opacity: pos ? 1 : 0,
        background: pos
          ? `radial-gradient(${RAIO}px circle at ${pos.x}px ${pos.y}px, color-mix(in srgb, var(--accent) 9%, transparent), transparent 70%)`
          : 'none',
        // Transição SÓ na opacidade. Na posição ela faria o brilho correr atrás
        // do cursor com atraso, que é pior que não ter brilho nenhum.
        transition: 'opacity 0.2s ease',
      }}
    />
  );
}
