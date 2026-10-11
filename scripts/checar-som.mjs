/**
 * Confere o boletim de som (`lib/logagem/som.ts`) e, com uma pasta, gera o
 * sound report e o camera report com a coluna Áudio para olhar.
 *
 *   node scripts/checar-som.mjs [pasta-para-os-pdfs]
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const {
    montarSom, claqueteDoSom, resumoDoSom, arquivoDoSom, trilhasDoSom, takeLevaSom, alternarNota, trechosDoSom,
  } = await vite.ssrLoadModule('/src/lib/logagem/som.ts');
  const { proximoArquivo } = await vite.ssrLoadModule('/src/lib/logagem/takes.ts');

  const estado = { projeto_id: 'p', diaria_id: 'd', cena: '4', plano: 'B', take: 3, cena_id: 'c4', plano_id: 'p4b' };
  assert.equal(takeLevaSom(estado), true, 'sem escolha, o som vai junto');
  assert.equal(takeLevaSom({ ...estado, audio: 'MOS' }), false, 'MOS não tem som');
  assert.equal(takeLevaSom({ som_junto: false }), false);
  assert.equal(arquivoDoSom(estado), 'ZOOM0001');
  assert.deepEqual(trilhasDoSom(estado), ['Boom', 'Lapela 1', 'Lapela 2']);
  assert.equal(proximoArquivo('ZOOM0009'), 'ZOOM0010');

  const kit = { ...estado, arquivo_som: 'ZOOM0012', trilhas_som: ['Boom', 'Lapela Alice'], rolo_som: '02' };
  const s1 = montarSom(kit, 'take', 1, { take: { id: 't1', take: 2 } });
  assert.equal(s1.arquivo, 'ZOOM0012');
  assert.equal(s1.rolo, '02');
  assert.equal(s1.take_id, 't1');
  assert.equal(s1.take, 2, 'o número é o do take de câmera casado');
  assert.equal(s1.marca, undefined, 'sem marca até alguém marcar');
  assert.deepEqual(s1.trilhas, [{ nome: 'Boom' }, { nome: 'Lapela Alice' }]);
  assert.equal(claqueteDoSom(s1), '4-B / Tk2');

  const w = montarSom(kit, 'wild', 2);
  assert.equal(w.plano, '', 'wild é da cena, não do plano');
  assert.equal(w.take, undefined);
  assert.equal(claqueteDoSom(w), 'Cena 4 · wild track');

  const r = montarSom({ ...kit, trilhas_som: ['Boom', 'Lapela Nicole'] }, 'room_tone', 3);
  assert.equal(resumoDoSom([{ ...s1, marca: 'bom' }, w, { ...r, marca: 'fs' }]), '3 arquivos · 1 bom · 1 wild · 1 room tone · 1 false start');
  assert.equal(resumoDoSom([]), '');
  assert.deepEqual(trechosDoSom([s1, w, r]).map(t => t.sons.length), [2, 1], 'a lapela trocou de ator: trecho novo');

  assert.equal(alternarNota('', 'vento'), 'vento');
  assert.equal(alternarNota('vento', 'roupa'), 'vento, roupa');
  assert.equal(alternarNota('vento, roupa', 'Vento'), 'roupa', 'tocar de novo tira');

  // O HERO da câmera nasce como o take bom do som.
  assert.equal(montarSom(kit, 'take', 4, { take: { id: 't9', take: 1, status: 'HERO' } }).marca, 'bom');
  assert.equal(montarSom(kit, 'take', 5, { take: { id: 't9', take: 1, status: 'OK' } }).marca, undefined);

  // O nome do primeiro arquivo pelo gravador, e a data do F3 trocando com o dia.
  const { primeiroArquivoDo, arquivoNoDia } = await vite.ssrLoadModule('/src/lib/logagem/som.ts');
  assert.equal(primeiroArquivoDo('Zoom H6', '2026-10-31'), 'ZOOM0001');
  assert.equal(primeiroArquivoDo('Zoom F3', '2026-10-31'), '261031_001');
  assert.equal(primeiroArquivoDo('Sound Devices MixPre-6', '2026-10-31'), null, 'padrão desconhecido: a pessoa digita');
  assert.equal(arquivoNoDia('261010_014', '2026-10-31'), '261031_014');
  assert.equal(arquivoNoDia('ZOOM0014', '2026-10-31'), 'ZOOM0014');
  assert.equal(proximoArquivo('261031_009'), '261031_010');

  // A claquete mudada à mão puxa a cena e o plano da decupagem.
  const { claqueteDaDecupagem } = await vite.ssrLoadModule('/src/lib/logagem/decupagem.ts');
  const dec = {
    cenas: [{ id: 'c4', numero: '4', ambiente: 'ext', periodo: 'noite' }],
    planos: [{ id: 'p2', cena_id: 'c4', numero: '2', lente: '35mm', descricao: 'Alice corre' }],
  };
  const base = { cena: '3', plano: 'A', plano_letras: true, abertura: 'f/2.8', obs: '' };
  assert.deepEqual(claqueteDaDecupagem(dec, { cena: '4', plano: 'A', take: 1 }, base), { cena_id: 'c4', ambiente: 'EXT', luz: 'NOITE' });
  const b = claqueteDaDecupagem(dec, { plano: 'B', take: 1 }, { ...base, cena: '4' });
  assert.equal(b.plano_id, 'p2', 'o B da claquete é o plano 2 da decupagem');
  assert.equal(b.lente, '35mm');
  assert.equal(b.obs, 'Alice corre', 'observação vazia ganha a descrição');
  assert.equal(claqueteDaDecupagem(dec, { plano: 'B' }, { ...base, cena: '4', obs: 'já tem' }).obs, undefined, 'não empilha');
  assert.deepEqual(claqueteDaDecupagem(dec, { cena: '9' }, base), {}, 'cena fora da decupagem não muda nada');
  assert.equal(claqueteDaDecupagem({ ...dec, planos: [...dec.planos, { id: 'p1', cena_id: 'c4', numero: '1', descricao: 'Geral' }] }, { plano: 'B' }, { ...base, cena: '4', obs: 'Geral' }).obs, 'Alice corre', 'a descrição do plano anterior dá lugar à do novo');
  assert.deepEqual(claqueteDaDecupagem(dec, { take: 2 }, base), {}, 'mudar só o take não procura nada');

  const pasta = process.argv[2];
  if (pasta) {
    const { relatorioEmPdf } = await vite.ssrLoadModule('/src/lib/logagem/pdf.tsx');
    const { OPCOES_PADRAO } = await vite.ssrLoadModule('/src/lib/logagem/relatorio.ts');
    const tk = (id, plano, n, arquivo) => ({ id, projeto_id: 'p', diaria_id: 'd', cena: '4', plano, take: n, status: 'OK', hora: '09:35:04', ordem: n, camera_id: 'A', cartao: '001', arquivo, criado_em: 0 });
    const takes = [tk('t1', 'B', 1, 'A001C001'), tk('t2', 'B', 2, 'A001C002'), tk('t3', 'C', 1, 'A001C003')];
    const sons = [
      { ...montarSom({ ...kit, arquivo_som: 'ZOOM0001', trilhas_som: ['Boom', 'Lapela Alice', 'Lapela Bia'] }, 'take', 1, { take: takes[0] }), marca: 'fs' },
      { ...montarSom({ ...kit, arquivo_som: 'ZOOM0002', trilhas_som: ['Boom', 'Lapela Alice', 'Lapela Bia'] }, 'take', 2, { take: takes[1] }), marca: 'bom', trilhas: [{ nome: 'Boom' }, { nome: 'Lapela Alice', nota: 'roupa' }, { nome: 'Lapela Bia' }], obs: 'avião no fim' },
      { ...montarSom({ ...kit, arquivo_som: 'ZOOM0003', trilhas_som: ['Boom', 'Lapela Nicole'] }, 'room_tone', 3) },
    ];
    const dados = {
      projeto: { id: 'p', nome: 'Canção de Outono' }, diaria: { id: 'd', numero: 2, data: '2026-10-31' },
      takes, sons, kitDoSom: 'Zoom H6 · 48 kHz · 24 bits', hds: [], backups: [], checksums: [],
      equipe: { diretor: '', fotografia: '', operador: '', produtor: '' },
      fotos: {}, quemLogou: {}, comprovantes: {}, geradoEm: Date.now(),
    };
    for (const tipo of ['som', 'camera']) {
      const blob = await relatorioEmPdf(tipo, dados, OPCOES_PADRAO);
      writeFileSync(join(pasta, `${tipo}.pdf`), Buffer.from(await blob.arrayBuffer()));
    }
  }
  console.log('som: ok');
} finally {
  await vite.close();
}
