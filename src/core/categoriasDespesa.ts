/**
 * As categorias de gasto de uma produção.
 *
 * As seis primeiras são as antigas e ficam no começo de propósito: são as mais
 * lançadas, e mudar a ordem obrigaria a reaprender onde cada uma está. As
 * novas cobrem o que antes caía tudo em "Outro" — e "Outro" continua por
 * último, como saída para o que não se encaixa.
 */
export const CATEGORIAS_DESPESA = [
  { id: 'transporte', label: 'Transporte', emoji: '🚗' },
  { id: 'alimentacao', label: 'Alimentação', emoji: '🍔' },
  { id: 'moradia', label: 'Moradia', emoji: '🏨' },
  { id: 'equipamento', label: 'Equipamento', emoji: '🎥' },
  { id: 'arte', label: 'Arte', emoji: '🎨' },
  { id: 'elenco', label: 'Elenco', emoji: '🎭' },
  { id: 'equipe', label: 'Cachês', emoji: '💼' },
  { id: 'locacao', label: 'Locação', emoji: '🏠' },
  { id: 'figurino', label: 'Figurino', emoji: '👗' },
  { id: 'maquiagem', label: 'Maquiagem', emoji: '💄' },
  { id: 'som', label: 'Som', emoji: '🎙️' },
  { id: 'luz', label: 'Luz e Elétrica', emoji: '💡' },
  { id: 'pos', label: 'Pós-produção', emoji: '🎞️' },
  { id: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { id: 'seguro', label: 'Seguro e Taxas', emoji: '📋' },
  { id: 'producao', label: 'Produção', emoji: '📌' },
  { id: 'outro', label: 'Outro', emoji: '📄' },
];

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

/** O nome da categoria como a tela mostra. Id desconhecido volta como veio. */
export function rotuloDaCategoria(id: string): string {
  const c = CATEGORIAS_DESPESA.find(c => c.id === id);
  return c ? c.label : id;
}
