import { db } from '../../db/db';
import type { EstadoDaLogagem, Som, Take } from '../../types';
import { horaDeAgora, proximoArquivo } from './takes';
import { idDoEstado } from './estado';

/**
 * O boletim de som (PLANO-boletim-de-som, Fase 1).
 *
 * O "kit de som" mora no estado da Logagem: gravador, próximo arquivo e o nome
 * das trilhas. Por isso herda sozinho da diária anterior (`herdarEstado`), como
 * a câmera — e o arquivo continua de onde parou.
 */

export const SOM_PADRAO = {
  arquivo: 'ZOOM0001',
  trilhas: ['Boom', 'Lapela 1', 'Lapela 2'],
};

export const somJunto = (e: Pick<EstadoDaLogagem, 'som_junto'>) => e.som_junto !== false;
export const arquivoDoSom = (e: Pick<EstadoDaLogagem, 'arquivo_som'>) => e.arquivo_som?.trim() || SOM_PADRAO.arquivo;
export const trilhasDoSom = (e: Pick<EstadoDaLogagem, 'trilhas_som'>) =>
  e.trilhas_som?.length ? e.trilhas_som : SOM_PADRAO.trilhas;

export const ROTULO_DO_TIPO: Record<Som['tipo'], string> = { take: 'Take', wild: 'Wild track', room_tone: 'Room tone' };
export const ROTULO_DO_STATUS_DO_SOM: Record<Som['status'], string> = { bom: 'Bom', problema: 'Com problema', descartar: 'Descartar' };

/** O registro de som, a partir do que está na claquete agora. */
export function montarSom(
  estado: EstadoDaLogagem,
  tipo: Som['tipo'],
  ordem: number,
  extra: { quem?: string; take?: Take; agora?: Date } = {},
): Som {
  const { quem, take, agora = new Date() } = extra;
  return {
    id: crypto.randomUUID(),
    projeto_id: estado.projeto_id,
    diaria_id: estado.diaria_id,
    departamento_id: estado.departamento_id,
    tipo,
    cena_id: estado.cena_id || undefined,
    plano_id: tipo === 'take' ? estado.plano_id || undefined : undefined,
    cena: String(estado.cena),
    // Wild e room tone são da cena, não de um plano.
    plano: tipo === 'take' ? String(estado.plano) : '',
    take: tipo === 'take' ? take?.take ?? (Number(estado.take) || 1) : undefined,
    arquivo: arquivoDoSom(estado),
    status: 'bom',
    trilhas: trilhasDoSom(estado).map(nome => ({ nome })),
    take_id: take?.id,
    hora: horaDeAgora(agora),
    ordem,
    logado_por: quem,
    criado_em: Date.now(),
  };
}

/** Grava o arquivo de som e anda o contador do gravador. */
export async function registrarSom(estado: EstadoDaLogagem, tipo: Som['tipo'], quem?: string, take?: Take) {
  const sons = await db.log_som.where('diaria_id').equals(estado.diaria_id).toArray();
  const ordem = sons.reduce((maior, s) => Math.max(maior, s.ordem || 0), 0) + 1;
  const som = montarSom(estado, tipo, ordem, { quem, take });
  await db.log_som.add(som);
  await db.log_estado.update(idDoEstado(estado.diaria_id), { arquivo_som: proximoArquivo(som.arquivo) });
  return som;
}

export const mudarSom = (id: string, m: Partial<Pick<Som, 'status' | 'trilhas' | 'arquivo' | 'obs'>>) => db.log_som.update(id, m);
export const apagarSom = (id: string) => db.log_som.delete(id);

export const ordenarSons = (sons: Som[]) => [...sons].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/** "Cena 4 · 2B · take 3", "Cena 4 · wild track" */
export function claqueteDoSom(s: Pick<Som, 'tipo' | 'cena' | 'plano' | 'take'>): string {
  const cena = String(s.cena ?? '').trim();
  if (s.tipo !== 'take') return [cena && `Cena ${cena}`, ROTULO_DO_TIPO[s.tipo].toLowerCase()].filter(Boolean).join(' · ');
  return `${cena}-${s.plano} / Tk${s.take ?? ''}`;
}

/** "12 arquivos · 2 wild · 1 room tone · 1 com problema" */
export function resumoDoSom(sons: Som[]): string {
  if (!sons.length) return '';
  const n = (f: (s: Som) => boolean) => sons.filter(f).length;
  const wild = n(s => s.tipo === 'wild');
  const room = n(s => s.tipo === 'room_tone');
  const problema = n(s => s.status === 'problema');
  const descartar = n(s => s.status === 'descartar');
  return [
    `${sons.length} arquivo${sons.length === 1 ? '' : 's'}`,
    wild && `${wild} wild`,
    room && `${room} room tone`,
    problema && `${problema} com problema`,
    descartar && `${descartar} para descartar`,
  ].filter(Boolean).join(' · ');
}
