/**
 * A escala da diária mescla por pessoa, em vez de a última gravação levar tudo
 * (ROADMAP §10.A, item 2).
 *
 * O PROBLEMA
 * O espelho guarda a diária inteira, e quem grava por último leva tudo. Dois
 * assistentes escalando gente ao mesmo tempo — um põe a Fotografia, o outro a
 * Arte — e metade da escala some, em silêncio.
 *
 * POR QUE NÃO É SÓ UNIR AS DUAS LISTAS
 * União nunca remove: tirar alguém da escala deixaria de funcionar, porque a
 * versão do outro aparelho, ainda com a pessoa, a traria de volta. Então cada
 * pessoa tem um carimbo próprio (`escala_carimbos`), com a hora da última
 * mudança dela — entrou ou saiu (`fora`). Na mescla, vale o carimbo mais novo
 * de cada pessoa, e não o da diária inteira.
 *
 * Os carimbos nascem no hook do Dexie (`db.ts`), comparando a escala antes e
 * depois de cada gravação. Nenhuma tela que escala gente precisou mudar.
 *
 * Sem dependência nenhuma de propósito: o `db.ts` importa daqui.
 */

export interface CarimboDaEscala {
  /** Quando esta pessoa entrou ou saiu da escala (relógio do aparelho). */
  em: number;
  /** Saiu. Sem isto, a mescla não saberia distinguir "saiu" de "nunca soube". */
  fora?: true;
}

export type CarimbosDaEscala = Record<string, CarimboDaEscala>;

interface ComEscala {
  equipe_escalada?: string[];
  escala_carimbos?: CarimbosDaEscala;
}

/** Os carimbos de quem entrou e saiu entre uma versão da escala e a próxima. */
export function carimbarMudancasDaEscala(
  antes: string[] | undefined, depois: string[] | undefined,
  carimbos: CarimbosDaEscala | undefined, agora: number,
): CarimbosDaEscala {
  const velha = new Set(antes || []);
  const nova = new Set(depois || []);
  const saida: CarimbosDaEscala = { ...(carimbos || {}) };
  for (const id of nova) if (!velha.has(id)) saida[id] = { em: agora };
  for (const id of velha) if (!nova.has(id)) saida[id] = { em: agora, fora: true };
  return saida;
}

/**
 * A escala das duas versões, pessoa a pessoa.
 *
 * `base` dá a ordem (a versão que ganhou o resto da diária); quem entrou só do
 * outro lado vem no fim. Uma escala antiga, sem carimbos, conta como carimbo
 * zero para quem está nela — qualquer mudança carimbada vence.
 */
export function mesclarEscala(base: ComEscala, outra: ComEscala): {
  equipe_escalada: string[];
  escala_carimbos: CarimbosDaEscala;
} {
  const naBase = new Set(base.equipe_escalada || []);
  const naOutra = new Set(outra.equipe_escalada || []);
  const cBase = base.escala_carimbos || {};
  const cOutra = outra.escala_carimbos || {};

  const efetivo = (id: string, carimbos: CarimbosDaEscala, presentes: Set<string>): CarimboDaEscala | undefined =>
    carimbos[id] ?? (presentes.has(id) ? { em: 0 } : undefined);

  const todos = [...new Set([...naBase, ...naOutra, ...Object.keys(cBase), ...Object.keys(cOutra)])];
  const carimbos: CarimbosDaEscala = {};
  const dentro = new Set<string>();

  for (const id of todos) {
    const a = efetivo(id, cBase, naBase);
    const b = efetivo(id, cOutra, naOutra);
    // Empate: fica quem está DENTRO. Tirar alguém por engano é o erro caro.
    const vence = !a ? b : !b ? a : a.em > b.em ? a : b.em > a.em ? b : (!a.fora ? a : b);
    if (!vence) continue;
    if (vence.em > 0) carimbos[id] = vence;
    if (!vence.fora) dentro.add(id);
  }

  const ordem = [...(base.equipe_escalada || []), ...(outra.equipe_escalada || [])];
  return {
    equipe_escalada: [...new Set(ordem)].filter(id => dentro.has(id)),
    escala_carimbos: carimbos,
  };
}

/** As duas escalas dizem a mesma coisa? */
export function mesmaEscala(a: string[] | undefined, b: string[] | undefined): boolean {
  const x = new Set(a || []);
  const y = new Set(b || []);
  return x.size === y.size && [...x].every(id => y.has(id));
}
