import type { NomenclaturaArquivo } from '../../types';

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
  codec?: string;
}

export const NOMENCLATURAS: { id: NomenclaturaArquivo; nome: string; exemplo: string; explicacao: string }[] = [
  { id: 'camid', nome: 'Cam ID + Reel', exemplo: 'A001C001', explicacao: 'Sony Cinema Line: câmera, reel, posição e clipe' },
  { id: 'standard', nome: 'Standard FX30', exemplo: 'C0148', explicacao: 'C e o número do clipe' },
  { id: 'canon', nome: 'Canon R50 V', exemplo: 'A_0001C001A', explicacao: 'câmera, reel, clipe e codec (A ou H)' },
  { id: 'dji', nome: 'DJI', exemplo: 'DJI_0001', explicacao: 'Osmo Pocket 3 e afins' },
  { id: 'lumavi', nome: 'Lumavi legado', exemplo: 'A_00010148', explicacao: 'o formato antigo do Lumavi' },
  { id: 'custom', nome: 'Personalizado', exemplo: '{CAM}_{CARD}_{CLIP}', explicacao: 'monte com {CAM}, {CARD} e {CLIP}' },
];

/** Quais campos cada formato usa — o resto some da tela. */
export function camposDaNomenclatura(n: NomenclaturaArquivo) {
  return {
    usaCamera: n === 'camid' || n === 'lumavi' || n === 'canon' || n === 'custom',
    usaCartao: n === 'camid' || n === 'lumavi' || n === 'canon' || n === 'custom',
    usaPosicao: n === 'camid',
    usaZeros: n === 'standard' || n === 'dji' || n === 'custom',
    usaTemplate: n === 'custom',
  };
}

const pad = (valor: string | number, tamanho: number) => String(valor).padStart(tamanho, '0');

/** O reel usa só os DÍGITOS do cartão: "Card 03" vira "03". */
function reelDe(cartao: string): string {
  return String(cartao || '').replace(/\D/g, '') || '0';
}

export function aplicarTemplate(d: DadosDoNome): string {
  const clipe = pad(Number(d.proximo_clipe) || 0, Number(d.zeros_clipe) || 4);
  return String(d.template || '')
    .replace(/\{CAM\}/gi, d.camera_id || '')
    .replace(/\{CARD\}/gi, d.cartao || '')
    .replace(/\{CLIP\}/gi, clipe);
}

export function nomeArquivoPrevisto(d: DadosDoNome): string {
  const clipe = Number(d.proximo_clipe) || 0;
  const reel = reelDe(d.cartao);
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
    case 'custom': return aplicarTemplate(d);
    default: return `C${pad(clipe, zeros)}`;
  }
}
