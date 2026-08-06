import { useEffect, useRef, useState } from 'react';
import { useMovimentoReduzido } from './ia';

interface Props {
  valor: number;
  /** Ex: 'R$ '. Fica fora da animação para não piscar junto. */
  prefixo?: string;
  casas?: number;
  /** Tempo até chegar ao número final. */
  duracaoMs?: number;
}

/**
 * Número que sobe até o valor final.
 *
 * Serve para o olho perceber que aquilo é dinheiro se somando, não um texto
 * qualquer. A curva desacelera no fim (ease-out): números que param de repente
 * parecem travar.
 *
 * Com movimento reduzido, mostra o valor direto — animar dígito é exatamente o
 * tipo de movimento que incomoda quem pediu para reduzir.
 */
export function ContadorAnimado({ valor, prefixo = '', casas = 2, duracaoMs = 900 }: Props) {
  const reduzido = useMovimentoReduzido();
  const [atual, setAtual] = useState(reduzido ? valor : 0);
  const anterior = useRef(reduzido ? valor : 0);

  useEffect(() => {
    if (reduzido) {
      setAtual(valor);
      anterior.current = valor;
      return;
    }

    const de = anterior.current;
    const inicio = performance.now();
    let quadro = 0;

    const passo = () => {
      const t = Math.min(1, (performance.now() - inicio) / duracaoMs);
      const suave = 1 - Math.pow(1 - t, 3);
      setAtual(de + (valor - de) * suave);
      if (t < 1) quadro = requestAnimationFrame(passo);
      else anterior.current = valor;
    };
    quadro = requestAnimationFrame(passo);

    return () => cancelAnimationFrame(quadro);
  }, [valor, duracaoMs, reduzido]);

  return <>{prefixo}{atual.toFixed(casas)}</>;
}
