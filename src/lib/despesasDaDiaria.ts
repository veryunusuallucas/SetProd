import type { Despesa } from '../types';

/**
 * Quais despesas são de uma diária — e por que isso virou uma função.
 *
 * ⚠️ EXISTEM DOIS CAMPOS, E SÓ UM DELES É UM VÍNCULO.
 *
 *   `diaria_id`  o id da diária. É este que vale.
 *   `diaria`     o NOME dela, escrito para aparecer na lista: "Diária 3",
 *                "Geral", "Pré-produção". É rótulo, não chave.
 *
 * A lista de diárias filtrava por `despesa.diaria === diaria.id`, comparando o
 * texto "Diária 3" com um UUID. Nunca dava certo: todo cartão mostrava
 * R$ 0,00 em gastos, mesmo com despesas lançadas — enquanto a tela de dentro da
 * diária, que filtrava por `diaria_id`, mostrava o valor certo. As duas telas
 * discordavam sobre o mesmo dia, e a de fora é a que se olha primeiro.
 *
 * O `diaria` continua sendo aceito aqui como chave por causa de dados antigos:
 * antes de o `diaria_id` existir, houve lançamento com o id guardado nele. Não
 * custa nada aceitar os dois na leitura, e custa uma despesa sumida não aceitar.
 * Escrever, só em `diaria_id`.
 */
export function despesasDaDiaria(despesas: Despesa[], diariaId: string): Despesa[] {
  return despesas.filter(d => d.diaria_id === diariaId || d.diaria === diariaId);
}

/** O total gasto numa diária, em reais. */
export function totalDaDiaria(despesas: Despesa[], diariaId: string): number {
  return despesasDaDiaria(despesas, diariaId).reduce((soma, d) => soma + (d.valor_total || 0), 0);
}
