// Checagem das tentativas de busca de endereço: `npx tsx scripts/checar-geocodificar.ts`
import assert from 'node:assert/strict';
import { tentativasDeBusca, ehLinkCurtoDoGoogle } from '../src/lib/geocodificar.ts';

// O endereço da PUC (Diária 1 da Canção): só a última achou o número no OSM, que chama a rua de "Avenida".
assert.deepEqual(tentativasDeBusca('R. Dom José Gaspar, 500 - Prédio 30 - Coração Eucarístico, Belo Horizonte - MG, 30535-000'), [
  'R. Dom José Gaspar, 500 - Prédio 30 - Coração Eucarístico, Belo Horizonte - MG, 30535-000',
  'Rua Dom José Gaspar, 500 - Coração Eucarístico, Belo Horizonte - MG',
  'Rua Dom José Gaspar, 500, Belo Horizonte - MG',
  'Dom José Gaspar, 500, Belo Horizonte - MG',
]);
assert.deepEqual(tentativasDeBusca('Rua Dom José Gaspar, 500'), ['Rua Dom José Gaspar, 500'], 'sem cidade não inventa');
assert.ok(!tentativasDeBusca('Av. Paulista, 1578, São Paulo - SP, 01310-200').some(t => /^\d{5}/.test(t)), 'CEP sozinho nunca');
assert.ok(ehLinkCurtoDoGoogle('https://maps.app.goo.gl/Gncgz3fMh6BbnD6T6'));
assert.ok(!ehLinkCurtoDoGoogle('https://www.google.com/maps/@-19.92,-43.99,17z'));
console.log('geocodificar: ok');
