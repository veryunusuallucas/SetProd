import { db } from '../db/db';

export async function notificar(projeto_id: string, texto: string, opts?: { perfil_id?: string; task_id?: string }) {
  await db.notificacoes.add({
    id: crypto.randomUUID(),
    projeto_id,
    perfil_id: opts?.perfil_id,
    texto,
    task_id: opts?.task_id,
    lida: false,
    data: Date.now(),
  });
}
