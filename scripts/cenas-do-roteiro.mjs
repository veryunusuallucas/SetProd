#!/usr/bin/env node
/**
 * Roda o detector de cabeçalhos de cena em cima de um PDF de verdade.
 *
 * POR QUE ELE EXISTE
 * A separação de cenas é determinística (`RE_CABECALHO`, em `lib/decupagem.ts`),
 * e por isso ela é testável fora do navegador. Um roteiro de 128 cenas onde 3
 * somem é um problema de expressão regular, não de IA — e a única forma de
 * consertar isso sem chutar é ver as linhas que ela NÃO pegou.
 *
 * O que ele imprime:
 *   · quantas cenas achou, e quais números;
 *   · os buracos na numeração (achou 26 e 28, não achou 27);
 *   · as LINHAS QUASE-CABEÇALHO: trechos com INT./EXT. que a expressão deixou
 *     passar. É essa lista que diz o que precisa mudar.
 *
 * Uso:
 *   node scripts/cenas-do-roteiro.mjs "caminho/do/roteiro.pdf"
 *
 * ⚠️ A EXPRESSÃO NÃO É COPIADA AQUI.
 * Ela é lida do próprio `lib/decupagem.ts` e avaliada — se fosse uma cópia,
 * cedo ou tarde o teste passaria a medir uma expressão que o app não usa mais.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// A expressão, tirada do código de verdade.
// ---------------------------------------------------------------------------

function carregarPadrao() {
  const fonte = fs.readFileSync('src/lib/decupagem.ts', 'utf8');

  const pedaco = (nome) => {
    const i = fonte.indexOf(`const ${nome} =`);
    if (i < 0) throw new Error(`nao achei ${nome} em decupagem.ts`);
    const fim = fonte.indexOf('\n);', i) >= 0 && fonte.indexOf('\n);', i) < fonte.indexOf('\n', fonte.indexOf(';', i))
      ? fonte.indexOf('\n);', i) + 3
      : fonte.indexOf(';', i) + 1;
    return fonte.slice(i, fim);
  };

  // `PERIODOS` e `RE_CABECALHO` são declarações puras: sem import, sem tipo.
  // A ordem importa: a expressão usa as duas listas declaradas antes dela.
  const codigo = [
    pedaco('PERIODOS'),
    pedaco('QUALIFICADOR'),
    pedaco('RE_CABECALHO'),
    'return RE_CABECALHO;',
  ].join('\n');
  // eslint-disable-next-line no-new-func
  return new Function(codigo)();
}

// ---------------------------------------------------------------------------
// O texto do PDF, extraído do MESMO jeito que o app extrai.
// ---------------------------------------------------------------------------

async function paginasDoPdf(caminho) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // `file://` porque o carregador de módulos do Node recusa caminho do Windows
  // com letra de unidade ("protocolo c:").
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(fs.readFileSync(caminho)),
    // Sem isto o pdf.js troca as fontes base e as larguras saem erradas — o
    // mesmo cuidado que o app toma.
    // Barra no fim e separador POSIX: o pdf.js trata isto como URL, e a barra
    // invertida do Windows faz ele recusar o caminho.
    standardFontDataUrl: path.dirname(require.resolve('pdfjs-dist/package.json')).split(path.sep).join('/') + '/standard_fonts/',
  }).promise;

  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // ⚠️ Junta com ESPAÇO, exatamente como `BreakdownModule` faz. Juntar com
    // quebra de linha mudaria o que a expressão vê e o teste mediria outra coisa.
    paginas.push({ numero: i, texto: content.items.map(it => it.str).join(' ') });
  }
  return paginas;
}

// ---------------------------------------------------------------------------

/** Trechos que têm cara de cabeçalho e a expressão não pegou. */
function quaseCabecalhos(texto, achados) {
  const marcados = new Set(achados.map(a => a.indice));
  const suspeitos = [];
  const RE_INICIO = /\b(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.?|EXT\.?|I\/E\.?)(?=[\s.])/gi;

  for (const m of texto.matchAll(RE_INICIO)) {
    const i = m.index ?? 0;
    // Já faz parte de um cabeçalho reconhecido?
    if ([...marcados].some(inicio => Math.abs(inicio - i) < 90)) continue;
    suspeitos.push({ indice: i, trecho: texto.slice(Math.max(0, i - 40), i + 90).replace(/\s+/g, ' ').trim() });
  }
  return suspeitos;
}

async function principal() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error('uso: node scripts/cenas-do-roteiro.mjs "roteiro.pdf"');
    process.exit(1);
  }

  const RE = carregarPadrao();
  const paginas = await paginasDoPdf(caminho);

  let completo = '';
  const inicioDaPagina = [];
  for (const p of paginas) {
    inicioDaPagina.push({ inicio: completo.length, pagina: p.numero });
    completo += p.texto + '\n';
  }
  const paginaDe = (i) => {
    let atual = 1;
    for (const m of inicioDaPagina) { if (m.inicio <= i) atual = m.pagina; else break; }
    return atual;
  };

  RE.lastIndex = 0;
  const achados = [...completo.matchAll(RE)].map(m => ({
    indice: m.index ?? 0,
    numero: (m[1] || '').replace(/\s+/g, '').toUpperCase(),
    cabecalho: m[0].trim().replace(/\s{2,}/g, ' '),
    pagina: paginaDe(m.index ?? 0),
  }));

  console.log(`\n${path.basename(caminho)} — ${paginas.length} páginas`);
  console.log(`Cenas reconhecidas: ${achados.length}\n`);

  // Buracos na numeração: o jeito mais rápido de ver o que faltou.
  const numeros = achados.map(a => parseInt(a.numero, 10)).filter(n => !isNaN(n));
  const maior = Math.max(0, ...numeros);
  const tem = new Set(numeros);
  const buracos = [];
  for (let n = 1; n <= maior; n++) if (!tem.has(n)) buracos.push(n);
  if (buracos.length) console.log(`⚠️  Buracos na numeração (1 a ${maior}): ${buracos.join(', ')}\n`);
  else console.log('✓ Numeração sem buracos\n');

  const suspeitos = quaseCabecalhos(completo, achados);
  if (suspeitos.length) {
    console.log(`⚠️  ${suspeitos.length} trecho(s) com INT./EXT. que a expressão NÃO reconheceu:\n`);
    for (const s of suspeitos.slice(0, 40)) {
      console.log(`   pág ${String(paginaDe(s.indice)).padStart(3)} · …${s.trecho}…`);
    }
    if (suspeitos.length > 40) console.log(`   (+${suspeitos.length - 40})`);
  } else {
    console.log('✓ Nenhum trecho com INT./EXT. ficou de fora');
  }
  console.log('');
}

principal().catch(e => { console.error(e); process.exit(1); });
