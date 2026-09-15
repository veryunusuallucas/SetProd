import type { EstadoDaLogagem, Take } from '../../types';

/**
 * A claquete: cena, plano e take, com as convenções que o set já usa.
 *
 * Nada aqui toca no banco nem na tela — são as regras, do jeito que o Lumavi as
 * tinha, para poderem ser conferidas fora do navegador (PLANO-logagem §2.1).
 */

/**
 * O alfabeto de claquete, com 21 letras.
 *
 * Faltam **I, O, Q, S e Z** de propósito: escritas à mão num pedaço de acrílico,
 * dentro de um galpão, elas viram 1, 0, 2, 5 e 2. É a convenção de set, e não
 * uma economia nossa. Depois de Y vem AA, AB… (contagem bijetiva de base 21).
 */
export const PLANO_ALFA = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'T', 'U', 'V', 'W', 'X', 'Y'] as const;

/** "A" → 1, "Y" → 21, "AA" → 22. Vazio ou letra de fora → 0. */
export function indiceDoPlano(plano: string): number {
  const s = String(plano || '').toUpperCase();
  if (!s) return 0;
  let n = 0;
  for (const letra of s) {
    const v = PLANO_ALFA.indexOf(letra as typeof PLANO_ALFA[number]);
    if (v < 0) return 0;
    n = n * PLANO_ALFA.length + (v + 1);
  }
  return n;
}

/** 1 → "A", 22 → "AA". Zero ou menos → vazio. */
export function planoDoIndice(n: number): string {
  if (n <= 0) return '';
  let s = '';
  const base = PLANO_ALFA.length;
  while (n > 0) {
    const resto = (n - 1) % base;
    s = PLANO_ALFA[resto] + s;
    n = Math.floor((n - 1) / base);
  }
  return s;
}

export const proximoPlano = (p: string) => planoDoIndice(indiceDoPlano(p) + 1);
export const planoAnterior = (p: string) => planoDoIndice(Math.max(0, indiceDoPlano(p) - 1));

export type CampoDaClaquete = 'cena' | 'plano' | 'take';

/**
 * Um passo no − ou no +, **com a cascata junto** (`stepScene` + `cascadeResetTake`).
 *
 * A cascata é a convenção do set, e ela existe porque a claquete é hierárquica:
 * - mudou a **cena** → plano volta para A (ou 1) e take para 1;
 * - mudou o **plano** → só o take volta para 1;
 * - mudou o **take** → nada mais se mexe.
 *
 * Registrar um take NÃO reinicia nada: soma 1 no take e pronto. Quem reinicia é
 * a troca de cena ou de plano, porque aí é outro setup.
 */
export function passoNaClaquete(estado: Pick<EstadoDaLogagem, 'cena' | 'plano' | 'take' | 'plano_letras'>, campo: CampoDaClaquete, direcao: 1 | -1) {
  const letras = estado.plano_letras !== false;

  if (campo === 'plano') {
    const novo = letras
      ? (direcao > 0 ? proximoPlano(estado.plano) : planoAnterior(estado.plano))
      : String(Math.max(0, (parseInt(String(estado.plano), 10) || 0) + direcao));
    return { plano: novo, take: 1 };
  }

  if (campo === 'cena') {
    const novo = String(Math.max(0, (parseInt(String(estado.cena), 10) || 0) + direcao));
    return { cena: novo, plano: letras ? 'A' : '1', take: 1 };
  }

  return { take: Math.max(0, (Number(estado.take) || 0) + direcao) };
}

/** A mesma cascata quando a pessoa DIGITA no campo em vez de usar as setas. */
export function digitarNaClaquete(estado: Pick<EstadoDaLogagem, 'plano_letras'>, campo: CampoDaClaquete, valor: string) {
  const letras = estado.plano_letras !== false;
  if (campo === 'cena') return { cena: valor, plano: letras ? 'A' : '1', take: 1 };
  if (campo === 'plano') return { plano: letras ? valor.toUpperCase() : valor, take: 1 };
  return { take: Math.max(0, parseInt(valor.replace(/\D/g, ''), 10) || 0) };
}

/**
 * Trocar entre plano em letras e plano em números, convertendo o que está lá.
 *
 * Quem estava no plano "C" e vira para números não pode ficar com um "C" que os
 * botões não sabem somar. Letra de fora do alfabeto vira A; o que não é número
 * vira 1.
 */
export function trocarModoDoPlano(plano: string, paraLetras: boolean): string {
  if (paraLetras) return indiceDoPlano(plano) === 0 ? 'A' : String(plano).toUpperCase();
  return /^\d+$/.test(String(plano)) ? String(plano) : '1';
}

const igual = (a: unknown, b: unknown) => String(a ?? '').trim().toUpperCase() === String(b ?? '').trim().toUpperCase();

/** Dois registros são a mesma claquete quando cena, plano e take batem (`mesmaSlate`). */
export function mesmaClaquete(take: Pick<Take, 'cena' | 'plano' | 'take'>, estado: Pick<EstadoDaLogagem, 'cena' | 'plano' | 'take'>) {
  return igual(take.cena, estado.cena) && igual(take.plano, estado.plano) && igual(take.take, estado.take);
}

/**
 * O próximo plano ainda **não usado nesta cena** (`proximaLetraPlano`).
 *
 * É a saída do "acréscimo" quando a claquete repete: o take existe, e o que se
 * quer não é sobrescrever, é o plano seguinte. Em modo número, o Lumavi anexa
 * uma letra ao número — "1" vira "1A", depois "1B".
 */
export function proximoPlanoLivre(planosDaCena: string[], plano: string, letras: boolean): string {
  const usados = new Set(planosDaCena.map(p => String(p).trim().toUpperCase()));

  if (letras) {
    let p = proximoPlano(plano);
    while (usados.has(p.toUpperCase())) p = proximoPlano(p);
    return p;
  }

  const base = String(plano).match(/^(\d+)/)?.[1] ?? String(plano);
  for (const letra of PLANO_ALFA) {
    if (!usados.has((base + letra).toUpperCase())) return base + letra;
  }
  return base + 'A';
}
