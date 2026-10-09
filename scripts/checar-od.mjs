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
 *  - a padrão é a OD de referência numa página; a detalhada traz o que se pede;
 *  - os campos da Etapa 2 (bases, ponto, veículos, refeições, sinopse) chegam.
 */
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { montarOD } = await vite.ssrLoadModule('/src/lib/od/montar.ts');
  const { BLOCOS_PADRAO } = await vite.ssrLoadModule('/src/lib/od/tipos.ts');

  let n = 0;
  const it = (tipo, extra = {}) => ({ id: 'i' + n++, tipo, ...extra });
  const entrada = (paginas) => ({
    projeto: { id: 'p', nome: 'Teste' },
    diaria: {
      id: 'd', projeto_id: 'p', numero: 2, data: '2026-10-10', chamada: '07:30', equipe_escalada: [], locacoes_ids: ['apagada'],
      bases: [{ rotulo: 'Almoço', local: 'Prédio 42' }],
      ponto_encontro: 'Metrô às 6h',
      veiculos_cena: [{ id: 'v', cena: '2', veiculo: 'Honda Fit', chegada: '07:30' }, { id: 'v2', veiculo: '' }],
      // 'i0' é o café: os itens são numerados na ordem (`n` volta a 0 antes de cada OD).
      refeicoes: { elenco: { i0: 5 } },
      elenco: { e1: { chegada: '07:45', maq_fig: '08:00' } },
    },
    itens: [
      it('coffee', { titulo: 'Café', duracao_min: 30 }),
      it('preparacao', { titulo: 'Prep', duracao_min: 30 }),
      it('cena', { cena_id: 'c1', duracao_min: 60 }),
      it('almoco', { duracao_min: 60 }),
      it('cena', { cena_id: 'c2', duracao_min: 60 }),
      it('wrap', { duracao_min: 30 }),
    ],
    cenas: [
      { id: 'c1', numero: '1', descricao: 'SALA', ambiente: 'int', locacao_id: 'l1', paginas, sinopse: 'Alice toca.', dia_historia: '0.1' },
      { id: 'c2', numero: '2', descricao: 'RUA', ambiente: 'ext', locacao_id: 'l2' },
    ],
    planosPorCena: new Map(),
    locacoes: [{ id: 'l1', nome: 'Escola', endereco: 'Rua A' }, { id: 'l2', nome: 'Rua', endereco: 'Rua B' }],
    perfis: [], departamentos: [],
    personagens: [{ id: 'e1', nome: 'Alice', categoria: 'ELENCO', cast_id: 1 }],
    cenasPorPersonagem: new Map([['e1', new Set(['c1'])]]),
    clima: [], tasks: [{ id: 't', descricao: 'Ligar', status: 'pendente' }],
    totalDiarias: 5,
  });

  n = 0;
  const simples = montarOD(entrada('1 2/8'), BLOCOS_PADRAO);
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
  assert.equal(primeira.celulas.elenco, '1', 'o número do personagem vai na cena');
  assert.equal(grade.linhas.filter(l => !l.faixa)[1].celulas.elenco, '—');

  const lugar = secao(simples, 'lugar');
  const nomes = lugar.colunas[0].secoes[0].itens.map(c => c.valor);
  assert.deepEqual(nomes, ['Escola', 'Rua'], 'as locações saem das cenas quando a da diária sumiu');

  const marcos = secao(simples, 'horarios').tabela.colunas.map(c => c.rotulo);
  for (const m of ['Chamada', 'Roda', 'Corta', 'Desprodução']) assert.ok(marcos.includes(m), `falta ${m} nos horários`);
  assert.ok(marcos.some(m => m.startsWith('Preparação')));

  assert.ok(!simples.secoes.some(s => s.novaPagina), 'a padrão é uma página');
  assert.ok(!secao(simples, 'checklist'));
  assert.ok(!secao(simples, 'transporte'));

  // Etapa 2
  assert.equal(primeira.celulas.cena.detalhe, 'Dia 0.1');
  assert.equal(primeira.celulas.set.detalhe, 'Alice toca.', 'a sinopse vai embaixo do set');
  assert.deepEqual(lugar.colunas[1].secoes[0].itens.map(c => [c.rotulo, c.valor]), [['Almoço', 'Prédio 42']]);
  assert.equal(secao(simples, 'ponto').itens[0].valor, 'Metrô às 6h');
  assert.equal(secao(simples, 'veiculos-cena').tabela.linhas.length, 1, 'veículo sem nome não sai');
  const elenco = secao(simples, 'elenco').tabela;
  assert.equal(elenco.linhas[0].celulas.make, '08h00', 'o horário antigo de make/fig sai como make');
  assert.ok(!elenco.colunas.some(c => c.chave === 'mic'), 'mic vazio não vira coluna');
  assert.match(elenco.linhas.at(-1).faixa.texto, /ELENCO TOTAL: 1 = \[ CAFÉ 5 \]/);

  n = 0;
  const completa = montarOD(entrada(undefined));
  assert.equal(completa.secoes.filter(s => s.novaPagina).length, 1, 'a completa abre uma página nova');
  assert.ok(secao(completa, 'checklist'));
  assert.ok(!secao(completa, 'grade').tabela.colunas.some(c => c.chave === 'paginas'), 'coluna de páginas vazia não entra');

  // O elenco sai do TEXTO da cena, não só da marcação (a manual não guarda a cena).
  const { cenasDoElemento, aparece } = await vite.ssrLoadModule('/src/lib/decupagem.ts');
  assert.ok(aparece('ALICE entra na sala.', 'Alice'));
  assert.ok(!aparece('MARIANA entra.', 'Ana'), '"Ana" não pode casar dentro de "Mariana"');
  const alice = { id: 'e1', nome: 'Alice', categoria: 'ELENCO', aliases: ['Lice'] };
  const textos = [{ id: 'c1', corpo: 'ALICE toca piano.' }, { id: 'c2', corpo: 'Nicole espera. LICE chega.' }, { id: 'c3', corpo: 'Rua vazia.' }];
  assert.deepEqual([...cenasDoElemento(alice, [{ elemento_id: 'e1' }], textos)].sort(), ['c1', 'c2']);
  const faca = { id: 'e2', nome: 'faca', categoria: 'OBJETOS' };
  assert.equal(cenasDoElemento(faca, [], [{ id: 'c1', corpo: 'Ele pega a faca.' }]).size, 0, 'objeto só vale marcado');

  console.log('OD ok');
} finally {
  await vite.close();
}
