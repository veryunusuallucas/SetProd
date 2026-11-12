import { db } from '../../db/db';
import type { EstadoDaLogagem, Som, Take } from '../../types';
import { horaDeAgora, proximoArquivo } from './takes';
import { idDoEstado } from './estado';
import { horaDoDia, type LinhaDaSincronia } from './sincronia';

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

/** "2026-10-31" → "261031", como os gravadores escrevem a data no nome. */
const dataCurta = (dataISO?: string) => (dataISO && /^\d{4}-\d{2}-\d{2}/.test(dataISO) ? dataISO.slice(2, 10).replace(/-/g, '') : '');

/**
 * O nome do primeiro arquivo do dia, no padrão de fábrica do gravador.
 *
 * Só os padrões confirmados (pesquisa de 11/10/2026): a série H da Zoom numera
 * `ZOOM0001…ZOOM9999`; o Zoom F3 usa a data e o número, `261031_001`. Para os
 * outros, `null` — quem loga confere o primeiro arquivo e digita.
 */
export function primeiroArquivoDo(aparelho: string | undefined, dataISO?: string): string | null {
  if (!aparelho) return null;
  if (/^zoom h/i.test(aparelho)) return 'ZOOM0001';
  if (/^zoom f3$/i.test(aparelho.trim())) return dataCurta(dataISO) ? `${dataCurta(dataISO)}_001` : null;
  return null;
}

/**
 * O arquivo herdado da diária anterior, com a data trocada quando o nome é por
 * data (`261010_014` → `261031_014`). O número continua; a data é a do dia.
 */
export function arquivoNoDia(arquivo: string | undefined, dataISO?: string): string | undefined {
  const d = dataCurta(dataISO);
  return arquivo && d && /^\d{6}_\d+$/.test(arquivo) ? `${d}${arquivo.slice(6)}` : arquivo;
}

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

/** As marcas, na ordem dos botões. `status` é o da câmera com a mesma cor. */
export const MARCAS: { id: NonNullable<Som['marca']>; curto: string; nome: string; status: 'OK' | 'NG' | 'HERO' | 'RECINV' }[] = [
  { id: 'ok', curto: 'OK', nome: 'OK', status: 'OK' },
  { id: 'ng', curto: 'NG', nome: 'NG', status: 'NG' },
  { id: 'hero', curto: 'HERO', nome: 'HERO', status: 'HERO' },
  { id: 'fs', curto: 'FS', nome: 'False start', status: 'RECINV' },
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
    // O HERO da câmera é o take escolhido: o som dele nasce HERO também.
    marca: take?.status === 'HERO' ? 'hero' : undefined,
    take_id: take?.id,
    hora: horaDeAgora(agora),
    ordem,
    logado_por: quem,
    criado_em: Date.now(),
  };
}

/**
 * Grava o arquivo de som e anda o contador do gravador.
 *
 * Indivisível, como o `registrarTake`: o próximo arquivo é lido do banco dentro
 * da transação, para dois toques juntos não darem dois ZOOM0005.
 */
export async function registrarSom(estado: EstadoDaLogagem, tipo: Som['tipo'], quem?: string, take?: Take) {
  return db.transaction('rw', db.log_som, db.log_estado, async () => {
    const noBanco = await db.log_estado.get(idDoEstado(estado.diaria_id));
    const atual = noBanco ? { ...estado, arquivo_som: noBanco.arquivo_som } : estado;
    const sons = await db.log_som.where('diaria_id').equals(estado.diaria_id).toArray();
    const ordem = sons.reduce((maior, s) => Math.max(maior, s.ordem || 0), 0) + 1;
    const som = montarSom(atual, tipo, ordem, { quem, take });
    await db.log_som.add(som);
    await db.log_estado.update(idDoEstado(estado.diaria_id), { arquivo_som: proximoArquivo(som.arquivo) });
    return som;
  });
}

/**
 * O take de câmera virou HERO depois (substituído ou editado): o som casado
 * sem marca vira HERO. Marca que alguém já pôs à mão (FS, NG) fica — o som
 * pode ter estragado justo no take que a câmera adorou.
 */
export async function somAcompanhaHero(takeId: string, status?: string) {
  if (status !== 'HERO') return;
  const casados = await db.log_som.where('take_id').equals(takeId).toArray();
  for (const s of casados) if (!s.marca) await db.log_som.update(s.id, { marca: 'hero' });
}

export const mudarSom = (id: string, m: Partial<Pick<Som, 'marca' | 'trilhas' | 'arquivo' | 'obs'>>) => db.log_som.update(id, m);

/* ───────────────────────── Grudar e desgrudar (Logagem v2, passo 2) ───────────────────────── */

/**
 * Gruda o som no take: passa a ser o áudio daquele momento, com a claquete
 * dele. Um take pode ter dois arquivos (o gravador partiu o som em dois).
 * Não mexe em nenhum contador: o arquivo já existe, só a ligação muda.
 */
export async function grudarSom(somId: string, take: Take) {
  await db.log_som.update(somId, {
    take_id: take.id, tipo: 'take',
    cena: take.cena, plano: take.plano, take: take.take, cena_id: take.cena_id, plano_id: take.plano_id,
  });
  await somAcompanhaHero(take.id, take.status);
}

/** Desgruda: o som fica solto no boletim, com a claquete que tinha. O vídeo fica sem esse áudio. */
export const desgrudarSom = (somId: string) => db.log_som.update(somId, { take_id: undefined });

/** "18:12:05" → segundos, para achar o que foi logado perto. */
const segundos = (hora?: string) => {
  const [h, m, s] = String(hora || '').split(':').map(Number);
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
};

/**
 * Para que take grudar este som: os sem áudio primeiro, e entre eles o logado
 * mais perto na hora — é quase sempre o certo.
 */
export function takesParaGrudar(som: Pick<Som, 'hora' | 'take_id'>, takes: Take[], sons: Som[]): { take: Take; audios: string[] }[] {
  return takes
    .filter(t => t.id !== som.take_id)
    .map(take => ({ take, audios: sons.filter(s => s.take_id === take.id).map(s => s.arquivo) }))
    .sort((a, b) => (a.audios.length ? 1 : 0) - (b.audios.length ? 1 : 0)
      || Math.abs(segundos(a.take.hora) - segundos(som.hora)) - Math.abs(segundos(b.take.hora) - segundos(som.hora)));
}

/** O inverso: que som grudar neste take. Os soltos primeiro, o mais perto na hora antes. */
export function sonsParaGrudar(take: Pick<Take, 'id' | 'hora'>, sons: Som[]): Som[] {
  return sons
    .filter(s => s.take_id !== take.id)
    .sort((a, b) => (a.take_id ? 1 : 0) - (b.take_id ? 1 : 0)
      || Math.abs(segundos(a.hora) - segundos(take.hora)) - Math.abs(segundos(b.hora) - segundos(take.hora)));
}

const ehOUltimoSom = (sons: Som[], som: Som) => !sons.some(s => s.id !== som.id && (s.ordem ?? 0) > (som.ordem ?? 0));

/** Apagou o ÚLTIMO arquivo e o gravador ainda apontava para o seguinte: o próximo volta a ser ele. */
export function voltaDoSom(estado: EstadoDaLogagem, som: Som, sons: Som[]): Partial<EstadoDaLogagem> {
  return ehOUltimoSom(sons, som) && proximoArquivo(som.arquivo) === arquivoDoSom(estado) ? { arquivo_som: som.arquivo } : {};
}

export async function apagarSom(id: string) {
  await db.transaction('rw', db.log_som, db.log_estado, async () => {
    const som = await db.log_som.get(id);
    if (!som) return;
    const [sons, estado] = await Promise.all([
      db.log_som.where('diaria_id').equals(som.diaria_id).toArray(),
      db.log_estado.get(idDoEstado(som.diaria_id)),
    ]);
    await db.log_som.delete(id);
    const volta = estado ? voltaDoSom(estado, som, sons) : {};
    if (estado && volta.arquivo_som) await db.log_estado.update(estado.id, volta);
  });
}

/** Os arquivos DEPOIS deste, renumerados em sequência a partir do nome novo. */
export function renumerarSeguintes(sons: Som[], som: Som, novo: string): { id: string; arquivo: string }[] {
  let anterior = novo;
  return ordenarSons(sons)
    .filter(s => (s.ordem ?? 0) > (som.ordem ?? 0))
    .map(s => ({ id: s.id, arquivo: (anterior = proximoArquivo(anterior)) }));
}

/**
 * Corrige o nome de um arquivo já logado (o gravador numerou diferente).
 * Com `seguintes`, os de depois andam junto. Se o último arquivo mudou e o
 * próximo ainda apontava para depois dele, o próximo acompanha.
 */
export async function renomearSom(som: Som, novo: string, seguintes: { id: string; arquivo: string }[] = []) {
  await db.transaction('rw', db.log_som, db.log_estado, async () => {
    const [sons, estado] = await Promise.all([
      db.log_som.where('diaria_id').equals(som.diaria_id).toArray(),
      db.log_estado.get(idDoEstado(som.diaria_id)),
    ]);
    const ultimo = ultimoSom(sons);
    await db.log_som.update(som.id, { arquivo: novo });
    for (const s of seguintes) await db.log_som.update(s.id, { arquivo: s.arquivo });
    if (!estado || !ultimo) return;
    const novoDoUltimo = ultimo.id === som.id ? novo : seguintes.find(s => s.id === ultimo.id)?.arquivo;
    if (novoDoUltimo && proximoArquivo(ultimo.arquivo) === arquivoDoSom(estado)) {
      await db.log_estado.update(estado.id, { arquivo_som: proximoArquivo(novoDoUltimo) });
    }
  });
}

export const ordenarSons = (sons: Som[]) => [...sons].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/** O arquivo mais recente da diária — o que os botões do Som marcam. */
export const ultimoSom = (sons: Som[]) => sons.reduce<Som | undefined>((u, s) => (!u || (s.ordem ?? 0) > (u.ordem ?? 0) ? s : u), undefined);

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

/** "12 arquivos · 2 HERO · 5 OK · 2 wild · 1 room tone · 1 false start · 1 NG" */
export function resumoDoSom(sons: Som[]): string {
  if (!sons.length) return '';
  const n = (f: (s: Som) => boolean) => sons.filter(f).length;
  const hero = n(s => s.marca === 'hero');
  const ok = n(s => s.marca === 'ok');
  const wild = n(s => s.tipo === 'wild');
  const room = n(s => s.tipo === 'room_tone');
  const fs = n(s => s.marca === 'fs');
  const ng = n(s => s.marca === 'ng');
  return [
    `${sons.length} arquivo${sons.length === 1 ? '' : 's'}`,
    hero && `${hero} HERO`,
    ok && `${ok} OK`,
    wild && `${wild} wild`,
    room && `${room} room tone`,
    fs && `${fs} false start`,
    ng && `${ng} NG`,
  ].filter(Boolean).join(' · ');
}

/* ───────────────────────── A sincronia aplicada ───────────────────────── */

/**
 * As trilhas de um arquivo lido no ingest: os nomes do kit pela posição
 * (`Tr3` é a terceira trilha do kit), até a última faixa que gravou.
 */
export function trilhasDasFaixas(faixas: string[], kit: string[]): Som['trilhas'] {
  const numeros = faixas.map(f => Number(/\d+/.exec(f)?.[0])).filter(n => n > 0);
  const ate = Math.max(kit.length, ...numeros, 0);
  return Array.from({ length: ate }, (_, i) => ({ nome: kit[i] || `Tr${i + 1}` }));
}

/**
 * Grava o que a pessoa aprovou na sincronia.
 *
 * O boletim manda: arquivo "divergente" não é religado — o relógio pode estar
 * certo, mas quem decide mudar o que foi anotado no set é uma pessoa, na grade.
 * Todo arquivo do gravador ganha o `wav` (hora, duração, trilhas gravadas).
 */
export async function aplicarSincronia(
  estado: EstadoDaLogagem,
  linhas: LinhaDaSincronia[],
  opcoes: { desvio: number; incluirSemVideo: boolean; quem?: string },
): Promise<{ ligados: number; novos: number; semVideo: number }> {
  const conta = { ligados: 0, novos: 0, semVideo: 0 };
  const kit = trilhasDoSom(estado);
  await db.transaction('rw', db.log_som, db.log_estado, async () => {
    let ordem = (await db.log_som.where('diaria_id').equals(estado.diaria_id).toArray())
      .reduce((m, s) => Math.max(m, s.ordem || 0), 0);
    for (const l of linhas) {
      const wav = { inicio: horaDoDia(l.arquivo.inicio ?? 0), duracao: l.arquivo.duracao, faixas: l.arquivo.faixas };
      if (l.som) {
        await db.log_som.update(l.som.id, { wav, ...(l.acao === 'ligar' && l.take ? { take_id: l.take.id } : {}) });
        if (l.acao === 'ligar') conta.ligados++;
        continue;
      }
      if (l.acao === 'sem_video' && !opcoes.incluirSemVideo) continue;
      const t = l.acao === 'novo' ? l.take : undefined;
      await db.log_som.add({
        id: crypto.randomUUID(),
        projeto_id: estado.projeto_id,
        diaria_id: estado.diaria_id,
        departamento_id: estado.departamento_id,
        tipo: t ? 'take' : 'wild',
        cena_id: t?.cena_id,
        plano_id: t?.plano_id,
        cena: t?.cena ?? '',
        plano: t?.plano ?? '',
        take: t?.take,
        arquivo: l.arquivo.nome,
        rolo: estado.rolo_som?.trim() || undefined,
        marca: t?.status === 'HERO' ? 'hero' : undefined,
        trilhas: trilhasDasFaixas(l.arquivo.faixas, kit),
        obs: t ? undefined : 'sem vídeo no mesmo horário (ingest)',
        take_id: t?.id,
        wav,
        hora: wav.inicio,
        ordem: ++ordem,
        logado_por: opcoes.quem,
        criado_em: Date.now(),
      });
      if (t) conta.novos++;
      else conta.semVideo++;
    }
    await db.log_estado.update(idDoEstado(estado.diaria_id), { desvio_som: opcoes.desvio });
  });
  return conta;
}
