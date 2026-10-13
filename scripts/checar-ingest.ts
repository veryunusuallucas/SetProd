// Checagem do casamento do ingest: `npx tsx scripts/checar-ingest.ts`
import assert from 'node:assert/strict';
import { cruzar, numeroDoClipe, correcaoDoTake } from '../src/lib/logagem/ingest.ts';

assert.equal(numeroDoClipe('A008C013'), 13);
assert.equal(numeroDoClipe('A003C030_260912SL'), 30);
assert.equal(numeroDoClipe('C0148'), 148);
assert.equal(numeroDoClipe('DJI_0007'), 7);
assert.equal(numeroDoClipe('A_0001C001A'), 1);

const take = (id: string, arquivo: string, hora: string, camera_id = 'A') => ({ id, arquivo, hora, camera_id }) as never;
const clipe = (nome: string, hora: string) => ({ nome, meta: { criadoEm: `2026-10-10T${hora}-03:00` } }) as never;

const takes = [take('t13', 'A001C013', '15:02:40'), take('t14', 'A001C014', '15:06:00'), take('b13', 'B001C013', '15:02:30', 'B')];
const r = cruzar(takes, [clipe('A008C013', '15:01:10'), clipe('A008C014', '15:05:00'), clipe('A008C015', '15:09:00')]);

assert.equal(r[0].tipo, 'igual');
assert.equal(r[0].tipo === 'igual' && r[0].take.id, 't13', 'mesmo número, mesma câmera, hora perto');
assert.equal(r[0].tipo === 'igual' && r[0].diferencas[0].campo, 'arquivo');
assert.equal(r[1].tipo === 'igual' && r[1].take.id, 't14');
assert.equal(r[2].tipo, 'sem-take', 'número sem take');

// Diária 1 da Canção: logados de uma vez às 11:39, gravados 11:21–11:27.
const d1 = cruzar(
  [take('a13', 'A001C013', '11:39:19'), take('a14', 'A001C014', '11:39:20'), take('a15', 'A001C015', '11:39:22')],
  [clipe('A008C013', '11:21:29'), clipe('A008C014', '11:22:33'), clipe('A008C015', '11:27:10')],
);
assert.deepEqual(d1.map(c => c.tipo === 'igual' && c.take.id), ['a13', 'a14', 'a15']);
// Hora longe demais, ou logado antes de gravar: não casa.
assert.equal(cruzar([take('t13', 'A001C013', '18:00:00')], [clipe('A008C013', '15:01:10')])[0].tipo, 'sem-take');
assert.equal(cruzar([take('t13', 'A001C013', '14:50:00')], [clipe('A008C013', '15:01:10')])[0].tipo, 'sem-take');
// Take que já achou clipe pelo nome não é roubado.
const n = cruzar([take('t13', 'A001C013', '15:02:40')], [clipe('A001C013', '15:01:10'), clipe('A008C013', '15:01:10')]);
assert.deepEqual(n.map(c => c.tipo), ['igual', 'sem-take']);
assert.equal(n[0].tipo === 'igual' && n[0].diferencas.length, 0);

assert.equal(correcaoDoTake(clipe('A008C013', '15:01:10'), undefined, 'A001C013').arquivo, 'A008C013', 'renomeia');
assert.equal(correcaoDoTake(clipe('A003C030_260912SL', '15:01:10'), undefined, 'A003C030').arquivo, undefined, 'sufixo não renomeia');

console.log('ingest: ok');

// Câmeras novas (catálogo de 13/10/2026): Canon padrão e Blackmagic.
import { nomeArquivoPrevisto, chaveDoClipe } from '../src/lib/logagem/nomenclatura.ts';
const base = { camera_id: 'A', cartao: '001', posicao: 'C', proximo_clipe: 7, zeros_clipe: 4 };
assert.equal(nomeArquivoPrevisto({ ...base, nomenclatura: 'mvi' }), 'MVI_0007');
assert.equal(nomeArquivoPrevisto({ ...base, nomenclatura: 'blackmagic', agora: new Date(2026, 9, 31, 15, 12) }), 'A001_10311512_C007');
assert.equal(chaveDoClipe('A001_10311512_C007.braw'), 'A001_C007', 'o carimbo de hora não conta');
assert.equal(numeroDoClipe('A001_10311512_C007'), 7, 'o clipe é o C do fim');
// Logado às 15:14, a câmera começou a gravar às 15:12: casa pelo nome mesmo assim.
const bm = cruzar([take('b7', 'A001_10311514_C007', '15:14:00')], [clipe('A001_10311512_C007', '15:12:00')]);
assert.equal(bm[0].tipo === 'igual' && bm[0].take.id, 'b7');
console.log('câmeras novas: ok');

// Sony com título (FX30): o número é o pedaço do fim, e não o "30" do título nem a data.
const dia = new Date(2026, 9, 13, 10, 0);
assert.equal(nomeArquivoPrevisto({ ...base, nomenclatura: 'sony_titulo', titulo: 'FX30', agora: dia }), 'FX30_0007');
assert.equal(nomeArquivoPrevisto({ ...base, nomenclatura: 'sony_data_titulo', titulo: 'FX30', agora: dia }), '261013_FX30_0007');
assert.equal(nomeArquivoPrevisto({ ...base, nomenclatura: 'sony_titulo_data', titulo: 'FX30', agora: dia }), 'FX30_261013_0007');
assert.equal(numeroDoClipe('FX30_0007.MP4'), 7);
assert.equal(numeroDoClipe('261013_FX30_0007'), 7);
assert.equal(numeroDoClipe('FX30_261013_0007'), 7);
console.log('sony com título: ok');
