import { lazy, Suspense, useState } from 'react';
import { decidirEfeitos } from './suporte';

const Silk = lazy(() => import('./Silk'));

/**
 * Fundo animado das telas de entrada (inicial e login).
 *
 * Só existe aqui. Dentro do app o valor é velocidade — charme na porta,
 * eficiência lá dentro. Se o aparelho não der conta ou a pessoa tiver pedido
 * menos movimento, some sem deixar buraco: o degradê estático abaixo assume.
 */
interface Props {
  /**
   * Tinge a tela de vermelho. Serve para o modo de apagar: a página inteira
   * muda de clima, então não dá para clicar achando que está no modo normal.
   */
  perigo?: boolean;
}

export function FundoEntrada({ perigo = false }: Props) {
  const [efeitos] = useState(() => decidirEfeitos());

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        // Degradê que já sustenta a tela sozinho — o shader entra por cima.
        background: perigo
          ? 'radial-gradient(120% 100% at 50% 0%, #3a1015 0%, var(--bg-primary) 60%)'
          : 'radial-gradient(120% 100% at 50% 0%, #17122b 0%, var(--bg-primary) 60%)',
        transition: 'background 0.45s ease',
      }}
    >
      {efeitos.fundo && (
        <Suspense fallback={null}>
          <Silk cor={perigo ? '#3d0f14' : '#1a1030'} />
        </Suspense>
      )}
    </div>
  );
}
