/**
 * Confere a sincronia som × vídeo (`lib/logagem/sincronia.ts`). Com as pastas
 * de um cartão de câmera e de um cartão de som, mostra o casamento real.
 *
 *   node scripts/checar-sincronia.mjs [pasta-CLIP pasta-do-gravador]
 */
import assert from 'node:assert/strict';
import { openAsBlob, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const s = await vite.ssrLoadModule('/src/lib/logagem/sincronia.ts');

  assert.deepEqual(s.nomeDoWav('ZOOM0007_Tr3.WAV'), { nome: 'ZOOM0007', faixa: 'Tr3' });
  assert.deepEqual(s.nomeDoWav('261031_001.WAV'), { nome: '261031_001' });
  assert.equal(s.horaDoDia(37034), '10:17:14');
  assert.equal(s.desvioLegivel(2450), '+40:50');
  assert.equal(s.lerDesvio('+40:50'), 2450);
  assert.equal(s.lerDesvio('-1:15'), -75);

  // Diária 1 da Canção de Outono, de cabeça: o gravador 40:50 adiantado.
  const clipes = [
    { takeId: 'c3', arquivo: 'A001C003', inicio: 9 * 3600 + 36 * 60 + 24, duracao: 145.6 },
    { takeId: 'c4', arquivo: 'A001C004', inicio: 9 * 3600 + 48 * 60 + 48, duracao: 186.7 },
    { takeId: 'c1', arquivo: 'A001C001', inicio: 9 * 3600 + 15 * 60 + 11, duracao: 37 },
  ];
  const arquivos = [
    { nome: 'ZOOM0006', faixas: [], inicio: 9 * 3600 + 43 * 60 + 35, duracao: 31.5 },
    { nome: 'ZOOM0007', faixas: [], inicio: 10 * 3600 + 17 * 60 + 14, duracao: 150.4 },
    { nome: 'ZOOM0008', faixas: [], inicio: 10 * 3600 + 29 * 60 + 35, duracao: 193.7 },
  ];
  assert.equal(s.acharDesvio(clipes, arquivos), 2450);
  const r = s.casar(clipes, arquivos, 2450);
  assert.deepEqual(r.pares.map(p => [p.clipe.arquivo, p.arquivo.nome]), [['A001C003', 'ZOOM0007'], ['A001C004', 'ZOOM0008']]);
  assert.deepEqual(r.semVideo.map(a => a.nome), ['ZOOM0006']);
  assert.deepEqual(r.semSom.map(c => c.arquivo), ['A001C001']);
  assert.equal(s.acharDesvio(clipes.slice(0, 1), arquivos.slice(1, 2)), null, 'um par só não prova o desvio');
  assert.equal(s.duracoesBatem(37, 186), false, 'clipe curto não é o som de 3 minutos');
  assert.equal(s.duracoesBatem(145.6, 150.4), true);
  const c9 = { takeId: 'c9', arquivo: 'A001C009', inicio: 10 * 3600 + 35 * 60 + 12, duracao: 153.7 };
  assert.equal(s.sobrepoe(c9, { nome: 'ZOOM0016', faixas: [], inicio: 11 * 3600 + 17 * 60 + 6, duracao: 86.3 }, 2450), true, 'som inteiro dentro do clipe');
  assert.equal(s.sobrepoe(c9, { nome: 'ZOOM0015', faixas: [], inicio: 11 * 3600 + 15 * 60 + 52, duracao: 21.3 }, 2450), false, 'false start que mal encosta');
  assert.equal(s.desvioDoBoletim([{ take_id: 'c3', arquivo: 'zoom0007' }], clipes, arquivos), 2450);

  // O plano: o boletim manda; o relógio liga o que falta e aponta o que diverge.
  const takes = [{ id: 'c3', arquivo: 'A001C003' }, { id: 'c4', arquivo: 'A001C004' }];
  const plano = s.planejarSincronia(r, takes, [
    { arquivo: 'ZOOM0007', take_id: 'c3' },
    { arquivo: 'ZOOM0008', take_id: 'c1' },
    { arquivo: 'ZOOM0006', tipo: 'wild' },
  ]);
  assert.deepEqual(plano.map(l => [l.arquivo.nome, l.acao]), [['ZOOM0006', 'no_boletim'], ['ZOOM0007', 'conferido'], ['ZOOM0008', 'divergente']]);
  assert.deepEqual(s.planejarSincronia(r, takes, []).map(l => l.acao), ['sem_video', 'novo', 'novo']);

  const { trilhasDasFaixas } = await vite.ssrLoadModule('/src/lib/logagem/som.ts');
  assert.deepEqual(trilhasDasFaixas(['Tr1', 'Tr3', 'Tr4'], ['Boom', 'Lapela 1', 'Lapela 2']).map(t => t.nome), ['Boom', 'Lapela 1', 'Lapela 2', 'Tr4']);

  const [pastaClip, pastaSom] = process.argv.slice(2);
  if (pastaClip && pastaSom) {
    // Só o que a sincronia usa do XML (o `lerNRT` do app precisa de DOMParser, que o Node não tem).
    const reais = readdirSync(pastaClip).filter(n => /M01.XML$/i.test(n)).map(n => {
      const t = readFileSync(join(pastaClip, n), 'utf8');
      const nome = n.slice(0, 8);
      return { id: nome, arquivo: nome, xml: { criadoEm: /CreationDate value="([^"]+)"/.exec(t)?.[1], segundos: Number(/Duration value="(\d+)"/.exec(t)?.[1]) / 23.976 } };
    });
    const wavs = [];
    for (const pasta of [pastaSom, ...readdirSync(pastaSom).map(d => join(pastaSom, d)).filter(d => statSync(d).isDirectory())]) {
      for (const n of readdirSync(pasta).filter(n => /\.wav$/i.test(n))) wavs.push({ arquivo: n, cab: await s.lerCabecalhoWav(await openAsBlob(join(pasta, n))) });
    }
    const doGravador = s.juntarFaixas(wavs);
    const cl = s.clipesDosTakes(reais);
    const desvio = s.acharDesvio(cl, doGravador);
    console.log('desvio achado:', desvio === null ? '—' : s.desvioLegivel(desvio));
    const real = s.casar(cl, doGravador, desvio ?? 0);
    for (const p of real.pares) console.log(`  ${p.clipe.arquivo} ↔ ${p.arquivo.nome} (${p.arquivo.faixas.join(',')}) folga ${p.folga}s`);
    console.log('  só som:', real.semVideo.map(a => `${a.nome}@${s.horaDoDia(a.inicio)}`).join(' '));
    console.log('  só vídeo:', real.semSom.map(c => c.arquivo).join(' '));
    assert.ok(real.pares.some(p => p.clipe.arquivo === 'A001C003' && p.arquivo.nome === 'ZOOM0007'), 'o par do Lucas');
    assert.ok(real.pares.some(p => p.clipe.arquivo === 'A001C009' && p.arquivo.nome === 'ZOOM0016'), 'o som que entrou depois da câmera (boletim do continuísta)');
  }
  console.log('sincronia: ok');
} finally {
  await vite.close();
}
