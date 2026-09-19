import { db, marcarTransacaoComoRemota } from '../db/db';
import { participacaoLocal } from './membros';
import { CAMPOS_MEDICOS, CAMPOS_RESTRITOS, podeVerCamada, type Camada } from './camposSensiveis';
import type { Perfil } from '../types';

/**
 * A ficha da equipe viaja em TRÊS linhas do espelho, não em uma (ROADMAP §3.C).
 *
 * O PROBLEMA QUE ISTO FECHA
 * A RLS esconde LINHA, não campo. Com a ficha inteira numa linha só, o CPF, a
 * conta bancária, o cachê e o remédio de uso contínuo de todo mundo chegavam
 * ao aparelho de qualquer membro — a tela escondia, o IndexedDB não.
 *
 * O DESENHO
 * No aparelho, a ficha continua sendo UM `Perfil`, com todos os campos: nenhuma
 * tela precisou mudar. A partição acontece só na fronteira com o servidor:
 *
 *   perfis            → o crachá (nome, função, departamento, contato)
 *   perfis_restritos  → documento, dinheiro, vínculo  (`CAMPOS_RESTRITOS`)
 *   perfis_medicos    → a ficha médica                (`CAMPOS_MEDICOS`)
 *
 * As três têm o mesmo `id` (o da pessoa). A RLS de leitura (`fichas.sql`) só
 * entrega as duas últimas a quem pode ver: a própria pessoa, dono e admin.
 *
 * - SUBIR: `partirParaEnviar` — a linha pública sempre; as outras duas só se
 *   esta conta pode ver aquela camada. Quem não pode nunca recebeu esses
 *   campos, e mandar a camada vazia apagaria o CPF de alguém no servidor.
 * - DESCER: `aplicarParteDaFicha` junta a camada à ficha daqui; e a linha
 *   pública, ao chegar, não apaga as camadas que já estavam aqui.
 *
 * Cada camada tem o próprio carimbo (`_carimbos`), porque a hora da ficha
 * (`atualizado_em`) anda com qualquer edição do crachá — e comparar a camada
 * médica com ela descartaria uma alteração médica real que chegou atrasada.
 */

export const PARTES_DA_FICHA = {
  perfis_restritos: { camada: 'restrita' as const, campos: CAMPOS_RESTRITOS as readonly string[] },
  perfis_medicos: { camada: 'medica' as const, campos: CAMPOS_MEDICOS as readonly string[] },
};

export type ParteDaFicha = keyof typeof PARTES_DA_FICHA;

export const ehParteDaFicha = (tabela: string): tabela is ParteDaFicha => tabela in PARTES_DA_FICHA;

/** Os campos que não sobem na linha pública. */
const FORA_DA_PUBLICA = new Set<string>([...CAMPOS_RESTRITOS, ...CAMPOS_MEDICOS, '_carimbos']);

type FichaLocal = Perfil & { _carimbos?: Partial<Record<Camada, number>> };

/** Esta conta pode ver — e portanto mandar — esta camada desta pessoa? */
export function possoMexerNaCamada(projetoId: string, perfilId: string, camada: Camada): boolean {
  const eu = participacaoLocal(projetoId);
  return podeVerCamada(camada, {
    papel: eu?.papel ?? 'desconhecido',
    meuPerfilId: eu?.perfil_id ?? null,
    perfilId,
  });
}

/** A ficha daqui, repartida no que sobe para cada linha do espelho. */
export function partirParaEnviar(projetoId: string, ficha: FichaLocal): {
  publica: Record<string, unknown>;
  partes: { tabela: ParteDaFicha; dados: Record<string, unknown> }[];
} {
  const publica: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(ficha)) {
    if (!FORA_DA_PUBLICA.has(campo)) publica[campo] = valor;
  }

  const partes = (Object.keys(PARTES_DA_FICHA) as ParteDaFicha[])
    .filter(tabela => possoMexerNaCamada(projetoId, ficha.id, PARTES_DA_FICHA[tabela].camada))
    .map(tabela => {
      const dados: Record<string, unknown> = { id: ficha.id, projeto_id: ficha.projeto_id };
      for (const campo of PARTES_DA_FICHA[tabela].campos) {
        const valor = (ficha as unknown as Record<string, unknown>)[campo];
        if (valor !== undefined) dados[campo] = valor;
      }
      return { tabela, dados };
    });

  return { publica, partes };
}

/** As camadas desta pessoa que esta conta pode apagar junto com a ficha. */
export function partesQuePossoApagar(projetoId: string, perfilId: string): ParteDaFicha[] {
  return (Object.keys(PARTES_DA_FICHA) as ParteDaFicha[])
    .filter(tabela => possoMexerNaCamada(projetoId, perfilId, PARTES_DA_FICHA[tabela].camada));
}

/**
 * A linha pública que chegou, sem perder as camadas que já estavam aqui.
 *
 * A pública não traz CPF nem remédio — e um `put` com ela apagaria da ficha
 * local o que veio pelas outras duas linhas. O `...linha` vem por último: se
 * um aparelho antigo ainda mandar a ficha inteira numa linha só, o que ele
 * mandou vale.
 */
export function fundirPublica(local: FichaLocal | undefined, publica: Record<string, unknown>): Record<string, unknown> {
  const guardado: Record<string, unknown> = {};
  if (local) {
    for (const campo of FORA_DA_PUBLICA) {
      const valor = (local as unknown as Record<string, unknown>)[campo];
      if (valor !== undefined) guardado[campo] = valor;
    }
  }
  return { ...guardado, ...publica };
}

/**
 * Uma camada que chegou do servidor, aplicada à ficha daqui.
 *
 * Roda DENTRO da transação de `aplicarLinhas` (já marcada como remota). Devolve
 * se aplicou. Se a ficha ainda não chegou (a camada veio antes, na virada de
 * uma página), nasce um esboço com carimbo zero — a linha pública, quando vier,
 * é sempre "mais nova" que ele e completa o resto.
 */
export async function aplicarParteDaFicha(linha: {
  tabela: ParteDaFicha; id: string; projeto_id: string;
  dados: Record<string, unknown> | null; atualizado_em: number; deletado: boolean;
}): Promise<boolean> {
  const { camada, campos } = PARTES_DA_FICHA[linha.tabela];
  const local = await db.perfis.get(linha.id) as FichaLocal | undefined;
  const naFila = await db.sync_queue.get(`perfis:${linha.id}`);

  const carimboDaqui = Math.max(local?._carimbos?.[camada] ?? 0, naFila?.atualizado_em ?? 0);
  if (carimboDaqui >= linha.atualizado_em) return false;

  const ficha: Record<string, unknown> = local
    ? { ...local }
    : { id: linha.id, projeto_id: linha.projeto_id, nome: '', atualizado_em: 0 };

  for (const campo of campos) delete ficha[campo];
  if (!linha.deletado && linha.dados) {
    for (const campo of campos) {
      if (linha.dados[campo] !== undefined) ficha[campo] = linha.dados[campo];
    }
  }
  ficha._carimbos = { ...(local?._carimbos || {}), [camada]: linha.atualizado_em };

  await db.perfis.put(ficha as unknown as Perfil);
  return true;
}

/**
 * Tira deste aparelho as camadas que esta conta não pode ver.
 *
 * Antes das três linhas, a ficha inteira chegava a todo mundo — então quem é
 * 'equipe' tem, no IndexedDB, o CPF e o remédio da produção inteira, de antes.
 * Isto limpa, ao abrir a produção. Só quando o papel é CONHECIDO: sem saber
 * quem é a pessoa, apagar poderia ser apagar a ficha do próprio dono.
 */
export async function limparFichasQueNaoPossoVer(projetoId: string): Promise<number> {
  const eu = participacaoLocal(projetoId);
  if (!eu) return 0;

  const fichas = await db.perfis.where('projeto_id').equals(projetoId).toArray() as FichaLocal[];
  const alteradas: FichaLocal[] = [];

  for (const ficha of fichas) {
    const copia: Record<string, unknown> = { ...ficha };
    let mexeu = false;
    for (const tabela of Object.keys(PARTES_DA_FICHA) as ParteDaFicha[]) {
      const { camada, campos } = PARTES_DA_FICHA[tabela];
      if (possoMexerNaCamada(projetoId, ficha.id, camada)) continue;
      for (const campo of campos) {
        if (copia[campo] !== undefined) { delete copia[campo]; mexeu = true; }
      }
    }
    if (mexeu) alteradas.push(copia as unknown as FichaLocal);
  }

  if (alteradas.length) {
    await db.transaction('rw', db.perfis, async () => {
      // É faxina daqui: não sobe (subiria a ficha sem o CPF por cima da de
      // quem pode ver) e não passa pela trava de escrita.
      marcarTransacaoComoRemota();
      await db.perfis.bulkPut(alteradas);
    });
  }
  return alteradas.length;
}
