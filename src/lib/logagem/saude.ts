import { BITRATES } from './backup';

/**
 * A saúde do arquivo de vídeo: ele é mesmo um vídeo?
 *
 * O caso real que motivou isto (APARTE, A003C010, 19/10/2024): o XML estava
 * perfeito, a miniatura que a câmera gerou era um JPEG válido, o MP4 tinha o
 * tamanho certo para 2m33s de XAVC HS 4K — e não abria. Por dentro, desde o
 * primeiro byte, não havia estrutura de MP4 nenhuma: nem `ftyp`, nem `mdat`,
 * nem `moov`. Um gigabyte de dados que não eram o clipe.
 *
 * Nada disso aparece olhando nome, tamanho ou XML. Aparece lendo **os
 * primeiros bytes** — e é só isso que esta verificação lê: os cabeçalhos das
 * caixas do MP4, alguns bytes cada, pulando o vídeo em si. Um arquivo de 12 GB
 * se confere em meia dúzia de leituras pequenas.
 */

export type EstadoDoArquivo =
  /** Estrutura completa: cabeçalho, dados e índice. */
  | 'ok'
  /** Não começa como MP4. O caso do A003C010: os bytes não são o clipe. */
  | 'sem-cabecalho'
  /** Tem cabeçalho e dados, mas não o índice (`moov`): gravação interrompida. */
  | 'sem-indice'
  /** Uma caixa diz que vai além do fim do arquivo: cópia cortada no meio. */
  | 'cortado'
  /** Não é MP4/MOV — outro formato, não dá para julgar por aqui. */
  | 'outro-formato';

export interface ExameDoVideo {
  estado: EstadoDoArquivo;
  /** A marca do `ftyp`: `XAVC`, `qt  `, `isom`… */
  marca?: string;
  caixas: { tipo: string; inicio: number; tamanho: number }[];
  /** Duração que o próprio arquivo declara, em segundos. */
  segundos?: number;
  bytes: number;
}

const TIPOS_CONHECIDOS = new Set(['ftyp', 'uuid', 'free', 'skip', 'wide', 'mdat', 'moov', 'meta', 'pnot', 'udta', 'PICT']);

const ehTipoLegivel = (t: string) => /^[\x20-\x7e]{4}$/.test(t);

async function bytesDe(arquivo: Blob, inicio: number, quantos: number): Promise<DataView> {
  const pedaco = await arquivo.slice(inicio, inicio + quantos).arrayBuffer();
  return new DataView(pedaco);
}

const tipoEm = (v: DataView, pos: number) =>
  String.fromCharCode(v.getUint8(pos), v.getUint8(pos + 1), v.getUint8(pos + 2), v.getUint8(pos + 3));

/**
 * Examina o vídeo lendo só os cabeçalhos das caixas de primeiro nível.
 *
 * Aceita qualquer `Blob` — o `File` que a pessoa escolheu no navegador, ou o
 * `fs.openAsBlob` nos testes —, e o `slice` garante que só os bytes pedidos
 * saem do disco.
 */
export async function examinarVideo(arquivo: Blob): Promise<ExameDoVideo> {
  const total = arquivo.size;
  const caixas: ExameDoVideo['caixas'] = [];

  if (total < 16) return { estado: 'sem-cabecalho', caixas, bytes: total };

  // O começo decide quase tudo: um MP4 abre com `ftyp` no byte 4.
  const inicio = await bytesDe(arquivo, 0, 16);
  const primeiroTipo = tipoEm(inicio, 4);
  if (!ehTipoLegivel(primeiroTipo) || !TIPOS_CONHECIDOS.has(primeiroTipo)) {
    return { estado: 'sem-cabecalho', caixas, bytes: total };
  }

  let marca: string | undefined;
  let segundos: number | undefined;
  let pos = 0;
  let cortado = false;

  // Um MP4 de câmera tem 4 a 6 caixas no primeiro nível. O teto existe para um
  // arquivo estranho não virar mil leituras.
  for (let volta = 0; pos + 8 <= total && volta < 64; volta++) {
    const cab = await bytesDe(arquivo, pos, 16);
    if (cab.byteLength < 8) break;

    let tamanho = cab.getUint32(0);
    const tipo = tipoEm(cab, 4);
    let cabecalho = 8;

    if (!ehTipoLegivel(tipo)) {
      // Caixa ilegível no meio do arquivo: o que vem depois não é confiável.
      cortado = true;
      break;
    }
    if (tamanho === 1 && cab.byteLength >= 16) {
      tamanho = Number(cab.getBigUint64(8));
      cabecalho = 16;
    } else if (tamanho === 0) {
      tamanho = total - pos;
    }
    if (tamanho < cabecalho) { cortado = true; break; }

    caixas.push({ tipo, inicio: pos, tamanho });

    if (pos + tamanho > total) {
      cortado = true;
      break;
    }

    if (tipo === 'ftyp') {
      const corpo = await bytesDe(arquivo, pos + cabecalho, 4);
      if (corpo.byteLength === 4) marca = tipoEm(corpo, 0);
    }

    if (tipo === 'moov') segundos = await duracaoDoMoov(arquivo, pos + cabecalho, pos + tamanho);

    pos += tamanho;
  }

  const tem = (t: string) => caixas.some(c => c.tipo === t);

  let estado: EstadoDoArquivo;
  if (cortado) estado = 'cortado';
  else if (!tem('ftyp') && !tem('moov') && !tem('mdat')) estado = 'outro-formato';
  else if (tem('mdat') && !tem('moov')) estado = 'sem-indice';
  else estado = 'ok';

  return { estado, marca, caixas, segundos, bytes: total };
}

/** Procura o `mvhd` dentro do `moov` e devolve a duração declarada. */
async function duracaoDoMoov(arquivo: Blob, de: number, ate: number): Promise<number | undefined> {
  let pos = de;
  for (let volta = 0; pos + 8 <= ate && volta < 32; volta++) {
    const cab = await bytesDe(arquivo, pos, 8);
    if (cab.byteLength < 8) return undefined;
    const tamanho = cab.getUint32(0);
    const tipo = tipoEm(cab, 4);
    if (tipo === 'mvhd') {
      const corpo = await bytesDe(arquivo, pos + 8, 32);
      const versao = corpo.getUint8(0);
      const escala = versao === 1 ? corpo.getUint32(20) : corpo.getUint32(12);
      const duracao = versao === 1 ? Number(corpo.getBigUint64(24)) : corpo.getUint32(16);
      return escala ? duracao / escala : undefined;
    }
    if (tamanho < 8) return undefined;
    pos += tamanho;
  }
  return undefined;
}

/**
 * O tamanho que o arquivo DEVERIA ter, pela duração e pelo codec.
 *
 * Não é para acusar — a taxa real varia com a cena —, é para pegar o absurdo:
 * um clipe de dois minutos em XAVC HS com 40 MB é uma cópia que parou no meio.
 */
export function tamanhoEsperado(segundos: number, codec: string): number {
  const mbps = (BITRATES.find(b => b.teste.test(codec)) || { mbps: 300 }).mbps;
  return (mbps * 1e6 * segundos) / 8;
}

/**
 * Megabits por segundo de verdade, a partir do tamanho e da duração do XML.
 *
 * No A003C010, 1.040.794.772 bytes em 153,65 s dão 54 Mbps — o perfil de
 * 50 Mbps do XAVC HS 4K. O tamanho estava certo; foi isso que tornou o defeito
 * invisível para quem só olhava a pasta.
 */
export const taxaReal = (bytes: number, segundos: number) => (segundos > 0 ? (bytes * 8) / segundos / 1e6 : 0);

/** O que dizer para a pessoa, em uma frase, sobre cada estado. */
export const EXPLICACAO: Record<EstadoDoArquivo, string> = {
  ok: 'Arquivo íntegro: cabeçalho, imagem e índice no lugar.',
  'sem-cabecalho':
    'Não é um vídeo por dentro: não começa como MP4. O tamanho pode estar certo e o arquivo não abre — os bytes gravados não são o clipe. Recupere do cartão original, se ele ainda existir.',
  'sem-indice':
    'Gravação interrompida: a imagem está lá, mas falta o índice que o programa usa para abrir. Costuma ter conserto (a própria câmera repara ao reinserir o cartão, ou ferramentas como o untrunc).',
  cortado: 'Arquivo cortado: ele termina antes do que o próprio cabeçalho promete. É cópia que parou no meio — copie de novo.',
  'outro-formato': 'Formato que esta verificação não conhece. Não dá para dizer se está íntegro.',
};
