import type { Task } from '../types';

/**
 * Quem responde por uma tarefa — a resposta única, para os dois formatos.
 *
 * ⚠️ NUNCA LEIA `task.responsavel_id` DIRETO. Ele é o PRIMEIRO responsável, não
 * o responsável: a tarefa passou a aceitar várias pessoas, e quem lê só aquele
 * campo enxerga uma. O sintoma é traiçoeiro — a tarefa aparece na lista de uma
 * pessoa e some da lista da outra, sem nada na tela explicando a diferença.
 *
 * Tarefa antiga tem só `responsavel_id`; tarefa nova tem os dois. Aqui os dois
 * casos viram a mesma lista, e o resto do app não precisa saber que existe
 * diferença.
 */
export function responsaveisDaTask(task: Pick<Task, 'responsavel_id' | 'responsaveis_ids'>): string[] {
  if (task.responsaveis_ids?.length) return task.responsaveis_ids;
  return task.responsavel_id ? [task.responsavel_id] : [];
}

/** A pessoa responde por esta tarefa? */
export function respondePor(task: Pick<Task, 'responsavel_id' | 'responsaveis_ids'>, perfilId?: string): boolean {
  return Boolean(perfilId) && responsaveisDaTask(task).includes(perfilId!);
}

/**
 * O que gravar quando a lista de responsáveis muda.
 *
 * Escreve os DOIS campos, e é de propósito: `responsavel_id` é o índice da
 * tabela no Dexie e o que as tarefas antigas têm. Deixá-lo para trás faria as
 * consultas por dono devolverem a pessoa errada — e sem erro nenhum, que é o
 * pior jeito de estar errado.
 *
 * Lista vazia limpa os dois: tarefa sem dono é um estado válido, e é como uma
 * tarefa nasce quando ninguém assumiu ainda.
 */
export function gravarResponsaveis(ids: string[]): Pick<Task, 'responsavel_id' | 'responsaveis_ids'> {
  const limpos = [...new Set(ids.filter(Boolean))];
  return {
    responsavel_id: limpos[0] || undefined,
    responsaveis_ids: limpos.length ? limpos : undefined,
  };
}
