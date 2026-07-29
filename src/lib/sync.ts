import { db } from '../db/db';
import { supabase } from './supabase';

export async function syncPerfisDeCadastro(projetoId: string) {
  try {
    // 1. Puxa todos os perfis desse projeto que estão no Supabase
    const { data: perfisRemotos, error } = await supabase
      .from('perfis')
      .select('*')
      .eq('projeto_id', projetoId);

    if (error) {
      console.error("Erro ao puxar perfis do Supabase:", error);
      throw error;
    }

    if (!perfisRemotos) return;

    // 2. Compara com os locais e insere os que não existem (ou atualiza)
    // Dexie bulkPut faz upsert (atualiza se existir, cria se não existir)
    
    // Precisamos garantir que os dados remotos não sobrescrevam dados locais mais recentes (se tivéssemos sync bidirecional complexo).
    // Para simplificar agora, como o form público só insere, e o produtor que edita:
    // Nós faremos um bulkPut de tudo que veio, mas focando em novos cadastros.
    
    await db.perfis.bulkPut(perfisRemotos);
    
    return perfisRemotos.length;
  } catch (e) {
    console.error("Falha na sincronização:", e);
    throw e;
  }
}
