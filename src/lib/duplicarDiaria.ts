import { db } from '../db/db';
import type { AnexoOD, Comboio, Diaria, DiariaTask, ItemDoDia } from '../types';
import { criarDiaria } from './criarDiaria';
import type { Renumeracao } from './numeracao';
import { logAction } from './audit';

/**
 * Duplicar uma diária: copiar o PLANO, nunca o que aconteceu.
 *
 * O caso de uso é o dia que se repete — duas diárias na mesma locação, com a
 * mesma equipe, a mesma chamada e a mesma forma de dia, mudando as cenas. Montar
 * a segunda do zero é refazer à mão tudo o que já estava certo na primeira.
 *
 * ⚠️ A LINHA QUE SEPARA O QUE VEM DO QUE FICA É "PLANO × REGISTRO".
 *
 * Vem o que foi DECIDIDO antes do dia: a linha do tempo, as cenas, a equipe
 * escalada, as locações, o transporte, a base, os horários do elenco, a
 * checklist.
 *
 * Fica o que ACONTECEU no dia, porque não aconteceu na cópia: presença, quem
 * confirmou, ocorrências, rolos, cenas marcadas como gravadas, gastos, a hora
 * real em que cada item começou. Uma cópia que trouxesse isso diria que a
 * equipe já chegou num dia que ainda nem foi marcado — e o fechamento da cópia
 * contaria cenas como gravadas duas vezes.
 *
 * E fica o CICLO: a cópia nasce rascunho, sem versão e sem OD publicada. Ela é
 * um dia novo; herdar "publicada v3" faria o app avisar a equipe de mudanças num
 * papel que nunca saiu.
 */

export interface ResultadoDaDuplicacao {
  diaria: Diaria;
  renumeracao: Renumeracao;
}

/** Id novo para cada item. Ver o comentário em `duplicarDiaria`. */
const renovarItens = (linha?: ItemDoDia[]): ItemDoDia[] | undefined =>
  linha?.map(item => {
    // O que o dia REAL escreveu no item não vai para a cópia.
    const { hora_real: _real, origem_stripboard: _origem, ...plano } = item;
    return { ...plano, id: crypto.randomUUID() };
  });

export async function duplicarDiaria(origemId: string, data: string): Promise<ResultadoDaDuplicacao> {
  const origem = await db.diarias.get(origemId);
  if (!origem) throw new Error('Não encontrei a diária para duplicar.');

  /*
    A diária nasce pelo MESMO caminho de qualquer outra — número previsto,
    renumeração pela data, registro de auditoria. Duplicar não é um jeito
    paralelo de criar diária; é criar uma e preencher.
  */
  const { diaria: nova, renumeracao } = await criarDiaria(origem.projeto_id, data);

  /*
    ⚠️ OS ITENS GANHAM IDS NOVOS, e a marca de "veio do stripboard" sai.

    Os ids da linha do tempo não são decorativos: o espelho do stripboard
    reconcilia os marcadores POR ID. Com os mesmos ids da original, a cópia
    ficaria apontando para os almoços e deslocamentos de outro bloco — e no dia
    em que alguém a ligasse ao stripboard pelo "Virar OD", a reconciliação
    apagaria ou duplicaria os itens do dia errado.

    ⚠️ E O VÍNCULO COM O STRIPBOARD NÃO VEM. Uma diária em rascunho espelha o
    bloco do stripboard a que está ligada (\`stripboard_item_id\`). Se a cópia
    herdasse o vínculo, os dois dias espelhariam o mesmo bloco, e a primeira
    abertura da cópia reescreveria as cenas dela com as da original — desfazendo
    em silêncio justamente o que a pessoa duplicou para trocar. Sem vínculo, a
    cópia é dela.
  */
  const frentes = origem.frentes
    ? Object.fromEntries(Object.entries(origem.frentes).map(([grupo, f]) => [
        grupo,
        { ...f, linha_do_tempo: renovarItens(f.linha_do_tempo) },
      ]))
    : undefined;

  const plano: Partial<Diaria> = {
    chamada: origem.chamada,
    linha_do_tempo: renovarItens(origem.linha_do_tempo),
    // Diária antiga, de antes da linha do tempo, guarda o dia aqui.
    horarios: origem.horarios?.map(h => ({ ...h })),
    cena_ids: origem.cena_ids ? [...origem.cena_ids] : undefined,
    equipe_escalada: [...(origem.equipe_escalada || [])],
    locacoes_ids: [...(origem.locacoes_ids || [])],
    frentes,
    transporte: origem.transporte,
    comboios: origem.comboios?.map((c: Comboio) => ({ ...c, id: crypto.randomUUID(), passageiros_ids: [...c.passageiros_ids] })),
    base: origem.base ? { ...origem.base } : undefined,
    elenco: origem.elenco ? structuredClone(origem.elenco) : undefined,
    figuracao: origem.figuracao ? { ...origem.figuracao } : undefined,
    observacoes: origem.observacoes,
    link_reuniao: origem.link_reuniao,
    limite_gasto: origem.limite_gasto,
    valor_ideal: origem.valor_ideal,
    /*
      Os anexos vêm com id novo apontando para o MESMO arquivo.

      O arquivo não é copiado (é o mesmo roteiro do dia, a mesma planta da
      locação), mas o anexo precisa de identidade própria: apagar o anexo da
      cópia procura a diária dona pelo id, e com o mesmo id acharia a original.
    */
    anexos: origem.anexos?.map((a: AnexoOD) => ({ ...a, id: crypto.randomUUID() })),
  };

  await db.diarias.update(nova.id, plano);

  /*
    A checklist vem inteira — e toda PENDENTE.

    "Levar gerador reserva" continua valendo para o dia novo; o fato de ter sido
    cumprido no dia original, não. Uma checklist que nasce marcada é uma
    checklist que ninguém vai reler.
  */
  const tarefas = await db.diaria_tasks.where('diaria_id').equals(origemId).toArray();
  if (tarefas.length > 0) {
    await db.diaria_tasks.bulkAdd(tarefas.map((t: DiariaTask) => ({
      ...t,
      id: crypto.randomUUID(),
      diaria_id: nova.id,
      projeto_id: origem.projeto_id,
      status: 'pendente' as const,
    })));
  }

  const gravada = (await db.diarias.get(nova.id)) || { ...nova, ...plano };
  await logAction(
    origem.projeto_id, 'criar', 'diaria', nova.id,
    `Duplicou a Diária ${String(origem.numero).padStart(2, '0')} para o dia ${data}`,
  );

  return { diaria: gravada, renumeracao };
}
