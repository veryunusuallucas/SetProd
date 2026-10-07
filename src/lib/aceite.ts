import { supabase, supabaseConfigurado } from './supabase';
import { RASCUNHO, VERSAO_DOS_TERMOS } from './termos';

/**
 * O aceite dos termos — o recibo de que esta conta marcou a caixinha.
 *
 * Mora no SERVIDOR (`aceites_termos`, supabase/sql/aceites-termos.sql): é por
 * conta, não por aparelho, e é a única forma de ele valer como registro. Só de
 * inserção, com a hora do servidor — ninguém edita nem apaga, nem a pessoa.
 *
 * O `localStorage` aqui é só memória do aparelho, para a tela não piscar
 * enquanto o servidor responde, e para guardar um aceite feito sem internet
 * até ele conseguir subir. As chaves começam com `setprod_`, então o logout
 * limpa junto (limpezaLocal.ts) — e a próxima conta pergunta ao servidor de novo.
 *
 * Enquanto os termos forem rascunho, a versão aceita leva "-rascunho": quando o
 * texto final sair, a versão muda e todo mundo aceita de novo — ninguém fica
 * "tendo aceitado" um texto que não valia.
 */
export const VERSAO_ACEITA = RASCUNHO ? `${VERSAO_DOS_TERMOS}-rascunho` : VERSAO_DOS_TERMOS;

const chave = (usuario: string) => `setprod_termos_${usuario}`;
const chavePendente = (usuario: string) => `setprod_termos_pendente_${usuario}`;

function ler(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function gravar(k: string, v: string | null) {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sem storage: fica só no servidor */ }
}

export type Situacao =
  | 'em-dia'      // aceitou a versão atual
  | 'nova-versao' // aceitou uma anterior: mostra só os termos
  | 'primeira';   // nunca aceitou: mostra o bem-vindo inteiro

/**
 * Em que pé esta conta está com os termos.
 *
 * Sem servidor (app sem Supabase) ou sem resposta: confia no que o aparelho
 * lembra, e na dúvida não interrompe quem já usava — a pergunta volta quando a
 * rede voltar.
 */
export async function situacaoDoAceite(usuario: string): Promise<Situacao> {
  const lembrado = ler(chave(usuario));
  if (lembrado === VERSAO_ACEITA) return 'em-dia';
  if (!supabaseConfigurado) return lembrado ? 'nova-versao' : 'primeira';

  const { data, error } = await supabase
    .from('aceites_termos')
    .select('versao')
    .eq('usuario_id', usuario)
    .order('aceito_em', { ascending: false })
    .limit(20);

  if (error) {
    // Tabela ainda não criada, ou sem rede: não trava o app por isso.
    return 'em-dia';
  }
  const versoes = (data || []).map(l => l.versao as string);
  if (versoes.includes(VERSAO_ACEITA)) {
    gravar(chave(usuario), VERSAO_ACEITA);
    return 'em-dia';
  }
  if (ler(chavePendente(usuario)) === VERSAO_ACEITA) return 'em-dia';
  return versoes.length || lembrado ? 'nova-versao' : 'primeira';
}

/**
 * Registra o aceite. Sem internet, guarda para mandar depois e já libera o app:
 * quem está no set sem sinal não pode ficar preso numa tela de termos.
 */
export async function registrarAceite(usuario: string): Promise<'registrado' | 'pendente'> {
  gravar(chave(usuario), VERSAO_ACEITA);
  if (!supabaseConfigurado) return 'registrado';

  const { error } = await supabase.from('aceites_termos').insert({
    versao: VERSAO_ACEITA,
    user_agent: navigator.userAgent.slice(0, 400),
  });
  if (error) {
    gravar(chavePendente(usuario), VERSAO_ACEITA);
    return 'pendente';
  }
  gravar(chavePendente(usuario), null);
  return 'registrado';
}

/** Manda o aceite que ficou guardado sem internet. Chamar quando o app abre logado. */
export async function enviarAceitePendente(usuario: string): Promise<void> {
  const pendente = ler(chavePendente(usuario));
  if (!pendente || !supabaseConfigurado) return;
  const { error } = await supabase.from('aceites_termos').insert({
    versao: pendente,
    user_agent: navigator.userAgent.slice(0, 400),
  });
  if (!error) gravar(chavePendente(usuario), null);
}
