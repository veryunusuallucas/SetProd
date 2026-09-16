import type {
  BackupDeCartao, CameraDoKit, ChecksumDeCartao, EstadoDaLogagem, HdDeBackup, KitDeLogagem, LenteDoKit,
  MetadadosDoClipe, StatusTake, Take,
} from '../../types';
import { NOMENCLATURAS } from './nomenclatura';
import { formatarF } from './kits';
import { cartaoSeguro, cartoesConhecidos } from './backup';
import { ordenarTakes, type EquipeDoReport } from './relatorio';

/**
 * A cópia de segurança da Logagem em JSON (PLANO-logagem §2.11).
 *
 * Os PDFs são para ler; isto é para VOLTAR. É o arquivo que o DIT deixa no HD
 * junto com o material: se o aparelho morrer, se a conta sumir, se daqui a dois
 * anos alguém precisar do boletim, o JSON tem tudo — inclusive as fotos e o
 * conteúdo dos comprovantes, que no app moram no Storage.
 *
 * O bloco `_meta` é o do Lumavi: o que o DIT quer ler abrindo o arquivo num
 * editor de texto, sem app nenhum. Ele é só informativo; restaurar ignora.
 *
 * Restaurar aceita as DUAS origens: a cópia do SetProd e o JSON do Lumavi. A
 * segunda é o caminho de quem tem diárias antigas no app velho.
 */

export const FORMATO_DA_COPIA = 'setprod-logagem';
export const VERSAO_DA_COPIA = 1;

export interface ComprovanteNaCopia extends ChecksumDeCartao {
  /** O texto do MHL/md5sums. No app ele mora no Storage; aqui vem junto. */
  conteudo?: string;
}

export interface MetaDaCopia {
  app: string;
  versao: string;
  exportadoEm: string;
  exportadoEmLocal: string;
  projeto: string;
  diaria: string;
  data?: string;
  diretor: string;
  produtor: string;
  direcaoFotografia: string;
  operadorCamera: string;
  formatoArquivo: string;
  totalTakes: number;
  totalHeroes: number;
  totalNG: number;
  cartoes: { cartao: string; seguro: boolean }[];
  kitsCamera: { nome: string; cameras: string[] }[];
  kitsLente: { nome: string; lentes: string[] }[];
  fotos: number;
}

export interface CopiaDaLogagem {
  _meta: MetaDaCopia;
  formato: typeof FORMATO_DA_COPIA;
  versaoDoFormato: number;
  projeto: { id: string; nome: string };
  diaria: { id: string; numero: number; data?: string };
  estado?: EstadoDaLogagem;
  takes: Take[];
  kits: KitDeLogagem[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  comprovantes: ComprovanteNaCopia[];
  /** Referência `arquivo:` da foto → `data:image/jpeg;base64,…` */
  fotos: Record<string, string>;
}

/* ───────────────────────── Montar ───────────────────────── */

export function montarCopia(d: {
  projeto: { id: string; nome: string };
  diaria: { id: string; numero: number; data?: string };
  estado?: EstadoDaLogagem;
  takes: Take[];
  kits: KitDeLogagem[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  equipe: EquipeDoReport;
  conteudos: Record<string, string>;
  fotos: Record<string, string>;
  versaoDoApp: string;
  agora: Date;
  agoraLegivel: string;
}): CopiaDaLogagem {
  const takes = ordenarTakes(d.takes);
  const nomenclatura = NOMENCLATURAS.find(n => n.id === d.estado?.nomenclatura);
  const cartoes = cartoesConhecidos({ takes, backups: d.backups, checksums: d.checksums, cartaoAtual: d.estado?.cartao });
  const numero = String(d.diaria.numero).padStart(2, '0');

  const _meta: MetaDaCopia = {
    app: 'SetProd · Logagem',
    versao: d.versaoDoApp,
    exportadoEm: d.agora.toISOString(),
    exportadoEmLocal: d.agoraLegivel,
    projeto: d.projeto.nome,
    diaria: numero,
    data: d.diaria.data,
    diretor: d.equipe.diretor,
    produtor: d.equipe.produtor,
    direcaoFotografia: d.equipe.fotografia,
    operadorCamera: d.equipe.operador,
    formatoArquivo: nomenclatura
      ? (nomenclatura.id === 'custom' && d.estado?.template ? `${nomenclatura.nome} (${d.estado.template})` : nomenclatura.nome)
      : '',
    totalTakes: takes.length,
    totalHeroes: takes.filter(t => t.status === 'HERO').length,
    totalNG: takes.filter(t => t.status === 'NG').length,
    cartoes: cartoes.map(cartao => ({
      cartao,
      seguro: cartaoSeguro({ hds: d.hds, backups: d.backups, checksums: d.checksums, cartao }),
    })),
    kitsCamera: d.kits.filter(k => k.tipo === 'camera').map(k => ({
      nome: k.nome,
      cameras: (k.cameras || []).map(c => `${c.id}${c.modelo ? ` (${c.modelo})` : ''}`),
    })),
    kitsLente: d.kits.filter(k => k.tipo === 'lente').map(k => ({
      nome: k.nome,
      lentes: (k.lentes || []).map(l => `${l.nome} (f${formatarF(l.abre)}-f${formatarF(l.fecha)})`),
    })),
    fotos: Object.keys(d.fotos).length,
  };

  return {
    _meta,
    formato: FORMATO_DA_COPIA,
    versaoDoFormato: VERSAO_DA_COPIA,
    projeto: d.projeto,
    diaria: d.diaria,
    estado: d.estado,
    takes,
    kits: d.kits,
    hds: d.hds,
    backups: d.backups,
    comprovantes: d.checksums.map(c => ({ ...c, conteudo: d.conteudos[c.id] })),
    fotos: d.fotos,
  };
}

/* ───────────────────────── Ler ───────────────────────── */

/** O que uma cópia traz, já no formato do SetProd, venha de onde vier. */
export interface CopiaLida {
  origem: 'setprod' | 'lumavi';
  projeto: string;
  diaria: string;
  /** Ids de origem (só na cópia do SetProd). */
  projetoId?: string;
  diariaId?: string;
  exportadoEm?: string;
  takes: Take[];
  /** id do take (o da cópia) → `data:` da foto. */
  fotos: Record<string, string>;
  kits: KitDeLogagem[];
  hds: HdDeBackup[];
  /** `hd_id` aponta para um HD de `hds`. */
  backups: { cartao: string; hd_id: string }[];
  comprovantes: ComprovanteNaCopia[];
  estado?: Partial<EstadoDaLogagem>;
  /** O que o arquivo tinha e não vai entrar, dito em português. */
  avisos: string[];
}

export class CopiaInvalida extends Error {}

const STATUS_VALIDOS: StatusTake[] = ['OK', 'NG', 'HERO', 'RECINV', 'IMPORT'];
const texto = (v: unknown) => (v == null ? '' : String(v)).trim();
const semVazios = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;

export function lerCopia(bruto: string): CopiaLida {
  let obj: unknown;
  try {
    obj = JSON.parse(bruto.replace(/^\uFEFF/, ''));
  } catch {
    throw new CopiaInvalida('O arquivo não é um JSON válido.');
  }
  if (!obj || typeof obj !== 'object') throw new CopiaInvalida('O arquivo não é uma cópia da Logagem.');
  const o = obj as Record<string, unknown>;

  if (o.formato === FORMATO_DA_COPIA) return lerDoSetProd(o as unknown as CopiaDaLogagem);
  if (Array.isArray(o.logs) && o.setup && typeof o.setup === 'object') return lerDoLumavi(o);
  throw new CopiaInvalida('O arquivo não é uma cópia da Logagem nem um backup do Lumavi.');
}

function lerDoSetProd(c: CopiaDaLogagem): CopiaLida {
  if ((c.versaoDoFormato ?? 1) > VERSAO_DA_COPIA) {
    throw new CopiaInvalida('Esta cópia veio de uma versão mais nova do SetProd. Atualize o app para restaurar.');
  }
  const takes = Array.isArray(c.takes) ? c.takes : [];
  const fotos: Record<string, string> = {};
  for (const t of takes) {
    const dataUrl = t.foto ? c.fotos?.[t.foto] : undefined;
    if (dataUrl) fotos[t.id] = dataUrl;
  }
  const semFoto = takes.filter(t => t.foto && !fotos[t.id]).length;
  const avisos: string[] = [];
  if (semFoto) avisos.push(`${semFoto} foto${semFoto === 1 ? '' : 's'} de referência não ${semFoto === 1 ? 'estava' : 'estavam'} no arquivo; esses takes entram sem foto.`);

  return {
    origem: 'setprod',
    projeto: texto(c.projeto?.nome),
    diaria: String(c.diaria?.numero ?? '').padStart(2, '0'),
    projetoId: c.projeto?.id,
    diariaId: c.diaria?.id,
    exportadoEm: c._meta?.exportadoEm,
    takes,
    fotos,
    kits: Array.isArray(c.kits) ? c.kits : [],
    hds: Array.isArray(c.hds) ? c.hds : [],
    backups: (Array.isArray(c.backups) ? c.backups : []).map(b => ({ cartao: texto(b.cartao), hd_id: b.hd_id })),
    comprovantes: Array.isArray(c.comprovantes) ? c.comprovantes : [],
    estado: c.estado,
    avisos,
  };
}

/* O JSON do Lumavi, campo a campo. Ver `gravarLog` e `estadoPadrao` em Camera Log/public/app.js. */
interface LogDoLumavi {
  id?: string; file?: string; status?: string; time?: string;
  cena?: unknown; plano?: unknown; take?: unknown;
  ambiente?: string; luz?: string; audio?: string; nd?: string; obs?: string;
  fps?: string; resolution?: string; codec?: string; wb?: string; shutter?: string; iso?: string; lut?: string;
  lens?: string; cameraId?: string; card?: string; pos?: string; fStop?: string;
  recInvertido?: boolean; refPhoto?: string;
  bitDepth?: string; colorSampling?: string; timecodeStart?: string; timecodeEnd?: string; tcFps?: string;
  duration?: string; isoXml?: string; creationDate?: string; lensModel?: string; cameraModel?: string;
  audioCodec?: string; gamma?: string; gamut?: string; coding?: string;
}

function lerDoLumavi(o: Record<string, unknown>): CopiaLida {
  const setup = (o.setup || {}) as Record<string, string>;
  const camera = (o.camera || {}) as Record<string, unknown>;
  const scene = (o.scene || {}) as Record<string, unknown>;
  const logs = o.logs as LogDoLumavi[];
  const avisos: string[] = [];

  const fotos: Record<string, string> = {};
  let comTimecode = 0;
  const takes: Take[] = logs.map((l, i) => {
    const id = texto(l.id) || `lumavi-${i}`;
    const statusBruto = texto(l.status).toUpperCase();
    const status: StatusTake = l.recInvertido
      ? 'RECINV'
      : (STATUS_VALIDOS.includes(statusBruto as StatusTake) ? statusBruto as StatusTake : 'OK');
    if (l.refPhoto && /^data:image\//.test(l.refPhoto)) fotos[id] = l.refPhoto;
    if (texto(l.timecodeStart) || texto(l.timecodeEnd)) comTimecode++;

    const xml: MetadadosDoClipe = semVazios({
      modeloLente: texto(l.lensModel),
      modeloCamera: texto(l.cameraModel),
      bitDepth: texto(l.bitDepth),
      amostragem: texto(l.colorSampling),
      gamma: texto(l.gamma),
      gamut: texto(l.gamut),
      coding: texto(l.coding),
      tcFps: texto(l.tcFps),
      duracao: texto(l.duration),
      criadoEm: texto(l.creationDate),
      codecAudio: texto(l.audioCodec),
    });
    const temXml = Object.keys(xml).length > 0;

    return {
      id,
      projeto_id: '',
      diaria_id: '',
      cena: texto(l.cena),
      plano: texto(l.plano),
      take: Number(l.take) || 0,
      status,
      hora: texto(l.time),
      ordem: i + 1,
      camera_id: texto(l.cameraId).toUpperCase(),
      cartao: texto(l.card),
      posicao: texto(l.pos) || undefined,
      arquivo: texto(l.file),
      ambiente: texto(l.ambiente) || undefined,
      luz: texto(l.luz) || undefined,
      audio: texto(l.audio) || undefined,
      nd: texto(l.nd) || undefined,
      obs: texto(l.obs) || undefined,
      fps: texto(l.fps) || undefined,
      resolucao: texto(l.resolution) || undefined,
      codec: texto(l.codec) || undefined,
      wb: texto(l.wb) || undefined,
      shutter: texto(l.shutter) || undefined,
      // O ISO que a câmera gravou vale mais que o que alguém escolheu na tela.
      iso: texto(l.isoXml) || texto(l.iso) || undefined,
      lut: texto(l.lut) || undefined,
      lente: texto(l.lens) || undefined,
      abertura: texto(l.fStop).replace(/^f\/?/i, '') || undefined,
      xml: temXml ? { ...xml, fonte: 'Lumavi' } : undefined,
      criado_em: 0,
    };
  });

  /*
    O TIMECODE DO LUMAVI NÃO VEM.

    O leitor do Lumavi montava o LtcChange na ordem errada (os pares de bytes
    são quadros, segundos, minutos e horas, e ele lia ao contrário). Todo TC
    que ele gravou está trocado — trazê-lo seria importar um número que parece
    certo e não é. O Ingest do SetProd, com os XML do cartão, preenche o certo.
  */
  if (comTimecode) {
    avisos.push(
      `${comTimecode} take${comTimecode === 1 ? '' : 's'} ${comTimecode === 1 ? 'tinha' : 'tinham'} timecode lido pelo Lumavi, que lia os bytes do XML na ordem errada. ` +
      'Esses timecodes ficaram de fora — rode o Ingest com os XML do cartão para ter os certos.'
    );
  }

  const kits: KitDeLogagem[] = [];
  for (const k of (Array.isArray(o.kits) ? o.kits : []) as Record<string, unknown>[]) {
    const cameras: CameraDoKit[] = ((k.cameras as Record<string, unknown>[]) || []).map(c => ({
      id: texto(c.id).toUpperCase(),
      modelo: texto(c.model),
      reel: texto(c.reel),
      clipe: Number(c.clip) || 1,
      posicao: texto(c.pos),
    })).filter(c => c.id);
    if (texto(k.name) && cameras.length) {
      kits.push({ id: texto(k.id) || crypto.randomUUID(), projeto_id: '', tipo: 'camera', nome: texto(k.name), cameras, criado_em: 0 });
    }
  }
  for (const k of (Array.isArray(o.lensKits) ? o.lensKits : []) as Record<string, unknown>[]) {
    const lentes: LenteDoKit[] = ((k.lenses as Record<string, unknown>[]) || []).map(l => ({
      id: texto(l.id) || crypto.randomUUID(),
      nome: texto(l.name),
      focal: texto(l.focal) || undefined,
      abre: Number(l.apMin) || 1.4,
      fecha: Number(l.apMax) || 22,
    })).filter(l => l.nome);
    if (texto(k.name) && lentes.length) {
      kits.push({ id: texto(k.id) || crypto.randomUUID(), projeto_id: '', tipo: 'lente', nome: texto(k.name), lentes, criado_em: 0 });
    }
  }

  const offload = (o.offload || {}) as Record<string, unknown>;
  const hds: HdDeBackup[] = ((offload.hds as Record<string, unknown>[]) || [])
    .filter(h => texto(h.name))
    .map((h, i) => ({ id: texto(h.id) || `hd-${i}`, projeto_id: '', nome: texto(h.name), ordem: i + 1, criado_em: 0 }));

  const backups: CopiaLida['backups'] = [];
  for (const [chave, marcado] of Object.entries((offload.matrix as Record<string, boolean>) || {})) {
    if (!marcado) continue;
    const [cartao, hdId] = chave.split('||');
    if (texto(cartao) && hds.some(h => h.id === hdId)) backups.push({ cartao: texto(cartao), hd_id: hdId });
  }

  const comprovantes: ComprovanteNaCopia[] = [];
  for (const [cartao, ck] of Object.entries((offload.checksums as Record<string, Record<string, unknown>>) || {})) {
    if (!ck || !texto(ck.digest)) continue;
    const quando = Date.parse(texto(ck.savedAt));
    comprovantes.push({
      id: crypto.randomUUID(),
      projeto_id: '',
      diaria_id: '',
      cartao: texto(cartao),
      nome_arquivo: texto(ck.fileName) || 'checksum.txt',
      algoritmo: texto(ck.algo) === 'FNV-1a' ? 'FNV-1a' : 'SHA-256',
      digest: texto(ck.digest),
      bytes: Number(ck.bytes) || 0,
      linhas: Number(ck.lines) || 0,
      anexado_em: Number.isFinite(quando) ? quando : 0,
      conteudo: typeof ck.content === 'string' ? ck.content : undefined,
    });
  }

  const shotlist = Array.isArray(o.shotlist) ? o.shotlist.length : 0;
  if (shotlist) {
    avisos.push(`A decupagem do Lumavi (${shotlist} ite${shotlist === 1 ? 'm' : 'ns'}) não vem: no SetProd a decupagem mora no módulo Decupagem.`);
  }

  const estado: Partial<EstadoDaLogagem> = semVazios({
    camera_id: texto(camera.cameraId).toUpperCase(),
    cartao: texto(camera.card),
    posicao: texto(camera.pos),
    proximo_clipe: Number(camera.nextClip) || undefined,
    template: texto(camera.template),
    fps: texto(camera.fps),
    resolucao: texto(camera.resolution),
    codec: texto(camera.codec),
    wb: texto(camera.wb),
    shutter: texto(camera.shutter),
    iso: texto(camera.iso),
    lut: texto(camera.lut),
    cena: texto(scene.cena),
    plano: texto(scene.plano),
    take: Number(scene.take) || undefined,
  });

  return {
    origem: 'lumavi',
    projeto: texto(setup.project),
    diaria: texto(setup.diaryId),
    takes,
    fotos,
    kits,
    hds,
    backups,
    comprovantes,
    estado,
    avisos,
  };
}

/* ───────────────────────── Planejar ───────────────────────── */

const chaveDoTake = (t: Pick<Take, 'camera_id' | 'cartao' | 'arquivo' | 'cena' | 'plano' | 'take' | 'hora'>) =>
  texto(t.arquivo)
    ? `arq|${texto(t.camera_id).toUpperCase()}|${texto(t.cartao)}|${texto(t.arquivo).toUpperCase()}`
    : `clq|${texto(t.camera_id).toUpperCase()}|${texto(t.cena).toUpperCase()}|${texto(t.plano).toUpperCase()}|${t.take}|${texto(t.hora)}`;

const nomeIgual = (a: string, b: string) => texto(a).toLowerCase() === texto(b).toLowerCase();

export interface PlanoDeRestauracao {
  takesNovos: Take[];
  takesRepetidos: number;
  kitsNovos: KitDeLogagem[];
  /** HDs que não existem na produção (pelo nome). */
  hdsNovos: HdDeBackup[];
  /** id do HD na cópia → nome, para achar o HD certo na hora de aplicar. */
  nomeDoHd: Record<string, string>;
  backupsNovos: { cartao: string; hd: string }[];
  comprovantesNovos: ComprovanteNaCopia[];
  /** Estado só entra quando a diária ainda não tem nenhum. */
  estado?: Partial<EstadoDaLogagem>;
}

/**
 * O que a restauração vai fazer, antes de fazer.
 *
 * ⚠️ SÓ ACRESCENTA. Nada que já está na diária é sobrescrito: um take que já
 * existe (mesmo id, ou mesma câmera + cartão + arquivo, a regra do Lumavi)
 * fica como está, porque o do app pode ter sido corrigido pelo Ingest depois
 * da cópia. Restaurar é recuperar o que falta, não voltar no tempo.
 */
export function planejarRestauracao(copia: CopiaLida, atual: {
  takes: Take[];
  kits: KitDeLogagem[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  temEstado: boolean;
}): PlanoDeRestauracao {
  const ids = new Set(atual.takes.map(t => t.id));
  const chaves = new Set(atual.takes.map(chaveDoTake));
  const takesNovos: Take[] = [];
  let takesRepetidos = 0;
  for (const t of ordenarTakes(copia.takes)) {
    const chave = chaveDoTake(t);
    if (ids.has(t.id) || chaves.has(chave)) { takesRepetidos++; continue; }
    chaves.add(chave); // o arquivo repetido DENTRO da cópia também entra uma vez só
    takesNovos.push(t);
  }

  const kitsNovos = copia.kits.filter(k =>
    !atual.kits.some(a => a.id === k.id || (a.tipo === k.tipo && nomeIgual(a.nome, k.nome))));

  const nomeDoHd: Record<string, string> = {};
  for (const h of copia.hds) nomeDoHd[h.id] = h.nome;
  const hdsNovos = copia.hds.filter(h => !atual.hds.some(a => nomeIgual(a.nome, h.nome)));

  const backupsNovos: PlanoDeRestauracao['backupsNovos'] = [];
  for (const b of copia.backups) {
    const hd = nomeDoHd[b.hd_id];
    if (!hd) continue;
    const hdAtual = atual.hds.find(a => nomeIgual(a.nome, hd));
    const jaTem = hdAtual && atual.backups.some(x => x.hd_id === hdAtual.id && texto(x.cartao) === texto(b.cartao));
    const repetido = backupsNovos.some(x => x.hd === hd && x.cartao === b.cartao);
    if (!jaTem && !repetido) backupsNovos.push({ cartao: b.cartao, hd });
  }

  const comprovantesNovos = copia.comprovantes.filter(c =>
    !atual.checksums.some(a => texto(a.cartao) === texto(c.cartao) && a.digest === c.digest));

  return {
    takesNovos,
    takesRepetidos,
    kitsNovos,
    hdsNovos,
    nomeDoHd,
    backupsNovos,
    comprovantesNovos,
    estado: atual.temEstado ? undefined : copia.estado,
  };
}

export const planoVazio = (p: PlanoDeRestauracao) =>
  !p.takesNovos.length && !p.kitsNovos.length && !p.hdsNovos.length && !p.backupsNovos.length && !p.comprovantesNovos.length;

/** `data:image/jpeg;base64,...` → Blob, sem `fetch` (que alguns navegadores barram para `data:`). */
export function blobDoDataUrl(dataUrl: string): Blob | null {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  const [, tipo, base64, corpo] = m;
  if (!base64) return new Blob([decodeURIComponent(corpo)], { type: tipo });
  const bin = atob(corpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
