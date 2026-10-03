#!/usr/bin/env node
/**
 * Converte os gifs de src/conteudo/gifs/<humor>/ em mp4 leve.
 *
 *     npm run gifs
 *
 * POR QUE: gif é o formato mais pesado que existe para vídeo. Os 9 primeiros
 * chegaram com 12 MB e viraram 1,8 MB — e tudo o que está nas pastas viaja no
 * pacote do app, para todo mundo, a cada atualização.
 *
 * O QUE FAZ, para cada .gif (e .webp, quando o ffmpeg consegue ler):
 *   1. gera um .mp4 de no máximo 480px de largura, mudo, 24 quadros por segundo;
 *   2. dá um nome simples ("Confused Pulp Fiction GIF.gif" → confused-pulp-fiction.mp4);
 *   3. move o original para gifs-originais/<humor>/ (fora do app e do git).
 * O que não der para converter fica como está e aparece no fim da saída.
 *
 * Precisa do ffmpeg: no PATH, na variável FFMPEG, ou instalado pelo winget.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = 'src/conteudo/gifs';
const ORIGINAIS = 'gifs-originais';

function acharFfmpeg() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return 'ffmpeg'; } catch { /* segue procurando */ }
  const winget = join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
  if (existsSync(winget)) {
    for (const pacote of readdirSync(winget).filter(p => p.startsWith('Gyan.FFmpeg'))) {
      for (const versao of readdirSync(join(winget, pacote))) {
        const exe = join(winget, pacote, versao, 'bin', 'ffmpeg.exe');
        if (existsSync(exe)) return exe;
      }
    }
  }
  return null;
}

/**
 * "certeza_Pulp Fiction GIF.gif" → "certeza_pulp-fiction".
 * O "_" separa as tags do nome do filme e é mantido; o resto vira traço.
 */
function nomeSimples(arquivo) {
  return arquivo
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+gif(\s+by\s+.*)?$/i, '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .split('_')
    .map(parte => parte.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('_') || 'gif';
}

/** As pastas a varrer: a raiz (gifs com tags no nome) e as subpastas antigas. */
function pastas() {
  return ['', ...readdirSync(RAIZ).filter(d => statSync(join(RAIZ, d)).isDirectory())];
}

const ffmpeg = acharFfmpeg();
if (!ffmpeg) {
  console.error('Não achei o ffmpeg. Instale com: winget install Gyan.FFmpeg');
  process.exit(1);
}

const kb = n => `${Math.round(n / 1024)} KB`;
const falhas = [];
for (const humor of pastas()) {
  for (const arquivo of readdirSync(join(RAIZ, humor)).filter(a => /\.(gif|webp)$/i.test(a))) {
    const origem = join(RAIZ, humor, arquivo);
    let destino = join(RAIZ, humor, `${nomeSimples(arquivo)}.mp4`);
    for (let i = 2; existsSync(destino); i++) destino = join(RAIZ, humor, `${nomeSimples(arquivo)}-${i}.mp4`);
    try {
      execFileSync(ffmpeg, [
        '-y', '-loglevel', 'error', '-i', origem, '-movflags', '+faststart', '-pix_fmt', 'yuv420p',
        '-vf', "scale='trunc(min(480,iw)/2)*2':-2:flags=lanczos,fps=24",
        '-c:v', 'libx264', '-crf', '28', '-preset', 'slow', '-an', destino,
      ], { stdio: ['ignore', 'ignore', 'pipe'] });
      if (statSync(destino).size === 0) throw new Error('saiu vazio');
      const antes = statSync(origem).size;
      mkdirSync(join(ORIGINAIS, humor), { recursive: true });
      renameSync(origem, join(ORIGINAIS, humor, arquivo));
      console.log(`✓ ${humor}/${arquivo} → ${destino.split(/[\\/]/).pop()}  (${kb(antes)} → ${kb(statSync(destino).size)})`);
    } catch {
      try { if (existsSync(destino) && statSync(destino).size === 0) execFileSync(process.platform === 'win32' ? 'cmd' : 'rm', process.platform === 'win32' ? ['/c', 'del', destino] : [destino]); } catch { /* fica */ }
      falhas.push(`${humor}/${arquivo}`);
    }
  }
}
if (falhas.length) {
  console.log('\nFicaram como estavam (o ffmpeg não leu — webp animado costuma ser isso):');
  for (const f of falhas) console.log('  · ' + f);
}
