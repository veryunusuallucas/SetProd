/**
 * O caixa da produção, como "pessoa" nas despesas e nos acertos.
 *
 * `QuemValor.id_ref` aponta para uma ficha, um departamento — ou para isto,
 * que não é ficha nenhuma: é a produção pagando ou recebendo. Era uma string
 * solta em mais de quarenta lugares (ROADMAP §10.C); um erro de digitação num
 * deles bastava para o dinheiro da produção virar dinheiro de "ninguém" no
 * cálculo de saldos, sem erro nenhum.
 *
 * O valor gravado continua 'caixa_central': é o que está em todas as despesas
 * que já existem, aqui e no servidor.
 */
export const CAIXA_CENTRAL = 'caixa_central' as const;
