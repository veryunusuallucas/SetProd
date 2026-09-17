import type { Diaria } from '../../types';
import { emMinutos } from '../linhaDoDia';

/**
 * Em qual diária a Logagem abre.
 *
 * A Logagem sempre roda dentro de uma diária (PLANO-logagem §9a, pergunta 9).
 * Quem abre o módulo no set quer a de HOJE, e perguntar toda vez seria um toque
 * a mais no pior momento. Sem diária hoje, a próxima (quem prepara o kit na
 * véspera). Sem próxima, a última (quem confere o boletim depois do filme).
 *
 * `hoje` entra como argumento para a regra poder ser testada sem relógio.
 */
export function diariaPadrao(diarias: Diaria[], hoje: string): Diaria | undefined {
  const comData = diarias.filter(d => d.data);
  const deHoje = comData.find(d => d.data === hoje);
  if (deHoje) return deHoje;

  const proxima = comData
    .filter(d => d.data > hoje)
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  if (proxima) return proxima;

  return comData.sort((a, b) => b.data.localeCompare(a.data))[0] ?? diarias[0];
}

/**
 * Até que hora da madrugada a diária de ontem ainda é "a de agora".
 *
 * Diária noturna vira a noite: às 01h a data já é de amanhã, mas a claquete
 * ainda é do dia que começou às 18h. Sem isto a Logagem pularia sozinha para a
 * diária seguinte no meio da última cena.
 */
export const MADRUGADA_ATE_MIN = 6 * 60;

export type MotivoDaDiaria = 'hoje' | 'virou_a_noite' | 'proxima' | 'ultima';

/**
 * A diária em que se deveria estar AGORA, e por quê.
 *
 * Só `hoje` e `virou_a_noite` são "o dia acontecendo": são os dois casos em que
 * trocar de diária põe take no dia errado, e em que a tela avisa. `proxima` e
 * `ultima` são só o melhor lugar para abrir.
 */
export function diariaDeAgora(
  diarias: Diaria[],
  agora: Date = new Date(),
): { diaria: Diaria; motivo: MotivoDaDiaria } | undefined {
  const hoje = iso(agora);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const deHoje = diarias.find(d => d.data === hoje);

  if (agoraMin < MADRUGADA_ATE_MIN) {
    const ontem = new Date(agora);
    ontem.setDate(ontem.getDate() - 1);
    const deOntem = diarias.find(d => d.data === iso(ontem) && d.estado !== 'fechada');
    // A de hoje só ganha se a chamada dela já passou (diária que começa às 5h).
    const chamadaDeHoje = deHoje ? emMinutos(deHoje.chamada) : null;
    const hojeComecou = chamadaDeHoje !== null && agoraMin >= chamadaDeHoje;
    if (deOntem && !hojeComecou) return { diaria: deOntem, motivo: 'virou_a_noite' };
  }

  if (deHoje) return { diaria: deHoje, motivo: 'hoje' };
  const padrao = diariaPadrao(diarias, hoje);
  if (!padrao) return undefined;
  return { diaria: padrao, motivo: padrao.data && padrao.data > hoje ? 'proxima' : 'ultima' };
}

/** O dia está acontecendo nesta diária: trocar dela pede aviso. */
export const estaAcontecendo = (motivo?: MotivoDaDiaria) => motivo === 'hoje' || motivo === 'virou_a_noite';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
