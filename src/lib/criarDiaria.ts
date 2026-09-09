import { db } from '../db/db';
import type { Diaria } from '../types';
import { numeroPrevisto, renumerarPorData, type Renumeracao } from './numeracao';
import { logAction } from './audit';

/**
 * Criar uma diária — a mesma regra, venha de onde vier.
 *
 * Nasceu porque o stripboard passou a criar diárias direto do "Virar OD", e
 * duas telas criando a mesma coisa por caminhos próprios divergem em uma
 * versão: uma esquece de renumerar, a outra esquece o registro de auditoria, e
 * o projeto fica com dois tipos de diária dependendo de onde ela foi feita.
 *
 * A diária nasce com o número PREVISTO e é renumerada logo em seguida. O
 * previsto já é o certo em quase todo caso; a renumeração existe para o resto
 * do projeto acompanhar quando o dia novo entra no meio da sequência — criar a
 * diária de terça quando já existem quarta e quinta empurra as duas para a
 * frente.
 */
export async function criarDiaria(projetoId: string, data: string): Promise<{
  diaria: Diaria;
  renumeracao: Renumeracao;
}> {
  const existentes = await db.diarias.where('projeto_id').equals(projetoId).toArray();

  const nova: Diaria = {
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    numero: numeroPrevisto(existentes, data),
    data,
    tem_unidade_b: false,
    equipe_escalada: [],
    locacoes_ids: [],
  };

  await db.diarias.add(nova);
  const renumeracao = await renumerarPorData(projetoId);
  await logAction(projetoId, 'criar', 'diaria', nova.id, `Criou uma diária para o dia ${data}`);

  /*
    O número devolvido é relido do banco, e não o previsto.

    A renumeração pode ter mudado o número desta mesma diária, e quem chamou
    costuma mostrá-lo na tela em seguida ("as cenas foram para a Diária 05").
    Dizer o número errado logo depois de criar é o tipo de erro que faz a pessoa
    procurar a diária certa na lista e não achar.
  */
  const gravada = await db.diarias.get(nova.id);
  return { diaria: gravada || nova, renumeracao };
}

/**
 * A data que o formulário deve sugerir para a próxima diária.
 *
 * O dia seguinte ao da última diária — produção filma em dias seguidos, e
 * quando não filma, mudar a data é um toque. Sem diária nenhuma, hoje: quem
 * está montando a primeira quase sempre está montando o dia que vem aí.
 *
 * ⚠️ Nunca devolve uma data no passado por causa de uma diária antiga: se a
 * última já aconteceu, o palpite é hoje. Sugerir ontem faria a diária nova
 * nascer com o aviso de "esse dia já passou" que o app dá logo em seguida.
 */
export function dataSugerida(diarias: Diaria[]): string {
  const hoje = new Date();
  const paraISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const hojeISO = paraISO(hoje);

  const datas = diarias.map(d => d.data).filter(Boolean).sort();
  const ultima = datas[datas.length - 1];
  if (!ultima) return hojeISO;

  const seguinte = new Date(ultima + 'T12:00');
  seguinte.setDate(seguinte.getDate() + 1);
  const sugestao = paraISO(seguinte);

  return sugestao < hojeISO ? hojeISO : sugestao;
}
