// Checagem da ordem alfabética: `npx tsx scripts/checar-ordem.ts`
import assert from 'node:assert/strict';
import { emOrdem, nomeCompleto } from '../src/lib/ordem.ts';

const nomes = ['Zé', 'ana', 'Ângela', 'Maíra Franco', 'Marco Pena', 'Lucas Viol', 'Lau Lopes', 'Laura Bretas'];
assert.deepEqual(emOrdem(nomes, n => n), ['ana', 'Ângela', 'Lau Lopes', 'Laura Bretas', 'Lucas Viol', 'Maíra Franco', 'Marco Pena', 'Zé']);
assert.deepEqual(emOrdem(['Van 10', 'Van 2'], n => n), ['Van 2', 'Van 10'], 'número como número');
const original = ['b', 'a'];
emOrdem(original, n => n);
assert.deepEqual(original, ['b', 'a'], 'não mexe na lista original');
assert.equal(nomeCompleto({ nome: 'Rebeca' }), 'Rebeca');
console.log('ordem: ok');
