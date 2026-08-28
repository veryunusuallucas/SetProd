import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { useMovimentoReduzido } from './movimento';

/**
 * Um número que sobe até o valor.
 *
 * Não é enfeite: número que aparece pronto é lido como rótulo, número que sobe é
 * lido como resultado de uma conta. Num painel financeiro isso muda a percepção
 * de solidez — a pessoa vê o app somando, não exibindo.
 *
 * ⚠️ SÓ PARA NÚMERO DE RESUMO. Saldo, total gasto, páginas gravadas. Nunca em
 * linha de lista: quem está conferindo uma despesa contra o extrato quer o valor
 * imediatamente, e um número em movimento atrasa a leitura de propósito. Vale a
 * mesma regra que proíbe animar a decupagem e o financeiro item a item.
 *
 * TRÊS DETALHES QUE O CONTADOR À MÃO DO PAINEL NÃO TINHA:
 *
 *   ALGARISMO DE LARGURA FIXA. Sem `tabular-nums`, o 1 é mais estreito que o 8 e
 *   o número muda de largura a cada quadro — treme, e empurra o que está do lado.
 *   É a diferença mais visível entre um contador acabado e um improvisado.
 *
 *   DESACELERAÇÃO. A contagem linear chega ao fim na mesma velocidade em que
 *   começou, e parece um relógio digital. Com `easeOut` ela pousa.
 *
 *   MOVIMENTO REDUZIDO. Quem pediu menos movimento no sistema recebe o valor
 *   direto — a informação é a mesma.
 *
 * SUBSTITUI DOIS CONTADORES QUE EXISTIAM EM PARALELO: um `ContadorAnimado` em
 * `ui/`, usado só na Home, e um laço de `requestAnimationFrame` escrito à mão
 * dentro do painel da produção. Faziam a mesma coisa com defeitos diferentes —
 * o do painel nem desacelerava — e os dois escreviam dinheiro em notação
 * inglesa. Dois componentes para a mesma tarefa é dívida, não redundância: o
 * conserto de um nunca chega no outro.
 */

interface Props {
  valor: number;
  /** Formata como moeda brasileira: R$ 1.234,56. */
  moeda?: boolean;
  /** Casas decimais quando não é moeda. */
  decimais?: number;
  sufixo?: string;
  className?: string;
  style?: React.CSSProperties;
}

const DURACAO = 0.7;

function formatar(v: number, moeda?: boolean, decimais = 0): string {
  /*
    pt-BR de verdade, e não `toFixed`.

    O app inteiro escrevia "R$ 1234.56" — ponto decimal e sem separador de
    milhar, que é a notação inglesa. E o campo de digitar despesa já usava o
    formato certo: dava para TECLAR "R$ 1.234,56" e ver "R$ 1234.56" na linha
    seguinte. Onde este componente entra, isso acaba.
  */
  if (moeda) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

export function Numero({ valor, moeda, decimais = 0, sufixo, className, style }: Props) {
  const reduzido = useMovimentoReduzido();
  const [mostrado, setMostrado] = useState(valor);

  /*
    De ONDE a contagem parte.

    Guardado em `ref` e não em estado: ele muda junto com a animação, e usar
    estado aqui daria uma renderização a mais por quadro sem mudar nada na tela.
    Na primeira vez o ponto de partida é zero — é o que faz o número "subir".
    Depois, parte de onde estava, para uma despesa nova não jogar o saldo lá
    embaixo e trazê-lo de volta.
  */
  const anterior = useRef(0);

  useEffect(() => {
    if (reduzido) {
      anterior.current = valor;
      setMostrado(valor);
      return;
    }

    const de = anterior.current;
    if (de === valor) return;

    const controle = animate(de, valor, {
      duration: DURACAO,
      ease: 'easeOut',
      onUpdate: v => setMostrado(v),
      // Cravar o destino no fim: a interpolação por ponto flutuante pode parar
      // em 1234,5599999 e, em dinheiro, um centavo errado na tela é um erro.
      onComplete: () => setMostrado(valor),
    });

    anterior.current = valor;
    return () => controle.stop();
  }, [valor, reduzido]);

  return (
    <span
      className={className}
      // `tabular-nums` é o que impede o número de tremer enquanto conta.
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {formatar(mostrado, moeda, decimais)}{sufixo}
    </span>
  );
}
