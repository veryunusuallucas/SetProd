import { db } from '../db/db';
import { montarLinha, cenasDaQuebra, blocoDaQuebra, ROTULOS, type ItemLinha } from './stripboard';
import type { Cena, Diaria, StripboardItem, ItemDoDia, TipoItemDia } from '../types';

/**
 * A ponte entre o stripboard e a Ordem do Dia — a Opção C do plano.
 *
 * O PROBLEMA
 * Existiam duas fontes de verdade para "quais cenas em qual dia": a ordem do
 * stripboard (calculada percorrendo a linha e contando quebras) e a lista
 * `Diaria.cena_ids` (gravada quando alguém clicou em "Virar OD"). Elas nascem
 * iguais e divergem no minuto seguinte: arrastar uma cena depois de exportar não
 * mudava a OD, e tirar uma cena da OD não chegava ao stripboard.
 *
 * A ESCOLHA
 * Nem "o stripboard sempre manda" (perigoso: a equipe já recebeu o PDF, e
 * reordenar às 23h mudaria a OD de amanhã sem avisar ninguém), nem "só
 * exportação manual" (previsível, mas repetitivo enquanto o plano ainda muda).
 *
 * A diária tem estado. Enquanto **rascunho**, ela espelha o stripboard. Ao
 * **publicar**, congela — e mudança no stripboard vira aviso, para alguém
 * decidir. Nunca aplicada sozinha.
 */

export type EstadoDiaria = 'rascunho' | 'travada' | 'publicada' | 'fechada';

/**
 * O estado, com as diárias antigas incluídas.
 *
 * `fechada` é o campo velho e continua valendo: quem já tinha diária fechada
 * antes deste campo existir não deveria vê-la voltar a rascunho.
 */
export function estadoDa(diaria: Diaria): EstadoDiaria {
  if (diaria.estado) return diaria.estado;
  return diaria.fechada ? 'fechada' : 'rascunho';
}

export const ROTULO_ESTADO: Record<EstadoDiaria, string> = {
  rascunho: 'Rascunho',
  travada: 'Travada',
  publicada: 'Publicada',
  fechada: 'Fechada',
};

/** O plano só se edita em rascunho. Travada e publicada congelam. */
export function planoEditavel(diaria: Diaria): boolean {
  return estadoDa(diaria) === 'rascunho';
}

/**
 * Trava a diária: congela sem distribuir.
 *
 * Não mexe em `versao_od` nem em `data_publicacao` de propósito — travar não é
 * um evento para a equipe, é uma proteção interna. Quem trava não está dizendo
 * "está pronta para o set", está dizendo "parem de mexer nesta enquanto eu acerto
 * as outras".
 */
export async function travarDiaria(diariaId: string): Promise<void> {
  await db.diarias.update(diariaId, { estado: 'travada' });
}

export interface Diferenca {
  entram: Cena[];
  saem: Cena[];
  /** A quebra de origem sumiu do stripboard — não dá para comparar mais nada. */
  orfa: boolean;
}

export const semDiferenca = (d: Diferenca) => !d.orfa && d.entram.length === 0 && d.saem.length === 0;

/**
 * O que mudou no stripboard desde a última vez, para esta diária.
 *
 * Devolve `null` quando a diária não veio de uma quebra — nesse caso ela nunca
 * foi um espelho, e comparar não faria sentido.
 */
export function diferencaDeCenas(
  diaria: Diaria,
  cenas: Cena[],
  itens: StripboardItem[]
): Diferenca | null {
  if (!diaria.stripboard_item_id) return null;

  const linha = montarLinha(cenas, itens);
  const doStripboard = cenasDaQuebra(linha, diaria.stripboard_item_id);

  // A quebra foi apagada. Isto NÃO é "zero cenas": é "perdi a referência", e
  // tratar como zero esvaziaria a Ordem do Dia porque alguém removeu um
  // marcador do stripboard.
  if (doStripboard === null) return { entram: [], saem: [], orfa: true };

  const naOD = new Set(diaria.cena_ids || []);
  const naLinha = new Set(doStripboard.map(c => c.id));

  return {
    entram: doStripboard.filter(c => !naOD.has(c.id)),
    saem: cenas.filter(c => naOD.has(c.id) && !naLinha.has(c.id)),
    orfa: false,
  };
}

/**
 * Grava no banco as cenas do stripboard.
 *
 * A ordem vem da linha do tempo, não da ordem antiga da diária: reordenar o
 * stripboard é justamente o que a pessoa quer ver refletido.
 */
export async function aplicarDoStripboard(
  diaria: Diaria,
  cenas: Cena[],
  itens: StripboardItem[]
): Promise<boolean> {
  if (!diaria.stripboard_item_id) return false;

  const linha = montarLinha(cenas, itens);
  const bloco = blocoDaQuebra(linha, diaria.stripboard_item_id);
  if (bloco === null) return false;

  const novos = bloco.flatMap(i => (i.tipo === 'SCENE' ? [i.cena.id] : []));
  const atuais = diaria.cena_ids || [];
  const mesmasCenas = novos.length === atuais.length && novos.every((id, i) => id === atuais[i]);

  /*
    A LINHA DO TEMPO SÓ NASCE UMA VEZ (spec §2.3).

    Quando a diária ainda não tem uma, ela é semeada com o bloco inteiro do
    stripboard — cenas, almoço e deslocamentos, na ordem, com a estimativa de
    cada cena. É o que faz o cronograma se montar praticamente sozinho.

    ⚠️ Se ela JÁ existe, não se toca nela, nem quando as cenas mudam. Alguém
    passou a noite ajustando horários e travando a chamada; refazer a linha a
    cada sincronia apagaria esse trabalho em silêncio. As cenas novas entram
    pelo fim, pela reconciliação em `montarLinhaDoDia`, onde dá para ver.
  */
  const semLinha = !diaria.linha_do_tempo || diaria.linha_do_tempo.length === 0;
  if (mesmasCenas && !semLinha) return false;

  await db.diarias.update(diaria.id, {
    cena_ids: novos,
    ...(semLinha ? { linha_do_tempo: linhaDoTempoDoBloco(bloco) } : {}),
  });
  return true;
}

/** Traduz o bloco do stripboard para os itens da linha do dia. */
function linhaDoTempoDoBloco(bloco: ItemLinha[]): ItemDoDia[] {
  const TIPO: Partial<Record<string, TipoItemDia>> = {
    BANNER_LUNCH: 'almoco',
    BANNER_SNACK: 'coffee',
    BANNER_MOVE: 'move',
    BANNER_NOTE: 'nota',
  };

  return bloco.map(i => {
    if (i.tipo === 'SCENE') {
      return { id: `cena-${i.cena.id}`, tipo: 'cena' as const, cena_id: i.cena.id };
    }
    return {
      id: i.item.id,
      tipo: TIPO[i.tipo] || 'marco',
      titulo: i.item.titulo || ROTULOS[i.tipo],
      // A duração vem do banner quando ela foi definida lá. `undefined` cai no
      // padrão do tipo — 60min de almoço, 30 de deslocamento.
      ...(i.item.duracao_min !== undefined ? { duracao_min: i.item.duracao_min } : {}),
    };
  });
}

/**
 * Publica: a OD sai e as cenas param de se mexer sozinhas.
 *
 * O congelamento não é um campo a mais — é o contrato com quem está no set. A
 * partir daqui o app pode sugerir mudanças, nunca aplicá-las.
 */
export async function publicarDiaria(diariaId: string): Promise<void> {
  await db.diarias.update(diariaId, { estado: 'publicada', data_publicacao: Date.now() });
}

/**
 * Volta para rascunho.
 *
 * `versao_od` NÃO é zerada. É de propósito: se a diária já saiu uma vez, a
 * próxima exportação tem que ser v2, e não v1 de novo — senão existem dois
 * papéis diferentes com o mesmo número na mão da equipe, que é o pior resultado
 * possível deste botão.
 */
export async function despublicarDiaria(diariaId: string): Promise<void> {
  await db.diarias.update(diariaId, { estado: 'rascunho', data_publicacao: undefined });
}

/**
 * Uma diária cuja data já passou.
 *
 * Serve para não oferecer, em silêncio, um dia que já aconteceu. O caso real é
 * reencaixe: a cena não saiu, alguém volta ao stripboard e manda para "a última
 * diária" — que era ontem. A cena entra num dia morto e some do radar.
 *
 * Compara só a data, nunca a hora: uma diária de hoje continua válida às 22h.
 */
export function jaAconteceu(diaria: Diaria): boolean {
  if (!diaria.data) return false;
  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  return diaria.data < hojeISO;
}
