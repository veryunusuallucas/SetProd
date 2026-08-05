/**
 * Copia os "standard fonts" do pdf.js para public/pdfjs/standard_fonts.
 *
 * Por que isto existe: sem esses arquivos o pdf.js não consegue montar as
 * fontes base do PDF (Courier, Helvetica, Times). Ele substitui por outra, as
 * larguras saem erradas e a camada de texto — que é invisível e fica por cima
 * dos glifos — desliza para o lado. Na prática você seleciona o "S" de SALA e
 * o navegador devolve "ALA".
 *
 * Ficam em public/ (e não num CDN) porque o app é offline-first: no set não há
 * internet, e sem fonte o roteiro fica ilegível justamente na hora de usar.
 *
 * Roda sozinho no postinstall; para rodar à mão: npm run pdfjs:fontes
 */
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const origem = resolve(raiz, 'node_modules/pdfjs-dist/standard_fonts');
const destino = resolve(raiz, 'public/pdfjs/standard_fonts');

if (!existsSync(origem)) {
  // Não derruba o install: em CI sem dependências opcionais o pdfjs pode não
  // estar lá ainda, e falhar aqui esconderia o erro de verdade.
  console.warn('[pdfjs] standard_fonts não encontrado em node_modules — pulei a cópia.');
  process.exit(0);
}

await mkdir(dirname(destino), { recursive: true });
await cp(origem, destino, { recursive: true });
console.log(`[pdfjs] fontes copiadas para ${destino}`);
