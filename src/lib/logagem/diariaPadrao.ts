import type { Diaria } from '../../types';

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
