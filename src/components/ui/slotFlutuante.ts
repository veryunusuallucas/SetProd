import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * Quem ocupa o canto de baixo à direita, e até que altura.
 *
 * O menu de ajuda é global — existe em toda tela. O que está embaixo dele muda:
 * na tela inicial é o botão amarelo de criar; dentro da produção é a barra de
 * navegação; no desktop não é nada, porque a barra vira lateral.
 *
 * ⚠️ ALTURA FIXA JÁ ERROU DAS DUAS FORMAS AQUI.
 *
 * Primeiro o menu ficava sempre em 96px — a altura de quem tem um botão
 * embaixo. Dentro da produção, sem botão nenhum, ele flutuava com um vão vazio
 * embaixo, ancorado em nada.
 *
 * Aí passou a descer para 24px quando o canto estava "livre" — e ali estava o
 * erro: o canto NÃO estava livre. A barra de navegação do celular ocupa os 64px
 * de baixo, e o "?" foi parar em cima do botão "Mais".
 *
 * A lição das duas vezes é a mesma: quem sabe o que ocupa o canto é quem está
 * lá, não o menu. Então cada ocupante se anuncia com a altura que de fato toma.
 *
 * E ANUNCIA MEDINDO, NÃO ADIVINHANDO. A barra some do rodapé em telas largas —
 * o `.mobile-only` a esconde e uma barra lateral assume. Repetir esse ponto de
 * quebra aqui no JS criaria uma segunda fonte de verdade, que dessincroniza
 * calada no dia em que alguém mexer no CSS.
 *
 * Medir responde à pergunta certa — "isto está mesmo ocupando o fundo da
 * tela?" — sem saber nada sobre breakpoint, sobre `display: none` ou sobre a
 * faixa segura do iPhone. As três respostas caem da mesma medição.
 */

let ocupantes = new Map<number, number>();
let proximoId = 1;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const f of ouvintes) f();
}

/** A maior altura ocupada no rodapé, em pixels. 0 = canto livre. */
function alturaAtual(): number {
  let maior = 0;
  for (const h of ocupantes.values()) if (h > maior) maior = h;
  return maior;
}

/**
 * Anuncia que algo ocupa o rodapé até `altura` pixels.
 * Devolve como atualizar a medida e como desocupar.
 */
export function ocuparSlotInferior(altura: number): {
  atualizar: (a: number) => void;
  soltar: () => void;
} {
  const id = proximoId++;
  ocupantes.set(id, altura);
  avisar();

  let solto = false;
  return {
    atualizar: (a: number) => {
      if (solto || ocupantes.get(id) === a) return;
      ocupantes.set(id, a);
      avisar();
    },
    // Idempotente: em desenvolvimento o React monta e desmonta duas vezes.
    soltar: () => {
      if (solto) return;
      solto = true;
      ocupantes.delete(id);
      avisar();
    },
  };
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

/** Quantos pixels do rodapé estão ocupados. */
export function useAlturaOcupada(): number {
  return useSyncExternalStore(assinar, alturaAtual, () => 0);
}

/**
 * Mede um elemento e o registra como ocupante enquanto ele estiver colado no
 * fundo da tela.
 *
 * O teste é "o fundo dele encosta no fundo da janela?". Isso é verdade para a
 * barra de navegação do celular e falso quando ela vira barra lateral — sem
 * precisar saber que a fronteira entre os dois casos é 900px.
 *
 * ⚠️ DEVOLVE UM `ref` DE FUNÇÃO, E NÃO ACEITA UM `useRef`. A primeira versão
 * recebia o ref e media dentro de um `useEffect`, e não funcionava: a tela da
 * produção tem retornos antecipados enquanto o Dexie responde, então na hora em
 * que o efeito rodou o `<nav>` ainda não existia. O `ResizeObserver` observava
 * `null`, o registro ficava em zero, e nada mais disparava uma nova medição —
 * quando a barra finalmente aparecia, ninguém estava olhando.
 *
 * Ref de função é chamado NO MOMENTO em que o elemento entra e sai do DOM, que
 * é exatamente a pergunta aqui.
 */
export function useOcuparRodape() {
  const estado = useRef<{
    registro: ReturnType<typeof ocuparSlotInferior> | null;
    observador: ResizeObserver | null;
    medir: () => void;
  }>({ registro: null, observador: null, medir: () => {} });

  // Desocupa ao desmontar. O ref de função já cuida da troca de elemento; isto
  // cobre o componente inteiro saindo da tela.
  useEffect(() => () => {
    estado.current.observador?.disconnect();
    window.removeEventListener('resize', estado.current.medir);
    estado.current.registro?.soltar();
  }, []);

  return useCallback((el: HTMLElement | null) => {
    const s = estado.current;

    s.observador?.disconnect();
    window.removeEventListener('resize', s.medir);

    if (!el) {
      s.registro?.soltar();
      s.registro = null;
      return;
    }

    s.registro ??= ocuparSlotInferior(0);
    s.medir = () => {
      const r = el.getBoundingClientRect();
      const coladoNoFundo = r.height > 0 && Math.abs(r.bottom - window.innerHeight) < 2;
      s.registro?.atualizar(coladoNoFundo ? Math.round(r.height) : 0);
    };

    s.medir();

    // `ResizeObserver` pega a mudança de altura (a faixa segura do iPhone entra
    // e sai); o `resize` da janela pega a virada para barra lateral, que muda a
    // posição sem mudar o tamanho.
    s.observador = new ResizeObserver(s.medir);
    s.observador.observe(el);
    window.addEventListener('resize', s.medir);
  }, []);
}
