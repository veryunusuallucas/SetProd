import { useCallback } from 'react';

/**
 * O painel nasce de onde foi chamado.
 *
 * Todo modal do app cresce a partir do próprio centro, e o efeito é que ele
 * *aparece* em vez de *ser aberto*: nada liga o botão que a pessoa tocou ao
 * painel que surgiu. Ancorar a origem no ponto do toque resolve isso sem mudar
 * nada visualmente parado — a diferença está só nos 200ms da entrada, que é
 * exatamente onde a relação de causa é lida.
 *
 * ONDE NÃO USAR: confirmação destrutiva (apagar produção, remover pessoa). Ali
 * a interrupção é intencional — o painel deve chegar do centro, com o fundo
 * escurecido, e custar um instante de atenção. Fluidez ali seria trabalhar
 * contra o propósito da tela.
 *
 * COMO FUNCIONA
 * O último `pointerdown` da página fica guardado. Quando o painel monta, ele se
 * mede e converte aquele ponto em coordenadas próprias. Ouvir o ponteiro no
 * documento inteiro, e não pedir a referência do botão, é o que faz isto valer
 * para qualquer gatilho — inclusive os que abrem por atalho de teclado, onde
 * simplesmente não há ponto e o centro continua sendo o certo.
 */

let ultimoToque: { x: number; y: number; quando: number } | null = null;

if (typeof window !== 'undefined') {
  // `capture` para registrar antes de qualquer `stopPropagation` das telas.
  window.addEventListener(
    'pointerdown',
    e => { ultimoToque = { x: e.clientX, y: e.clientY, quando: Date.now() }; },
    true
  );
}

/**
 * Depois disto, o toque guardado não vale mais.
 *
 * Um painel aberto por teclado, ou por consequência de outra coisa, herdaria a
 * posição de um clique de minutos atrás e cresceria de um canto sem relação
 * nenhuma — pior que crescer do centro, porque aponta para o lugar errado.
 */
const VALIDADE_MS = 1200;

/**
 * Devolve um `ref` para o painel. Anexe ao elemento que tem a animação de
 * escala — não ao fundo escurecido.
 */
export function useOrigemAncorada() {
  return useCallback((el: HTMLElement | null) => {
    if (!el) return;

    const toque = ultimoToque;
    if (!toque || Date.now() - toque.quando > VALIDADE_MS) return; // fica no centro

    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;

    /*
      Preso às bordas do painel de propósito.

      Um toque no canto da tela, longe do painel, daria uma origem muito fora
      dele — e escalar a partir de um ponto distante vira um voo atravessando a
      tela, não um crescimento. Limitado à própria caixa, o pior caso é nascer
      de uma quina, que ainda lê como "veio daqui".
    */
    const x = Math.min(Math.max(toque.x - r.left, 0), r.width);
    const y = Math.min(Math.max(toque.y - r.top, 0), r.height);

    el.style.transformOrigin = `${x}px ${y}px`;
  }, []);
}
