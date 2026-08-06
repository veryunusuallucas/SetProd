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
export function FundoEntrada() {
  const [efeitos] = useState(() => decidirEfeitos());

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        // Degradê que já sustenta a tela sozinho — o shader entra por cima.
        background: 'radial-gradient(120% 100% at 50% 0%, #17122b 0%, var(--bg-primary) 60%)',
      }}
    >
      {efeitos.fundo && (
        <Suspense fallback={null}>
          <Silk />
        </Suspense>
      )}
    </div>
  );
}
