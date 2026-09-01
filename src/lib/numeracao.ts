import { db } from '../db/db';
import type { Diaria } from '../types';
import { estadoDa } from './sincronizaOD';

/**
 * O número da diária vem da ORDEM DAS DATAS, não da mão de ninguém.
 *
 * POR QUE
 * "Diária 01" nunca quis dizer "a primeira que eu cadastrei" — quer dizer "o
 * primeiro dia de filmagem". Enquanto o número era digitado, os dois se
 * separavam na primeira remarcação: a produção marcava um dia extra para antes
 * do começo e ele entrava como Diária 08, ou repetia um número sem perceber.
 *
 * Agora ele é derivado: ordene as diárias por data e conte. Criar um dia para
 * amanhã faz dele a Diária 01; criar um para daqui a um ano, com quatro dias
 * antes, faz dele a 05 — sem ninguém digitar nada.
 */

/** Empate na mesma data mantém a ordem que já estava. Dia dividido é rotina. */
function ordenar(diarias: Diaria[]): Diaria[] {
  return [...diarias].sort((a, b) => {
    const porData = (a.data || '').localeCompare(b.data || '');
    return porData !== 0 ? porData : (a.numero ?? 0) - (b.numero ?? 0);
  });
}

/** `id → número`, contando da primeira data para a última. */
export function numerarPorData(diarias: Diaria[]): Map<string, number> {
  const mapa = new Map<string, number>();
  ordenar(diarias).forEach((d, i) => mapa.set(d.id, i + 1));
  return mapa;
}

/**
 * Que número uma diária NOVA teria naquela data, sem gravar nada.
 *
 * Serve para o formulário dizer "vai ser a Diária 05" antes de a pessoa
 * confirmar — o número deixa de ser um campo e vira uma consequência visível.
 */
export function numeroPrevisto(diarias: Diaria[], data: string): number {
  if (!data) return diarias.length + 1;
  // Empate na mesma data: a nova entra DEPOIS das que já existem naquele dia.
  return ordenar(diarias).filter(d => (d.data || '') <= data).length + 1;
}

export interface Renumeracao {
  /** Quantas diárias mudaram de número. */
  mudaram: number;
  /**
   * As que mudaram e JÁ TINHAM SAÍDO (publicadas ou fechadas).
   *
   * É a única parte disto que precisa de atenção humana: existe um papel na
   * mão da equipe dizendo o número antigo.
   */
  jaCirculavam: { id: string; de: number; para: number }[];
}

/**
 * Renumera o projeto inteiro e grava só o que mudou.
 *
 * ⚠️ RENUMERA TAMBÉM AS PUBLICADAS E FECHADAS — e devolve quais foram.
 *
 * A alternativa seria congelar o número delas, e ela é pior: sobrariam números
 * repetidos e buracos na sequência, que é exatamente o problema que a
 * numeração automática veio resolver. Uma lista com duas "Diária 03" é pior que
 * uma Diária 03 que virou 04 e avisou.
 *
 * Quem chama decide o que fazer com `jaCirculavam` — a lista de diárias mostra
 * um aviso, porque a OD impressa passou a dizer outro número.
 */
export async function renumerarPorData(projetoId: string): Promise<Renumeracao> {
  const diarias = await db.diarias.where('projeto_id').equals(projetoId).toArray();
  const novos = numerarPorData(diarias);

  const jaCirculavam: Renumeracao['jaCirculavam'] = [];
  let mudaram = 0;

  for (const d of diarias) {
    const novo = novos.get(d.id)!;
    if (novo === d.numero) continue;

    mudaram++;
    const estado = estadoDa(d);
    if (estado === 'publicada' || estado === 'fechada') {
      jaCirculavam.push({ id: d.id, de: d.numero, para: novo });
    }
    await db.diarias.update(d.id, { numero: novo });
  }

  return { mudaram, jaCirculavam };
}
