import { numero } from './formato';

/**
 * As mensagens que o Acertos gera para cobrar e para avisar de repasse.
 *
 * Antes cada tela tinha a sua cópia do texto padrão e da troca das variáveis
 * (Acertos e a ficha da pessoa), e o valor saía "19.22" — com ponto, fora do
 * formato brasileiro do resto do app. Agora é um lugar só.
 */

/** As variáveis que um modelo pode usar — viram botões no editor. */
export const VARIAVEIS_DA_MENSAGEM = [
  { chave: 'nome', rotulo: 'Nome' },
  { chave: 'valor', rotulo: 'Valor' },
  { chave: 'projeto', rotulo: 'Produção' },
  { chave: 'funcao', rotulo: 'Função' },
  { chave: 'pix', rotulo: 'PIX do caixa' },
] as const;

export const MODELO_COBRANCA_PADRAO =
  'Olá {{nome}}! No projeto {{projeto}}, seu saldo ficou em R$ {{valor}} a pagar para a Produção.\nChave PIX para pagamento: {{pix}}';

export const MODELO_REPASSE_PADRAO =
  'Olá {{nome}}! A Produção vai te repassar R$ {{valor}} referente ao projeto {{projeto}}.';

/** Troca as variáveis do modelo pelos dados da pessoa. */
export function preencherMensagem(modelo: string, dados: {
  nome: string; valor: number; projeto: string; funcao?: string; pix?: string;
}): string {
  const pix = dados.pix || '(PIX do caixa não definido)';
  return modelo
    .replace(/\{\{\s*nome\s*\}\}/gi, dados.nome)
    .replace(/\{\{\s*valor\s*\}\}/gi, numero(dados.valor))
    .replace(/\{\{\s*projeto\s*\}\}/gi, dados.projeto)
    .replace(/\{\{\s*funcao\s*\}\}/gi, dados.funcao || '')
    .replace(/\{\{\s*pix\s*\}\}/gi, pix)
    // Modelos muito antigos usavam colchetes.
    .replace(/\[nome\]/gi, dados.nome)
    .replace(/\[valor\]/gi, numero(dados.valor));
}
