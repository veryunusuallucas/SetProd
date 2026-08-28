import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMovimentoReduzido } from './movimento';

/**
 * Uma faísca curta no ponto exato do toque.
 *
 * A resposta acontece ONDE o dedo está, e não onde o app resolveu colocar um
 * aviso. Confirmar uma cena no set e ver um toast subir do rodapé obriga a
 * pessoa a procurar a confirmação com os olhos; a faísca já está embaixo do
 * dedo dela.
 *
 * ⚠️ SÓ EM CONFIRMAÇÃO, NUNCA EM NAVEGAÇÃO. Faísca ao trocar de aba vira
 * poluição — e, pior, gasta o significado: se tudo faísca, faiscar não quer
 * dizer "deu certo". No app isso quer dizer: cena marcada como gravada, sim;
 * cena passando por "parcial" no meio do ciclo, não.
 *
 * COMO É CHAMADA
 * Por uma função, e não envolvendo o botão num componente. Envolver obrigaria a
 * mexer no JSX de cada lugar e a decidir na marra se aquele clique é uma
 * confirmação — quem sabe isso é o manipulador, que já tem a condição na mão:
 *
 *     if (novoStatus === 'gravada') faiscar(evento);
 */

interface Ponto { id: number; x: number; y: number }

let proximoId = 1;
let publicar: ((p: Ponto) => void) | null = null;

/** Solta a faísca no ponto do evento. Sem `<Faiscas />` montado, não faz nada. */
export function faiscar(e: { clientX: number; clientY: number }) {
  publicar?.({ id: proximoId++, x: e.clientX, y: e.clientY });
}

/** Quantos raios, e quão longe vão. Poucos e curtos: é um instante, não um efeito. */
const RAIOS = 8;
const DISTANCIA = 16;
const DURACAO = 0.42;

/**
 * O anfitrião das faíscas. Monte UMA vez, no topo do app.
 *
 * `pointerEvents: none` no contêiner é o detalhe que impede a faísca de comer o
 * toque seguinte — ela desenha por cima de tudo, mas não intercepta nada.
 */
export function Faiscas() {
  const [pontos, setPontos] = useState<Ponto[]>([]);
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    // Quem pediu menos movimento não recebe faísca nenhuma: ela é puro
    // movimento, e não carrega informação que se perca ao sumir.
    if (reduzido) { publicar = null; return; }

    publicar = p => {
      setPontos(atual => [...atual, p]);
      // Some sozinha. Guardar histórico de faísca não serve para nada, e uma
      // lista que só cresce vaza memória numa tela aberta o dia inteiro.
      setTimeout(() => setPontos(atual => atual.filter(x => x.id !== p.id)), DURACAO * 1000 + 80);
    };
    return () => { publicar = null; };
  }, [reduzido]);

  if (reduzido) return null;

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none', overflow: 'hidden' }}>
      <AnimatePresence>
        {pontos.map(p => (
          <div key={p.id} style={{ position: 'absolute', left: p.x, top: p.y }}>
            {Array.from({ length: RAIOS }, (_, i) => {
              const angulo = (i / RAIOS) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{
                    opacity: 0,
                    x: Math.cos(angulo) * DISTANCIA,
                    y: Math.sin(angulo) * DISTANCIA,
                    scale: 0.4,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: DURACAO, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    width: '3px', height: '3px', borderRadius: '50%',
                    // Cor do tema, nunca chumbada: a faísca acompanha o acento
                    // do app em vez de trazer um amarelo próprio.
                    backgroundColor: 'var(--accent)',
                    marginLeft: '-1.5px', marginTop: '-1.5px',
                  }}
                />
              );
            })}
          </div>
        ))}
      </AnimatePresence>
    </div>,
    document.body
  );
}
