import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { cenasDoElemento, normalizarCategoria } from '../../lib/decupagem';

/**
 * Os personagens da cena da claquete, com quem interpreta.
 *
 * A cena é a ligada à decupagem ou, sem vínculo, a de mesmo número. Quem está
 * em cena vem da marcação do roteiro e do nome no texto (`cenasDoElemento`),
 * o mesmo caminho da OD.
 */
export function useElencoDaCena(projetoId: string, estado: Pick<EstadoDaLogagem, 'cena_id' | 'cena'>) {
  return useLiveQuery(async () => {
    const [elementos, tags, cenas, perfis] = await Promise.all([
      db.elementos.where('projeto_id').equals(projetoId).toArray(),
      db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(),
      db.cenas.where('projeto_id').equals(projetoId).toArray(),
      db.perfis.where('projeto_id').equals(projetoId).toArray(),
    ]);
    const cena = cenas.find(c => c.id === estado.cena_id)
      ?? cenas.find(c => String(c.numero).trim().toUpperCase() === String(estado.cena).trim().toUpperCase());
    if (!cena) return [];
    return elementos
      .filter(el => normalizarCategoria(el.categoria) === 'ELENCO' && cenasDoElemento(el, tags, cenas).has(cena.id))
      .map(el => {
        const p = perfis.find(x => x.id === el.perfil_id);
        return { personagem: el.nome, ator: p ? (p.nome_social || p.nome) : '' };
      });
  }, [projetoId, estado.cena_id, estado.cena]) ?? [];
}
