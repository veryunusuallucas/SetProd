import { db } from '../db/db';
import type { Task } from '../types';

export const TITULO_TASK_MAE_DECUPAGEM = 'Análise Técnica / Decupagem';

/**
 * v4 §5.5: tudo que nasce na decupagem/breakdown vira subtarefa de uma task-mãe
 * automática, em vez de poluir o Kanban com tasks soltas.
 * Devolve quantos itens foram efetivamente adicionados (ignora duplicados).
 */
export async function adicionarSubtarefasDecupagem(projetoId: string, titulos: string[]): Promise<number> {
  const novos = titulos.map(t => t.trim()).filter(Boolean);
  if (novos.length === 0) return 0;

  let taskMae = await db.tasks
    .where('projeto_id')
    .equals(projetoId)
    .filter(t => t.titulo === TITULO_TASK_MAE_DECUPAGEM)
    .first();

  if (!taskMae) {
    taskMae = {
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      titulo: TITULO_TASK_MAE_DECUPAGEM,
      descricao: 'Itens levantados na análise técnica do roteiro.',
      status: 'doing',
      data_criacao: Date.now(),
      subtarefas: [],
    } as Task;
    await db.tasks.add(taskMae);
  }

  const existentes = taskMae.subtarefas || [];
  const jaTem = new Set(existentes.map(s => s.titulo.toLowerCase()));

  const adicionar = novos
    .filter(t => !jaTem.has(t.toLowerCase()))
    .map(titulo => ({ id: crypto.randomUUID(), titulo, concluida: false }));

  if (adicionar.length === 0) return 0;

  await db.tasks.update(taskMae.id, { subtarefas: [...existentes, ...adicionar] });
  return adicionar.length;
}
