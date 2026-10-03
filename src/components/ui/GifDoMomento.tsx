import { useState } from 'react';
import { sortearGif, type Humor } from '../../lib/gifs';
import { usePreferencia } from '../../lib/preferencias';
import { useMovimentoReduzido } from './ia';

/**
 * Um gif do humor pedido — o choro na hora de apagar, a festa no wrap.
 *
 * Some sozinho (não desenha nada) quando:
 *   · a pessoa desligou "Gifs pelo app" nas Configurações;
 *   · o aparelho pede movimento reduzido — gif é movimento puro;
 *   · a pasta do humor está vazia.
 * Por isso dá para pôr em qualquer lugar sem tratar esses casos de fora.
 *
 * O sorteio é UMA vez, na montagem: redesenhar a janela não troca o gif
 * debaixo dos olhos de quem está lendo.
 */
export function GifDoMomento({ humor, altura = 140, reserva = null }: {
  /** Um humor, ou uma lista em ordem de preferência (["medo", "triste"]). */
  humor: Humor | readonly Humor[];
  altura?: number;
  /** O que aparece quando não há gif (desligado, movimento reduzido, pasta vazia). */
  reserva?: React.ReactNode;
}) {
  const ligado = usePreferencia('gifs');
  const reduzido = useMovimentoReduzido();
  const [midia] = useState(() => sortearGif(humor));

  if (!ligado || reduzido || !midia) return <>{reserva}</>;

  const estilo: React.CSSProperties = {
    display: 'block', margin: '0 auto', maxWidth: '100%', maxHeight: `${altura}px`,
    objectFit: 'contain', borderRadius: 'var(--radius-md)',
  };
  return midia.video
    ? <video src={midia.url} autoPlay loop muted playsInline aria-hidden style={estilo} />
    : <img src={midia.url} alt="" aria-hidden style={estilo} />;
}
