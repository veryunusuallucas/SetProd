import type { SaldoParticipante } from './calculadora';
import { emCentavos, emReais } from './dinheiro';
import { CAIXA_CENTRAL } from './caixaCentral';
import type { QuemTipo } from '../types';

export interface TransacaoSugerida {
  de: { tipo: QuemTipo; id_ref: string };
  para: { tipo: QuemTipo; id_ref: string };
  valor: number;
}

/**
 * Algoritmo Guloso (Greedy) para simplificação de dívidas.
 * Calcula o menor número de transferências para zerar os saldos.
 */
export const simplificarDividas = (saldosDict: Record<string, SaldoParticipante>, modoAcerto: 'direto' | 'centralizado' = 'centralizado'): TransacaoSugerida[] => {
  const devedores: SaldoParticipante[] = [];
  const credores: SaldoParticipante[] = [];
  const transacoes: TransacaoSugerida[] = [];

  // Separar quem deve (saldo negativo) e quem tem a receber (saldo positivo)
  Object.values(saldosDict).forEach(p => {
    // Ignorar a entidade producao/projeto na listagem inicial de pessoas
    if (p.tipo === 'producao') return; 

    /*
      Em centavos inteiros (ROADMAP §10.B): o "saldo_liquido" daqui para baixo
      é centavo, e só as transações que saem voltam para reais. A tolerância de
      0,01 em float engolia dívida de um centavo — e às vezes deixava um credor
      com R$ 0,01 que ninguém pagava.
    */
    const centavos = emCentavos(p.saldo_liquido);
    if (centavos < 0) {
      devedores.push({ ...p, saldo_liquido: -centavos });
    } else if (centavos > 0) {
      credores.push({ ...p, saldo_liquido: centavos });
    }
  });

  if (modoAcerto === 'centralizado') {
    // No modo centralizado, devedores pagam à produção e a produção paga aos credores.
    devedores.forEach(devedor => {
      transacoes.push({
        de: { tipo: devedor.tipo, id_ref: devedor.id_ref },
        para: { tipo: 'producao', id_ref: CAIXA_CENTRAL },
        valor: emReais(devedor.saldo_liquido)
      });
    });

    credores.forEach(credor => {
      transacoes.push({
        de: { tipo: 'producao', id_ref: CAIXA_CENTRAL },
        para: { tipo: credor.tipo, id_ref: credor.id_ref },
        valor: emReais(credor.saldo_liquido)
      });
    });
    
    return transacoes;
  }

  // MODO DIRETO (Splitwise-like)
  // Ordenar para otimizar: os maiores devedores pagam aos maiores credores primeiro
  devedores.sort((a, b) => b.saldo_liquido - a.saldo_liquido);
  credores.sort((a, b) => b.saldo_liquido - a.saldo_liquido);

  let i = 0; // index devedores
  let j = 0; // index credores

  while (i < devedores.length && j < credores.length) {
    const devedor = devedores[i];
    const credor = credores[j];

    const valorTransferencia = Math.min(devedor.saldo_liquido, credor.saldo_liquido);

    if (valorTransferencia > 0) {
      transacoes.push({
        de: { tipo: devedor.tipo, id_ref: devedor.id_ref },
        para: { tipo: credor.tipo, id_ref: credor.id_ref },
        valor: emReais(valorTransferencia)
      });
    }

    devedor.saldo_liquido -= valorTransferencia;
    credor.saldo_liquido -= valorTransferencia;

    if (devedor.saldo_liquido <= 0) i++;
    if (credor.saldo_liquido <= 0) j++;
  }

  return transacoes;
};
