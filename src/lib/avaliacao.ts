import { supabase } from './supabase';
import { rotuloCompleto } from './versao';

/**
 * A avaliação do app — "como foi fazer esta produção no SetProd?".
 *
 * VAI PARA `bug_reports`, com `tipo = 'avaliacao'`. Não é bug, mas mora no mesmo
 * lugar de propósito: é a caixa que o Lucas já lê (a skill `relatos` busca,
 * guarda em `bugs/` e faz a triagem), e uma tabela nova seria mais um lugar
 * para esquecer de olhar. As respostas vão em `stats` (jsonb).
 *
 * Sem dado pessoal além do que o relato de bug já manda (a conta): nota,
 * escolhas, o texto, a versão do app e o tamanho da produção.
 *
 * QUANDO PERGUNTA: uma vez por produção encerrada, para cada pessoa da equipe
 * (decisão do Lucas, 07/10/2026). "Agora não" conta como resposta para aquela
 * produção; três "agora não" seguidos e o app para de perguntar sozinho — a
 * pessoa ainda pode avaliar em Configurações.
 *
 * O controle é deste aparelho (`localStorage`): perguntar de novo num celular
 * novo é aceitável; perguntar toda vez, não.
 */

export const OPCOES_QUE_AJUDARAM = [
  'Ordem do Dia', 'Diárias', 'Equipe e fichas', 'Roteiro e decupagem',
  'Stripboard', 'Financeiro e acertos', 'Logagem', 'Funcionar sem sinal',
] as const;

const LIMITE_DE_RECUSAS = 3;

const chaveFeita = (usuario: string, projeto: string) => `setprod_avaliacao_${usuario}_${projeto}`;
const chaveRecusas = (usuario: string) => `setprod_avaliacao_recusas_${usuario}`;

function ler(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function gravar(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* sem storage: pode perguntar de novo, e tudo bem */ }
}

/** Deve perguntar sobre esta produção? */
export function devePerguntar(usuario: string, projeto: string): boolean {
  if (ler(chaveFeita(usuario, projeto))) return false;
  return Number(ler(chaveRecusas(usuario)) || 0) < LIMITE_DE_RECUSAS;
}

/** "Agora não": não pergunta mais desta produção, e soma uma recusa. */
export function recusarAvaliacao(usuario: string, projeto: string) {
  gravar(chaveFeita(usuario, projeto), 'recusou');
  gravar(chaveRecusas(usuario), String(Number(ler(chaveRecusas(usuario)) || 0) + 1));
}

export interface Avaliacao {
  nota: number;
  ajudou: string[];
  atrapalhou: string;
  /** Ausente quando vem de Configurações, fora de uma produção. */
  projetoId?: string;
  diarias?: number;
}

export async function enviarAvaliacao(usuario: { id: string; email?: string | null }, a: Avaliacao): Promise<void> {
  const { error } = await supabase.from('bug_reports').insert([{
    tipo: 'avaliacao',
    descricao: a.atrapalhou.trim() || `(sem texto) nota ${a.nota}`,
    url_atual: window.location.pathname,
    user_agent: navigator.userAgent,
    stats: {
      avaliacao: { nota: a.nota, ajudou: a.ajudou, atrapalhou: a.atrapalhou.trim() || null },
      projeto_id: a.projetoId ?? null,
      diarias: a.diarias ?? null,
      origem: a.projetoId ? 'fim-da-producao' : 'configuracoes',
      usuario: { id: usuario.id, email: usuario.email ?? null },
      versao_app: rotuloCompleto(),
    },
  }]);
  if (error) throw new Error(`Não deu para enviar agora (${error.message}). Tente de novo em instantes.`);
  if (a.projetoId) gravar(chaveFeita(usuario.id, a.projetoId), 'avaliou');
  // Quem avalia volta a ser perguntado nas próximas: a recusa não é mais a última palavra.
  gravar(chaveRecusas(usuario.id), '0');
}
