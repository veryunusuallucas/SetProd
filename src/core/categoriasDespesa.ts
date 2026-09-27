/**
 * As categorias de gasto de uma produção.
 *
 * As seis primeiras são as antigas e ficam no começo de propósito: são as mais
 * lançadas, e mudar a ordem obrigaria a reaprender onde cada uma está. As
 * novas cobrem o que antes caía tudo em "Outro" — e "Outro" continua por
 * último, como saída para o que não se encaixa.
 */
export const CATEGORIAS_DESPESA: { id: string; label: string; emoji: string; aposentada?: boolean }[] = [
  { id: 'transporte', label: 'Transporte', emoji: '🚗' },
  { id: 'alimentacao', label: 'Alimentação', emoji: '🍔' },
  { id: 'moradia', label: 'Moradia', emoji: '🏨' },
  { id: 'equipamento', label: 'Equipamento', emoji: '🎥' },
  { id: 'arte', label: 'Arte', emoji: '🎨', aposentada: true },
  { id: 'elenco', label: 'Elenco', emoji: '🎭', aposentada: true },
  { id: 'equipe', label: 'Cachês', emoji: '💼' },
  { id: 'locacao', label: 'Locação', emoji: '🏠' },
  { id: 'figurino', label: 'Figurino', emoji: '👗', aposentada: true },
  { id: 'maquiagem', label: 'Maquiagem', emoji: '💄', aposentada: true },
  { id: 'som', label: 'Som', emoji: '🎙️', aposentada: true },
  { id: 'luz', label: 'Luz e Elétrica', emoji: '💡', aposentada: true },
  { id: 'pos', label: 'Pós-produção', emoji: '🎞️', aposentada: true },
  { id: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { id: 'seguro', label: 'Seguro e Taxas', emoji: '📋' },
  { id: 'producao', label: 'Produção', emoji: '📌', aposentada: true },
  { id: 'outro', label: 'Outro', emoji: '📄' },
];

export type CategoriaDespesa = (typeof CATEGORIAS_DESPESA)[number];

/**
 * OS TIPOS QUE REPETIAM O NOME DE UM DEPARTAMENTO SAÍRAM DA ESCOLHA
 * (decisão do Lucas, 27/09/2026 — leva 4, decisão A).
 *
 * Arte, Elenco, Figurino, Maquiagem, Som, Luz, Pós e Produção eram, ao mesmo
 * tempo, tipo de gasto e departamento — e no formulário apareciam lado a lado.
 * Um microfone lançado com o tipo "Som" e o departamento "Fotografia" não
 * aparecia no painel do Som, e quem lançou tinha certeza de ter escolhido Som.
 *
 * O departamento responde "de quem é". O tipo fica com o que atravessa as
 * áreas. `aposentada` NÃO apaga nada: a despesa antiga continua com o tipo
 * que tinha, com nome e ícone — só não é mais oferecida como opção nova.
 */
export const CATEGORIAS_ATIVAS = CATEGORIAS_DESPESA.filter(c => !c.aposentada);

/** O nome da categoria como a tela mostra. Id desconhecido volta como veio. */
export function rotuloDaCategoria(id: string): string {
  const c = CATEGORIAS_DESPESA.find(c => c.id === id);
  return c ? c.label : id;
}
