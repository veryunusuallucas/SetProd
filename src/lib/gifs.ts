/**
 * Os gifs do app, separados por HUMOR.
 *
 * Nasceram só no wrap (src/conteudo/wrap/gifs/). A pedido do Lucas
 * (02/10/2026) viraram uma coleção do app inteiro, numa pasta por humor:
 *
 *     src/conteudo/gifs/feliz/    o wrap, as comemorações
 *     src/conteudo/gifs/triste/   apagar, desfazer, o que dá pena
 *     src/conteudo/gifs/duvida/   "tem certeza?" — as outras confirmações
 *
 * PASTA NOVA = HUMOR NOVO. Criar `src/conteudo/gifs/susto/` e jogar arquivos
 * lá já faz `sortearGif('susto')` funcionar — falta só usar em algum lugar.
 *
 * Como a lista do wrap, isto é lido NA BUILD (`import.meta.glob`): navegador
 * não lista pasta. Arquivo novo só aparece depois do push, e em troca tudo
 * funciona no set sem sinal. Ver `src/conteudo/gifs/LEIAME.md`.
 */

const ARQUIVOS = import.meta.glob(
  '../conteudo/gifs/*/*.{gif,GIF,webp,WEBP,png,PNG,jpg,JPG,jpeg,JPEG,mp4,MP4}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

export interface Midia {
  url: string;
  /** mp4 vai num `<video>` mudo em laço — o mesmo trecho pesa um décimo do gif. */
  video: boolean;
  /** O nome do arquivo, sem extensão — para a galeria (galeria-gifs.html). */
  nome: string;
}

/** `{ feliz: [...], triste: [...] }` — o nome da pasta é o humor. */
export const GIFS: Record<string, Midia[]> = {};
for (const caminho of Object.keys(ARQUIVOS).sort()) {
  const humor = caminho.split('/').slice(-2, -1)[0].toLowerCase();
  const nome = caminho.split('/').pop()!.replace(/\.[^.]+$/, '');
  (GIFS[humor] ||= []).push({ url: ARQUIVOS[caminho], video: /\.mp4$/i.test(caminho), nome });
}

export type Humor = 'feliz' | 'triste' | (string & {});

/**
 * Um gif do humor, sem repetir o último mostrado daquele humor.
 *
 * A memória é por humor e por aparelho: quem apaga três coisas seguidas não vê
 * o mesmo choro três vezes — a repetição é a única que a pessoa percebe.
 */
export function sortearGif(humor: Humor): Midia | null {
  const lista = GIFS[humor] || [];
  if (lista.length === 0) return null;
  const chave = `setprod:gif-anterior:${humor}`;
  let anterior: string | null = null;
  try { anterior = localStorage.getItem(chave); } catch { /* sem memória, sorteia igual */ }
  const candidatos = lista.length > 1 ? lista.filter(m => m.url !== anterior) : lista;
  const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
  try { localStorage.setItem(chave, escolhido.url); } catch { /* idem */ }
  return escolhido;
}
