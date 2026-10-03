/**
 * A biblioteca de gifs do app, por TAG.
 *
 * O NOME DO ARQUIVO É O CADASTRO (Lucas, 03/10/2026). Tudo mora numa pasta só,
 * `src/conteudo/gifs/`, e cada arquivo diz suas emoções antes do filme:
 *
 *     certeza_medo_pulp-fiction-jules.mp4
 *     └──────┬────┘ └───────┬────────┘
 *          tags        o que é (último pedaço)
 *
 * Um gif pode ter várias tags e serve a vários momentos — o Jules apontando a
 * arma é "tem certeza?" e é "medo". Com pastas, ele teria que escolher uma.
 *
 * ONDE CADA TAG APARECE: ver `MOMENTOS`, abaixo. Tag nova no nome do arquivo
 * não quebra nada — só não é usada até alguém dizer onde. Sinônimos em inglês
 * viram a tag em português (happy → feliz, sad → triste...).
 *
 * Lido NA BUILD (`import.meta.glob`): navegador não lista pasta. Arquivo novo
 * só aparece depois do push; em troca, tudo funciona no set sem sinal.
 * Jogou um .gif? `npm run gifs` converte para mp4 leve. Ver o LEIAME da pasta.
 */

const ARQUIVOS = import.meta.glob(
  '../conteudo/gifs/**/*.{gif,GIF,webp,WEBP,png,PNG,jpg,JPG,jpeg,JPEG,mp4,MP4}',
  { eager: true, query: '?url', import: 'default' }
) as Record<string, string>;

/** O que se escreve em inglês, ou com acento, e a tag que o app entende. */
const SINONIMOS: Record<string, string> = {
  happy: 'feliz', sad: 'triste', scared: 'medo', fear: 'medo', fun: 'engracado', funny: 'engracado',
  doubt: 'duvida', confused: 'duvida', sure: 'certeza', empty: 'vazio',
  party: 'comemorar', celebrating: 'comemorar', celebrate: 'comemorar', congratulations: 'comemorar',
  celebrar: 'comemorar', comemoracao: 'comemorar', dance: 'comemorar', danca: 'comemorar',
  opening: 'abertura', inicio: 'abertura',
  correct: 'aprovado', agree: 'aprovado', concordar: 'aprovado', certo: 'aprovado',
};

export interface Midia {
  url: string;
  /** mp4 vai num `<video>` mudo em laço — o mesmo trecho pesa um décimo do gif. */
  video: boolean;
  /** O último pedaço do nome: o filme ou a cena ("pulp-fiction-jules"). */
  nome: string;
  tags: string[];
}

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

function lerArquivo(caminho: string, url: string): Midia {
  const partes = caminho.split('/');
  const arquivo = partes.pop()!.replace(/\.[^.]+$/, '');
  // Subpasta (o jeito antigo) também conta como tag: feliz/x.mp4 = feliz_x.
  const pasta = partes[partes.length - 1] !== 'gifs' ? [partes[partes.length - 1]] : [];
  const pedacos = arquivo.split('_').filter(Boolean);
  const nome = pedacos.length > 1 ? pedacos.pop()! : arquivo;
  const soNome = pedacos.length === 1 && pedacos[0] === nome;
  const tags = [...pasta, ...(soNome ? [] : pedacos)]
    .map(t => semAcento(t.toLowerCase().trim()))
    .map(t => SINONIMOS[t] || t);
  return { url, video: /\.mp4$/i.test(caminho), nome, tags: [...new Set(tags)] };
}

export const BIBLIOTECA: Midia[] = Object.keys(ARQUIVOS).sort().map(c => lerArquivo(c, ARQUIVOS[c]));

/** `{ feliz: [...], medo: [...] }` — cada gif aparece em todas as suas tags. */
export const GIFS: Record<string, Midia[]> = {};
for (const m of BIBLIOTECA) for (const t of m.tags) (GIFS[t] ||= []).push(m);

export type Humor = 'abertura' | 'comemorar' | 'feliz' | 'triste' | 'medo' | 'certeza' | 'duvida' | 'vazio' | (string & {});

/**
 * ONDE O APP USA CADA TAG. A ordem é a preferência: a primeira que tiver algum
 * gif ganha — por isso uma tag pode entrar aqui antes de ter arquivos.
 */
export const MOMENTOS = {
  /** A produção acabou de ser criada (a carta de abertura). */
  abertura: ['abertura', 'comemorar'],
  /** Fim da diária (a carta do wrap). */
  wrap: ['comemorar', 'feliz'],
  /** O acerto de alguém zerou ("tudo quite"). */
  quite: ['feliz', 'comemorar'],
  /** Perguntas de apagar e desfazer. */
  apagar: ['triste'],
  /** O que não tem volta: apagar uma produção de vez, arquivar o financeiro. */
  semVolta: ['certeza', 'medo', 'triste'],
  /** As perguntas comuns de "tem certeza?". */
  pergunta: ['duvida', 'certeza'],
  /** Membro novo quase sem dados ("tem quase nada aí"). */
  vazio: ['vazio', 'duvida'],
} satisfies Record<string, Humor[]>;

/**
 * Um gif para as tags pedidas, sem repetir o último mostrado com elas.
 *
 * A memória é por aparelho: quem apaga três coisas seguidas não vê o mesmo
 * choro três vezes — a repetição é a única que a pessoa percebe.
 */
export function sortearGif(humores: Humor | readonly Humor[]): Midia | null {
  const humor = ([] as Humor[]).concat(humores).find(h => (GIFS[h] || []).length > 0);
  if (!humor) return null;
  const lista = GIFS[humor];
  const chave = `setprod:gif-anterior:${humor}`;
  let anterior: string | null = null;
  try { anterior = localStorage.getItem(chave); } catch { /* sem memória, sorteia igual */ }
  const candidatos = lista.length > 1 ? lista.filter(m => m.url !== anterior) : lista;
  const escolhido = candidatos[Math.floor(Math.random() * candidatos.length)];
  try { localStorage.setItem(chave, escolhido.url); } catch { /* idem */ }
  return escolhido;
}
