import type { Departamento, Perfil } from '../../types';
import type { Papel } from '../permissoes';
import { normalizar } from '../creditos';

/**
 * Quem mexe na Logagem, e em que visão cada um abre.
 *
 * ⚠️ ISTO É A TELA, NÃO A SEGURANÇA. O servidor faz valer o papel (`leitura`
 * não escreve), mas não o departamento. Ver `escopo.ts` e a dívida declarada em
 * `supabase/sql/papeis.sql`. Enquanto a RLS departamental não existir, um membro
 * `equipe` de outro departamento, com o DevTools aberto, conseguiria gravar um
 * take. É o mesmo risco que tasks e fichas já têm.
 *
 * A regra (decidida com o Lucas em 15/09/2026, PLANO-logagem §9a):
 * - dono e admin editam;
 * - quem é da Fotografia (ficha vinculada) edita;
 * - quem o dono liberou (`Projeto.logagem_liberados`) edita;
 * - o resto vê.
 */

export interface ContextoDaLogagem {
  papel: Papel;
  usuarioId?: string;
  perfilId?: string;
  perfis: Perfil[];
  departamentos: Departamento[];
  liberados?: string[];
}

/** O departamento Fotografia desta produção, pelo nome. */
export function departamentoDaFotografia(departamentos: Departamento[]): Departamento | undefined {
  return departamentos.find(d => normalizar(d.nome) === 'fotografia');
}

export function podeEditarLogagem(c: ContextoDaLogagem): boolean {
  // `desconhecido` = sem como saber (offline, projeto só local). O app inteiro
  // falha ABRINDO nesse caso, e a Logagem segue a regra: quem está no avião
  // com o próprio projeto não pode ficar trancado fora dele. Ver `useRole`.
  if (c.papel === 'desconhecido') return true;
  if (c.papel === 'leitura') return false;
  if (c.papel === 'dono' || c.papel === 'admin') return true;

  if (c.usuarioId && c.liberados?.includes(c.usuarioId)) return true;

  const foto = departamentoDaFotografia(c.departamentos);
  const eu = c.perfilId ? c.perfis.find(p => p.id === c.perfilId) : undefined;
  return Boolean(foto && eu?.departamento_id === foto.id);
}

/**
 * A visão em que a Logagem abre para quem SÓ VÊ.
 *
 * - A continuísta vê tudo (câmera, cartão, lente, ND, OBS, foto): o boletim é
 *   ferramenta de trabalho dela também.
 * - A produção e o resto abrem no Acompanhamento: claquete atual, último take,
 *   contagem e cartões. Uma tabela de vinte colunas não responde "o 3 foi o
 *   bom?".
 *
 * É só o PADRÃO. Qualquer um troca, e o aparelho lembra.
 */
export type VisaoDeQuemVe = 'completa' | 'acompanhamento';

export function visaoPadraoDeQuemVe(perfil?: Perfil): VisaoDeQuemVe {
  const funcao = normalizar(perfil?.funcao || '');
  return funcao.includes('continuist') ? 'completa' : 'acompanhamento';
}
