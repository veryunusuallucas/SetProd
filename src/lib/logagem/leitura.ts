import { lerNRT, type ClipeDoXml, duracaoLegivel } from './nrt';
import {
  EXTENSOES_DE_VIDEO, clipesDoManifesto, ehLixoDoMac, lerManifesto, nomeDeClipeDoArquivo,
  type ClipeDoManifesto, type Manifesto,
} from './manifesto';
import { examinarVideo, type ExameDoVideo } from './saude';

/**
 * A leitura de um cartão (ou de uma pasta de backup) para o ingest.
 *
 * Junta as três fontes que um cartão pode ter, casando pelo nome do clipe:
 * - o **XML** da Sony, que sabe tudo sobre o clipe;
 * - o **vídeo**, de que só se leem os cabeçalhos, para saber se é íntegro;
 * - o **manifesto** do DaVinci, que lista tamanho e data até de quem não tem
 *   XML (Canon, drone).
 *
 * Nada disso sai do computador: os arquivos são lidos, o que interessa vira
 * registro, e o arquivo é esquecido (PLANO-logagem §9b).
 */

export interface ClipeLido {
  nome: string;
  xml?: ClipeDoXml;
  video?: { arquivo: string; bytes: number; exame: ExameDoVideo };
  manifesto?: ClipeDoManifesto;
  /** `AAAA-MM-DD` do dia em que o clipe foi gravado, pela melhor fonte. */
  dia?: string;
}

export interface LeituraDoCartao {
  clipes: ClipeLido[];
  manifesto?: Manifesto;
  /** Arquivos deixados de lado de propósito (lixo do Mac, miniaturas…). */
  ignorados: number;
  erros: { arquivo: string; motivo: string }[];
}

const extensao = (nome: string) => (nome.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';

/** O XML ao lado do clipe (`…M01.XML`), e não o índice do cartão (`MEDIAPRO.XML`). */
export const ehXmlDeClipe = (nome: string) => /M\d{2}\.xml$/i.test(nome) && !ehLixoDoMac(nome);
export const ehVideo = (nome: string) => EXTENSOES_DE_VIDEO.includes(extensao(nome)) && !ehLixoDoMac(nome);
export const ehManifesto = (nome: string) =>
  !ehLixoDoMac(nome) && (extensao(nome) === 'mhl' || /md5/i.test(nome) && extensao(nome) === 'txt');

/**
 * Um instante como ISO na hora DESTE computador, com o fuso no fim
 * (`2026-09-12T11:50:56-03:00`) — o mesmo formato que a Sony escreve no XML.
 */
export function isoLocal(ms: number): string {
  const d = new Date(ms);
  const dois = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const fuso = -d.getTimezoneOffset();
  const sinal = fuso >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}${sinal}${dois(Math.trunc(fuso / 60))}:${dois(fuso % 60)}`;
}

/** A data local de um instante, sem o fuso deslocar o dia. */
const diaLocal = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Lê os arquivos escolhidos.
 *
 * Um cartão tem centenas de arquivos que não interessam (miniaturas, índices,
 * bancos da câmera). Só entram os XML de clipe, os vídeos e os manifestos — o
 * resto é contado em `ignorados`, para a tela poder dizer que viu.
 */
export async function lerArquivosDoCartao(
  arquivos: File[],
  aoAvancar?: (feitos: number, total: number) => void
): Promise<LeituraDoCartao> {
  const porNome = new Map<string, ClipeLido>();
  const clipe = (nome: string) => {
    const chave = nome.toUpperCase();
    let c = porNome.get(chave);
    if (!c) { c = { nome }; porNome.set(chave, c); }
    return c;
  };

  const erros: LeituraDoCartao['erros'] = [];
  let manifesto: Manifesto | undefined;
  let ignorados = 0;

  const uteis = arquivos.filter(a => ehXmlDeClipe(a.name) || ehVideo(a.name) || ehManifesto(a.name));
  ignorados = arquivos.length - uteis.length;

  let feitos = 0;
  for (const arquivo of uteis) {
    try {
      if (ehXmlDeClipe(arquivo.name)) {
        const lido = lerNRT(arquivo.name, await arquivo.text());
        clipe(lido.nome).xml = lido;
      } else if (ehVideo(arquivo.name)) {
        const exame = await examinarVideo(arquivo);
        const c = clipe(nomeDeClipeDoArquivo(arquivo.name));
        c.video = { arquivo: arquivo.name, bytes: arquivo.size, exame };
        // A data do arquivo é o último recurso: uma cópia descuidada troca a
        // data, e por isso XML e manifesto vêm antes (ver `diaDoClipe`).
        c.dia = c.dia || diaLocal(arquivo.lastModified);
      } else if (ehManifesto(arquivo.name)) {
        manifesto = lerManifesto(await arquivo.text());
      }
    } catch (e) {
      erros.push({ arquivo: arquivo.name, motivo: e instanceof Error ? e.message : 'não consegui ler' });
    }
    feitos++;
    aoAvancar?.(feitos, uteis.length);
  }

  if (manifesto) {
    for (const m of clipesDoManifesto(manifesto)) clipe(m.nome).manifesto = m;
  }

  const clipes = [...porNome.values()].map(c => ({ ...c, dia: diaDoClipe(c) }));
  clipes.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));

  return { clipes, manifesto, ignorados, erros };
}

/**
 * O dia em que o clipe foi gravado, pela fonte mais confiável que houver.
 *
 * O XML traz a data na hora local da câmera (`2026-09-12T15:21:41-03:00`), e os
 * dez primeiros caracteres já são o dia certo. O manifesto traz a data em UTC —
 * um clipe gravado às 22h de São Paulo apareceria no dia seguinte —, então ele
 * é convertido para a hora deste computador.
 */
export function diaDoClipe(c: ClipeLido): string | undefined {
  const doXml = c.xml?.meta.criadoEm?.slice(0, 10);
  if (doXml) return doXml;
  if (c.manifesto?.modificadoEm) {
    const ms = Date.parse(c.manifesto.modificadoEm);
    if (Number.isFinite(ms)) return diaLocal(ms);
  }
  return c.dia;
}

/**
 * O clipe no formato que o cruzamento entende.
 *
 * Quem tem XML entra com tudo. Quem não tem entra com o que o arquivo e o
 * manifesto sabem: nome, e a duração que o próprio MP4 declara.
 */
export function comoClipeDoXml(c: ClipeLido): ClipeDoXml {
  if (c.xml) return c.xml;
  const segundos = c.video?.exame.segundos;

  /*
    A hora do clipe sem XML vem do manifesto — que escreve em UTC. Usada
    direto, um clipe da Canon gravado às 11:50 de São Paulo entraria no boletim
    às 14:50. Convertida para a hora deste computador, fica no formato do XML
    da Sony, e o take importado lê as duas do mesmo jeito.
  */
  const quando = c.manifesto?.modificadoEm ? Date.parse(c.manifesto.modificadoEm) : NaN;
  return {
    nome: c.nome,
    arquivoDaCamera: (c.video?.arquivo || c.manifesto?.arquivo || c.nome).replace(/\.[^.]+$/, ''),
    meta: {
      fonte: c.video?.arquivo || c.manifesto?.arquivo,
      criadoEm: Number.isFinite(quando) ? isoLocal(quando) : undefined,
      segundos,
      duracao: segundos ? duracaoLegivel(segundos) : undefined,
    },
  };
}

/**
 * Câmera e cartão pelo nome do clipe, quando o nome diz.
 *
 * `A003C010` é a câmera A, cartão 003 — é a convenção da Sony e da nomenclatura
 * "Cam ID + Reel" do app. Para um clipe importado sem take, é melhor que
 * herdar a câmera que está no estado agora, que pode ser outra.
 */
export function cameraECartaoDoNome(nome: string): { camera_id?: string; cartao?: string } {
  const m = nome.match(/^([A-Z]{1,2})(\d{3})[CLR]\d{3}/i);
  return m ? { camera_id: m[1].toUpperCase(), cartao: m[2] } : {};
}
