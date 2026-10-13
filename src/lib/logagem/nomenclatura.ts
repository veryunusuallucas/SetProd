import type { EstadoDaLogagem, NomenclaturaArquivo } from '../../types';
import { reelDaCena } from './claquete';

/**
 * O nome do arquivo que a câmera VAI gravar no próximo take.
 *
 * Portado do Lumavi (`nomeArquivoPrevisto`), com as convenções reais de cada
 * câmera. É o número mais importante da tela: é por ele que o ingest casa o XML
 * com o take, e é ele que o 2º AC confere no visor antes de dizer "rodando".
 *
 * Funções puras, sem banco e sem tela, para poderem ser testadas contra o
 * comportamento do Lumavi caso a caso.
 */

export interface DadosDoNome {
  nomenclatura: NomenclaturaArquivo;
  camera_id: string;
  cartao: string;
  posicao: string;
  proximo_clipe: number;
  zeros_clipe: number;
  template?: string;
  titulo?: string;
  codec?: string;
  /** Com `reel_da_cena`, o A00X vem da cena da claquete, e não do cartão. */
  reel_da_cena?: boolean;
  cena?: string;
  claquete_antes_do_extra?: EstadoDaLogagem['claquete_antes_do_extra'];
  /** O relógio da prévia da Blackmagic. Só os testes passam: no app vale o de agora. */
  agora?: Date;
}

export const NOMENCLATURAS: { id: NomenclaturaArquivo; nome: string; exemplo: string; explicacao: string }[] = [
  { id: 'camid', nome: 'Cam ID + Reel', exemplo: 'A001C001', explicacao: 'Sony Cinema Line: câmera, reel, posição e clipe' },
  { id: 'standard', nome: 'Standard FX30', exemplo: 'C0148', explicacao: 'C e o número do clipe' },
  { id: 'sony_titulo', nome: 'Título', exemplo: 'FX30_0001', explicacao: 'o título que você escolhe e o número do arquivo' },
  { id: 'sony_data_titulo', nome: 'Data + Título', exemplo: '261013_FX30_0001', explicacao: 'a data, o título e o número do arquivo' },
  { id: 'sony_titulo_data', nome: 'Título + Data', exemplo: 'FX30_261013_0001', explicacao: 'o título, a data e o número do arquivo' },
  { id: 'canon', nome: 'Canon Cinema', exemplo: 'A_0001C001A', explicacao: 'câmera, reel, clipe e codec (A ou H)' },
  { id: 'mvi', nome: 'Canon padrão', exemplo: 'MVI_0001', explicacao: 'MVI e o número do arquivo, o de fábrica das Canon' },
  { id: 'blackmagic', nome: 'Blackmagic', exemplo: 'A001_10311512_C001', explicacao: 'câmera, reel, data e hora do começo, e o clipe' },
  { id: 'dji', nome: 'DJI', exemplo: 'DJI_0001', explicacao: 'Osmo Pocket 3 e afins' },
  { id: 'lumavi', nome: 'Lumavi legado', exemplo: 'A_00010148', explicacao: 'o formato antigo do Lumavi' },
  { id: 'custom', nome: 'Personalizado', exemplo: '{CAM}_{CARD}_{CLIP}', explicacao: 'monte com {CAM}, {CARD} e {CLIP}' },
];

/** Quais campos cada formato usa — o resto some da tela. */
export function camposDaNomenclatura(n: NomenclaturaArquivo) {
  return {
    usaCamera: n === 'camid' || n === 'lumavi' || n === 'canon' || n === 'blackmagic' || n === 'custom',
    usaCartao: n === 'camid' || n === 'lumavi' || n === 'canon' || n === 'blackmagic' || n === 'custom',
    usaPosicao: n === 'camid',
    usaZeros: n === 'standard' || n === 'dji' || n === 'custom',
    usaTemplate: n === 'custom',
    usaTitulo: n === 'sony_titulo' || n === 'sony_data_titulo' || n === 'sony_titulo_data',
  };
}

const pad = (valor: string | number, tamanho: number) => String(valor).padStart(tamanho, '0');

/** O reel usa só os DÍGITOS do cartão: "Card 03" vira "03". */
function reelDe(cartao: string): string {
  return String(cartao || '').replace(/\D/g, '') || '0';
}

/** O reel do nome: o da cena, quando a produção numera assim; senão, o do cartão. */
function reelDoNome(d: DadosDoNome): string | null {
  return d.reel_da_cena ? reelDaCena({ cena: d.cena ?? '', claquete_antes_do_extra: d.claquete_antes_do_extra }) : null;
}

export function aplicarTemplate(d: DadosDoNome): string {
  const clipe = pad(Number(d.proximo_clipe) || 0, Number(d.zeros_clipe) || 4);
  return String(d.template || '')
    .replace(/\{CAM\}/gi, d.camera_id || '')
    .replace(/\{CARD\}/gi, reelDoNome(d) ?? (d.cartao || ''))
    .replace(/\{CLIP\}/gi, clipe);
}

export function nomeArquivoPrevisto(d: DadosDoNome): string {
  const clipe = Number(d.proximo_clipe) || 0;
  const reel = reelDoNome(d) ?? reelDe(d.cartao);
  const id = (d.camera_id || 'A').toUpperCase();
  const zeros = Number(d.zeros_clipe) || 4;

  switch (d.nomenclatura) {
    case 'standard': return `C${pad(clipe, zeros)}`;
    case 'camid': return `${id}${pad(reel, 3)}${d.posicao || 'C'}${pad(clipe, 3)}`;
    case 'lumavi': return `${id}_${pad(reel, 4)}${pad(clipe, 4)}`;
    case 'dji': return `DJI_${pad(clipe, zeros)}`;
    case 'canon': {
      // Uma letra vira "A_"; duas letras ficam como estão ("AB").
      const indice = id.length === 1 ? `${id}_` : id.slice(0, 2);
      const codec = String(d.codec || '').toUpperCase();
      const hevc = codec.includes('HS') || codec.includes('H.265') || codec.includes('HEVC');
      return `${indice}${pad(reel, 4)}C${pad(clipe, 3)}${hevc ? 'H' : 'A'}`;
    }
    /*
      Sony com título (manual da FX30: "Data+Título+Número do arquivo"). O
      manual não mostra o separador nem como a data sai: aqui vai AAMMDD, como
      no Cam ID + Reel# (A001C001_230101AB), separado por "_". Se o cartão
      mostrar outro jeito, o ingest ainda casa pelo número e pela hora.
    */
    case 'sony_titulo':
    case 'sony_data_titulo':
    case 'sony_titulo_data': {
      const titulo = (d.titulo || '').trim() || 'TITULO';
      const agora = d.agora ?? new Date();
      const data = [agora.getFullYear() % 100, agora.getMonth() + 1, agora.getDate()].map(n => pad(n, 2)).join('');
      const numero = pad(clipe, 4);
      if (d.nomenclatura === 'sony_titulo') return `${titulo}_${numero}`;
      return d.nomenclatura === 'sony_data_titulo' ? `${data}_${titulo}_${numero}` : `${titulo}_${data}_${numero}`;
    }
    case 'mvi': return `MVI_${pad(clipe, 4)}`;
    /*
      Blackmagic: A001_MMDDhhmm_C001 (manual da Pocket 4K). A data e a hora são
      as do COMEÇO da gravação — só a câmera sabe. A prévia usa o relógio de
      agora; o ingest e o backup casam pelo resto do nome (`chaveDoClipe`).
    */
    case 'blackmagic': {
      const agora = d.agora ?? new Date();
      const carimbo = [agora.getMonth() + 1, agora.getDate(), agora.getHours(), agora.getMinutes()].map(n => pad(n, 2)).join('');
      return `${id.slice(0, 1)}${pad(reel, 3)}_${carimbo}_C${pad(clipe, 3)}`;
    }
    case 'custom': return aplicarTemplate(d);
    default: return `C${pad(clipe, zeros)}`;
  }
}

/**
 * O nome do clipe sem o que só a câmera sabe na hora de gravar.
 *
 * Na Blackmagic, A001_10311512_C001 e A001_10311515_C001 são o MESMO clipe para
 * o boletim: o take é logado minutos depois do começo da gravação, e o
 * carimbo de hora nunca bate. Os outros formatos passam como estão (em
 * maiúsculas, sem extensão).
 */
export function chaveDoClipe(nome: string): string {
  const limpo = String(nome || '').trim().toUpperCase().replace(/\.[A-Z0-9]{2,4}$/, '');
  const bm = limpo.match(/^([A-Z])(\d{3})_\d{8}_(C\d{3})/);
  return bm ? `${bm[1]}${bm[2]}_${bm[3]}` : limpo;
}
