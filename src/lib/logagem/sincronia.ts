import type { Som, Take } from '../../types';

/**
 * A sincronia: qual arquivo do gravador é o som de qual clipe da câmera
 * (PLANO-boletim-de-som, Fase 2).
 *
 * Sem timecode em comum, os dois relógios ainda dizem QUANDO cada arquivo
 * começou — o WAV no bloco `bext`, o clipe no XML (`CreationDate`). Os relógios
 * não batem (na Diária 1 da Canção de Outono, o Zoom estava 40:50 adiantado),
 * mas a diferença é a mesma o dia inteiro: achada uma vez, cada clipe acha o
 * som que começou junto com ele.
 *
 * Nada aqui lê o áudio. Só o cabeçalho do WAV — alguns KB de um arquivo de
 * centenas de MB.
 */

/* ───────────────────────── O WAV ───────────────────────── */

export interface CabecalhoWav {
  /** Segundos do dia em que o arquivo começou, pelo relógio do gravador. */
  inicio?: number;
  /** `2026-10-10`, como o gravador escreveu. */
  data?: string;
  duracao?: number;
  taxa?: number;
  bits?: number;
  canais?: number;
}

const segundosDe = (hhmmss: string) => {
  const m = /^(\d{1,2})[:.](\d{2})[:.](\d{2})/.exec(hhmmss.trim());
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : undefined;
};

/** `37034` → `10:17:14` */
export const horaDoDia = (s: number) =>
  [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, Math.floor(s) % 60].map(n => String(n).padStart(2, '0')).join(':');

/**
 * Lê o cabeçalho de um Broadcast WAV: formato, `bext` (data e hora de início)
 * e o tamanho do áudio, que dá a duração.
 *
 * Lê aos pedaços e para no bloco `data`: o áudio em si nunca é carregado.
 */
export async function lerCabecalhoWav(arquivo: Blob): Promise<CabecalhoWav> {
  const ler = async (de: number, ate: number) => new DataView(await arquivo.slice(de, ate).arrayBuffer());
  // Texto de tamanho fixo, cortado no primeiro byte zero (o resto é enchimento).
  const ascii = (v: DataView, de: number, n: number) =>
    String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(de + i))).split('\u0000')[0];

  const topo = await ler(0, 12);
  if (topo.byteLength < 12 || ascii(topo, 0, 4) !== 'RIFF' || ascii(topo, 8, 4) !== 'WAVE') return {};

  const cab: CabecalhoWav = {};
  let pos = 12;
  let horaBext: string | undefined;
  // Um WAV tem meia dúzia de blocos antes do áudio; o teto é só contra arquivo estragado.
  for (let i = 0; i < 64 && pos + 8 <= arquivo.size; i++) {
    const h = await ler(pos, pos + 8);
    const id = ascii(h, 0, 4);
    const tamanho = h.getUint32(4, true);
    if (id === 'fmt ') {
      const f = await ler(pos + 8, pos + 24);
      cab.canais = f.getUint16(2, true);
      cab.taxa = f.getUint32(4, true);
      cab.bits = f.getUint16(14, true);
    } else if (id === 'bext' && tamanho >= 346) {
      // Descrição (256) + origem (32) + referência (32) + data (10) + hora (8) + TimeReference (8).
      const b = await ler(pos + 8, pos + 8 + 346);
      cab.data = ascii(b, 320, 10) || undefined;
      horaBext = ascii(b, 330, 8);
    } else if (id === 'data') {
      if (cab.taxa && cab.canais && cab.bits) cab.duracao = tamanho / (cab.taxa * cab.canais * (cab.bits / 8));
      break;
    }
    pos += 8 + tamanho + (tamanho % 2);
  }
  if (horaBext) cab.inicio = segundosDe(horaBext);
  return cab;
}

/** Um arquivo do gravador: as trilhas `ZOOM0007_Tr1/_Tr3/_Tr4` são UM arquivo do boletim. */
export interface ArquivoDoGravador {
  nome: string;
  /** `Tr1`, `Tr3`… — as trilhas que de fato gravaram. */
  faixas: string[];
  inicio?: number;
  duracao?: number;
  taxa?: number;
  bits?: number;
}

/** `ZOOM0007_Tr1.WAV` → `{ nome: 'ZOOM0007', faixa: 'Tr1' }` */
export function nomeDoWav(arquivo: string): { nome: string; faixa?: string } {
  const sem = arquivo.replace(/^.*[\\/]/, '').replace(/\.wav$/i, '');
  const m = /^(.*?)[_-](Tr\w+|[LR]|Ch\d+)$/i.exec(sem);
  return m ? { nome: m[1], faixa: m[2] } : { nome: sem };
}

export function juntarFaixas(lidos: { arquivo: string; cab: CabecalhoWav }[]): ArquivoDoGravador[] {
  const porNome = new Map<string, ArquivoDoGravador>();
  for (const { arquivo, cab } of lidos) {
    const { nome, faixa } = nomeDoWav(arquivo);
    const atual = porNome.get(nome) ?? { nome, faixas: [] };
    if (faixa) atual.faixas.push(faixa);
    atual.inicio ??= cab.inicio;
    atual.duracao = Math.max(atual.duracao ?? 0, cab.duracao ?? 0) || undefined;
    atual.taxa ??= cab.taxa;
    atual.bits ??= cab.bits;
    porNome.set(nome, atual);
  }
  for (const a of porNome.values()) a.faixas.sort((x, y) => x.localeCompare(y, 'en', { numeric: true }));
  return [...porNome.values()].sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0) || a.nome.localeCompare(b.nome));
}

/* ───────────────────────── O vídeo ───────────────────────── */

export interface ClipeComHora {
  takeId: string;
  arquivo: string;
  inicio: number;
  duracao?: number;
}

/**
 * Os takes com hora de câmera — os que passaram pelo ingest do XML.
 *
 * A hora vem como a câmera escreveu (`09:36:24-03:00`), sem converter fuso: o
 * gravador também escreve a hora local dele, e é essa que se compara.
 */
export function clipesDosTakes(takes: Take[]): ClipeComHora[] {
  return takes.flatMap(t => {
    const hora = /T(\d{2}:\d{2}:\d{2})/.exec(t.xml?.criadoEm ?? '')?.[1];
    const inicio = hora ? segundosDe(hora) : undefined;
    return inicio === undefined ? [] : [{ takeId: t.id, arquivo: t.arquivo, inicio, duracao: t.xml?.segundos }];
  });
}

/* ───────────────────────── O casamento ───────────────────────── */

/** Quanto o começo do som pode se afastar do começo do vídeo e ainda ser o mesmo take. */
export const FOLGA = 5;

export interface Par { clipe: ClipeComHora; arquivo: ArquivoDoGravador; folga: number }

/**
 * O som e o vídeo do mesmo take duram parecido: o som costuma começar antes e
 * acabar depois (na Diária 1, 150 s de som para 146 de vídeo). Um clipe de
 * 37 s não é o som de 3 minutos que por acaso começou no mesmo segundo.
 */
export function duracoesBatem(video?: number, som?: number): boolean {
  if (!video || !som) return true;
  return Math.abs(video - som) <= Math.max(15, 0.15 * Math.max(video, som));
}

/**
 * Cada clipe com o arquivo que começou junto com ele (relógio do som =
 * relógio da câmera + desvio), o mais perto primeiro e cada arquivo uma vez só.
 */
export function casar(clipes: ClipeComHora[], arquivos: ArquivoDoGravador[], desvio: number, folga = FOLGA) {
  const candidatos: Par[] = [];
  for (const clipe of clipes) {
    for (const arquivo of arquivos) {
      if (arquivo.inicio === undefined) continue;
      const d = Math.abs(arquivo.inicio - (clipe.inicio + desvio));
      if (d <= folga && duracoesBatem(clipe.duracao, arquivo.duracao)) candidatos.push({ clipe, arquivo, folga: d });
    }
  }
  candidatos.sort((a, b) => a.folga - b.folga);
  const usados = new Set<string>();
  const pares: Par[] = [];
  for (const c of candidatos) {
    if (usados.has(c.clipe.takeId) || usados.has(c.arquivo.nome)) continue;
    usados.add(c.clipe.takeId);
    usados.add(c.arquivo.nome);
    pares.push(c);
  }
  return {
    pares: pares.sort((a, b) => a.clipe.inicio - b.clipe.inicio),
    semVideo: arquivos.filter(a => !usados.has(a.nome)),
    semSom: clipes.filter(c => !usados.has(c.takeId)),
  };
}

/**
 * O desvio que casa mais pares — sem ninguém ter dito nenhum.
 *
 * Cada (clipe, arquivo) propõe um desvio; vence o que mais pares casa. Com os
 * 15 clipes e 20 arquivos da Diária 1 são 300 tentativas, nada. Empate fica
 * com o de menor folga somada. Um par só não prova nada: abaixo de dois, `null`.
 */
export function acharDesvio(clipes: ClipeComHora[], arquivos: ArquivoDoGravador[]): number | null {
  let melhor: { desvio: number; pares: number; folga: number } | null = null;
  const tentados = new Set<number>();
  for (const c of clipes) {
    for (const a of arquivos) {
      if (a.inicio === undefined) continue;
      const desvio = a.inicio - c.inicio;
      if (tentados.has(desvio)) continue;
      tentados.add(desvio);
      const { pares } = casar(clipes, arquivos, desvio);
      const folga = pares.reduce((s, p) => s + p.folga, 0);
      if (!melhor || pares.length > melhor.pares || (pares.length === melhor.pares && folga < melhor.folga)) {
        melhor = { desvio, pares: pares.length, folga };
      }
    }
  }
  return melhor && melhor.pares >= 2 ? melhor.desvio : null;
}

/**
 * O desvio que o próprio boletim já prova: um arquivo logado com a câmera
 * ("Som junto") cujo take passou pelo ingest. É o par que alguém viu no set.
 */
export function desvioDoBoletim(sons: Som[], clipes: ClipeComHora[], arquivos: ArquivoDoGravador[]): number | null {
  for (const s of sons) {
    if (!s.take_id) continue;
    const clipe = clipes.find(c => c.takeId === s.take_id);
    const arquivo = arquivos.find(a => a.nome.toUpperCase() === s.arquivo.trim().toUpperCase());
    if (clipe && arquivo?.inicio !== undefined) return arquivo.inicio - clipe.inicio;
  }
  return null;
}

/** `2450` → `+40:50`; `-75` → `−01:15` */
export function desvioLegivel(s: number): string {
  const a = Math.abs(Math.round(s));
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const seg = a % 60;
  const corpo = `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
  return `${s < 0 ? '−' : '+'}${corpo}`;
}

/** Lê `+40:50`, `-1:15`, `40m50s`… em segundos. */
export function lerDesvio(texto: string): number | null {
  const t = texto.trim().replace('−', '-');
  const sinal = t.startsWith('-') ? -1 : 1;
  const partes = t.replace(/^[+-]/, '').split(':').map(Number);
  if (!partes.length || partes.some(n => !Number.isFinite(n))) return null;
  const s = partes.reduce((tot, n) => tot * 60 + n, 0);
  return sinal * s;
}

/* ───────────────────────── O plano ───────────────────────── */

/**
 * O que acontece com cada arquivo do gravador ao aplicar.
 *
 * - `conferido`: o boletim já dizia este take — o relógio confirma;
 * - `ligar`: o arquivo está no boletim sem take, e o relógio achou o dele;
 * - `divergente`: o boletim diz OUTRO take. Fica como o boletim diz, à vista;
 * - `novo`: ninguém logou este arquivo, e ele tem vídeo — entra ligado ao take;
 * - `no_boletim`: sem vídeo, mas já logado (wild, room tone…);
 * - `sem_video`: sem vídeo e sem registro — entra como wild, se a pessoa quiser.
 */
export type AcaoDaSincronia = 'conferido' | 'ligar' | 'divergente' | 'novo' | 'no_boletim' | 'sem_video';

export interface LinhaDaSincronia {
  arquivo: ArquivoDoGravador;
  acao: AcaoDaSincronia;
  take?: Take;
  som?: Som;
  folga?: number;
}

export function planejarSincronia(resultado: ReturnType<typeof casar>, takes: Take[], sons: Som[]): LinhaDaSincronia[] {
  const somDe = (nome: string) => sons.find(s => s.arquivo.trim().toUpperCase() === nome.toUpperCase());
  const linhas: LinhaDaSincronia[] = resultado.pares.map(p => {
    const take = takes.find(t => t.id === p.clipe.takeId);
    const som = somDe(p.arquivo.nome);
    const acao: AcaoDaSincronia = !som ? 'novo' : !som.take_id ? 'ligar' : som.take_id === p.clipe.takeId ? 'conferido' : 'divergente';
    return { arquivo: p.arquivo, acao, take, som, folga: p.folga };
  });
  for (const arquivo of resultado.semVideo) {
    const som = somDe(arquivo.nome);
    linhas.push({ arquivo, acao: som ? 'no_boletim' : 'sem_video', som });
  }
  return linhas.sort((a, b) => (a.arquivo.inicio ?? 0) - (b.arquivo.inicio ?? 0));
}
