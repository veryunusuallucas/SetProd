import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { decidirEfeitos, movimentoReduzido } from './suporte';

// Carregado só quando a tela de entrada monta: o `ogl` e os shaders não têm
// por que pesar no carregamento de quem já está trabalhando dentro do app.
const WarpText = lazy(() => import('./WarpText'));

const RICK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/** Cliques precisam vir em sequência; parou, esquece. */
const JANELA_MS = 1500;
const CLIQUES_PARA_ESTOURAR = 3;

/** Tensão acumulada em cada clique — o terceiro é o estouro. */
const TENSAO = [0, 0.22, 0.55, 1];

interface Props {
  tamanho?: number;
  fontFamily?: string;
  /**
   * Liga o easter egg. Desligado, o título é só bonito.
   *
   * Ele mora só na tela inicial de propósito: um segredo que aparece em duas
   * telas deixa de ser segredo e vira botão.
   */
  interativo?: boolean;
  alinhamento?: 'esquerda' | 'centro';
}

/**
 * O título SETPROD, com o easter egg.
 *
 * Não há contador, balão nem dica: o único aviso é o próprio efeito ficando
 * mais violento a cada clique. Quem só passa o olho não percebe nada; quem
 * cutuca de propósito sente a tensão subindo e descobre sozinho.
 */
export function TituloSetProd({ tamanho = 92, fontFamily, interativo = true, alinhamento = 'centro' }: Props) {
  const [efeitos] = useState(() => decidirEfeitos());
  const [tensao, setTensao] = useState(0);

  const cliques = useRef(0);
  const relogio = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const cutucar = () => {
    window.clearTimeout(relogio.current);
    cliques.current += 1;

    if (cliques.current >= CLIQUES_PARA_ESTOURAR) {
      setTensao(1);
      cliques.current = 0;

      // O estouro tem que ser visto antes da aba abrir; meio segundo é o
      // suficiente para o texto se desfazer e voltar.
      window.setTimeout(() => {
        window.open(RICK, '_blank', 'noopener,noreferrer');
        setTensao(0);
      }, 520);
      return;
    }

    setTensao(TENSAO[cliques.current] ?? 0);
    relogio.current = window.setTimeout(() => {
      cliques.current = 0;
      setTensao(0);
    }, JANELA_MS);
  };

  // Sem WebGL, sem cursor ou com movimento reduzido: título comum, e o easter
  // egg continua existindo — só sem o acúmulo visual.
  if (!efeitos.titulo) {
    return (
      <button
        onPointerDown={interativo ? cutucar : undefined}
        title="SetProd"
        disabled={!interativo}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: fontFamily || "'Archivo Black', 'Arial Black', system-ui, sans-serif",
          fontWeight: 900, letterSpacing: '-0.06em',
          fontSize: `${Math.min(tamanho, 56)}px`,
          color: 'var(--text-primary)', lineHeight: 1.1,
          opacity: movimentoReduzido() ? 1 : 1 - tensao * 0.35,
          transition: 'opacity 0.2s ease',
        }}
      >
        SETPROD
      </button>
    );
  }

  return (
    <Suspense fallback={<div style={{ height: `${tamanho * 1.2}px` }} />}>
      {/* O onClick fica no wrapper porque o componente oficial não expõe um —
          e assim o easter egg não exige tocar no código dele. */}
      <div
        onClick={interativo ? cutucar : undefined}
        style={{ cursor: interativo ? 'pointer' : 'default' }}
      >
        <WarpText
          text="SETPROD"
          color="#f8f5ff"
          /* Números do exemplo da referência, sem alteração. */
          warpStrength={0.08}
          warpScale={1.7}
          speed={0.55}
          pointerInfluence={0.42}
          pointerStrength={0.38}
          refraction={0.018}
          ripple
          fontSize={tamanho}
          fontWeight={800}
          letterSpacing="-0.06em"
          align={alinhamento === 'esquerda' ? 'left' : 'center'}
          boost={tensao}
          {...(fontFamily ? { fontFamily } : {})}
          style={{ height: `${tamanho * 1.2}px`, minHeight: 0 }}
        />
      </div>
    </Suspense>
  );
}
