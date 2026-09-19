import type { Despesa, Acerto, QuemTipo } from '../types';
import { emCentavos, emReais, fecharNoTotal } from './dinheiro';

export interface SaldoParticipante {
  tipo: QuemTipo;
  id_ref: string;
  total_pago: number;
  total_devido: number;
  saldo_liquido: number; // Positivo = a receber, Negativo = a pagar
}

/**
 * Retorna uma chave única para identificar o participante independente do tipo.
 */
export const getChaveParticipante = (tipo: QuemTipo, id_ref: string) => `${tipo}::${id_ref}`;

/**
 * Calcula o saldo de cada participante com base na lista de despesas e acertos já realizados.
 *
 * EM CENTAVOS INTEIROS (ROADMAP §10.B): a soma acontece em inteiros, e cada
 * despesa fecha no próprio total antes de entrar — inclusive as antigas, cujo
 * rateio gravou 14,285714… por pessoa. Ver `core/dinheiro.ts`. Só a saída
 * volta para reais.
 */
export const calcularSaldos = (despesas: Despesa[], acertos: Acerto[]): Record<string, SaldoParticipante> => {
  const saldos: Record<string, SaldoParticipante> = {};

  const initParticipante = (tipo: QuemTipo, id_ref: string) => {
    const chave = getChaveParticipante(tipo, id_ref);
    if (!saldos[chave]) {
      saldos[chave] = { tipo, id_ref, total_pago: 0, total_devido: 0, saldo_liquido: 0 };
    }
    return chave;
  };

  // 1. Processar Despesas — cada lista fechada no total da despesa, em centavos
  despesas.forEach(despesa => {
    const pagos = fecharNoTotal(despesa.pagadores.map(p => p.valor), despesa.valor_total);
    const devidos = fecharNoTotal(despesa.devedores.map(d => d.valor), despesa.valor_total);

    // Computar quem pagou (credor da despesa)
    despesa.pagadores.forEach((pagador, i) => {
      const chave = initParticipante(pagador.tipo, pagador.id_ref);
      saldos[chave].total_pago += pagos[i];
      saldos[chave].saldo_liquido += pagos[i];
    });

    // Computar quem deve (devedor da despesa)
    despesa.devedores.forEach((devedor, i) => {
      const chave = initParticipante(devedor.tipo, devedor.id_ref);
      saldos[chave].total_devido += devidos[i];
      saldos[chave].saldo_liquido -= devidos[i];
    });
  });

  // 2. Processar Acertos (pagamentos já realizados para abater dívidas)
  acertos.forEach(acerto => {
    if (acerto.status === 'confirmado') {
      const chaveDe = initParticipante(acerto.de.tipo, acerto.de.id_ref);
      const chavePara = initParticipante(acerto.para.tipo, acerto.para.id_ref);

      // Quem pagou o acerto reduz a sua dívida (saldo líquido aumenta)
      saldos[chaveDe].saldo_liquido += emCentavos(acerto.valor);
      
      // Quem recebeu o acerto reduz o seu crédito (saldo líquido diminui)
      saldos[chavePara].saldo_liquido -= emCentavos(acerto.valor);
    }
  });

  // A conta foi toda em centavos; a saída volta para reais, exata.
  Object.keys(saldos).forEach(chave => {
    saldos[chave].saldo_liquido = emReais(saldos[chave].saldo_liquido);
    saldos[chave].total_pago = emReais(saldos[chave].total_pago);
    saldos[chave].total_devido = emReais(saldos[chave].total_devido);
  });

  return saldos;
};

export interface LinhaDetalhe {
  despesa_id: string;
  descricao: string;
  categoria: string;
  diaria?: string;
  valor: number; // valor absoluto envolvido nessa despesa para o participante
  tipo: 'deve' | 'adiantou'; // 'deve' aumenta a dívida, 'adiantou' é crédito
}

/**
 * Retorna a lista detalhada de despesas que compõem o saldo de um participante,
 * separando o que ele deve (devedor) do que ele adiantou (pagador).
 */
export const detalharParticipante = (
  despesas: Despesa[],
  tipo: QuemTipo,
  id_ref: string
): { linhas: LinhaDetalhe[]; total_deve: number; total_adiantou: number; saldo: number } => {
  const linhas: LinhaDetalhe[] = [];
  let total_deve = 0;
  let total_adiantou = 0;

  // Em centavos, e com cada despesa fechada no total — a mesma conta de
  // `calcularSaldos`, senão a ficha de alguém diria um saldo e os acertos outro.
  despesas.forEach(despesa => {
    const devidos = fecharNoTotal(despesa.devedores.map(d => d.valor), despesa.valor_total);
    const pagos = fecharNoTotal(despesa.pagadores.map(p => p.valor), despesa.valor_total);

    despesa.devedores.forEach((d, i) => {
      if (d.tipo !== tipo || d.id_ref !== id_ref) return;
      total_deve += devidos[i];
      linhas.push({
        despesa_id: despesa.id,
        descricao: despesa.descricao,
        categoria: despesa.categoria,
        diaria: despesa.diaria,
        valor: emReais(devidos[i]),
        tipo: 'deve',
      });
    });

    despesa.pagadores.forEach((p, i) => {
      if (p.tipo !== tipo || p.id_ref !== id_ref) return;
      total_adiantou += pagos[i];
      linhas.push({
        despesa_id: despesa.id,
        descricao: despesa.descricao,
        categoria: despesa.categoria,
        diaria: despesa.diaria,
        valor: emReais(pagos[i]),
        tipo: 'adiantou',
      });
    });
  });

  return {
    linhas,
    total_deve: emReais(total_deve),
    total_adiantou: emReais(total_adiantou),
    saldo: emReais(total_adiantou - total_deve),
  };
};
