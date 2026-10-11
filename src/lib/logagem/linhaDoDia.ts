import { db } from '../../db/db';
import type { Diaria, ItemDoDia } from '../../types';
import { cenaPulada, montarLinhaDoDia, trocarDeLugar } from '../linhaDoDia';
import { possoEscrever } from '../travaDeEscrita';

/**
 * A Logagem avisando a linha do dia (Lucas, 11/10/2026): o primeiro take de
 * uma cena é a hora em que ela começou. Ninguém precisa sair da claquete para
 * tocar "começou" na página da diária.
 *
 * Mesma regra do toque na linha: se uma cena anterior ainda não começou, o
 * set trocou a ordem, e quem decide é quem está logando — por isso a troca
 * volta como pergunta, e não acontece sozinha.
 */
export interface ComecoDaCena {
  /** A cena da linha que vinha antes e ainda não começou. */
  pulada?: { nome: string; nomeDaQueEntrou: string };
  /** "Sim, trocar de lugar". */
  trocar?: () => Promise<void>;
  /** "Não, só marcar". */
  soMarcar?: () => Promise<void>;
}

/** Onde a cena está: na linha da diária ou na de uma frente (diária dividida). */
function ondeEsta(diaria: Diaria, cenaId: string) {
  const frente = Object.entries(diaria.frentes || {}).find(([, f]) => f.cena_ids?.includes(cenaId));
  if (frente) {
    const [id, f] = frente;
    return {
      linha: montarLinhaDoDia({ linha_do_tempo: f.linha_do_tempo, cena_ids: f.cena_ids || [] }),
      mudanca: (nova: ItemDoDia[]) => ({ frentes: { ...(diaria.frentes || {}), [id]: { ...f, linha_do_tempo: nova } } }),
    };
  }
  return { linha: montarLinhaDoDia(diaria), mudanca: (nova: ItemDoDia[]) => ({ linha_do_tempo: nova }) };
}

/**
 * Marca a cena como começada na linha do dia, à hora do primeiro take.
 *
 * Não faz nada quando a cena não está na linha, já começou, ou quando quem loga
 * não pode mexer na diária (a diária é da produção: o take sai do mesmo jeito,
 * e a linha fica para quem pode).
 */
export async function comecarCenaPelaLogagem(diariaId: string, cenaId: string, hora: string): Promise<ComecoDaCena> {
  const diaria = await db.diarias.get(diariaId);
  if (!diaria) return {};
  const { linha, mudanca } = ondeEsta(diaria, cenaId);
  const item = linha.find(i => i.tipo === 'cena' && i.cena_id === cenaId);
  if (!item || item.hora_real) return {};

  const gravar = async (nova: ItemDoDia[], ordemPlanejada?: string[]) => {
    const m = { ...mudanca(nova), ...(ordemPlanejada ? { ordem_planejada: ordemPlanejada } : {}) };
    if (!possoEscrever('diarias', diaria.projeto_id, diaria, { ...diaria, ...m })) return;
    await db.diarias.update(diariaId, m);
  };
  const marcada = (l: ItemDoDia[]) => l.map(i => (i.id === item.id ? { ...i, hora_real: hora } : i));

  if (!possoEscrever('diarias', diaria.projeto_id, diaria, { ...diaria, ...mudanca(marcada(linha)) })) return {};

  const pulada = cenaPulada(linha, item.id);
  if (!pulada) {
    await gravar(marcada(linha));
    return {};
  }

  const numero = async (i: ItemDoDia) => `Cena ${(await db.cenas.get(i.cena_id!))?.numero ?? '?'}${i.parte || ''}`;
  return {
    pulada: { nome: await numero(pulada), nomeDaQueEntrou: await numero(item) },
    // Antes da primeira troca, a ordem do plano fica guardada para o DPR (ver DiariaModule).
    trocar: () => gravar(
      marcada(trocarDeLugar(linha, item.id, pulada.id)),
      diaria.ordem_planejada?.length ? undefined : linha.filter(i => i.tipo === 'cena').map(i => i.id),
    ),
    soMarcar: () => gravar(marcada(linha)),
  };
}
