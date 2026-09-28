import { db } from '../db/db';

/**
 * O saldo inicial vira uma entrada comum (leva 4, decisão C do Lucas,
 * 27/09/2026).
 *
 * `Projeto.saldo_inicial` era de uma versão antiga: entrava na conta do saldo,
 * mas nenhuma tela o editava desde que as entradas passaram a existir. Quem o
 * tinha não conseguia corrigir; quem não tinha nunca ia ter. Virando entrada,
 * ele aparece em Lançamentos e se edita como qualquer outra.
 *
 * No banco de produção, em 27/09/2026, nenhuma das 6 produções tinha saldo
 * inicial — isto existe para a produção que só mora num aparelho.
 *
 * O id é FIXO por produção (`saldo-inicial-<id>`): dois aparelhos convertendo
 * ao mesmo tempo gravam a MESMA entrada, e não duas. E é numa transação: entre
 * criar a entrada e zerar o saldo, nenhuma tela chega a contar os dois.
 */
export async function converterSaldoInicial(projetoId: string): Promise<boolean> {
  return db.transaction('rw', db.projetos, db.aportes, async () => {
    const projeto = await db.projetos.get(projetoId);
    const valor = projeto?.saldo_inicial || 0;
    if (!projeto || valor <= 0) return false;

    await db.aportes.put({
      id: `saldo-inicial-${projetoId}`,
      projeto_id: projetoId,
      origem: 'Saldo inicial',
      valor,
      data: projeto.data_criacao || Date.now(),
      obs: 'Era o "saldo inicial" da configuração da produção.',
    });
    await db.projetos.update(projetoId, { saldo_inicial: 0 });
    return true;
  });
}
