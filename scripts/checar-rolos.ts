// Checagem dos rolos do dia: `npx tsx scripts/checar-rolos.ts`
import assert from 'node:assert/strict';
import { rolosDoDia, emFaixas } from '../src/lib/logagem/resumo.ts';

assert.equal(emFaixas(['A002', 'A001', 'A003', 'A004', 'B001', 'A001']), 'A001–A004, B001');
assert.equal(emFaixas(['S01', 'S03']), 'S01, S03');
assert.equal(emFaixas(['A009', 'A010']), 'A009–A010');
assert.deepEqual(
  rolosDoDia(
    [{ camera_id: 'A', cartao: '1' }, { camera_id: 'A', cartao: 'Card 02' }, { camera_id: 'b', cartao: '001' }, { camera_id: 'A', cartao: '' }],
    [{ rolo: 's01' }, {}, { rolo: 'S02' }],
  ),
  { camera: 'A001–A002, B001', som: 'S01–S02' },
);
console.log('rolos: ok');
