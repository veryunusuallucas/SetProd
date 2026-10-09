/**
 * Confere a ordem dos planos (`reordenarPlanos`, `proximoNumeroDePlano`).
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

  console.log('planos ok');
} finally {
  await vite.close();
}
