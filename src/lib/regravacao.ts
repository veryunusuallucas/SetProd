import type { Cena, CenaNaDiaria, Diaria, MotivoNaDiaria, RegistroCena } from '../types';

/**
 * Regravação, complemento e continuação (PLANO-reshoot, 11/11/2026).
 *
 * A cena volta para outra diária sem sair da original: a diária de origem é
 * prestação de contas e fica intocada. Quem guarda o "porquê" é a diária nova,
 * em `cenas_no_dia` (ver o tipo).
 */

export const ROTULO_DO_MOTIVO: Record<MotivoNaDiaria, string> = {
  primeira: 'Primeira vez',
  regravacao: 'Regravação',
  pickup: 'Complemento (pickup)',
  continuacao: 'Continuação',
};

/** O que a escolha oferece: os três motivos de uma cena voltar. */
export const MOTIVOS_DE_VOLTA: { id: Exclude<MotivoNaDiaria, 'primeira'>; ajuda: string }[] = [
  { id: 'regravacao', ajuda: 'gravou e não gostou' },
  { id: 'pickup', ajuda: 'faltou um plano, um inserte' },
  { id: 'continuacao', ajuda: 'não coube no dia' },
];

const numeroDa = (d?: Pick<Diaria, 'numero'>) => (d ? String(d.numero).padStart(2, '0') : '??');

/** Por que a cena está nesta diária. Sem entrada, é a primeira vez. */
export function cenaNaDiaria(diaria: Pick<Diaria, 'cenas_no_dia'>, cenaId: string): CenaNaDiaria {
  return diaria.cenas_no_dia?.[cenaId] ?? { motivo: 'primeira' };
}

/**
 * A marcação que a OD imprime: "REGRAVAÇÃO (da Diária 03) — "foco errado"".
 *
 * TEXTO, NÃO COR: a OD é impressa, fotocopiada e lida no sol. Sem marcação
 * (primeira vez), `undefined`.
 */
export function marcaDaCena(
  diaria: Pick<Diaria, 'cenas_no_dia'>,
  cenaId: string,
  diarias: Pick<Diaria, 'id' | 'numero'>[],
): string | undefined {
  const v = voltaDaCena(diaria, cenaId, diarias);
  return v && [v.titulo, v.porque].filter(Boolean).join(' — ');
}

/** A marcação em dois pedaços, para o papel pôr o título em negrito e o porquê embaixo. */
export function voltaDaCena(
  diaria: Pick<Diaria, 'cenas_no_dia'>,
  cenaId: string,
  diarias: Pick<Diaria, 'id' | 'numero'>[],
): { titulo: string; porque?: string } | undefined {
  const c = cenaNaDiaria(diaria, cenaId);
  if (c.motivo === 'primeira') return undefined;
  const origem = c.diaria_origem_id ? diarias.find(d => d.id === c.diaria_origem_id) : undefined;
  const nome = ROTULO_DO_MOTIVO[c.motivo].replace(/ \(.*\)$/, '').toUpperCase();
  return {
    titulo: `${nome}${origem ? ` (da Diária ${numeroDa(origem)})` : ''}`,
    porque: c.observacao?.trim() ? `"${c.observacao.trim()}"` : undefined,
  };
}

/**
 * As cenas que o espelho do stripboard não pode tirar do dia.
 *
 * A cena só tem um lugar no stripboard, e esse lugar é o da diária original.
 * A volta vive fora dele: sem esta lista, a diária nova (em rascunho) perderia
 * a cena sozinha na próxima abertura.
 */
export function cenasForaDoStripboard(diaria: Pick<Diaria, 'cena_ids' | 'cenas_no_dia'>): string[] {
  return (diaria.cena_ids || []).filter(id => cenaNaDiaria(diaria, id).motivo !== 'primeira');
}

export interface CandidataARegravar {
  cena: Cena;
  /** A diária mais recente em que a cena já rodou. */
  origem: Diaria;
  /** Quantas vezes já voltou como regravação. */
  vezes: number;
}

/**
 * As candidatas a regravar: cenas que já rodaram em outra diária.
 *
 * "Rodou" é derivado do que existe, sem status próprio: a diária fechou, já
 * passou da data, ou alguém marcou a cena como gravada ou parcial nela. Não é
 * perfeito, e por isso quem escolhe pode pegar também uma cena de fora da lista
 * (`outras`): travar a pessoa porque o app errou é pior que um registro impreciso.
 */
export function candidatasARegravar(
  cenas: Cena[],
  diarias: Diaria[],
  registros: RegistroCena[],
  diariaAtual: Pick<Diaria, 'id' | 'cena_ids'>,
  hojeISO: string,
): { gravadas: CandidataARegravar[]; outras: Cena[] } {
  const noDia = new Set(diariaAtual.cena_ids || []);
  const rodouEm = (d: Diaria, cenaId: string) =>
    d.fechada || d.estado === 'fechada' || (d.data && d.data < hojeISO)
    || registros.some(r => r.diaria_id === d.id && r.cena_id === cenaId && (r.status === 'gravada' || r.status === 'parcial'));

  const gravadas: CandidataARegravar[] = [];
  const outras: Cena[] = [];
  for (const cena of cenas) {
    if (cena.fora_do_roteiro || noDia.has(cena.id)) continue;
    const onde = diarias
      .filter(d => d.id !== diariaAtual.id && (d.cena_ids || []).includes(cena.id) && rodouEm(d, cena.id))
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    if (!onde.length) { outras.push(cena); continue; }
    const vezes = diarias.filter(d => d.cenas_no_dia?.[cena.id]?.motivo === 'regravacao').length;
    gravadas.push({ cena, origem: onde[0], vezes });
  }
  // A mais recente primeiro: é a que acabou de dar problema.
  gravadas.sort((a, b) => (b.origem.data || '').localeCompare(a.origem.data || ''));
  return { gravadas, outras };
}

/** A vida inteira da cena: "Diária 03 · primeira vez", "Diária 07 · regravação". */
export function historicoDaCena(cenaId: string, diarias: Diaria[]): { diaria: Diaria; motivo: MotivoNaDiaria }[] {
  return diarias
    .filter(d => (d.cena_ids || []).includes(cenaId))
    .sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.numero - b.numero)
    .map(d => ({ diaria: d, motivo: cenaNaDiaria(d, cenaId).motivo }));
}
