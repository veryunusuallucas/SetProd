#!/usr/bin/env node
/**
 * Impede um push que muda o app e esquece as Novidades.
 *
 * POR QUE UMA TRAVA, E NÃO UM LEMBRETE
 * Lembrete funciona no dia em que a gente lembra. O changelog para de ser
 * escrito exatamente nas correções pequenas — e são elas que mais confundem
 * quem está usando: a pessoa nota que alguma coisa mudou de comportamento,
 * não encontra registro nenhum, e fica achando que fez algo errado.
 *
 * O QUE ELE EXIGE, quando o push mexe no app:
 *
 *   1. a `version` do package.json subiu em relação ao que já está publicado;
 *   2. `src/lib/novidades.tsx` tem, NO TOPO, uma entrada com essa mesma versão.
 *
 * Não exige mais que isso de propósito. Um verificador que cobra formato acaba
 * sendo contornado com texto vazio só para passar, e aí atrapalha em vez de
 * ajudar. O que ele garante é que a entrada existe e que ninguém esqueceu de
 * subir o número.
 *
 * Para pular numa emergência: `git push --no-verify`.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Mudança nestes caminhos é mudança que alguém percebe usando o app. */
const OLHAR = ['src/', 'supabase/functions/', 'index.html', 'vite.config.ts'];

/** E nestes não é — não adianta cobrar changelog de um ajuste de ferramenta. */
const IGNORAR = [/^src\/lib\/novidades\.tsx$/, /\.test\.[tj]sx?$/, /^scripts\//];

const VERMELHO = '\x1b[31m';
const AMARELO = '\x1b[33m';
const NORMAL = '\x1b[0m';

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf8' }).trim();
}

function versaoDoPacote(ref) {
  try {
    const cru = ref ? git(`show ${ref}:package.json`) : readFileSync('package.json', 'utf8');
    return JSON.parse(cru).version ?? null;
  } catch {
    return null; // primeiro push, ou o arquivo ainda não existia lá
  }
}

/**
 * A versão da primeira entrada de `VERSOES`.
 *
 * Lê por expressão regular em vez de importar o arquivo: ele é TSX com JSX
 * dentro, e o Node não o executa sem uma etapa de compilação. Um hook que
 * precisa de build para rodar é um hook que alguém desliga na primeira pressa.
 */
function versaoNoTopoDasNovidades() {
  const fonte = readFileSync('src/lib/novidades.tsx', 'utf8');
  const lista = fonte.indexOf('VERSOES');
  if (lista < 0) return null;
  const achado = /versao:\s*['"]([^'"]+)['"]/.exec(fonte.slice(lista));
  return achado ? achado[1] : null;
}

/** Maior que, comparando 4.4.10 com 4.4.9 como número e não como texto. */
function maiorQue(a, b) {
  if (!b) return true;
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0, y = pb[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function erro(linhas) {
  console.error(`\n${VERMELHO}✗ Push barrado: as Novidades não foram atualizadas.${NORMAL}\n`);
  for (const l of linhas) console.error(`  ${l}`);
  console.error(`\n  ${AMARELO}Emergência? git push --no-verify${NORMAL}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------

const entrada = readFileSync(0, 'utf8').trim();
if (!entrada) process.exit(0); // nada sendo enviado

const VAZIO = /^0+$/;
let mexeuNoApp = false;
let versaoPublicada = null;

for (const linha of entrada.split('\n')) {
  const [, shaLocal, , shaRemoto] = linha.split(' ');
  if (!shaLocal || VAZIO.test(shaLocal)) continue; // apagando um branch

  // Branch novo no remoto: não há com o que comparar, e travar o primeiro push
  // de um branch de experimento seria só atrapalhar.
  if (!shaRemoto || VAZIO.test(shaRemoto)) continue;

  const arquivos = git(`diff --name-only ${shaRemoto}..${shaLocal}`).split('\n').filter(Boolean);
  const relevantes = arquivos.filter(
    a => OLHAR.some(p => a.startsWith(p)) && !IGNORAR.some(r => r.test(a))
  );
  if (relevantes.length) {
    mexeuNoApp = true;
    versaoPublicada = versaoDoPacote(shaRemoto);
  }
}

if (!mexeuNoApp) process.exit(0);

const versaoAtual = versaoDoPacote(null);
const versaoNasNovidades = versaoNoTopoDasNovidades();

if (!maiorQue(versaoAtual, versaoPublicada)) {
  erro([
    `A versão continua em ${versaoAtual} (já publicada).`,
    '',
    'Suba o número no package.json — 4.4.1 → 4.4.2 para uma correção,',
    '4.4.x → 4.5.0 quando a mudança valer um nome.',
  ]);
}

if (versaoNasNovidades !== versaoAtual) {
  erro([
    `package.json está em ${versaoAtual}, mas a primeira entrada de`,
    `src/lib/novidades.tsx é ${versaoNasNovidades ?? '(nenhuma)'}.`,
    '',
    'Acrescente a entrada da versão nova NO TOPO de VERSOES, com uma linha',
    'por mudança que alguém percebe usando o app.',
    '',
    'Escreva para quem usa, não para quem programa: o que mudou na tela e',
    'por quê — nunca o nome do arquivo.',
  ]);
}

console.log(`✓ Novidades da v${versaoAtual} estão escritas.`);
