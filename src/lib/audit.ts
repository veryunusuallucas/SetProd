import { db } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import { contaAtual } from './conta';
import type { AcaoLog, AuditLog, EntidadeLog } from '../types';

/**
 * A ata da produção — quem fez o quê, e quando.
 *
 * DESDE 18/09/2026 NÃO SE APAGA (ROADMAP, Etapa 7). Antes o log viajava pelo
 * espelho como qualquer tabela, e quem o apagava aqui apagava para todo mundo.
 * Agora ele sobe para `auditoria`, uma tabela do servidor onde ninguém altera
 * nem apaga — nem o dono (`supabase/sql/auditoria.sql`).
 *
 * O CAMINHO DE UM REGISTRO
 * 1. `logAction` grava na cópia local (`logs`, que é o que a ata do rodapé
 *    lê) e na caixa de saída (`fila_auditoria`);
 * 2. `sincronizarAuditoria`, a cada volta do sync, sobe a caixa de saída e
 *    traz o que os outros registraram.
 *
 * SEM SINAL, O LOG ESPERA — decisão escrita, como o ROADMAP pede. A fila é
 * própria e sobrevive a fechar o app; o que foi feito no set sem internet entra
 * na ata quando o sinal volta, com a hora em que aconteceu (`data_hora`). O
 * único jeito de perder é sair da conta com a fila cheia e sem rede — e o
 * logout avisa disso (`limpezaLocal.ts`).
 */

export async function logAction(
  projeto_id: string,
  acao: AcaoLog,
  entidade: EntidadeLog,
  entidade_id: string,
  detalhes: string
) {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    const registro: AuditLog = {
      id: crypto.randomUUID(),
      projeto_id,
      // Sem conta (app sem Supabase), o registro fica só aqui: não há quem assine.
      autor_id: session?.user?.id || 'offline_user',
      autor_nome: session?.user?.email || 'Usuário Local',
      acao,
      entidade,
      entidade_id,
      detalhes,
      data_hora: Date.now(),
    };

    await db.logs.add(registro);
    if (session?.user) await db.fila_auditoria.add(registro);
  } catch (err) {
    console.error('Erro ao registrar log de auditoria', err);
  }
}

/** Até onde a ata deste projeto já foi lida do servidor — por conta, como o sync. */
const chaveCursor = (projetoId: string) => `setprod_cursor_auditoria_${contaAtual()}_${projetoId}`;

/** Recusa de RLS: a conta não é (mais) da produção. Reenviar não muda nada. */
const RECUSADO_PELA_RLS = '42501';
/** A tabela ainda não existe — o `auditoria.sql` não rodou. Espera, não descarta. */
const TABELA_INEXISTENTE = '42P01';

/**
 * Sobe o que foi registrado aqui e traz o que os outros registraram.
 *
 * Nunca lança: a ata é acessório da sincronização, e um erro nela não pode
 * virar "Erro" no rodapé de quem só quer salvar a diária.
 */
export async function sincronizarAuditoria(projetoId: string): Promise<void> {
  if (!supabaseConfigurado) return;
  try {
    await enviarAuditoria(projetoId);
    await puxarAuditoria(projetoId);
  } catch (e: any) {
    if (e?.code !== TABELA_INEXISTENTE) console.warn('[SetProd] Ata: não consegui sincronizar', e?.message || e);
  }
}

async function enviarAuditoria(projetoId: string) {
  const fila = await db.fila_auditoria.where('projeto_id').equals(projetoId).toArray();
  if (!fila.length) return;

  const linhas = fila.map(({ id, projeto_id, autor_id, autor_nome, acao, entidade, entidade_id, detalhes, data_hora }) => ({
    id, projeto_id, autor_id, autor_nome, acao, entidade, entidade_id, detalhes, data_hora,
  }));

  // `ignoreDuplicates` vira `on conflict do nothing`: o mesmo log reenviado
  // depois de uma queda é ignorado. Não usa update — que ninguém tem ali.
  const { error } = await supabase.from('auditoria').upsert(linhas, { onConflict: 'id', ignoreDuplicates: true });

  if (error && error.code !== RECUSADO_PELA_RLS) throw error;
  // Subiu, ou foi recusado de vez (a conta saiu da produção): de qualquer jeito
  // não fica na fila, senão seria reenviado para sempre.
  await db.fila_auditoria.bulkDelete(fila.map(f => f.id));
}

async function puxarAuditoria(projetoId: string) {
  const PAGINA = 200;
  for (;;) {
    let cursor: string | null = null;
    try { cursor = localStorage.getItem(chaveCursor(projetoId)); } catch { /* sem cursor: desde o começo */ }

    let consulta = supabase
      .from('auditoria')
      .select('id, projeto_id, autor_id, autor_nome, acao, entidade, entidade_id, detalhes, data_hora, recebido_em')
      .eq('projeto_id', projetoId)
      .order('recebido_em', { ascending: true })
      .limit(PAGINA);
    if (cursor) consulta = consulta.gt('recebido_em', cursor);

    const { data, error } = await consulta;
    if (error) throw error;
    if (!data?.length) return;

    await db.logs.bulkPut(data.map(({ recebido_em: _r, ...log }) => ({
      ...log,
      autor_id: log.autor_id || 'offline_user',
      autor_nome: log.autor_nome || '',
      entidade_id: log.entidade_id || '',
      detalhes: log.detalhes || '',
    }) as AuditLog));

    try { localStorage.setItem(chaveCursor(projetoId), data[data.length - 1].recebido_em); } catch { /* relê na próxima */ }
    if (data.length < PAGINA) return;
  }
}

/** Quantos registros da ata ainda não subiram — o logout pergunta antes de apagar. */
export function auditoriaPendente(): Promise<number> {
  return db.fila_auditoria.count().catch(() => 0);
}
