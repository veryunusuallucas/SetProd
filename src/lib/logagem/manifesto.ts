import { nomeDoClipe } from './nrt';

/**
 * O manifesto do cartão: o que o programa de cópia listou ao clonar e conferir.
 *
 * O DaVinci gera um `.mhl` (XML com caminho, tamanho, data e MD5 de cada
 * arquivo) e um `md5sums.txt` ao lado. Eles nasceram para provar que a cópia
 * está íntegra — e é isso que a aba Backup usa —, mas servem para uma segunda
 * coisa que vale ouro no ingest: **são a lista do que existe no cartão**, com
 * tamanho e data, sem precisar ler um único vídeo.
 *
 * É o que salva a Canon e o drone, que não deixam XML nenhum ao lado dos
 * clipes.
 */

export interface ArquivoDoManifesto {
  /** Como veio escrito, com as barras invertidas do Windows. */
  caminho: string;
  nome: string;
  extensao: string;
  bytes?: number;
  /** ISO, como o manifesto escreveu. Na prática é o fim da gravação. */
  modificadoEm?: string;
  md5?: string;
}

export interface Manifesto {
  formato: 'mhl' | 'md5';
  ferramenta?: string;
  usuario?: string;
  maquina?: string;
  inicio?: string;
  fim?: string;
  arquivos: ArquivoDoManifesto[];
}

export const EXTENSOES_DE_VIDEO = ['mp4', 'mov', 'mxf', 'braw', 'avi', 'mts', 'm4v'];

const partes = (caminho: string) => {
  const nome = caminho.split(/[\\/]/).pop() || caminho;
  const extensao = (nome.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';
  return { nome, extensao };
};

/** O `.mhl` do DaVinci: XML com um `<hash>` por arquivo. */
export function lerMhl(texto: string): Manifesto {
  const doc = new DOMParser().parseFromString(texto, 'application/xml');
  if (doc.querySelector('parsererror') || !doc.querySelector('hashlist')) {
    throw new Error('não é um manifesto MHL');
  }

  const valor = (dentro: Element | Document, seletor: string) =>
    dentro.querySelector(seletor)?.textContent?.trim() || undefined;

  return {
    formato: 'mhl',
    ferramenta: valor(doc, 'creatorinfo > tool'),
    usuario: valor(doc, 'creatorinfo > username'),
    maquina: valor(doc, 'creatorinfo > hostname'),
    inicio: valor(doc, 'creatorinfo > startdate'),
    fim: valor(doc, 'creatorinfo > finishdate'),
    arquivos: [...doc.querySelectorAll('hash')].map(h => {
      const caminho = valor(h, 'file') || '';
      const bytes = Number(valor(h, 'size'));
      return {
        caminho,
        ...partes(caminho),
        bytes: Number.isFinite(bytes) ? bytes : undefined,
        modificadoEm: valor(h, 'lastmodificationdate'),
        md5: valor(h, 'md5'),
      };
    }),
  };
}

/** O `md5sums.txt`: uma linha por arquivo, `hash  caminho`. */
export function lerMd5Sums(texto: string): Manifesto {
  const arquivos = String(texto)
    .split(/\r?\n/)
    .map(linha => linha.match(/^([0-9a-f]{32})\s+(.+)$/i))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map(m => {
      const caminho = m[2].trim();
      return { caminho, ...partes(caminho), md5: m[1].toLowerCase() };
    });

  if (!arquivos.length) throw new Error('não é uma lista de MD5');
  return { formato: 'md5', arquivos };
}

/** Lê o manifesto seja qual for o formato, pelo conteúdo e não pela extensão. */
export function lerManifesto(texto: string): Manifesto {
  return /<hashlist/i.test(texto) ? lerMhl(texto) : lerMd5Sums(texto);
}

/**
 * O nome de clipe que o boletim usa, a partir do nome do arquivo de vídeo.
 *
 * Cada fabricante inventa o seu:
 * - Sony: `A003C030_260912SL.MP4` → `A003C030` (o carimbo de data e as duas
 *   letras existem para dois cartões não repetirem nome de arquivo);
 * - DJI: `DJI_20260912150328_0001_D.MP4` → `DJI_0001`, que é como a
 *   nomenclatura DJI do app monta o nome;
 * - Canon e o resto: o nome do arquivo mesmo (`2S0A5649`).
 */
export function nomeDeClipeDoArquivo(nomeArquivo: string): string {
  const semExtensao = String(nomeArquivo || '').replace(/\.[^.]+$/, '');

  const dji = semExtensao.match(/^DJI_\d{8,14}_(\d{3,5})(?:_[A-Z])?$/i);
  if (dji) return `DJI_${dji[1]}`;

  return nomeDoClipe(semExtensao);
}

export interface ClipeDoManifesto {
  nome: string;
  arquivo: string;
  caminho: string;
  bytes?: number;
  /** `AAAA-MM-DD`, quando o manifesto trouxe a data. */
  dia?: string;
  modificadoEm?: string;
}

/** Só os vídeos do manifesto, com o nome que casa com o boletim. */
export function clipesDoManifesto(manifesto: Manifesto): ClipeDoManifesto[] {
  return manifesto.arquivos
    .filter(a => EXTENSOES_DE_VIDEO.includes(a.extensao))
    .map(a => ({
      nome: nomeDeClipeDoArquivo(a.nome),
      arquivo: a.nome,
      caminho: a.caminho,
      bytes: a.bytes,
      dia: a.modificadoEm?.slice(0, 10),
      modificadoEm: a.modificadoEm,
    }));
}

/**
 * Quantos clipes de cada dia.
 *
 * ⚠️ É A DEFESA CONTRA O CARTÃO QUE NÃO FOI FORMATADO, e isso não é hipótese:
 * no cartão da Canon (R7, 13/09) havia 16 clipes de uma Sony, de 14 de MAIO,
 * na pasta `PRIVATE\M4ROOT\CLIP` — o cartão tinha sido usado em outra câmera e
 * nunca formatado. Quem mandasse o cartão inteiro para o ingest sem olhar
 * ganharia 16 takes importados de outra produção, em outro mês.
 */
export function clipesPorDia(clipes: ClipeDoManifesto[]): Record<string, number> {
  const contagem: Record<string, number> = {};
  for (const c of clipes) {
    const dia = c.dia || 'sem data';
    contagem[dia] = (contagem[dia] || 0) + 1;
  }
  return contagem;
}

/** Os clipes que NÃO são do dia da diária — os que merecem uma olhada antes. */
export function forasteiros(clipes: ClipeDoManifesto[], diaDaDiaria?: string): ClipeDoManifesto[] {
  if (!diaDaDiaria) return [];
  return clipes.filter(c => c.dia && c.dia !== diaDaDiaria);
}

/** Soma em bytes, para a tela falar em GB de verdade e não em estimativa. */
export const totalEmBytes = (clipes: ClipeDoManifesto[]) =>
  clipes.reduce((soma, c) => soma + (c.bytes || 0), 0);

export function emGB(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.round(bytes / 1e3)} KB`;
}
