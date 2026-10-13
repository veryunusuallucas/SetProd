// Checagem do backup: `npx tsx scripts/checar-backup.ts`
import assert from 'node:assert/strict';
import { outrosCartoesNoComprovante } from '../src/lib/logagem/backup.ts';

const takes = [
  { arquivo: 'A001C001', cartao: '001' }, { arquivo: 'A002C005', cartao: '002' },
  { arquivo: 'A004C010', cartao: '004' }, { arquivo: 'A008C013', cartao: '008' }, { arquivo: 'B003C001', cartao: '003' },
];
const md5 = [
  'd41d8cd98f00b204e9800998ecf8427e  ./M4ROOT/CLIP/A001C001.MP4',
  '0cc175b9c0f1b6a831c399e269772661  ./M4ROOT/CLIP/A002C005.MP4',
  '92eb5ffee6ae2fec3ad71c777531578f  ./M4ROOT/CLIP/a004c010.mp4',
  '4a8a08f09d37b73795649038408b5f33  ./M4ROOT/CLIP/A008C013.XML',
].join('\n');

assert.deepEqual(outrosCartoesNoComprovante(md5, '001', takes), ['002', '004', '008'], 'acha os outros, sem caixa');
assert.deepEqual(outrosCartoesNoComprovante(md5, '002', takes), ['001', '004', '008'], 'nunca devolve o próprio');
assert.deepEqual(outrosCartoesNoComprovante('nada aqui', '001', takes), [], 'comprovante sem clipe dos outros');
console.log('backup: ok');

// Conferência do comprovante com o boletim (Diária 1: A001C013–015 logados sem arquivo).
import { conferirComprovante } from '../src/lib/logagem/backup.ts';
const mhl = String.raw`<file>M4ROOT\CLIP\A001C001_261010CF.MP4</file>
<file>M4ROOT\CLIP\A001C001_261010CFM01.XML</file>
<file>M4ROOT\CLIP\A008C013_261010CF.MP4</file>
<file>M4ROOT\CLIP\A009C099_261010CF.MP4</file>`;
const c = conferirComprovante(mhl, [
  { arquivo: 'A001C001', xml: { segundos: 37 } }, { arquivo: 'A008C013', xml: { criadoEm: 'x' } }, { arquivo: 'A001C013' },
]);
assert.equal(c.clipes, 3, 'só os vídeos contam, o XML não');
assert.deepEqual(c.faltam, ['A001C013'], 'take logado sem arquivo');
assert.deepEqual(c.sobram, ['A009C099_261010CF'], 'arquivo sem take');
assert.deepEqual(c.semIngest, ['A001C013'], 'take sem ingest');
console.log('conferência: ok');
