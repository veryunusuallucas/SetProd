// Apagar o último take volta a claquete e os contadores (relato do set, 31/10/2026).
import assert from 'node:assert/strict';
import { takeSemSom, voltaDoApagado } from '../src/lib/logagem/takes';
import { voltaDoSom, renumerarSeguintes } from '../src/lib/logagem/som';
import { PADRAO } from '../src/lib/logagem/estado';
import { nomeArquivoPrevisto } from '../src/lib/logagem/nomenclatura';
import type { EstadoDaLogagem, Som, Take } from '../src/types';

const estado0 = { ...PADRAO, id: 'e', projeto_id: 'p', diaria_id: 'd' } as EstadoDaLogagem;
const arq1 = nomeArquivoPrevisto(estado0); // A001C001
// Depois de registrar o take 1: take 2, clipe 2, som ZOOM0002.
const estado = { ...estado0, take: 2, proximo_clipe: 2, arquivo_som: 'ZOOM0002' };
const take = { id: 't1', cena: '1', plano: 'A', take: 1, camera_id: 'A', arquivo: arq1, ordem: 1 } as Take;
const som = { id: 's1', arquivo: 'ZOOM0001', ordem: 1, take_id: 't1' } as Som;

assert.deepEqual(voltaDoApagado(estado, take, [take], [som], [som]), { take: 1, proximo_clipe: 1, arquivo_som: 'ZOOM0001' });
// Não era o último: nada volta.
const t2 = { ...take, id: 't2', take: 2, ordem: 2 } as Take;
assert.deepEqual(voltaDoApagado({ ...estado, take: 3, proximo_clipe: 3 }, take, [take, t2], [], []), {});
// Já mudou de plano: o take fica, o clipe volta.
assert.deepEqual(voltaDoApagado({ ...estado, plano: 'B', take: 1 }, take, [take], [], []), { proximo_clipe: 1 });
// Só o som: volta o arquivo do gravador.
assert.deepEqual(voltaDoSom(estado, som, [som]), { arquivo_som: 'ZOOM0001' });
assert.deepEqual(voltaDoSom({ ...estado, arquivo_som: 'ZOOM0009' }, som, [som]), {});
// Renomear: os seguintes em sequência.
const s2 = { ...som, id: 's2', arquivo: 'ZOOM0002', ordem: 2 } as Som;
assert.deepEqual(renumerarSeguintes([som, s2], som, 'ZOOM0005'), [{ id: 's2', arquivo: 'ZOOM0006' }]);
// O par desalinhado (set, 01/11/2026): o último take sem o som dele.
assert.equal(takeSemSom([take, t2], [som], estado)?.id, 't2');
assert.equal(takeSemSom([take], [som], estado), undefined);
assert.equal(takeSemSom([take, t2], [som], { ...estado, som_junto: false }), undefined);
assert.equal(takeSemSom([take, { ...t2, audio: 'MOS' } as Take], [som], estado), undefined);
console.log('ok: apagar, renomear e par desalinhado');
