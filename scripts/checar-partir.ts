// Checagem de partir e juntar trechos de cena: `npx tsx scripts/checar-partir.ts`
import assert from 'node:assert/strict';
import { partirItemDeCena, juntarComVizinho, planosDoTrecho } from '../src/lib/partirCena.ts';

const planos = [1, 2, 3, 4, 5, 6].map(n => ({ id: `p${n}`, numero: String(n) })) as never[];
const cena = { id: 'c3', tipo: 'cena', cena_id: 'cena3', duracao_min: 225 } as never;

// Cena 3 → plano 1 | planos 2–6 → plano 1 | 2–3 | 4–6 (o caso do Lucas).
const [a, b] = partirItemDeCena(cena, planos, 0, 225);
const [b1, b2] = partirItemDeCena(b, planosDoTrecho(b, planos), 1, b.duracao_min!);
assert.deepEqual([a, b1, b2].map(t => t.planos_ids), [['p1'], ['p2', 'p3'], ['p4', 'p5', 'p6']]);
assert.equal(a.duracao_min! + b1.duracao_min! + b2.duracao_min!, 225, 'a duração não some nem dobra');

// Com o almoço no meio: juntar o 2–3 com o 4–6 volta a 2–6, e o plano 1 fica.
const almoco = { id: 'alm', tipo: 'refeicao' } as never;
let linha = [a, almoco, b1, b2];
linha = juntarComVizinho(linha, b1.id, planos);
assert.equal(linha.length, 3);
assert.deepEqual(linha[2].planos_ids, ['p2', 'p3', 'p4', 'p5', 'p6']);
// O último trecho junta com o anterior; tudo junto volta a ser a cena inteira.
linha = juntarComVizinho(linha, linha[2].id, planos);
assert.deepEqual(linha.map(i => i.id), [cena['id' as never], 'alm']);
assert.equal(linha[0].planos_ids, undefined);
assert.equal(linha[0].duracao_min, 225);

// Sem decupagem: A + B volta a ser a cena inteira.
const [x, y] = partirItemDeCena(cena, [], 0, 60);
const junto = juntarComVizinho([x, y], y.id, []);
assert.equal(junto.length, 1);
assert.equal(junto[0].parte, undefined);
console.log('partir e juntar: ok');
