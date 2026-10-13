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
