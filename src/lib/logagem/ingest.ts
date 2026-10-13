import { db } from '../../db/db';
import type { StatusTake, Take } from '../../types';
import type { ClipeDoXml } from './nrt';
import { cameraECartaoDoNome } from './leitura';

/**
 * Ingest: casar o que a câmera gravou com o que foi logado, e corrigir.
 *
 * A REGRA É "O XML VENCE" (PLANO-logagem §2.10). Quem logou digitou o codec
 * entre um "ação" e um "corta"; a câmera escreveu o que ela realmente fez. Onde
 * os dois discordam, a câmera está certa.
 *
 * Mas vencer não é decidir escondido: o ingest mostra cada diferença antes de
 * aplicar. Um boletim que muda sozinho é um boletim em que ninguém confia.
 */

/** Como o clipe achou (ou não achou) o take dele. */
export type Casamento =
  | { tipo: 'igual'; clipe: ClipeDoXml; take: Take; diferencas: Diferenca[] }
  | { tipo: 'sem-take'; clipe: ClipeDoXml }
  | { tipo: 'repetido'; clipe: ClipeDoXml; take: Take };

export interface Diferenca {
  campo: keyof Take | 'duracao' | 'tcIn' | 'tcOut' | 'modeloCamera';
  rotulo: string;
  logado?: string;
  daCamera?: string;
}

const normalizar = (v?: string) => String(v ?? '').trim().toLowerCase();

/**
 * Qual take é este clipe.
 *
 * Três tentativas, da mais exata para a mais frouxa (`casarLog` do Lumavi):
 * o nome igual; o nome do clipe começando com o do take mais `_` (o take diz
 * `A003C030`, o arquivo é `A003C030_260912SL`); e o do take começando com o do
 * clipe (o boletim usou um nome mais longo).
 */
export function acharTake(takes: Take[], nome: string): Take | undefined {
  const alvo = normalizar(nome);
  if (!alvo) return undefined;

  return (
    takes.find(t => normalizar(t.arquivo) === alvo) ??
    takes.find(t => alvo.startsWith(normalizar(t.arquivo) + '_')) ??
    takes.find(t => normalizar(t.arquivo).startsWith(alvo))
  );
}

/**
 * O que o XML diz de diferente do que foi logado.
 *
 * Só entra na lista o campo que **tem valor no XML** e **discorda** do
 * boletim. Campo que o XML não traz não vira "diferença" — a FX30 não escreve
 * ISO, e isso não quer dizer que o ISO logado esteja errado.
 */
export function diferencasDoClipe(take: Take, clipe: ClipeDoXml): Diferenca[] {
  const lista: Diferenca[] = [];
  const comparar = (campo: Diferenca['campo'], rotulo: string, logado?: string, daCamera?: string) => {
    if (!daCamera) return;
    if (normalizar(logado) === normalizar(daCamera)) return;
    lista.push({ campo, rotulo, logado: logado || undefined, daCamera });
  };

  comparar('codec', 'Codec', take.codec, clipe.codec);
  comparar('fps', 'FPS', take.fps, clipe.fps);
  comparar('resolucao', 'Resolução', take.resolucao, clipe.resolucao);
  comparar('duracao', 'Duração', take.xml?.duracao, clipe.meta.duracao);
  comparar('tcIn', 'TC in', take.xml?.tcIn, clipe.meta.tcIn);
  comparar('tcOut', 'TC out', take.xml?.tcOut, clipe.meta.tcOut);
  comparar('modeloCamera', 'Câmera', take.xml?.modeloCamera, clipe.meta.modeloCamera);
  comparar('lente', 'Lente', take.lente, clipe.meta.modeloLente);

  return lista;
}

/**
 * O número do clipe dentro do nome: `A008C013` → 13, `C0148` → 148,
 * `DJI_0007` → 7. É a última sequência de dígitos, tirando antes o sufixo da
 * câmera (`A003C030_260912SL`) quando o que sobra ainda tem número.
 */
export function numeroDoClipe(nome: string): number | null {
  const semSufixo = nome.replace(/_[^_]*$/, '');
  const base = /\d/.test(semSufixo) ? semSufixo : nome;
  const m = base.match(/(\d+)\D*$/);
  return m ? Number(m[1]) : null;
}

/** "HH:MM:SS" (ou o ISO do XML) em segundos do dia. */
function segundosDoDia(hora?: string): number | null {
  const m = String(hora ?? '').match(/(\d{2}):(\d{2}):(\d{2})/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

/**
 * Quando o take pode ter sido logado em relação ao começo do clipe. Nunca
 * antes (fora 2 min de relógio desencontrado); depois, até 1 h: na Diária 1 da
 * Canção, os C013–C015 foram logados de uma vez, 12 a 18 min depois de gravados.
 */
const ANTES = 2 * 60;
const DEPOIS = 60 * 60;

/**
 * Segunda chance para o clipe que não achou take pelo nome: o MESMO número de
 * clipe, da mesma câmera, logado perto da hora em que a câmera gravou.
 *
 * É o caso do A00X errado (o boletim diz A001C013, a câmera gravou A008C013):
 * o reel mudou e o nome não bate, mas o contador de clipes e o relógio contam a
 * mesma história. Só entra take que nenhum clipe achou pelo nome, e só quando
 * a hora existe dos dois lados — o número sozinho repete de cartão em cartão.
 */
function acharPeloNumeroEHora(livres: Take[], clipe: ClipeDoXml): Take | undefined {
  const numero = numeroDoClipe(clipe.nome);
  const inicio = segundosDoDia(clipe.meta.criadoEm);
  if (numero === null || inicio === null) return undefined;
  const camera = cameraECartaoDoNome(clipe.nome).camera_id;

  let melhor: { take: Take; distancia: number } | undefined;
  for (const take of livres) {
    if (numeroDoClipe(take.arquivo || '') !== numero) continue;
    if (camera && take.camera_id && take.camera_id.toUpperCase() !== camera) continue;
    const hora = segundosDoDia(take.hora);
    if (hora === null) continue;
    if (hora < inicio - ANTES || hora > inicio + DEPOIS) continue;
    const distancia = Math.abs(hora - inicio);
    if (!melhor || distancia < melhor.distancia) melhor = { take, distancia };
  }
  return melhor?.take;
}

/**
 * Cruza os clipes lidos com os takes da diária.
 *
 * Primeiro pelo nome; o que sobrar, pelo número do clipe e pela hora — e aí o
 * nome do arquivo aparece como diferença, para o boletim passar a usar o que
 * a câmera gravou.
 *
 * Dois clipes que casam com o MESMO take viram "repetido" em vez de os dois
 * corrigirem a mesma linha: acontece quando o boletim tem um nome curto demais,
 * e aplicar os dois em cima do outro deixaria o take com os dados de um clipe
 * qualquer dos dois — sem ninguém perceber.
 */
export function cruzar(takes: Take[], clipes: ClipeDoXml[]): Casamento[] {
  const usados = new Set<string>();
  const peloNome = clipes.map(clipe => acharTake(takes, clipe.nome));
  const achadosPeloNome = new Set(peloNome.filter(Boolean).map(t => t!.id));

  return clipes.map((clipe, i) => {
    const take = peloNome[i] ?? acharPeloNumeroEHora(
      takes.filter(t => !achadosPeloNome.has(t.id) && !usados.has(t.id)), clipe,
    );
    if (!take) return { tipo: 'sem-take', clipe } as const;
    if (usados.has(take.id)) return { tipo: 'repetido', clipe, take } as const;
    usados.add(take.id);
    const diferencas = diferencasDoClipe(take, clipe);
    if (!peloNome[i]) diferencas.unshift({ campo: 'arquivo', rotulo: 'Arquivo', logado: take.arquivo, daCamera: clipe.nome });
    return { tipo: 'igual', clipe, take, diferencas } as const;
  });
}

/** O que gravar no take quando o XML vence. */
export function correcaoDoTake(clipe: ClipeDoXml, xmlAnterior?: Take['xml'], arquivoLogado?: string): Partial<Take> {
  const mudanca: Partial<Take> = {
    // O bloco `xml` guarda o que veio da câmera, separado do que foi digitado:
    // é assim que dá para saber, depois, de onde cada valor veio.
    xml: { ...xmlAnterior, ...clipe.meta },
  };
  // Casou pelo número e pela hora: o nome do boletim estava errado.
  if (arquivoLogado !== undefined && !acharTake([{ arquivo: arquivoLogado } as Take], clipe.nome)) mudanca.arquivo = clipe.nome;
  if (clipe.codec) mudanca.codec = clipe.codec;
  if (clipe.fps) mudanca.fps = clipe.fps;
  if (clipe.resolucao) mudanca.resolucao = clipe.resolucao;
  return mudanca;
}

/**
 * O take que nasce de um clipe sem take (status `IMPORT`).
 *
 * A câmera gravou e ninguém logou: pode ter sido um clipe de teste, pode ter
 * sido o take que salvou o dia enquanto o 2º AC estava resolvendo outra coisa.
 * O boletim precisa dizer que ele existe — com um status que deixa claro que
 * ninguém apertou OK nele.
 */
export function takeImportado(
  clipe: ClipeDoXml,
  base: { projeto_id: string; diaria_id: string; departamento_id?: string; camera_id: string; cartao: string },
  ordem: number
): Take {
  const hora = (clipe.meta.criadoEm?.match(/T(\d{2}:\d{2}:\d{2})/) || [])[1] || '';
  return {
    id: crypto.randomUUID(),
    projeto_id: base.projeto_id,
    diaria_id: base.diaria_id,
    departamento_id: base.departamento_id,
    cena: '',
    plano: '',
    take: 0,
    status: 'IMPORT' as StatusTake,
    hora,
    ordem,
    arquivo: clipe.nome,
    camera_id: base.camera_id,
    cartao: base.cartao,
    codec: clipe.codec,
    fps: clipe.fps,
    resolucao: clipe.resolucao,
    xml: clipe.meta,
    criado_em: Date.now(),
  };
}

/**
 * Aplica o que a pessoa aprovou na tela: corrige os takes e cria os importados.
 *
 * Só recebe o que foi escolhido. A decisão de quais clipes entram (os de outro
 * dia, os com arquivo estragado) é da tela, à vista de quem está aplicando —
 * aqui não se decide nada.
 */
export async function aplicarIngest(opcoes: {
  base: { projeto_id: string; diaria_id: string; departamento_id?: string };
  corrigir: { take: Take; clipe: ClipeDoXml }[];
  importar: { clipe: ClipeDoXml; camera_id: string; cartao: string }[];
}): Promise<{ corrigidos: number; importados: number }> {
  for (const { take, clipe } of opcoes.corrigir) {
    await db.log_takes.update(take.id, correcaoDoTake(clipe, take.xml, take.arquivo));
  }

  const existentes = await db.log_takes.where('diaria_id').equals(opcoes.base.diaria_id).toArray();
  let ordem = existentes.reduce((maior, t) => Math.max(maior, t.ordem || 0), 0);
  for (const { clipe, camera_id, cartao } of opcoes.importar) {
    ordem += 1;
    await db.log_takes.add(takeImportado(clipe, { ...opcoes.base, camera_id, cartao }, ordem));
  }

  return { corrigidos: opcoes.corrigir.length, importados: opcoes.importar.length };
}
