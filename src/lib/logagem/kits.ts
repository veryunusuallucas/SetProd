import { db } from '../../db/db';
import type { CameraDoKit, EstadoDaLogagem, KitDeLogagem, LenteDoKit } from '../../types';

/**
 * Kits de câmera e de lente: o equipamento que a produção tem em mãos.
 *
 * O kit é DA PRODUÇÃO, e não da pessoa (PLANO-logagem §1.1): o sync do SetProd
 * carrega tudo por projeto, e um kit "do usuário" pediria um caminho novo só
 * para ele. Para o uso real basta **importar o kit de outra produção** — uma
 * cópia, com ids novos, que a produção nova pode mexer sem estragar a antiga.
 */

/* ───────────────────────── Abertura ───────────────────────── */

/** A série de terços de diafragma, a mesma do Lumavi (`APERTURES`). */
export const ABERTURAS = [1.2, 1.4, 1.8, 2, 2.4, 2.8, 3.5, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 19, 22, 32] as const;

export const formatarF = (f: number) => (Number.isInteger(f) ? String(f) : f.toFixed(1));

/**
 * As aberturas que ESTA lente alcança.
 *
 * Uma Helios 58 abre em f/2 e fecha em f/22; oferecer f/1.2 e f/32 na lista é
 * convidar o boletim a mentir. Sem lente do kit (ou sem faixa anotada), a série
 * inteira vale — é melhor que impedir de registrar.
 */
export function aberturasDaLente(lente?: LenteDoKit | null): string[] {
  const serie = ABERTURAS.slice();
  if (!lente || !Number.isFinite(lente.abre)) return serie.map(f => `f/${formatarF(f)}`);

  const min = Number(lente.abre);
  const max = Number(lente.fecha) || 32;
  // A folga de 1e-6 é para 2.8 digitado não sair de fora de uma faixa 2.8–22
  // por causa do arredondamento do ponto flutuante.
  const dentro = serie.filter(f => f >= min - 1e-6 && f <= max + 1e-6);
  return (dentro.length ? dentro : [min]).map(f => `f/${formatarF(f)}`);
}

/** Mantém a abertura de agora se ela couber na lente nova; senão, a mais aberta. */
export function aberturaQueCabe(atual: string | undefined, lista: string[]): string {
  return atual && lista.includes(atual) ? atual : (lista[0] || '');
}

/* ───────────────────────── Trocar de câmera ───────────────────────── */

/**
 * Ativar outra câmera do kit: guarda os contadores da que sai, carrega os da
 * que entra (`ativarCamera` do Lumavi).
 *
 * É a operação que justifica o kit existir. Numa diária de duas câmeras, a A
 * está no clipe 148 do cartão 007 e a B no clipe 32 do cartão 002; alternar
 * entre elas à mão erraria o nome do arquivo na primeira distração.
 *
 * Se a câmera que está saindo NÃO é do kit (alguém digitou "D" à mão no campo),
 * não há onde guardar os contadores dela, e eles se perdem — o mesmo que o
 * Lumavi faz. Trocar de câmera pelos chips nunca perde nada.
 */
export function trocarCamera(cameras: CameraDoKit[], estado: EstadoDaLogagem, novaId: string) {
  const nova = cameras.find(c => c.id === novaId);
  if (!nova || novaId === estado.camera_id) return null;

  const guardadas = cameras.map(c =>
    c.id === estado.camera_id
      ? { ...c, reel: estado.cartao, clipe: estado.proximo_clipe, posicao: estado.posicao }
      : c
  );

  return {
    cameras: guardadas,
    estado: {
      camera_id: nova.id,
      cartao: nova.reel,
      proximo_clipe: nova.clipe,
      posicao: nova.posicao || 'C',
    } satisfies Partial<EstadoDaLogagem>,
  };
}

/* ───────────────────────── Banco ───────────────────────── */

export function kitsDoProjeto(projetoId: string, tipo: 'camera' | 'lente') {
  return db.log_kits.where('projeto_id').equals(projetoId).filter(k => k.tipo === tipo).toArray();
}

export async function criarKitDeCamera(projetoId: string, nome: string, primeira: CameraDoKit, departamentoId?: string) {
  const kit: KitDeLogagem = {
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    departamento_id: departamentoId,
    tipo: 'camera',
    nome,
    cameras: [primeira],
    criado_em: Date.now(),
  };
  await db.log_kits.add(kit);
  return kit;
}

export async function criarKitDeLente(projetoId: string, nome: string, departamentoId?: string) {
  const kit: KitDeLogagem = {
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    departamento_id: departamentoId,
    tipo: 'lente',
    nome,
    lentes: [],
    criado_em: Date.now(),
  };
  await db.log_kits.add(kit);
  return kit;
}

export const salvarCameras = (kitId: string, cameras: CameraDoKit[]) => db.log_kits.update(kitId, { cameras });
export const salvarLentes = (kitId: string, lentes: LenteDoKit[]) => db.log_kits.update(kitId, { lentes });
export const renomearKit = (kitId: string, nome: string) => db.log_kits.update(kitId, { nome });
export const excluirKit = (kitId: string) => db.log_kits.delete(kitId);

/**
 * Copia um kit de outra produção para esta.
 *
 * Ids NOVOS em tudo, inclusive nas câmeras e lentes de dentro: a produção nova
 * vai renomear a lente, acertar um reel, tirar a câmera que não veio. Se os ids
 * fossem os mesmos, o sync entenderia as duas produções como o mesmo kit e cada
 * conserto aqui apareceria lá.
 */
export async function importarKit(kitId: string, projetoId: string, departamentoId?: string) {
  const origem = await db.log_kits.get(kitId);
  if (!origem) return null;

  const copia: KitDeLogagem = {
    ...origem,
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    departamento_id: departamentoId,
    criado_em: Date.now(),
    cameras: origem.cameras?.map(c => ({ ...c })),
    lentes: origem.lentes?.map(l => ({ ...l, id: crypto.randomUUID() })),
  };
  await db.log_kits.add(copia);
  return copia;
}
