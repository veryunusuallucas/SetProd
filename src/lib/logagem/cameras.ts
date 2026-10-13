import type { NomenclaturaArquivo } from '../../types';

/**
 * O catálogo de câmeras (Lucas, 13/10/2026): escolher "Sony FX30" já diz como
 * ela nomeia os arquivos e quais codecs, FPS e resoluções ela grava. O setup
 * deixa de oferecer o que a câmera não tem.
 *
 * As fichas vêm dos manuais e das especificações de cada fabricante
 * (pesquisadas em 13/10/2026). Onde a fonte não confirmou, está dito na
 * `observacao` — a pessoa confere no visor antes do primeiro take.
 */

export interface FormatoDaCamera {
  nomenclatura: NomenclaturaArquivo;
  /** Como o menu da câmera chama essa opção. */
  noMenu: string;
}

export interface ModeloDeCamera {
  id: string;
  marca: string;
  nome: string;
  /** As formas de nomear que ela tem. A primeira é a recomendada para o set. */
  formatos: FormatoDaCamera[];
  codecs: string[];
  fps: string[];
  resolucoes: string[];
  padrao: { codec: string; fps: string; resolucao: string };
  /** O que vale saber antes do primeiro take. */
  observacao: string;
}

export const CAMERAS: ModeloDeCamera[] = [
  {
    id: 'sony-fx30',
    marca: 'Sony',
    nome: 'FX30',
    formatos: [
      { nomenclatura: 'camid', noMenu: 'Formato do nome: Cam ID + Reel#' },
      { nomenclatura: 'standard', noMenu: 'Formato do nome: Padrão' },
      { nomenclatura: 'sony_titulo', noMenu: 'Formato do nome: Título' },
      { nomenclatura: 'sony_data_titulo', noMenu: 'Formato do nome: Data + Título' },
      { nomenclatura: 'sony_titulo_data', noMenu: 'Formato do nome: Título + Data' },
    ],
    codecs: ['XAVC S-I', 'XAVC HS', 'XAVC S'],
    fps: ['23.98', '24', '25', '29.97', '50', '59.94', '100', '119.88'],
    resolucoes: ['4K UHD (3840x2160)', 'Full HD (1920x1080)'],
    padrao: { codec: 'XAVC S-I', fps: '23.98', resolucao: '4K UHD (3840x2160)' },
    observacao: 'Cam ID + Reel# exige firmware 2.0 ou mais novo e cartão SDXC ou CFexpress A; com SDHC o nome fica no Padrão (Menu → Arquivo → Config. de arquivo). O título vai até 37 caracteres. 119,88 fps em 4K só em XAVC S ou XAVC HS; o S-I vai até 59,94.',
  },
  {
    id: 'canon-r50v',
    marca: 'Canon',
    nome: 'EOS R50 V',
    formatos: [
      { nomenclatura: 'canon', noMenu: 'nome estilo Cinema (A_0001C001A)' },
      { nomenclatura: 'mvi', noMenu: 'nome padrão (MVI_0001)' },
    ],
    codecs: ['H.265 (HEVC) 10-bit 4:2:2', 'H.264 8-bit 4:2:0'],
    fps: ['23.98', '25', '29.97', '50', '59.94', '119.88'],
    resolucoes: ['4K UHD (3840x2160)', 'Full HD (1920x1080)'],
    padrao: { codec: 'H.265 (HEVC) 10-bit 4:2:2', fps: '23.98', resolucao: '4K UHD (3840x2160)' },
    observacao: '4K sem corte vai até 29,97; 59,94 em 4K só com corte. 119,88 só em Full HD. O nome estilo Cinema é o que o Lumavi usava; confira no cartão qual dos dois a sua grava.',
  },
  {
    id: 'bmpcc-4k',
    marca: 'Blackmagic',
    nome: 'Pocket Cinema Camera 4K',
    formatos: [{ nomenclatura: 'blackmagic', noMenu: 'nome fixo: A001_MMDDhhmm_C001' }],
    codecs: [
      'Blackmagic RAW 3:1', 'Blackmagic RAW 5:1', 'Blackmagic RAW 8:1', 'Blackmagic RAW 12:1',
      'Blackmagic RAW Q0', 'Blackmagic RAW Q5',
      'ProRes 422 HQ', 'ProRes 422', 'ProRes 422 LT', 'ProRes 422 Proxy',
    ],
    fps: ['23.98', '24', '25', '29.97', '30', '50', '59.94', '60', '120'],
    resolucoes: ['4K DCI (4096x2160)', '4K UHD (3840x2160)', '2.8K anamórfico (2880x2160)', '2.6K (2688x1512)', 'Full HD (1920x1080)'],
    padrao: { codec: 'Blackmagic RAW 5:1', fps: '24', resolucao: '4K DCI (4096x2160)' },
    observacao: 'A data e a hora do nome são as do começo do clipe: o app mostra o relógio de agora, e o ingest casa pelo resto do nome. 4K DCI vai até 60 fps; 120 só em 2.6K ou HD janelado. A letra da câmera e o reel se mudam no menu de gravação.',
  },
];

export const cameraPorId = (id?: string) => CAMERAS.find(c => c.id === id);

/**
 * O que muda no estado ao escolher a câmera: o modelo, o formato do nome (se o
 * de agora não é dela) e o setup que ela não grava volta para o padrão dela.
 * O que já serve fica — a escolha não desfaz o que o 2º AC acertou.
 */
export function aoEscolherCamera(
  modelo: ModeloDeCamera,
  atual: { nomenclatura: NomenclaturaArquivo; codec?: string; fps?: string; resolucao?: string },
) {
  const temFormato = modelo.formatos.some(f => f.nomenclatura === atual.nomenclatura);
  return {
    modelo_camera: modelo.id,
    nomenclatura: temFormato ? atual.nomenclatura : modelo.formatos[0].nomenclatura,
    codec: atual.codec && modelo.codecs.includes(atual.codec) ? atual.codec : modelo.padrao.codec,
    fps: atual.fps && modelo.fps.includes(atual.fps) ? atual.fps : modelo.padrao.fps,
    resolucao: atual.resolucao && modelo.resolucoes.includes(atual.resolucao) ? atual.resolucao : modelo.padrao.resolucao,
  };
}
