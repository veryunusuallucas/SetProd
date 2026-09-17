import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { movimentoReduzido } from './suporte';
import { Claquete, DURACAO_DA_CLAQUETE } from '../Claquete';

/**
 * O título SETPROD, com o easter egg.
 *
 * ERA UM SHADER (`WarpText`, do React Bits): o texto ondulava o tempo todo e
 * refratava sob o cursor. Saiu em 17/09/2026, a pedido do Lucas, por três
 * motivos que só aparecem com o app na mão: o nome do app é a primeira coisa
 * que se lê e não devia estar tremendo; num aparelho sem WebGL ele caía para
 * um texto comum, e a porta do app tinha duas caras; e o efeito custava um
 * canvas e uma biblioteca de gráficos para desenhar sete letras.
 *
 * No lugar, o título **se abre**: as letras entram espaçadas e desfocadas e
 * assentam no lugar, uma vez, na chegada. Depois fica parado, como um nome.
 *
 * O EASTER EGG CONTINUA, e continua sem aviso: a cada cutucão o nome aperta e
 * desfoca um pouco mais, e no terceiro a claquete bate (ver `Claquete.tsx`).
 * Quem só passa o olho não vê nada; quem cutuca de propósito sente a tensão
 * subindo e descobre sozinho.
 */

const RICK = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

/** Cliques precisam vir em sequência; parou, esquece. */
const JANELA_MS = 1500;
const CLIQUES_PARA_ESTOURAR = 3;

/** Tensão acumulada em cada clique — o terceiro é o estouro. */
const TENSAO = [0, 0.3, 0.65, 1];

interface Props {
  tamanho?: number;
  fontFamily?: string;
  /**
   * Liga o easter egg. Desligado, o título é só o nome.
   *
   * Ele mora só na tela inicial de propósito: um segredo que aparece em duas
   * telas deixa de ser segredo e vira botão.
   */
  interativo?: boolean;
  alinhamento?: 'esquerda' | 'centro';
  /** Tinge o título de vermelho junto com o fundo, no modo de apagar. */
  perigo?: boolean;
}

export function TituloSetProd({
  tamanho = 92, fontFamily, interativo = true, alinhamento = 'centro', perigo = false,
}: Props) {
  const [tensao, setTensao] = useState(0);
  const [claquete, setClaquete] = useState(false);
  const [reduzido] = useState(() => movimentoReduzido());

  const cliques = useRef(0);
  const relogio = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(relogio.current), []);

  const cutucar = () => {
    window.clearTimeout(relogio.current);
    cliques.current += 1;

    if (cliques.current >= CLIQUES_PARA_ESTOURAR) {
      setTensao(1);
      cliques.current = 0;
      setClaquete(true);
      // A claquete fica um segundo no ar — bater, estourar, ler — e só então
      // o take vai para o corte.
      window.setTimeout(() => {
        window.open(RICK, '_blank', 'noopener,noreferrer');
        setClaquete(false);
        setTensao(0);
      }, DURACAO_DA_CLAQUETE);
      return;
    }

    setTensao(TENSAO[cliques.current] ?? 0);
    relogio.current = window.setTimeout(() => {
      cliques.current = 0;
      setTensao(0);
    }, JANELA_MS);
  };

  return (
    <>
      <button
        type="button"
        onClick={interativo ? cutucar : undefined}
        title="SetProd"
        aria-label="SetProd"
        disabled={!interativo}
        className={reduzido ? 'titulo-setprod' : 'titulo-setprod abrindo'}
        style={{
          fontFamily: fontFamily || "'Archivo Black', 'Arial Black', system-ui, sans-serif",
          fontSize: `${tamanho}px`,
          color: perigo ? 'var(--color-danger)' : 'var(--text-primary)',
          alignSelf: alinhamento === 'centro' ? 'center' : 'flex-start',
          cursor: interativo ? 'pointer' : 'default',
          // A tensão do easter egg: apertar, desfocar, inclinar. Só isso.
          letterSpacing: `${-0.06 + tensao * 0.05}em`,
          filter: tensao ? `blur(${tensao * 2.4}px)` : undefined,
          transform: tensao ? `skewX(${tensao * -5}deg) scale(${1 + tensao * 0.03})` : undefined,
        }}
      >
        SETPROD
      </button>

      {claquete && typeof document !== 'undefined'
        && createPortal(<Claquete reduzido={reduzido} />, document.body)}
    </>
  );
}
