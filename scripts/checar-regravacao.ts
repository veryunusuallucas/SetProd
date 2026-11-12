// Regravação na Ordem do Dia (PLANO-reshoot, 11/11/2026).
import assert from 'node:assert/strict';
import { candidatasARegravar, cenasForaDoStripboard, historicoDaCena, marcaDaCena } from '../src/lib/regravacao';
import { diferencaDeCenas } from '../src/lib/sincronizaOD';
import { cenasDaQuebra, montarLinha } from '../src/lib/stripboard';
import type { Cena, Diaria, RegistroCena, StripboardItem } from '../src/types';

const cena = (id: string, numero: string, ordem: number) => ({ id, numero, ordem, descricao: `Cena ${numero}`, projeto_id: 'p' }) as unknown as Cena;
const c14 = cena('c14', '14', 1), c20 = cena('c20', '20', 3), c30 = cena('c30', '30', 5);
const d03 = { id: 'd03', numero: 3, data: '2026-03-12', fechada: true, cena_ids: ['c14'] } as unknown as Diaria;
const d07 = {
  id: 'd07', numero: 7, data: '2026-03-20', cena_ids: ['c20', 'c14'], stripboard_item_id: 'q2',
  cenas_no_dia: { c14: { motivo: 'regravacao', diaria_origem_id: 'd03', observacao: 'foco errado' } },
} as unknown as Diaria;
const diarias = [d03, d07];

// A marca que a OD imprime, em texto.
assert.equal(marcaDaCena(d07, 'c14', diarias), 'REGRAVAÇÃO (da Diária 03) — "foco errado"');
assert.equal(marcaDaCena(d07, 'c20', diarias), undefined);
assert.equal(marcaDaCena(d03, 'c14', diarias), undefined, 'a diária de origem fica intocada');
assert.equal(marcaDaCena({ cenas_no_dia: { c1: { motivo: 'pickup' } } }, 'c1', []), 'COMPLEMENTO');

// Candidatas: a que rodou numa diária fechada (ou passada, ou marcada gravada) vem com a origem.
const d08 = { id: 'd08', numero: 8, data: '2026-03-25', cena_ids: [] } as unknown as Diaria;
const r = candidatasARegravar([c14, c20, c30], diarias, [], d08, '2026-03-15');
assert.deepEqual(r.gravadas.map(g => [g.cena.id, g.origem.id, g.vezes]), [['c14', 'd03', 1]]);
assert.deepEqual(r.outras.map(c => c.id), ['c20', 'c30'], 'a d07 ainda não rodou: a 20 não é candidata');
const marcada = [{ diaria_id: 'd07', cena_id: 'c20', status: 'gravada' }] as RegistroCena[];
assert.ok(candidatasARegravar([c20], diarias, marcada, d08, '2026-03-15').gravadas.length === 1, 'marcada gravada conta');
assert.equal(candidatasARegravar([c14], diarias, [], d07, '2026-03-15').gravadas.length, 0, 'a que já está no dia não aparece');

// O espelho do stripboard não tira a cena que voltou (ela vive fora dele).
assert.deepEqual(cenasForaDoStripboard(d07), ['c14']);
const itens = [
  { id: 'q1', projeto_id: 'p', tipo: 'DAY_BREAK', ordem: 2 },
  { id: 'q2', projeto_id: 'p', tipo: 'DAY_BREAK', ordem: 4 },
] as StripboardItem[];
const doBloco = cenasDaQuebra(montarLinha([c14, c20, c30], itens), 'q2')!.map(c => c.id);
assert.ok(!doBloco.includes('c14'), 'no stripboard a 14 continua no dia dela');
assert.deepEqual(diferencaDeCenas(d07, [c14, c20, c30], itens)!.saem.map(c => c.id), [], 'marcada: fica');
assert.deepEqual(diferencaDeCenas({ ...d07, cenas_no_dia: undefined }, [c14, c20, c30], itens)!.saem.map(c => c.id), ['c14'], 'sem marca: sairia');

// A vida inteira da cena, na ordem dos dias.
assert.deepEqual(historicoDaCena('c14', [d07, d03]).map(h => [h.diaria.numero, h.motivo]), [[3, 'primeira'], [7, 'regravacao']]);
console.log('ok: regravação');
