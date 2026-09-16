import type { MetadadosDoClipe } from '../../types';

/**
 * O XML que a Sony deixa ao lado de cada clipe (NonRealTimeMeta).
 *
 * É a única fonte que sabe de verdade o que a câmera fez: codec, timecode,
 * duração exata, gamma, gamut. Tudo o mais é o que alguém digitou às pressas
 * entre um take e outro — por isso, no ingest, **o XML vence**.
 *
 * Lido com o `DOMParser` do próprio navegador: nenhuma dependência nova para um
 * app que precisa abrir no 3G do set.
 */

/* ───────────────────────── Nome do clipe ───────────────────────── */

/**
 * O nome que o boletim conhece, a partir do nome do arquivo XML.
 *
 * `A003C030_260912SLM01.XML` → `A003C030`
 *
 * A câmera acrescenta duas coisas ao nome do clipe: o sufixo `M01` do arquivo
 * de metadados e um carimbo `_AAMMDD` + duas letras sorteadas, que serve para
 * dois cartões diferentes nunca terem o mesmo nome de arquivo. Nenhum dos dois
 * aparece na claquete, então nenhum dos dois entra aqui.
 */
export function nomeDoClipe(nomeArquivo: string): string {
  const semExtensao = String(nomeArquivo || '').replace(/\.[^.]+$/, '');
  const semMeta = semExtensao.replace(/M\d{2}$/i, '');
  return semMeta.replace(/_\d{6}[A-Z0-9]{2}$/i, '');
}

/* ───────────────────────── Timecode ───────────────────────── */

/**
 * O timecode de um `LtcChange`.
 *
 * ⚠️ OS PARES DE DÍGITOS VÊM AO CONTRÁRIO, e essa é a parte que o Lumavi errava.
 *
 * O valor `12251608` parece `12:25:16:08` lido da esquerda para a direita — e é
 * assim que o Lumavi mostrava. Mas a Sony guarda o timecode empacotado na ordem
 * **quadros, segundos, minutos, horas**, então o mesmo valor é `08:16:25:12`.
 *
 * Como sei: no cartão real (A003C030), o clipe tem 36 quadros a 24 fps e o XML
 * traz início `12251608` e fim `23261608` no quadro 35. Lido ao contrário, o
 * início é 08:16:25:12 e o fim 08:16:26:23 — exatamente 35 quadros depois. Lido
 * como o Lumavi lia, o clipe começaria às 12h e terminaria às 23h.
 *
 * A conferência vale para os 17 clipes daquele cartão.
 */
export function timecodeDoValor(valor: string | null | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (digitos.length !== 8) return '';
  const [quadros, segundos, minutos, horas] = [0, 2, 4, 6].map(i => digitos.slice(i, i + 2));
  return `${horas}:${minutos}:${segundos}:${quadros}`;
}

/** Quadros desde 00:00:00:00, para conferir e para contar duração. */
export function timecodeEmQuadros(tc: string, fps: number): number {
  const p = String(tc).split(':').map(Number);
  if (p.length !== 4 || p.some(n => !Number.isFinite(n))) return 0;
  const inteiro = Math.round(fps) || 24;
  return ((p[0] * 60 + p[1]) * 60 + p[2]) * inteiro + p[3];
}

/* ───────────────────────── Codec ───────────────────────── */

/**
 * De `AVC50_1920_1080_H422P@L41` para "XAVC S-I", com amostragem e bits.
 *
 * O nome que a Sony escreve é o perfil do encoder, não o que está na etiqueta
 * do menu da câmera. Quem loga escreveu "XAVC S-I" no boletim; o XML diz
 * `H422P`. São a mesma coisa, e o app precisa saber disso para não acusar
 * divergência em todo clipe.
 */
export function lerCodec(bruto: string): { codec: string; amostragem?: string; bitDepth?: string; cru: string } {
  const cru = String(bruto || '');
  const texto = cru.toUpperCase();

  let codec = cru;
  if (/HEVC|H265|HS/.test(texto)) codec = 'XAVC HS';
  else if (/H422IP|H422P|INTRA/.test(texto)) codec = 'XAVC S-I';
  else if (/H420|AVC/.test(texto)) codec = 'XAVC S';

  let amostragem = (cru.match(/4:[24]:[024]/) || [])[0];
  let bitDepth = (cru.match(/(\d{1,2})\s*-?\s*bit/i) || [])[1];
  if (/H422/i.test(cru)) { amostragem = amostragem || '4:2:2'; bitDepth = bitDepth || '10'; }
  else if (/H420/i.test(cru)) { amostragem = amostragem || '4:2:0'; bitDepth = bitDepth || '10'; }

  /*
    O HEVC da Sony escreve o perfil de outro jeito: `HEVC_3840_2160_M42210P` é
    Main 4:2:2 10 — amostragem 4:2:2, 10 bits. Achado no clipe A003C010
    (APARTE, 2024), que o leitor deixava sem amostragem nenhuma.
  */
  const perfilHevc = cru.match(/_M(4(?:22|20))?(\d{1,2})P\b/i);
  if (perfilHevc) {
    const [, crominancia, bits] = perfilHevc;
    amostragem = amostragem || (crominancia === '422' ? '4:2:2' : '4:2:0');
    bitDepth = bitDepth || bits;
  }

  return { codec, amostragem, bitDepth, cru };
}

/* ───────────────────────── O XML inteiro ───────────────────────── */

export interface ClipeDoXml {
  /** O nome que casa com o take: `A003C030`. */
  nome: string;
  /** O nome do arquivo de vídeo, quando dá para saber: `A003C030_260912SL`. */
  arquivoDaCamera: string;
  codec?: string;
  fps?: string;
  resolucao?: string;
  meta: MetadadosDoClipe;
}

const texto = (doc: Document, seletor: string, atributo: string) =>
  doc.querySelector(seletor)?.getAttribute(atributo) ?? null;

/** Duração legível: 36 quadros a 24 fps viram `00:01`. */
export function duracaoLegivel(segundos: number): string {
  const inteiro = Math.max(0, Math.round(segundos));
  const h = Math.floor(inteiro / 3600);
  const m = Math.floor((inteiro % 3600) / 60);
  const s = inteiro % 60;
  const doisDigitos = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${doisDigitos(m)}:${doisDigitos(s)}` : `${doisDigitos(m)}:${doisDigitos(s)}`;
}

export function lerNRT(nomeArquivo: string, xml: string): ClipeDoXml {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('XML ilegível');
  if (!doc.querySelector('NonRealTimeMeta')) throw new Error('não é um XML de clipe da Sony');

  const meta: MetadadosDoClipe = { fonte: nomeArquivo };

  // Resolução
  const pixels = texto(doc, 'VideoLayout', 'pixel');
  const linhas = texto(doc, 'VideoLayout', 'numOfVerticalLine');
  const resolucao = pixels && linhas ? `${pixels}x${linhas}` : undefined;

  // Codec
  const codecBruto = texto(doc, 'VideoFrame', 'videoCodec');
  const codec = codecBruto ? lerCodec(codecBruto) : null;
  if (codec) {
    meta.amostragem = codec.amostragem;
    meta.bitDepth = codec.bitDepth;
  }

  // FPS de captura ("23.98p")
  const fps = texto(doc, 'VideoFrame', 'captureFps')?.replace(/p$/i, '') ?? undefined;

  // Timecode e duração
  const tcFps = texto(doc, 'LtcChangeTable', 'tcFps') ?? undefined;
  meta.tcFps = tcFps;
  const mudancas = [...doc.querySelectorAll('LtcChange')];
  if (mudancas.length) {
    meta.tcIn = timecodeDoValor(mudancas[0].getAttribute('value'));
    const fim = mudancas.find(m => (m.getAttribute('status') || '') === 'end') ?? mudancas[mudancas.length - 1];
    meta.tcOut = timecodeDoValor(fim.getAttribute('value'));
  }

  const quadros = Number(texto(doc, 'Duration', 'value'));
  const porSegundo = parseFloat(String(tcFps || fps || '24')) || 24;
  if (Number.isFinite(quadros) && quadros > 0) {
    meta.segundos = quadros / porSegundo;
    meta.duracao = duracaoLegivel(meta.segundos);
  }

  meta.criadoEm = texto(doc, 'CreationDate', 'value') ?? undefined;
  meta.modeloCamera = texto(doc, 'Device', 'modelName') ?? undefined;
  meta.modeloLente = texto(doc, 'Lens', 'modelName') ?? undefined;

  const codecAudio = texto(doc, 'AudioRecPort', 'audioCodec');
  const canais = texto(doc, 'AudioFormat', 'numOfChannel');
  if (codecAudio) meta.codecAudio = codecAudio + (canais ? ` ${canais}ch` : '');

  // O picture profile fica num saco de <Item name value> genérico.
  const itens = [...doc.querySelectorAll('Item')];
  const item = (...chaves: string[]) => {
    const achado = itens.find(i => {
      const nome = (i.getAttribute('name') || '').toLowerCase();
      return chaves.some(c => nome.includes(c));
    });
    return achado?.getAttribute('value') || null;
  };

  meta.gamma = item('capturegammaequation', 'gamma') ?? undefined;
  meta.gamut = item('capturecolorprimaries', 'colorprimaries', 'gamut') ?? undefined;
  meta.coding = item('codingequations') ?? undefined;
  meta.bitDepth = (item('bitdepth', 'bit_depth')?.match(/\d+/) || [])[0] || meta.bitDepth;
  meta.amostragem = item('colorsampling', 'samplingstructure', 'chroma') || meta.amostragem;

  const semExtensao = String(nomeArquivo || '').replace(/\.[^.]+$/, '');
  return {
    nome: nomeDoClipe(nomeArquivo),
    arquivoDaCamera: semExtensao.replace(/M\d{2}$/i, ''),
    codec: codec?.codec,
    fps,
    resolucao,
    meta,
  };
}

/**
 * O ISO e a abertura que o XML traz, quando traz.
 *
 * Ficam de fora do `MetadadosDoClipe` porque não são "do clipe": são campos que
 * o take já tem preenchidos à mão, e o ingest vai comparar com o que foi
 * digitado. A FX30 não escreve nenhum dos dois — a FX3 e a FX6 escrevem.
 */
export function exposicaoDoXml(xml: string): { iso?: string; abertura?: string; focal?: string } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const itens = [...doc.querySelectorAll('Item')];
  const item = (...chaves: string[]) => {
    const achado = itens.find(i => {
      const nome = (i.getAttribute('name') || '').toLowerCase();
      return chaves.some(c => nome.includes(c));
    });
    return achado?.getAttribute('value') || null;
  };

  const iso = item('isosensitivity', 'exposureindex', 'iso');
  const fnumero = item('fnumber', 'iris', 'fstop', 'aperture');
  const focal = item('focallength', 'lensfocallength', 'lenszoom');

  const mm = focal !== null ? parseFloat(String(focal).replace(/[^\d.]/g, '')) : NaN;

  return {
    iso: iso ? (iso.match(/\d+/) || [iso])[0] : undefined,
    abertura: fnumero ? formatarAbertura(fnumero) : undefined,
    // Focal 0mm é lente manual: a câmera não sabe qual é, e o que está no
    // boletim (digitado por quem montou a lente) vale mais que o zero.
    focal: Number.isFinite(mm) && mm > 0 ? `${Math.round(mm)}mm` : undefined,
  };
}

function formatarAbertura(bruto: string): string {
  const s = String(bruto).trim();
  if (/^\d+\/\d+$/.test(s)) {
    const [a, b] = s.split('/').map(Number);
    return 'f/' + (a / b).toFixed(1);
  }
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? s : 'f/' + n.toFixed(1);
}
