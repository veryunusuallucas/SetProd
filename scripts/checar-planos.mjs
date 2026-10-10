/**
 * Confere a ordem dos planos (`reordenarPlanos`, `proximoNumeroDePlano`) e a
 * ordem em que as cenas foram gravadas (`ordemDeGravacao`).
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

  // A ordem gravada: a lista manda; cena nova vai para o fim; id sumido some.
  const { ordemDeGravacao } = await vite.ssrLoadModule('/src/lib/linhaDoDia.ts');
  const dia = [{ id: 'cafe', tipo: 'coffee' }, { id: 'c2', tipo: 'cena' }, { id: 'c4', tipo: 'cena' }, { id: 'c5', tipo: 'cena' }, { id: 'c6', tipo: 'cena' }];
  const ids = l => l.map(i => i.id);
  assert.deepEqual(ids(ordemDeGravacao(dia)), ['c2', 'c4', 'c5', 'c6'], 'sem lista é o plano, só cenas');
  assert.deepEqual(ids(ordemDeGravacao(dia, ['c4', 'c2', 'sumiu'])), ['c4', 'c2', 'c5', 'c6']);

  console.log('planos ok');
} finally {
  await vite.close();
}
