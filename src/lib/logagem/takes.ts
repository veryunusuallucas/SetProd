import { db } from '../../db/db';
import type { EstadoDaLogagem, StatusTake, Take } from '../../types';
import { nomeArquivoPrevisto } from './nomenclatura';
import { mesmaClaquete, proximoPlanoLivre } from './claquete';
import { idDoEstado } from './estado';

/**
 * Registrar o take: o ato que a Logagem existe para fazer.
 *
 * Tudo aqui é o `gravarLog` do Lumavi, com um cuidado a mais: o SetProd
 * sincroniza, então o take carrega quem logou e a ordem em que foi rodado.
 */

export const ROTULO_DO_STATUS: Record<StatusTake, string> = {
  OK: 'OK',
  NG: 'NG',
  HERO: 'HERO',
  RECINV: 'REC invertido',
  IMPORT: 'Importado',
};

/** A cor de cada status. Vermelho é só o NG — HERO é a melhor coisa do dia. */
export const COR_DO_STATUS: Record<StatusTake, string> = {
  OK: 'var(--color-success)',
  NG: 'var(--color-danger)',
  HERO: 'var(--accent)',
  RECINV: 'var(--color-warning)',
  IMPORT: 'var(--text-muted)',
};

export const horaDeAgora = (agora = new Date()) =>
  [agora.getHours(), agora.getMinutes(), agora.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');

/**
 * O take, montado a partir do que está na tela NO MOMENTO do registro.
 *
 * O take é uma **fotografia**, e não um atalho para o estado: se amanhã alguém
 * trocar a lente ou o ISO, o take de hoje continua dizendo com o que foi
 * rodado. Por isso ele copia o setup inteiro em vez de guardar uma referência.
 */
export function montarTake(
  estado: EstadoDaLogagem,
  status: StatusTake,
  ordem: number,
  quem?: string,
  agora = new Date()
): Take {
  return {
    id: crypto.randomUUID(),
    projeto_id: estado.projeto_id,
    diaria_id: estado.diaria_id,
    departamento_id: estado.departamento_id,
    cena: String(estado.cena),
    plano: String(estado.plano),
    take: Number(estado.take) || 1,
    status,
    hora: horaDeAgora(agora),
    ordem,
    // O arquivo é o previsto NA HORA do registro: depois o clipe anda, e o
    // nome previsto vira o do PRÓXIMO take.
    arquivo: nomeArquivoPrevisto(estado),
    camera_id: estado.camera_id,
    cartao: estado.cartao,
    posicao: estado.posicao,
    ambiente: estado.ambiente,
    luz: estado.luz,
    audio: estado.audio,
    nd: estado.nd,
    obs: estado.obs,
    fps: estado.fps,
    resolucao: estado.resolucao,
    codec: estado.codec,
    wb: estado.wb,
    shutter: estado.shutter,
    iso: estado.iso,
    lut: estado.lut,
    lente: estado.lente,
    abertura: estado.abertura,
    logado_por: quem,
    criado_em: Date.now(),
  };
}

/** O take já registrado com esta mesma cena, plano e take — se existir. */
export const acharDuplicado = (takes: Take[], estado: EstadoDaLogagem) =>
  takes.find(t => mesmaClaquete(t, estado));

/**
 * Grava o take e prepara o próximo.
 *
 * Depois de registrar: **take +1, clipe +1, observação limpa**. Nada mais se
 * mexe — a cena e o plano continuam, porque o normal é rodar de novo o mesmo
 * plano. Quem muda de setup mexe na claquete, e aí a cascata cuida do resto.
 *
 * O contador da câmera ativa do kit anda junto: sem isso, o chip do kit
 * mostraria o clipe de meia hora atrás até alguém trocar de câmera.
 */
export async function registrarTake(estado: EstadoDaLogagem, status: StatusTake, quem?: string) {
  const takes = await db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray();
  const ordem = takes.reduce((maior, t) => Math.max(maior, t.ordem || 0), 0) + 1;
  const take = montarTake(estado, status, ordem, quem);

  await db.log_takes.add(take);
  await db.log_estado.update(idDoEstado(estado.diaria_id), {
    take: (Number(estado.take) || 0) + 1,
    proximo_clipe: (Number(estado.proximo_clipe) || 0) + 1,
    obs: '',
  });
  await sincronizarKit(estado, (Number(estado.proximo_clipe) || 0) + 1);

  return take;
}

async function sincronizarKit(estado: EstadoDaLogagem, clipe: number) {
  if (!estado.kit_camera_id) return;
  const kit = await db.log_kits.get(estado.kit_camera_id);
  if (!kit?.cameras?.some(c => c.id === estado.camera_id)) return;
  await db.log_kits.update(kit.id, {
    cameras: kit.cameras.map(c =>
      c.id === estado.camera_id ? { ...c, reel: estado.cartao, clipe, posicao: estado.posicao } : c
    ),
  });
}

/**
 * Substituir o take que já existia com a mesma claquete.
 *
 * **Não mexe no arquivo nem no clipe** — e essa é a parte que importa. O clipe
 * já gravado no cartão continua sendo aquele; o que mudou foi a opinião sobre
 * ele (era NG, virou OK) ou o contexto que faltou anotar. Mexer no nome do
 * arquivo aqui seria dizer que a câmera regravou por cima, o que não aconteceu.
 */
export function substituirTake(id: string, estado: EstadoDaLogagem, status: StatusTake, agora = new Date()) {
  return db.log_takes.update(id, {
    status,
    hora: horaDeAgora(agora),
    ambiente: estado.ambiente,
    luz: estado.luz,
    audio: estado.audio,
    nd: estado.nd,
    obs: estado.obs,
    fps: estado.fps,
    resolucao: estado.resolucao,
    codec: estado.codec,
    wb: estado.wb,
    shutter: estado.shutter,
    iso: estado.iso,
    lut: estado.lut,
    lente: estado.lente,
    abertura: estado.abertura,
  });
}

/**
 * O "acréscimo": não é o mesmo take de novo, é um **setup novo** da mesma cena.
 *
 * O plano pula para a próxima letra ainda não usada NESTA cena e o take volta
 * para 1 — a convenção americana de 1, 1A, 1B. Devolve o que mudar na claquete,
 * para quem chamou gravar e registrar em seguida.
 */
export function claqueteDoAcrescimo(takes: Take[], estado: EstadoDaLogagem) {
  const daCena = takes.filter(t => String(t.cena).trim() === String(estado.cena).trim()).map(t => t.plano);
  return {
    plano: proximoPlanoLivre(daCena, String(estado.plano), estado.plano_letras !== false),
    take: 1,
  };
}

export const apagarTake = (id: string) => db.log_takes.delete(id);
