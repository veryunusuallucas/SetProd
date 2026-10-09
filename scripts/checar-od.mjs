/**
 * Confere a montagem da Ordem do Dia (`src/lib/od/montar.ts`).
 *
 *   node scripts/checar-od.mjs
 *
 * Roda pelo Vite (`ssrLoadModule`) porque o `montar.ts` importa sem extensão,
 * como o resto do app. Confere o que o modelo do set pede e que é fácil de
 * quebrar sem ver o papel:
 *  - a preparação logo antes de uma cena entra NA linha dela;
 *  - as locações saem também das cenas (a da diária pode ter sido apagada);
 *  - a faixa de horários tem chamada, roda, corta e desprodução;
 *  - coluna sem dado nenhum não entra;
 *  - a simples não tem página 2, a completa tem.
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { montarOD } = await vite.ssrLoadModule('/src/lib/od/montar.ts');

  let n = 0;
  const it = (tipo, extra = {}) => ({ id: 'i' + n++, tipo, ...extra });
  const entrada = (paginas) => ({
    projeto: { id: 'p', nome: 'Teste' },
    diaria: { id: 'd', projeto_id: 'p', numero: 2, data: '2026-10-10', chamada: '07:30', equipe_escalada: [], locacoes_ids: ['apagada'] },
    itens: [
      it('coffee', { titulo: 'Café', duracao_min: 30 }),
      it('preparacao', { titulo: 'Prep', duracao_min: 30 }),
      it('cena', { cena_id: 'c1', duracao_min: 60 }),
      it('almoco', { duracao_min: 60 }),
      it('cena', { cena_id: 'c2', duracao_min: 60 }),
      it('wrap', { duracao_min: 30 }),
    ],
    cenas: [
      { id: 'c1', numero: '1', descricao: 'SALA', ambiente: 'int', locacao_id: 'l1', paginas },
      { id: 'c2', numero: '2', descricao: 'RUA', ambiente: 'ext', locacao_id: 'l2' },
    ],
    planosPorCena: new Map(),
    locacoes: [{ id: 'l1', nome: 'Escola', endereco: 'Rua A' }, { id: 'l2', nome: 'Rua', endereco: 'Rua B' }],
    perfis: [], departamentos: [], personagens: [], cenasPorPersonagem: new Map(),
    clima: [], tasks: [{ id: 't', descricao: 'Ligar', status: 'pendente' }],
    totalDiarias: 5,
  });

  const simples = montarOD(entrada('1 2/8'), 'simples');
  const secao = (doc, id) => doc.secoes.find(s => s.id === id);

  assert.equal(simples.cabecalho.diaria, 'Diária 2 de 5');
  assert.equal(simples.cabecalho.chamada, '07h30');
  assert.equal(simples.cabecalho.fim, '12h00');

  const grade = secao(simples, 'grade').tabela;
  assert.ok(!grade.linhas.some(l => /PREP/.test(l.faixa?.texto || '')), 'a preparação não pode virar linha solta');
  const primeira = grade.linhas.find(l => !l.faixa);
  assert.equal(primeira.celulas.rodando.texto, 'Roda 08h30 - 09h30');
  assert.equal(primeira.celulas.rodando.detalhe, 'Prep 08h00 - 08h30');
  assert.ok(grade.colunas.some(c => c.chave === 'paginas'));
  assert.ok(!grade.colunas.some(c => c.chave === 'elenco'), 'coluna de elenco vazia não entra');

  const lugar = secao(simples, 'lugar');
  const nomes = lugar.colunas[0].secoes[0].itens.map(c => c.valor);
  assert.deepEqual(nomes, ['Escola', 'Rua'], 'as locações saem das cenas quando a da diária sumiu');

  const marcos = secao(simples, 'horarios').tabela.colunas.map(c => c.rotulo);
  for (const m of ['Chamada', 'Roda', 'Corta', 'Desprodução']) assert.ok(marcos.includes(m), `falta ${m} nos horários`);
  assert.ok(marcos.some(m => m.startsWith('Preparação')));

  assert.ok(!simples.secoes.some(s => s.novaPagina), 'a simples é uma página');
  assert.ok(!secao(simples, 'checklist'));

  const completa = montarOD(entrada(undefined), 'completa');
  assert.equal(completa.secoes.filter(s => s.novaPagina).length, 1, 'a completa abre uma página nova');
  assert.ok(secao(completa, 'checklist'));
  assert.ok(!secao(completa, 'grade').tabela.colunas.some(c => c.chave === 'paginas'), 'coluna de páginas vazia não entra');

  console.log('OD ok');
} finally {
  await vite.close();
}
