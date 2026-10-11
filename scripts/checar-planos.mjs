/**
 * Confere a ordem dos planos (`reordenarPlanos`, `proximoNumeroDePlano`) e a
 * troca de ordem das cenas no set (`cenaPulada`, `trocarDeLugar`, `reordenarCenas`).
 *
 *   node scripts/checar-planos.mjs
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { reordenarPlanos, proximoNumeroDePlano, compararNumeroDePlano } = await vite.ssrLoadModule('/src/lib/decupagem.ts');
  const p = (id, numero) => ({ id, numero });
  const cena = [p('a', '2'), p('b', '3'), p('c', '4'), p('d', '5')];

  // O último sobe para o topo: os números 2..5 continuam, e ele vira o 2.
  assert.deepEqual(reordenarPlanos(cena, 3, 0), [
    { id: 'd', numero: '2' }, { id: 'a', numero: '3' }, { id: 'b', numero: '4' }, { id: 'c', numero: '5' },
  ]);
  // Trocar dois vizinhos mexe só nos dois.
  assert.deepEqual(reordenarPlanos(cena, 1, 2), [{ id: 'c', numero: '3' }, { id: 'b', numero: '4' }]);
  assert.deepEqual(reordenarPlanos(cena, 2, 2), []);

  assert.equal(proximoNumeroDePlano(['1', '2', '4']), '5', 'depois de apagar um, não repete o número');
  assert.equal(proximoNumeroDePlano([]), '1');
  assert.equal(proximoNumeroDePlano(['3A', '10']), '11');
  assert.deepEqual(['10', '3A', '3', '2'].sort(compararNumeroDePlano), ['2', '3', '3A', '10']);

  // Quando o set muda a ordem: a troca na hora e o arrastar do fechamento.
  const { cenaPulada, trocarDeLugar, reordenarCenas } = await vite.ssrLoadModule('/src/lib/linhaDoDia.ts');
  const dia = [
    { id: 'cafe', tipo: 'coffee', hora_real: '07:45' }, { id: 'c1', tipo: 'cena', hora_real: '08:45' },
    { id: 'c2', tipo: 'cena' }, { id: 'alm', tipo: 'almoco' }, { id: 'c4', tipo: 'cena' }, { id: 'c5', tipo: 'cena' },
  ];
  const ids = l => l.map(i => i.id);
  assert.equal(cenaPulada(dia, 'c4')?.id, 'c2', 'a 4 começou antes da 2');
  assert.equal(cenaPulada(dia, 'c2'), undefined, 'a 2 é a próxima: nada a perguntar');
  assert.equal(cenaPulada(dia, 'alm'), undefined, 'só cena pergunta');
  assert.deepEqual(ids(trocarDeLugar(dia, 'c4', 'c2')), ['cafe', 'c1', 'c4', 'alm', 'c2', 'c5']);
  assert.deepEqual(ids(reordenarCenas(dia, ['c1', 'c5', 'c2', 'c4'])), ['cafe', 'c1', 'c5', 'alm', 'c2', 'c4'], 'o almoço fica no lugar');
  assert.deepEqual(ids(reordenarCenas(dia, ['c4', 'c2'])), ['cafe', 'c1', 'c4', 'alm', 'c2', 'c5'], 'só quem está na lista se mexe');
  // A trava de horário fica no lugar: a cena que entra às 13h15 herda o 13h15.
  const travado = dia.map(i => (i.id === 'c4' ? { ...i, hora_travada: '13:15' } : i));
  const trocado = trocarDeLugar(travado, 'c4', 'c2');
  assert.equal(trocado.find(i => i.id === 'c2').hora_travada, '13:15');
  assert.equal(trocado.find(i => i.id === 'c4').hora_travada, undefined);
  assert.equal(reordenarCenas(travado, ['c4', 'c2']).find(i => i.id === 'c2').hora_travada, '13:15');

  // A Logagem sugere o status da cena pelos planos que rodaram.
  const { planosNaLogagem, sugestaoPelosPlanos } = await vite.ssrLoadModule('/src/lib/registroSet.ts');
  const c4 = { id: 'c4', numero: '4' };
  const planosC4 = [{ id: 'p1', numero: '1' }, { id: 'p2', numero: '2' }];
  const tk = (extra) => ({ cena: '4', plano: '1', status: 'OK', ...extra });
  assert.deepEqual(planosNaLogagem(c4, planosC4, [{}], [tk({ plano_id: 'p1' }), tk({ plano: '2', status: 'NEUTRO' })]), { feitos: 2, total: 2 }, 'NEUTRO conta como rodou');
  assert.deepEqual(planosNaLogagem(c4, planosC4, [{}], [tk({ plano_id: 'p1' }), tk({ plano: '2', status: 'NG' })]), { feitos: 1, total: 2 }, 'NG não conta');
  assert.deepEqual(planosNaLogagem(c4, planosC4, [{ planos_ids: ['p1'] }], [tk({ plano_id: 'p1' })]), { feitos: 1, total: 1 }, 'só os planos do trecho do dia');
  assert.deepEqual(planosNaLogagem(c4, planosC4, [{}], [tk({ cena: '5' })]), { feitos: 0, total: 2 }, 'take de outra cena não conta');
  assert.equal(sugestaoPelosPlanos(2, 2), 'gravada');
  assert.equal(sugestaoPelosPlanos(2, 1), 'parcial');

  console.log('planos ok');
} finally {
  await vite.close();
}
