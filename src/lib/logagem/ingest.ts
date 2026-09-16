import { db } from '../../db/db';
import type { StatusTake, Take } from '../../types';
import type { ClipeDoXml } from './nrt';

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
 * Cruza os clipes lidos com os takes da diária.
 *
 * Dois clipes que casam com o MESMO take viram "repetido" em vez de os dois
 * corrigirem a mesma linha: acontece quando o boletim tem um nome curto demais,
 * e aplicar os dois em cima do outro deixaria o take com os dados de um clipe
 * qualquer dos dois — sem ninguém perceber.
 */
export function cruzar(takes: Take[], clipes: ClipeDoXml[]): Casamento[] {
  const usados = new Set<string>();

  return clipes.map(clipe => {
    const take = acharTake(takes, clipe.nome);
    if (!take) return { tipo: 'sem-take', clipe } as const;
    if (usados.has(take.id)) return { tipo: 'repetido', clipe, take } as const;
    usados.add(take.id);
    return { tipo: 'igual', clipe, take, diferencas: diferencasDoClipe(take, clipe) } as const;
  });
}

/** O que gravar no take quando o XML vence. */
export function correcaoDoTake(clipe: ClipeDoXml, xmlAnterior?: Take['xml']): Partial<Take> {
  const mudanca: Partial<Take> = {
    // O bloco `xml` guarda o que veio da câmera, separado do que foi digitado:
    // é assim que dá para saber, depois, de onde cada valor veio.
    xml: { ...xmlAnterior, ...clipe.meta },
  };
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
    await db.log_takes.update(take.id, correcaoDoTake(clipe, take.xml));
  }

  const existentes = await db.log_takes.where('diaria_id').equals(opcoes.base.diaria_id).toArray();
  let ordem = existentes.reduce((maior, t) => Math.max(maior, t.ordem || 0), 0);
  for (const { clipe, camera_id, cartao } of opcoes.importar) {
    ordem += 1;
    await db.log_takes.add(takeImportado(clipe, { ...opcoes.base, camera_id, cartao }, ordem));
  }

  return { corrigidos: opcoes.corrigir.length, importados: opcoes.importar.length };
}
