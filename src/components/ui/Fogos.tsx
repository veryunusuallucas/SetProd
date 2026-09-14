import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useMovimentoReduzido } from './movimento';

/**
 * Fogos de artifício — a comemoração do wrap.
 *
 * ⚠️ É A FAÍSCA (`ui/Faisca.tsx`) EM ESCALA, e não um efeito novo importado de
 * fora. Mesma ideia — partículas que saem de um ponto e apagam —, mesma cor do
 * tema, mesmo respeito a quem pediu menos movimento. Procurei no React Bits
 * (não tem) e no Motion (o exemplo é pago); o repertório da casa resolvia.
 *
 * O QUE SEPARA FOGOS DE CONFETE
 * Confete cai de cima e cobre a tela. Fogos ESTOURAM em pontos e somem, e é por
 * isso que servem aqui: eles deixam ler o que está embaixo. A carta de wrap tem
 * números que a pessoa vai querer olhar, e um efeito que tapa o conteúdo por
 * três segundos transforma comemoração em espera.
 *
 * ⚠️ `pointerEvents: none` no contêiner, como na faísca: desenha por cima de
 * tudo e não intercepta um toque sequer. Sem isso, os fogos comeriam o clique
 * no botão de fechar — exatamente enquanto a pessoa tenta fechar.
 */

/** Partículas por estouro. Acima disso o celular de set engasga. */
const PARTICULAS = 22;
/** Quanto cada partícula viaja, em pixels. */
const ALCANCE = [90, 170] as const;
const DURACAO = 1.15;

/**
 * As cores.
 *
 * O acento do app primeiro — os fogos são DESTE app, não de um pacote. As
 * outras três entram porque um estouro monocromático não lê como festa; são
 * poucas e quentes de propósito, para não brigar com o tema escuro.
 */
const CORES = ['var(--accent)', '#ffd166', '#ef476f', '#06d6a0'];

interface Estouro {
  id: number;
  /** Posição em porcentagem da tela, para não depender do tamanho. */
  x: number;
  y: number;
  atraso: number;
  cor: string;
}

export function Fogos({ duracaoMs = 2600, quantidade = 5 }: {
  /** Quanto tempo os estouros continuam nascendo. */
  duracaoMs?: number;
  /** Quantos estouros ao todo. */
  quantidade?: number;
}) {
  const reduzido = useMovimentoReduzido();
  const [vivo, setVivo] = useState(true);

  /*
    Os estouros são sorteados UMA vez e ficam.

    Sorteados a cada render, eles saltariam de lugar sempre que o componente
    pai mudasse de estado — e o pai é uma carta com botões, então isso
    aconteceria no primeiro toque.
  */
  const estouros = useMemo<Estouro[]>(() => {
    const janela = Math.max(0, duracaoMs - DURACAO * 1000);
    return Array.from({ length: quantidade }, (_, i) => ({
      id: i,
      x: 12 + Math.random() * 76,
      // Na metade de cima: fogo estoura no céu, e embaixo ele cobriria o texto.
      y: 10 + Math.random() * 42,
      atraso: (i / Math.max(1, quantidade - 1)) * (janela / 1000),
      cor: CORES[i % CORES.length],
    }));
  }, [duracaoMs, quantidade]);

  useEffect(() => {
    if (reduzido) return;
    const t = setTimeout(() => setVivo(false), duracaoMs + DURACAO * 1000);
    return () => clearTimeout(t);
  }, [duracaoMs, reduzido]);

  // Quem pediu menos movimento não recebe nada. Os fogos são puro movimento e
  // não carregam informação — o que importa está escrito na carta, em texto.
  if (reduzido || !vivo) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9997, pointerEvents: 'none', overflow: 'hidden' }}>
      {estouros.map(e => (
        <div key={e.id} style={{ position: 'absolute', left: `${e.x}%`, top: `${e.y}%` }}>
          {Array.from({ length: PARTICULAS }, (_, i) => {
            const angulo = (i / PARTICULAS) * Math.PI * 2 + Math.random() * 0.2;
            const alcance = ALCANCE[0] + Math.random() * (ALCANCE[1] - ALCANCE[0]);
            return (
              <motion.span
                key={i}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  x: Math.cos(angulo) * alcance,
                  /*
                    A queda no fim: o `+ alcance * 0.35` puxa a partícula para
                    baixo no destino. É o que separa um fogo de um asterisco —
                    sem gravidade, o estouro fica perfeitamente radial e lê como
                    um ícone de carregando.
                  */
                  y: Math.sin(angulo) * alcance + alcance * 0.35,
                  scale: [0.4, 1, 0.9, 0.2],
                }}
                transition={{
                  duration: DURACAO,
                  delay: e.atraso,
                  ease: [0.15, 0.75, 0.35, 1],
                  times: [0, 0.12, 0.6, 1],
                }}
                style={{
                  position: 'absolute',
                  width: '4px', height: '4px', borderRadius: '50%',
                  backgroundColor: e.cor,
                  marginLeft: '-2px', marginTop: '-2px',
                  boxShadow: `0 0 6px ${e.cor}`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>,
    document.body
  );
}
