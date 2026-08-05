/**
 * Fila de análises com IA.
 *
 * O problema real: quatro pessoas da equipe abrem o app e mandam analisar o
 * roteiro ao mesmo tempo. Cada análise são ~30 chamadas; quatro viram 120 de
 * uma vez, estouram a cota e a análise de todo mundo falha no meio.
 *
 * Aqui só uma roda por vez. As outras veem quem está na frente e o progresso,
 * em vez de um erro seco de cota.
 *
 * Isto é conveniência, não segurança: quem mexer no navegador pula a fila. O
 * teto que vale dinheiro é o da Edge Function, no servidor.
 */
import { supabase, supabaseConfigurado } from './supabase';

/** Sem sinal de vida por este tempo, a execução é dada como abandonada. */
const LIMITE_SEM_SINAL_MS = 2 * 60 * 1000;
const INTERVALO_SINAL_MS = 20 * 1000;

export interface ExecucaoAtiva {
  id: string;
  nome: string;
  projeto: string;
  feito: number;
  total: number;
  desdeMs: number;
  minha: boolean;
}

export interface Vaga {
  liberado: boolean;
  /** Preenchido quando `liberado` é falso: quem está ocupando. */
  ocupadaPor?: ExecucaoAtiva;
  /** Identificador da minha execução, para atualizar e encerrar. */
  id?: string;
}

/** Execução em andamento de alguém, se houver. */
export async function execucaoAtiva(): Promise<ExecucaoAtiva | null> {
  if (!supabaseConfigurado) return null;

  const corte = new Date(Date.now() - LIMITE_SEM_SINAL_MS).toISOString();
  const { data, error } = await supabase
    .from('ia_execucoes')
    .select('*')
    .eq('status', 'rodando')
    .gte('atualizado_em', corte)
    .order('iniciado_em', { ascending: true })
    .limit(1);

  if (error || !data?.length) return null;

  const e = data[0];
  const { data: sessao } = await supabase.auth.getSession();

  return {
    id: e.id,
    nome: e.nome || 'Alguém da equipe',
    projeto: e.projeto || '',
    feito: e.feito || 0,
    total: e.total || 0,
    desdeMs: Date.now() - new Date(e.iniciado_em).getTime(),
    minha: e.user_id === sessao?.session?.user?.id,
  };
}

/**
 * Tenta pegar a vez. Se outra pessoa estiver rodando, devolve quem é.
 *
 * Sem a tabela criada, libera direto: o app não pode parar de funcionar por
 * causa de um recurso de conveniência que ainda não foi instalado.
 */
export async function pegarVez(params: { projeto: string; total: number }): Promise<Vaga> {
  if (!supabaseConfigurado) return { liberado: true };

  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao?.session?.user;
  if (!usuario) return { liberado: true };

  const ativa = await execucaoAtiva();
  if (ativa && !ativa.minha) return { liberado: false, ocupadaPor: ativa };

  const nome = (usuario.user_metadata?.nome as string) || usuario.email || 'Alguém da equipe';
  const { data, error } = await supabase
    .from('ia_execucoes')
    .insert({
      user_id: usuario.id,
      nome,
      projeto: params.projeto,
      total: params.total,
      status: 'rodando',
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[SetProd] Fila da IA indisponível, seguindo sem ela:', error.message);
    return { liberado: true };
  }
  return { liberado: true, id: data.id };
}

/** Marca progresso e serve de sinal de vida. */
export async function marcarProgresso(id: string | undefined, feito: number) {
  if (!id || !supabaseConfigurado) return;
  await supabase
    .from('ia_execucoes')
    .update({ feito, atualizado_em: new Date().toISOString() })
    .eq('id', id);
}

/** Libera a vez. Chamar SEMPRE, inclusive quando a análise falha. */
export async function liberarVez(id: string | undefined) {
  if (!id || !supabaseConfigurado) return;
  await supabase
    .from('ia_execucoes')
    .update({ status: 'concluido', atualizado_em: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Mantém a execução viva enquanto a análise roda.
 *
 * Sem isso, uma análise longa passaria dos 2 minutos sem sinal e outra pessoa
 * furaria a fila achando que a máquina travou.
 */
export function manterVivo(id: string | undefined): () => void {
  if (!id || !supabaseConfigurado) return () => {};
  const t = setInterval(() => {
    supabase.from('ia_execucoes')
      .update({ atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .then(undefined, () => {});
  }, INTERVALO_SINAL_MS);
  return () => clearInterval(t);
}

/** Quantas chamadas à IA já saíram hoje (para mostrar na tela). */
export async function chamadasHoje(): Promise<number | null> {
  if (!supabaseConfigurado) return null;
  const inicio = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('ia_chamadas')
    .select('id', { count: 'exact', head: true })
    .gte('criado_em', inicio);
  return error ? null : (count ?? 0);
}
