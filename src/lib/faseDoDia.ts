import type { Diaria } from '../types';
import { estadoDa } from './sincronizaOD';
import { emMinutos } from './linhaDoDia';

/**
 * Em que fase a diária está — e por que isso NÃO é um botão.
 *
 * ⚠️ O MODO INTERATIVO NÃO É UMA ABA QUE SE ESCOLHE. É o que a diária VIRA.
 *
 * A linha divisória é a exportação. Antes dela, o plano é livre: ninguém viu.
 * Depois dela, todo mundo está com aquele PDF na mão, e o plano vira verdade
 * compartilhada — mudá-lo por baixo produziria a pior situação possível, que é
 * a equipe seguindo um papel e o app mostrando outro.
 *
 * A primeira versão disto era um seletor "Montar / No set" que cada pessoa
 * escolhia. Funcionava, e estava errado pelo mesmo motivo: dois AD podiam olhar
 * a mesma diária em modos diferentes, e nenhum dos dois sabia disso.
 *
 * O `ativo` é a segunda virada, e essa é do relógio: o dia COMEÇOU quando
 * passou da chamada. Sem botão "iniciar o dia" — quem está no set às 6h da
 * manhã com café na mão não vai lembrar de apertar nada, e uma tela que espera
 * um clique que ninguém dá fica mostrando o dia de ontem.
 */

export type Modo = 'criacao' | 'interativo';

export interface Fase {
  modo: Modo;
  /** O dia está acontecendo: passou da chamada e a diária não fechou. */
  ativo: boolean;
  /** Minutos até a chamada. `null` quando já passou, ou não dá para saber. */
  faltamMinutos: number | null;
  /**
   * Dias até a diária: 0 é hoje, 1 é amanhã, negativo já passou.
   *
   * Existe porque o relógio passou a aparecer assim que a OD é publicada, e não
   * só no dia. Sem isto ele não teria o que dizer numa diária de quinta-feira:
   * `faltamMinutos` só sabe contar dentro do mesmo dia.
   */
  diasAte: number | null;
  /** A diária é de hoje. */
  hoje: boolean;
}

/**
 * @param agora Injetável para o cálculo ser testável sem mexer no relógio.
 */
export function faseDoDia(diaria: Diaria, agora: Date = new Date()): Fase {
  const estado = estadoDa(diaria);
  /*
    `travada` fica do lado de CRIAÇÃO, e não do lado do registro.

    Ela congela o plano, mas ninguém de fora viu — não há dia acontecendo para
    registrar. Mostrar a tela de execução numa diária que a equipe nem recebeu
    seria pedir marcação de um dia que não começou.
  */
  const modo: Modo = estado === 'rascunho' || estado === 'travada' ? 'criacao' : 'interativo';

  /*
    A data é comparada como TEXTO, não como Date.

    `new Date('2026-10-10')` é meia-noite UTC, que no Brasil é o dia 9 às 21h —
    o erro que já apareceu duas vezes neste app. Montar a data local de hoje em
    `YYYY-MM-DD` e comparar strings não tem fuso para errar.
  */
  const hojeISO = [
    agora.getFullYear(),
    String(agora.getMonth() + 1).padStart(2, '0'),
    String(agora.getDate()).padStart(2, '0'),
  ].join('-');

  const hoje = diaria.data === hojeISO;
  const passou = Boolean(diaria.data && diaria.data < hojeISO);

  const chamada = emMinutos(diaria.chamada);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();

  /*
    Um dia que já passou conta como ativo enquanto a diária não fechar.

    Não é detalhe: o AD que não conseguiu marcar tudo durante a correria e abre
    o app às 23h — ou na manhã seguinte, antes de fechar — precisa da mesma tela
    de registro. Devolvê-lo ao modo de planejamento seria oferecer a edição de
    um plano que já aconteceu.
  */
  const comecouHoje = hoje && (chamada === null || agoraMin >= chamada);
  const ativo = modo === 'interativo' && estado !== 'fechada' && (comecouHoje || passou);

  const faltamMinutos = hoje && chamada !== null && agoraMin < chamada
    ? chamada - agoraMin
    : null;

  /*
    A distância em dias, contada ao MEIO-DIA das duas pontas.

    Meia-noite mais horário de verão dá 23h ou 25h de diferença, e a divisão por
    24h derruba ou inventa um dia. Ao meio-dia sobra folga de doze horas para
    qualquer mudança de fuso — o mesmo cuidado de `lib/urgencia.ts`.
  */
  const diasAte = diaria.data ? contarDias(hojeISO, diaria.data) : null;

  return { modo, ativo, faltamMinutos, diasAte, hoje };
}

/** Dias inteiros de `deISO` até `ateISO`, ambos em `YYYY-MM-DD`. */
function contarDias(deISO: string, ateISO: string): number | null {
  const meioDia = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    if (!a || !m || !d) return null;
    return new Date(a, m - 1, d, 12, 0, 0).getTime();
  };
  const de = meioDia(deISO), ate = meioDia(ateISO);
  if (de === null || ate === null) return null;
  return Math.round((ate - de) / 86_400_000);
}

/** "em 40min" / "em 2h10". Para a contagem regressiva até a chamada. */
export function descreverEspera(minutos: number): string {
  if (minutos < 60) return `em ${minutos}min`;
  const h = Math.floor(minutos / 60), m = minutos % 60;
  return m ? `em ${h}h${String(m).padStart(2, '0')}` : `em ${h}h`;
}
