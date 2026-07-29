import { db } from '../db/db';
import { supabase } from './supabase';
import type { AcaoLog, EntidadeLog } from '../types';

export async function logAction(
  projeto_id: string,
  acao: AcaoLog,
  entidade: EntidadeLog,
  entidade_id: string,
  detalhes: string
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fallback if not logged in (though we shouldn't get here because of ProtectedRoute)
    const autor_id = session?.user?.id || 'offline_user';
    const autor_nome = session?.user?.email || 'Usuário Local';
    
    await db.logs.add({
      id: crypto.randomUUID(),
      projeto_id,
      autor_id,
      autor_nome,
      acao,
      entidade,
      entidade_id,
      detalhes,
      data_hora: Date.now()
    });
  } catch (err) {
    console.error('Erro ao registrar log de auditoria', err);
  }
}
