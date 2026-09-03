import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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

/**
 * COMPENSAÇÃO DE TAMANHO — por que os números não são os da referência.
 *
 * O shader desloca o texto em coordenadas de textura (0 a 1), então o efeito
 * final em PIXELS é proporcional à largura do canvas. A demonstração do React
 * Bits usa um texto enorme; aqui o título tem 84px na tela inicial e 52px no
 * login. Com os mesmos números, o movimento vira um terço — e o repouso cai
 * para MENOS DE UM PIXEL, que é literalmente invisível.
 *
 * Medido com os valores antigos (warp 0.08, ponteiro 0.38):
 *   login  0,66px em repouso ·  6,3px sob o cursor
 *   início 1,08px em repouso · 10,3px sob o cursor
 *   demo   1,98px em repouso · 18,8px sob o cursor
 *
 * Daí a compensação: a força cresce na mesma proporção em que o título
 * encolhe, e o movimento percebido fica igual em qualquer tamanho — cerca de
 * 2,7px em repouso e 16px sob o cursor, nos dois lugares.
 *
 * Para mexer na intensidade, mexa só nestes três números.
 */
const TAMANHO_REFERENCIA = 84;
const BASE_WARP = 0.20;
const BASE_PONTEIRO = 0.62;
const BASE_REFRACAO = 0.028;

/** Teto de 2,2× para um título minúsculo não virar borrão ilegível. */
const compensacaoDe = (tamanho: number) =>
  Math.min(2.2, Math.max(1, TAMANHO_REFERENCIA / Math.max(tamanho, 1)));

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
  /** Tinge o título de vermelho junto com o fundo, no modo de apagar. */
  perigo?: boolean;
}

/**
 * O título SETPROD, com o easter egg.
 *
 * Não há contador, balão nem dica: o único aviso é o próprio efeito ficando
 * mais violento a cada clique. Quem só passa o olho não percebe nada; quem
 * cutuca de propósito sente a tensão subindo e descobre sozinho.
 */
export function TituloSetProd({ tamanho = 92, fontFamily, interativo = true, alinhamento = 'centro', perigo = false }: Props) {
  const [efeitos] = useState(() => decidirEfeitos());
  const [tensao, setTensao] = useState(0);
  const compensacao = compensacaoDe(tamanho);

  /*
    ⚠️ TER WEBGL NÃO É O MESMO QUE CONTINUAR TENDO.

    `decidirEfeitos()` pergunta uma vez, na montagem, e o Firefox às vezes tira
    o contexto DEPOIS — foi o relato de 12/08: "no mozila o título não aparece"
    e, junto, "WebGL context was lost" no console. Sem contexto, o canvas fica
    em branco e a tela de entrada perde o nome do app; a pessoa não tem nem como
    saber onde está.

    O `webglcontextlost` não sobe pela árvore, mas passa por ela na descida —
    por isso o ouvinte é registrado na fase de captura, no elemento que embrulha
    o canvas. Perdeu o contexto, cai no título de texto, que é o mesmo caminho
    de quem nunca teve WebGL.
  */
  const [contextoPerdido, setContextoPerdido] = useState(false);

  /*
    O ouvinte entra por ref, e não por `useEffect`.

    A caixa mora dentro de um `Suspense`, e o WarpText é carregado sob demanda:
    quando um efeito com `[]` roda, o que está na tela ainda é o vazio do
    Suspense e a caixa é `null`. O efeito não pegava nada e nunca mais rodava —
    a queda do contexto passava batida, que foi como este conserto falhou na
    primeira tentativa. A ref é chamada quando o elemento aparece de verdade.
  */
  const aoMontarCaixa = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const perdeu = () => setContextoPerdido(true);
    el.addEventListener('webglcontextlost', perdeu, true);
    return () => el.removeEventListener('webglcontextlost', perdeu, true);
  }, []);

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
  if (!efeitos.titulo || contextoPerdido) {
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
          color: perigo ? 'var(--color-danger)' : 'var(--text-primary)', lineHeight: 1.1,
          opacity: movimentoReduzido() ? 1 : 1 - tensao * 0.35,
          transition: 'opacity 0.2s ease, color 0.45s ease',
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
        ref={aoMontarCaixa}
        onClick={interativo ? cutucar : undefined}
        style={{ cursor: interativo ? 'pointer' : 'default' }}
      >
        <WarpText
          text="SETPROD"
          color="#f8f5ff"
          /* Ver COMPENSACAO abaixo: os números crescem quando o título encolhe. */
          warpStrength={BASE_WARP * compensacao}
          warpScale={1.7}
          speed={0.55}
          pointerInfluence={0.42}
          pointerStrength={BASE_PONTEIRO * compensacao}
          refraction={BASE_REFRACAO * compensacao}
          ripple
          fontSize={tamanho}
          fontWeight={800}
          letterSpacing="-0.06em"
          align={alinhamento === 'esquerda' ? 'left' : 'center'}
          boost={tensao}
          tint={perigo ? '#ff6b6b' : '#ffffff'}
          {...(fontFamily ? { fontFamily } : {})}
          style={{ height: `${tamanho * 1.2}px`, minHeight: 0 }}
        />
      </div>
    </Suspense>
  );
}
