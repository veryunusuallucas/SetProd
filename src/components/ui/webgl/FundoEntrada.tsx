import { lazy, Suspense, useState } from 'react';
import { movimentoReduzido } from './suporte';

const Contraluz = lazy(() => import('../Contraluz').then(m => ({ default: m.Contraluz })));

/**
 * Fundo animado das telas de entrada (inicial e login).
 *
 * Só existe aqui. Dentro do app o valor é velocidade — charme na porta,
 * eficiência lá dentro.
 *
 * Era o Silk, um shader de ondas roxas (`webgl/Silk.tsx`, que fica no repo
 * para quem quiser voltar). Desde 17/09/2026 é o CONTRALUZ: um feixe frio com
 * grão de filme, escolhido pelo Lucas na maquete da porta. Sendo canvas 2D, e
 * não shader, ele aparece TAMBÉM no aparelho fraco e no navegador sem WebGL —
 * onde antes a tela ficava só com o degradê. Com movimento reduzido, ele pinta
 * um quadro e para.
 */
interface Props {
  /**
   * Tinge a tela de vermelho. Serve para o modo de apagar: a página inteira
   * muda de clima, então não dá para clicar achando que está no modo normal.
   */
  perigo?: boolean;
}

export function FundoEntrada({ perigo = false }: Props) {
  const [parado] = useState(() => movimentoReduzido());

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        // Degradê que já sustenta a tela sozinho — o shader entra por cima.
        background: perigo
          ? 'radial-gradient(120% 100% at 50% 0%, #2a0d11 0%, var(--bg-primary) 60%)'
          : 'radial-gradient(120% 100% at 50% 0%, #101119 0%, var(--bg-primary) 60%)',
        transition: 'background 0.45s ease',
      }}
    >
      <Suspense fallback={null}>
        <Contraluz perigo={perigo} parado={parado} />
      </Suspense>
    </div>
  );
}
