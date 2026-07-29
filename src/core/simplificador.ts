import type { SaldoParticipante } from './calculadora';
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

    if (p.saldo_liquido < -0.01) {
      devedores.push({ ...p, saldo_liquido: Math.abs(p.saldo_liquido) });
    } else if (p.saldo_liquido > 0.01) {
      credores.push({ ...p });
    }
  });

  if (modoAcerto === 'centralizado') {
    // No modo centralizado, devedores pagam à produção e a produção paga aos credores.
    devedores.forEach(devedor => {
      transacoes.push({
        de: { tipo: devedor.tipo, id_ref: devedor.id_ref },
        para: { tipo: 'producao', id_ref: 'caixa_central' },
        valor: Math.round(devedor.saldo_liquido * 100) / 100
      });
    });

    credores.forEach(credor => {
      transacoes.push({
        de: { tipo: 'producao', id_ref: 'caixa_central' },
        para: { tipo: credor.tipo, id_ref: credor.id_ref },
        valor: Math.round(credor.saldo_liquido * 100) / 100
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

    if (valorTransferencia > 0.01) {
      transacoes.push({
        de: { tipo: devedor.tipo, id_ref: devedor.id_ref },
        para: { tipo: credor.tipo, id_ref: credor.id_ref },
        valor: Math.round(valorTransferencia * 100) / 100
      });
    }

    devedor.saldo_liquido -= valorTransferencia;
    credor.saldo_liquido -= valorTransferencia;

    if (devedor.saldo_liquido <= 0.01) i++;
    if (credor.saldo_liquido <= 0.01) j++;
  }

  return transacoes;
};
