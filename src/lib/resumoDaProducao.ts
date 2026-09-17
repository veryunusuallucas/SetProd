import type { Diaria } from '../types';
import { diasEntre } from './urgencia';

/**
 * Onde a produção está, para o card da tela inicial.
 *
 * O card mostrava o saldo do filme, e a tela inicial é vista por todo mundo
 * que entrou na produção — dinheiro é da produção, não de quem abre o app. No
 * lugar entra o que serve a qualquer um: em que fase o filme está e quando é a
 * próxima diária.
 */

export type FaseDaProducao = 'sem_diarias' | 'pre' | 'hoje' | 'filmando' | 'encerrada';

type DiariaDoResumo = Pick<Diaria, 'numero' | 'data' | 'estado'>;

export interface ResumoDaProducao {
  fase: FaseDaProducao;
  total: number;
  /** Já passaram (data antes de hoje) ou foram fechadas. */
  feitas: number;
  /** A de hoje, se houver e não estiver fechada. */
  deHoje?: DiariaDoResumo;
  /** A próxima depois de hoje, e quantos dias faltam. */
  proxima?: DiariaDoResumo & { faltam: number };
  /** A última com data, para "encerrada em". */
  ultima?: DiariaDoResumo;
}

const temData = (d: DiariaDoResumo) => /^\d{4}-\d{2}-\d{2}$/.test(d.data || '');

export function resumirProducao(diarias: DiariaDoResumo[], hoje: string): ResumoDaProducao {
  const total = diarias.length;
  const feitas = diarias.filter(d => d.estado === 'fechada' || (temData(d) && d.data < hoje)).length;
  const datadas = diarias.filter(temData).sort((a, b) => a.data.localeCompare(b.data) || a.numero - b.numero);

  const deHoje = datadas.find(d => d.data === hoje && d.estado !== 'fechada');
  const depois = datadas.find(d => d.data > hoje && d.estado !== 'fechada');
  const proxima = depois ? { ...depois, faltam: diasEntre(hoje, depois.data) } : undefined;
  const ultima = datadas[datadas.length - 1];

  let fase: FaseDaProducao;
  if (total === 0) fase = 'sem_diarias';
  else if (deHoje) fase = 'hoje';
  else if (feitas === 0) fase = 'pre';
  else if (proxima || feitas < total) fase = 'filmando';
  else fase = 'encerrada';

  return { fase, total, feitas, deHoje, proxima, ultima };
}

/** "hoje", "amanhã", "em 12 dias". */
export function quandoE(faltam: number): string {
  if (faltam <= 0) return 'hoje';
  if (faltam === 1) return 'amanhã';
  return `em ${faltam} dias`;
}
