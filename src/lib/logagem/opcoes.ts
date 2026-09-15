/**
 * As listas dos seletores da Logagem, as mesmas do Lumavi (`OPTIONS`).
 *
 * São listas de SUGESTÃO, não de proibição: o set sempre tem a câmera que
 * ninguém previu. Por isso cada seletor da tela aceita também "outro valor".
 */
export const OPCOES = {
  posicao: ['C', 'L', 'R'],
  fps: ['23.98', '24', '25', '29.97', '30', '48', '50', '59.94', '60', '100', '120'],
  resolucao: ['4K UHD (3840x2160)', '4K DCI (4096x2160)', '6K (6048x3402)', 'Full HD (1920x1080)', 'HD (1280x720)'],
  codec: ['XAVC S-I', 'XAVC S', 'XAVC HS', 'ProRes 422 HQ', 'ProRes 4444', 'H.264', 'RAW'],
  wb: ['Auto', '3200K', '4300K', '5500K', '5600K', '6500K'],
  shutter: ['180°', '172.8°', '90°', '45°', '1/48', '1/50', '1/60', '1/100', '1/125', '1/250'],
  iso: ['100', '200', '400', '640', '800', '1250', '2500', '3200', '6400', '12800'],
  ambiente: ['INT', 'EXT', 'ESTÚDIO', 'VEÍCULO'],
  luz: ['DIA', 'NOITE', 'MISTA', 'PRÁTICA'],
  audio: ['GUIA', 'DIRETO', 'PLUGADO', 'MOS'],
  nd: ['Clear', '0.6 (2 Stops)', '1.2 (4 Stops)', '1.8 (6 Stops)', '2.1 (7 Stops)'],
} as const;
