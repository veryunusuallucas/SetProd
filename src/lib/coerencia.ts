/**
 * Uma linha do espelho só entra no aparelho se o de dentro bate com o de fora.
 *
 * O Dexie grava pela chave de DENTRO (`dados.id`), mas quem decide se a linha
 * pode ser lida é a de FORA (`projeto_id`, `id`), conferida pela RLS. Sem esta
 * checagem, quem administra a produção A gravava lá uma linha com
 * `dados.id = <id da produção B>` e o sync sobrescrevia a B no aparelho de quem
 * participa das duas — inclusive com uma `lixeira_em` antiga, que a varredura
 * destruía sozinha.
 *
 * O servidor recusa isso desde a rodada 1 (gatilho `coerencia_do_registro`);
 * esta é a segunda tranca, para linha antiga ou servidor sem o gatilho.
 */
export interface LinhaParaConferir {
  projeto_id: string;
  tabela: string;
  id: string;
  dados: Record<string, unknown> | null;
  deletado: boolean;
}

export function linhaCoerente(l: LinhaParaConferir): boolean {
  if (l.tabela === 'projetos' && l.id !== l.projeto_id) return false;
  // Lápide não grava `dados`: só apaga pela chave de fora, que a RLS conferiu.
  if (l.deletado || !l.dados) return true;
  if (l.dados.id !== l.id) return false;
  if ('projeto_id' in l.dados && l.dados.projeto_id != null && l.dados.projeto_id !== l.projeto_id) return false;
  return true;
}
