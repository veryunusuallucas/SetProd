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
    A LINHA DO TEMPO NASCE DO BLOCO, E DEPOIS CONTINUA ACOMPANHANDO — SÓ OS
    MARCADORES.

    Quando a diária ainda não tem linha, ela é semeada com o bloco inteiro:
    cenas, refeições e deslocamentos, na ordem, com a estimativa de cada cena.

    Se ela já existe, a linha NÃO é refeita — alguém passou a noite ajustando
    horários e travando a chamada, e refazer tudo a cada sincronia apagaria esse
    trabalho em silêncio. O que entra é só a diferença de marcadores: o que foi
    acrescentado no stripboard aparece aqui, o que foi apagado lá some daqui, e
    tudo o mais fica exatamente onde está.

    ⚠️ ISTO SÓ RODA EM RASCUNHO. Quem chama (`SincroniaStripboard`) verifica o
    estado antes. Diária travada ou publicada não se mexe sozinha — é a razão de
    esses dois estados existirem.
  */
  const semLinha = !diaria.linha_do_tempo || diaria.linha_do_tempo.length === 0;

  if (semLinha) {
    await db.diarias.update(diaria.id, {
      cena_ids: novos,
      linha_do_tempo: linhaDoTempoDoBloco(bloco),
    });
    return true;
  }

  const linhaNova = reconciliarMarcadores(diaria.linha_do_tempo!, bloco);
  const linhaMudou = mudouAlgo(diaria.linha_do_tempo!, linhaNova);

  if (mesmasCenas && !linhaMudou) return false;

  await db.diarias.update(diaria.id, {
    cena_ids: novos,
    ...(linhaMudou ? { linha_do_tempo: linhaNova } : {}),
  });
  return true;
}

/**
 * Traz do bloco para a linha existente o que mudou nos MARCADORES.
 *
 * Três coisas, e só elas:
 *
 *   entra   marcador novo no stripboard, na mesma posição relativa — logo
 *           depois da cena que vem antes dele no bloco, e não no fim do dia.
 *           Um coffee break jogado no fim da lista é pior que nenhum.
 *   sai     marcador que foi apagado do stripboard. Só os que têm
 *           `origem_stripboard`: item feito à mão aqui dentro nunca some.
 *   muda    nome e duração, enquanto ninguém tiver editado o item AQUI. Depois
 *           de editado, a diária ganha e o stripboard para de sobrescrever.
 *
 * O que ela nunca toca: ordem dos itens que já estavam, horário travado, hora
 * real, e qualquer item que a pessoa acrescentou na própria diária.
 */
export function reconciliarMarcadores(linha: ItemDoDia[], bloco: ItemLinha[]): ItemDoDia[] {
  const doBloco = new Map<string, ItemDoDia>();
  for (const item of linhaDoTempoDoBloco(bloco)) {
    if (item.origem_stripboard) doBloco.set(item.id, item);
  }

  // Fora os apagados, e atualiza os que o stripboard ainda manda.
  const mantidos = linha.flatMap(item => {
    if (!item.origem_stripboard) return [item];

    const noBloco = doBloco.get(item.id);
    if (!noBloco) return [];              // apagado no stripboard
    if (item.editado_na_diaria) return [item];

    return [{ ...item, titulo: noBloco.titulo, duracao_min: noBloco.duracao_min }];
  });

  /*
    Os novos, cada um logo depois da sua âncora.

    A âncora é a última CENA antes dele no bloco — a cena é a referência que
    existe dos dois lados. Marcador antes de qualquer cena entra no começo do
    dia; âncora que não está na linha (não deveria acontecer) manda o item para
    o fim, que é melhor que sumir.
  */
  const jaTem = new Set(mantidos.map(i => i.id));
  const resultado = [...mantidos];

  let ancora: string | null = null;
  for (const i of bloco) {
    if (i.tipo === 'SCENE') { ancora = `cena-${i.cena.id}`; continue; }

    const novo = doBloco.get(i.item.id);
    if (!novo || jaTem.has(novo.id)) continue;

    const onde = ancora === null ? 0 : resultado.findIndex(x => x.id === ancora) + 1;
    if (onde === 0 && ancora !== null) resultado.push(novo);
    else resultado.splice(onde, 0, novo);
    jaTem.add(novo.id);
  }

  return resultado;
}

/** Compara duas linhas pelo que importa: quem está, em que ordem, e com quê. */
function mudouAlgo(antes: ItemDoDia[], depois: ItemDoDia[]): boolean {
  if (antes.length !== depois.length) return true;
  return antes.some((a, i) => {
    const b = depois[i];
    return a.id !== b.id || a.titulo !== b.titulo || a.duracao_min !== b.duracao_min;
  });
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
      origem_stripboard: true,
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
