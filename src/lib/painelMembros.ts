import { supabase, supabaseConfigurado } from './supabase';
import { sincronizarParticipacoes, type PapelMembro } from './membros';

/**
 * O painel do dono — mudar papel, expulsar, e saber quem é quem.
 *
 * Tudo aqui passa pela Edge Function `membros`, e não por escrita direta. Não é
 * indireção à toa: as três operações são justamente as que a RLS proíbe de
 * propósito.
 *
 *   · o e-mail de outra pessoa não é legível pelo app (RLS de `auth.users`);
 *   · a coluna `papel` não é concedida a `authenticated` — é essa trava que
 *     impede alguém de se auto-promover editando a própria linha;
 *   · a política de delete deixa SAIR, não EXPULSAR.
 *
 * Afrouxar qualquer uma delas para o painel funcionar seria trocar uma trava de
 * segurança por uma tela. A função faz as checagens no servidor e mantém as
 * travas onde estão.
 */

export interface MembroDetalhado {
  usuario_id: string;
  papel: PapelMembro;
  apelido: string | null;
  perfil_id: string | null;
  /** Vem do `auth.users`, e só a Edge Function consegue lê-lo. */
  email: string | null;
  nome: string | null;
}

async function chamar<T>(corpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('membros', { body: corpo });

  if (error) {
    // A função responde o motivo no corpo mesmo quando o status não é 2xx — sem
    // ler isso, todo erro vira "non-2xx status code" na tela.
    let detalhe = error.message;
    try {
      const c = await (error as any).context?.json?.();
      if (c?.erro) detalhe = c.erro;
    } catch { /* mantém a mensagem original */ }

    if (/not found|404|failed to send a request/i.test(detalhe)) {
      throw new Error('A função `membros` não está publicada no Supabase. Rode: supabase functions deploy membros');
    }
    throw new Error(detalhe);
  }

  if ((data as any)?.erro) throw new Error((data as any).erro);
  return data as T;
}

/** Quem participa, com e-mail e nome. */
export async function listarMembros(projetoId: string): Promise<MembroDetalhado[]> {
  if (!supabaseConfigurado) return [];
  const r = await chamar<{ membros: MembroDetalhado[] }>({ acao: 'listar', projeto_id: projetoId });
  return r.membros ?? [];
}

export async function mudarPapel(projetoId: string, alvo: string, papel: PapelMembro): Promise<void> {
  await chamar({ acao: 'mudar_papel', projeto_id: projetoId, alvo, papel });
  // A própria pessoa pode ter mudado de papel — a cópia local precisa saber.
  await sincronizarParticipacoes();
}

export async function removerMembro(projetoId: string, alvo: string): Promise<void> {
  await chamar({ acao: 'remover', projeto_id: projetoId, alvo });
  await sincronizarParticipacoes();
}

/** O dono diz quem é quem na ficha, sem depender da pessoa fazer isso. */
export async function vincularPerfilDe(projetoId: string, alvo: string, perfilId: string | null): Promise<void> {
  await chamar({ acao: 'vincular_perfil', projeto_id: projetoId, alvo, perfil_id: perfilId });
  await sincronizarParticipacoes();
}
