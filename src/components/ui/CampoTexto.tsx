import { useEffect, useRef, useState } from 'react';

/**
 * Um campo de texto que grava sozinho, sem atrapalhar quem está digitando.
 *
 * ⚠️ O PROBLEMA QUE ELE RESOLVE, E POR QUE ELE APARECIA COMO DOIS BUGS
 *
 * O padrão espalhado pelo app era este:
 *
 *     <input value={cena.descricao} onChange={e => db.cenas.update(id, {...})} />
 *
 * Parece inofensivo e não é. Cada tecla dispara uma gravação no banco, e a tela
 * só recebe o valor novo quando o Dexie avisa — o que acontece um instante
 * DEPOIS. Nesse intervalo o React redesenha o campo com o texto anterior, e o
 * navegador, ao receber um valor diferente do que está na tela, joga o cursor
 * para o fim.
 *
 * Foram dois relatos que pareciam não ter relação:
 *
 *   "toda vez que tento escrever alguma coisa entre palavras, ele ignora e
 *    escreve no final da linha"  — é o cursor sendo empurrado.
 *
 *   "acentos não funcionam"  — é a mesma coisa. No Mac, ´ + a é uma composição
 *    de duas teclas; redesenhar o campo no meio dela cancela a composição, e o
 *    acento se perde. Vale para ~, ^, ` e para o teclado do celular, que compõe
 *    palavra inteira.
 *
 * A CORREÇÃO
 * O texto que está sendo digitado mora aqui, e não no banco. A gravação sai
 * depois de uma pausa de `ATRASO_MS` — ou na hora, quando o campo perde o foco.
 * Enquanto a pessoa digita, nada de fora mexe no campo.
 *
 * Isso também deixa de gerar uma escrita por tecla no banco e na fila de
 * sincronia: "Assalto no banco" eram dezessete gravações, e vira uma.
 */

/** Quanto tempo sem digitar até gravar. */
const ATRASO_MS = 400;

interface Props {
  /** O valor que está no banco. */
  value: string;
  /** Chamado quando o texto assenta — não a cada tecla. */
  aoGravar: (valor: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
  /** Vira `<textarea>` com esta altura em linhas. */
  linhas?: number;
  inputMode?: 'text' | 'numeric' | 'decimal';
  title?: string;
  autoFocus?: boolean;
}

export function CampoTexto({
  value, aoGravar, placeholder, style, className, disabled, linhas, inputMode, title, autoFocus,
}: Props) {
  const [texto, setTexto] = useState(value ?? '');
  /** O último valor que ESTE campo mandou gravar. */
  const meuUltimo = useRef(value ?? '');
  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /*
    O texto e a função de gravar, em refs, para o efeito de desmontagem poder
    ler os dois sem depender deles.

    ⚠️ NÃO TROQUE ISTO POR UM `useEffect(..., [texto])`.
    A limpeza de um efeito roda a cada mudança das dependências, e não só ao
    desmontar. Com `[texto]`, cada tecla disparava a gravação do texto ANTERIOR
    — o que reconstruía o bug que este componente existe para consertar, e ainda
    por cima escrevendo valor velho por cima do novo.
  */
  const textoAgora = useRef(texto);
  textoAgora.current = texto;
  const gravarRef = useRef(aoGravar);
  gravarRef.current = aoGravar;

  /*
    Quando o valor muda POR FORA, o campo acompanha.

    "Por fora" é a outra pessoa editando a mesma cena, ou a sincronia trazendo
    a versão do servidor. A comparação com `meuUltimo` é o que separa isso do
    eco da própria digitação — sem ela, o valor que acabamos de gravar voltaria
    como se fosse novidade e o cursor pularia de novo, que é justamente o bug.
  */
  useEffect(() => {
    const vindo = value ?? '';
    if (vindo === meuUltimo.current) return;
    meuUltimo.current = vindo;
    setTexto(vindo);
  }, [value]);

  const agendar = (novo: string) => {
    setTexto(novo);
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      meuUltimo.current = novo;
      aoGravar(novo);
    }, ATRASO_MS);
  };

  /*
    Sair do campo grava na hora.

    Sem isto, quem digita e fecha a tela em menos de meio segundo perde o que
    escreveu — e é exatamente o que acontece com quem escreve uma palavra e já
    clica no próximo campo.
  */
  const gravarAgora = () => {
    clearTimeout(relogio.current);
    if (texto === meuUltimo.current) return;
    meuUltimo.current = texto;
    aoGravar(texto);
  };

  // Desmontar também grava: trocar de aba do módulo desmonta o campo, e o que
  // estava esperando no relógio morreria junto com ele.
  useEffect(() => () => {
    clearTimeout(relogio.current);
    if (textoAgora.current !== meuUltimo.current) gravarRef.current(textoAgora.current);
  }, []);

  const comuns = {
    value: texto,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => agendar(e.target.value),
    onBlur: gravarAgora,
    placeholder, style, className, disabled, title, autoFocus,
  };

  return linhas
    ? <textarea {...comuns} rows={linhas} />
    : <input {...comuns} inputMode={inputMode} />;
}
