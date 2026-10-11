import { db } from '../../db/db';
import type { EstadoDaLogagem, Som, Take } from '../../types';
import { horaDeAgora, proximoArquivo } from './takes';
import { idDoEstado } from './estado';

/**
 * O boletim de som (PLANO-boletim-de-som, Fase 1).
 *
 * O desenho segue o sound report de papel e o iXML dos gravadores (pesquisa
 * de 11/10/2026): uma linha por ARQUIVO do gravador, uma coluna por TRILHA com
 * o nome no cabeçalho, e as marcas que a montagem lê — take bom (circled),
 * false start e no good.
 *
 * O "kit de som" mora no estado da Logagem: gravador, rolo, próximo arquivo e
 * o nome das trilhas. Por isso herda sozinho da diária anterior
 * (`herdarEstado`), como a câmera — e o arquivo continua de onde parou.
 */

export const SOM_PADRAO = {
  arquivo: 'ZOOM0001',
  trilhas: ['Boom', 'Lapela 1', 'Lapela 2'],
};

/** O que o sound report e a aba Gravador oferecem. "Outro" é sempre possível. */
export const OPCOES_DO_GRAVADOR = {
  aparelho: ['Zoom H6', 'Zoom H5', 'Zoom H4n', 'Zoom F3', 'Zoom F6', 'Zoom F8n', 'Tascam DR-40X', 'Sound Devices MixPre-6', 'Celular'],
  taxa: ['44,1 kHz', '48 kHz', '96 kHz'],
  bits: ['16 bits', '24 bits', '32 bits float'],
  tc: ['Relógio do gravador', '23,976', '24', '25', '29,97', '30'],
} as const;

/** "Zoom H6 · 48 kHz · 24 bits · TC 24" — o cabeçalho do sound report. */
export function kitLegivel(e: Pick<EstadoDaLogagem, 'gravador_som' | 'taxa_som' | 'bits_som' | 'tc_som'>): string {
  const tc = e.tc_som && /\d/.test(e.tc_som) ? `TC ${e.tc_som} fps` : '';
  return [e.gravador_som, e.taxa_som, e.bits_som, tc].filter(Boolean).join(' · ');
}

export const somJunto =(e: Pick<EstadoDaLogagem, 'som_junto'>) => e.som_junto !== false;
export const arquivoDoSom = (e: Pick<EstadoDaLogagem, 'arquivo_som'>) => e.arquivo_som?.trim() || SOM_PADRAO.arquivo;
export const trilhasDoSom = (e: Pick<EstadoDaLogagem, 'trilhas_som'>) =>
  e.trilhas_som?.length ? e.trilhas_som : SOM_PADRAO.trilhas;

/** O take de câmera vai criar som? Não quando o som está desligado ou o áudio é MOS. */
export const takeLevaSom = (e: Pick<EstadoDaLogagem, 'som_junto' | 'audio'>) => somJunto(e) && e.audio !== 'MOS';

export const ROTULO_DO_TIPO: Record<Som['tipo'], string> = { take: 'Take', wild: 'Wild track', room_tone: 'Room tone' };

export const MARCAS: { id: NonNullable<Som['marca']>; curto: string; nome: string }[] = [
  { id: 'bom', curto: '◯', nome: 'Take bom' },
  { id: 'fs', curto: 'FS', nome: 'False start' },
  { id: 'ng', curto: 'NG', nome: 'No good' },
];

/** Notas que o som mais escreve numa trilha. */
export const NOTAS_DE_TRILHA = ['vento', 'clipou', 'roupa', 'ruído', 'sem sinal', 'baixo', 'fora'];

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
    rolo: estado.rolo_som?.trim() || undefined,
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

export const mudarSom = (id: string, m: Partial<Pick<Som, 'marca' | 'trilhas' | 'arquivo' | 'obs'>>) => db.log_som.update(id, m);
export const apagarSom = (id: string) => db.log_som.delete(id);

export const ordenarSons = (sons: Som[]) => [...sons].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/** Acrescenta ou tira uma nota rápida do texto da trilha ("vento, roupa"). */
export function alternarNota(texto: string | undefined, nota: string): string {
  const partes = (texto || '').split(',').map(p => p.trim()).filter(Boolean);
  const tem = partes.some(p => p.toLowerCase() === nota.toLowerCase());
  return (tem ? partes.filter(p => p.toLowerCase() !== nota.toLowerCase()) : [...partes, nota]).join(', ');
}

/**
 * Os arquivos em trechos com as mesmas trilhas e o mesmo rolo, na ordem.
 *
 * É o cabeçalho de colunas do papel: quando a lapela 2 troca de ator no meio
 * do dia, abre um trecho novo com os nomes novos — sem isso a coluna "Lapela
 * Alice" de cima estaria mentindo para as linhas de baixo.
 */
export function trechosDoSom(sons: Som[]): { trilhas: string[]; rolo?: string; sons: Som[] }[] {
  const trechos: { trilhas: string[]; rolo?: string; sons: Som[] }[] = [];
  for (const som of sons) {
    const nomes = som.trilhas.map(t => t.nome);
    const ultimo = trechos[trechos.length - 1];
    if (ultimo && ultimo.rolo === som.rolo && ultimo.trilhas.join('|') === nomes.join('|')) ultimo.sons.push(som);
    else trechos.push({ trilhas: nomes, rolo: som.rolo, sons: [som] });
  }
  return trechos;
}

/** "4-B / Tk3", "Cena 4 · wild track" */
export function claqueteDoSom(s: Pick<Som, 'tipo' | 'cena' | 'plano' | 'take'>): string {
  const cena = String(s.cena ?? '').trim();
  if (s.tipo !== 'take') return [cena && `Cena ${cena}`, ROTULO_DO_TIPO[s.tipo].toLowerCase()].filter(Boolean).join(' · ');
  return `${cena}-${s.plano} / Tk${s.take ?? ''}`;
}

/** "12 arquivos · 3 bons · 2 wild · 1 room tone · 1 false start" */
export function resumoDoSom(sons: Som[]): string {
  if (!sons.length) return '';
  const n = (f: (s: Som) => boolean) => sons.filter(f).length;
  const bons = n(s => s.marca === 'bom');
  const wild = n(s => s.tipo === 'wild');
  const room = n(s => s.tipo === 'room_tone');
  const fs = n(s => s.marca === 'fs');
  const ng = n(s => s.marca === 'ng');
  return [
    `${sons.length} arquivo${sons.length === 1 ? '' : 's'}`,
    bons && `${bons} bo${bons === 1 ? 'm' : 'ns'}`,
    wild && `${wild} wild`,
    room && `${room} room tone`,
    fs && `${fs} false start`,
    ng && `${ng} NG`,
  ].filter(Boolean).join(' · ');
}
