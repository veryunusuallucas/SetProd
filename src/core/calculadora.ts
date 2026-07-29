import type { Despesa, Acerto, QuemTipo } from '../types';

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

  // 1. Processar Despesas
  despesas.forEach(despesa => {
    // Computar quem pagou (credor da despesa)
    despesa.pagadores.forEach(pagador => {
      const chave = initParticipante(pagador.tipo, pagador.id_ref);
      saldos[chave].total_pago += pagador.valor;
      saldos[chave].saldo_liquido += pagador.valor;
    });

    // Computar quem deve (devedor da despesa)
    despesa.devedores.forEach(devedor => {
      const chave = initParticipante(devedor.tipo, devedor.id_ref);
      saldos[chave].total_devido += devedor.valor;
      saldos[chave].saldo_liquido -= devedor.valor;
    });
  });

  // 2. Processar Acertos (pagamentos já realizados para abater dívidas)
  acertos.forEach(acerto => {
    if (acerto.status === 'confirmado') {
      const chaveDe = initParticipante(acerto.de.tipo, acerto.de.id_ref);
      const chavePara = initParticipante(acerto.para.tipo, acerto.para.id_ref);

      // Quem pagou o acerto reduz a sua dívida (saldo líquido aumenta)
      saldos[chaveDe].saldo_liquido += acerto.valor;
      
      // Quem recebeu o acerto reduz o seu crédito (saldo líquido diminui)
      saldos[chavePara].saldo_liquido -= acerto.valor;
    }
  });

  // Arredondamento para evitar problemas de precisão de float no JS
  Object.keys(saldos).forEach(chave => {
    saldos[chave].saldo_liquido = Math.round(saldos[chave].saldo_liquido * 100) / 100;
    saldos[chave].total_pago = Math.round(saldos[chave].total_pago * 100) / 100;
    saldos[chave].total_devido = Math.round(saldos[chave].total_devido * 100) / 100;
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

  despesas.forEach(despesa => {
    despesa.devedores
      .filter(d => d.tipo === tipo && d.id_ref === id_ref)
      .forEach(d => {
        total_deve += d.valor;
        linhas.push({
          despesa_id: despesa.id,
          descricao: despesa.descricao,
          categoria: despesa.categoria,
          diaria: despesa.diaria,
          valor: Math.round(d.valor * 100) / 100,
          tipo: 'deve',
        });
      });

    despesa.pagadores
      .filter(p => p.tipo === tipo && p.id_ref === id_ref)
      .forEach(p => {
        total_adiantou += p.valor;
        linhas.push({
          despesa_id: despesa.id,
          descricao: despesa.descricao,
          categoria: despesa.categoria,
          diaria: despesa.diaria,
          valor: Math.round(p.valor * 100) / 100,
          tipo: 'adiantou',
        });
      });
  });

  return {
    linhas,
    total_deve: Math.round(total_deve * 100) / 100,
    total_adiantou: Math.round(total_adiantou * 100) / 100,
    saldo: Math.round((total_adiantou - total_deve) * 100) / 100,
  };
};
