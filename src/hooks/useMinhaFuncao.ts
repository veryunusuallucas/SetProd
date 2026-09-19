import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useRole } from './useRole';
import { corDoDepartamento } from '../lib/creditos';
import type { Departamento, Perfil } from '../types';

/**
 * Quem EU sou nesta produção — o eixo 2 (ROADMAP, Etapa 9).
 *
 * Junta a conta (`useRole().perfilId`) à ficha e ao departamento dela, e
 * devolve função, departamento e cor. É o ponto único de onde a fase visual
 * vai puxar a cor, e é o mesmo que alimenta a trava de escrita
 * (ProjectLayout → `definirContextoDeEscrita`) — então o escopo e a cor nunca
 * discordam sobre quem a pessoa é.
 *
 * `carregando` separa "ainda lendo" de "não tem": a trava só pode confiar no
 * departamento quando a leitura terminou.
 */
export function useMinhaFuncao(): {
  carregando: boolean;
  perfil: Perfil | null;
  funcao?: string;
  departamento: Departamento | null;
  /** A cor do meu departamento; nula sem ficha ou sem departamento. */
  cor: string | null;
} {
  const { perfilId } = useRole();

  const perfil = useLiveQuery(
    async () => (perfilId ? (await db.perfis.get(perfilId)) ?? null : null),
    [perfilId]
  );
  const departamento = useLiveQuery(
    async () => (perfil?.departamento_id ? (await db.departamentos.get(perfil.departamento_id)) ?? null : null),
    [perfil?.departamento_id]
  );

  return {
    carregando: perfil === undefined || departamento === undefined,
    perfil: perfil ?? null,
    funcao: perfil?.funcao,
    departamento: departamento ?? null,
    cor: departamento ? corDoDepartamento(departamento) : null,
  };
}
