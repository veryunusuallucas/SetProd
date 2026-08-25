import { db } from '../db/db';
import { paginasParaOitavos } from './decupagem';
import type { RegistroCena, StatusCena, Cena } from '../types';

/**
 * O que aconteceu no set — o caminho de volta que o app não tinha.
 *
 * O ciclo da indústria é Shooting Schedule → Call Sheet → Daily Production
 * Report, e o DPR realimenta o planejamento. O SetProd fazia só a ida: o
 * stripboard mandava cenas para a OD e ninguém nunca dizia o que de fato saiu.
 *
 * Este arquivo é o registro. O relatório e a fila de repescagem vêm depois
 * (Etapa 4), e os dois se apoiam no que está aqui.
 */

/**
 * A ordem em que um toque alterna os estados.
 *
 * Pensada para o set: com pressa, luz ruim e uma mão só, o caso comum tem que
 * estar a um toque. `gravada` primeiro porque é o que mais acontece; `cortada`
 * por último porque é decisão de direção, não de dia.
 */
export const CICLO: StatusCena[] = ['gravada', 'parcial', 'nao_gravada', 'cortada'];

export const ROTULO: Record<StatusCena, string> = {
  gravada: 'Gravada',
  parcial: 'Parcial',
  nao_gravada: 'Não gravada',
  cortada: 'Cortada',
};

/**
 * Motivos por atalho.
 *
 * Digitar texto no set não acontece — a pessoa está de pé, no escuro, com o
 * rádio na outra mão. O campo livre continua existindo para quando houver
 * tempo, mas ele não pode ser o único caminho.
 */
export const MOTIVOS = ['chuva', 'luz', 'elenco', 'equipamento', 'tempo', 'locação'] as const;

/** O estado atual de uma cena numa diária. `undefined` = ninguém marcou ainda. */
export function registroDe(
  registros: RegistroCena[],
  diariaId: string,
  cenaId: string
): RegistroCena | undefined {
  return registros.find(r => r.diaria_id === diariaId && r.cena_id === cenaId);
}

/**
 * Marca uma cena — cria ou atualiza a linha daquele dia.
 *
 * Sem confirmação, de propósito: marcação errada se desfaz com outro toque, e
 * um modal a cada cena tornaria a tela inutilizável justamente quando ela mais
 * precisa ser rápida.
 */
export async function marcarCena(
  projetoId: string,
  diariaId: string,
  cenaId: string,
  status: StatusCena,
  extras?: { motivo?: string; observacao?: string; oitavos_gravados?: number; setups?: number; registrado_por?: string }
): Promise<void> {
  const existente = await db.registros_cena
    .where('[diaria_id+cena_id]')
    .equals([diariaId, cenaId])
    .first();

  if (existente) {
    await db.registros_cena.update(existente.id, {
      status,
      registrado_em: Date.now(),
      ...extras,
    });
    return;
  }

  await db.registros_cena.add({
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    diaria_id: diariaId,
    cena_id: cenaId,
    status,
    registrado_em: Date.now(),
    ...extras,
  });
}

/** Desfaz a marcação — volta ao estado "ninguém disse nada". */
export async function limparMarcacao(diariaId: string, cenaId: string): Promise<void> {
  const existente = await db.registros_cena
    .where('[diaria_id+cena_id]')
    .equals([diariaId, cenaId])
    .first();
  if (existente) await db.registros_cena.delete(existente.id);
}

/** O próximo estado no ciclo. Sem marcação nenhuma, começa em `gravada`. */
export function proximoStatus(atual?: StatusCena): StatusCena {
  if (!atual) return CICLO[0];
  const i = CICLO.indexOf(atual);
  return CICLO[(i + 1) % CICLO.length];
}

// ---------------------------------------------------------------------------
// Planos
// ---------------------------------------------------------------------------

export async function marcarPlano(
  projetoId: string,
  diariaId: string,
  cenaId: string,
  planoId: string,
  status: 'ok' | 'pendente',
  registradoPor?: string
): Promise<void> {
  const existente = await db.registros_plano
    .where('[diaria_id+plano_id]')
    .equals([diariaId, planoId])
    .first();

  if (existente) {
    await db.registros_plano.update(existente.id, { status, registrado_em: Date.now() });
    return;
  }

  await db.registros_plano.add({
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    diaria_id: diariaId,
    cena_id: cenaId,
    plano_id: planoId,
    status,
    registrado_em: Date.now(),
    registrado_por: registradoPor,
  });
}

/**
 * O que os planos marcados sugerem para a cena.
 *
 * ⚠️ SUGERE, NÃO DECIDE. Uma cena com 6 planos e 4 feitos parece parcial — mas
 * às vezes 4 bastam e a cena está fechada, e só quem estava lá sabe disso.
 * Devolver a sugestão e deixar a pessoa confirmar é a diferença entre um app
 * que ajuda e um que discute.
 */
export function sugestaoPelosPlanos(
  totalDePlanos: number,
  planosFeitos: number
): StatusCena | undefined {
  if (totalDePlanos === 0) return undefined;
  if (planosFeitos === 0) return 'nao_gravada';
  if (planosFeitos >= totalDePlanos) return 'gravada';
  return 'parcial';
}

// ---------------------------------------------------------------------------
// O estado derivado
// ---------------------------------------------------------------------------

/**
 * O estado ATUAL de cada cena do projeto, olhando todas as diárias.
 *
 * Derivado, nunca guardado — é assim que os dois divergem. Uma cena marcada
 * `parcial` no dia 3 e `gravada` no dia 7 está gravada: vale a linha mais
 * recente.
 */
export function estadoAtualDasCenas(registros: RegistroCena[]): Map<string, RegistroCena> {
  const mapa = new Map<string, RegistroCena>();
  for (const r of registros) {
    const anterior = mapa.get(r.cena_id);
    if (!anterior || r.registrado_em > anterior.registrado_em) mapa.set(r.cena_id, r);
  }
  return mapa;
}

export interface Progresso {
  cenasTotal: number;
  gravadas: number;
  parciais: number;
  naoGravadas: number;
  cortadas: number;
  /** Ainda falta gravar — exclui as cortadas, que saíram do filme. */
  pendentes: number;
  /** Oitavos de página do filme, sem as cortadas. */
  oitavosTotal: number;
  oitavosGravados: number;
}

/**
 * Quanto do filme já saiu.
 *
 * As cortadas saem do denominador: elas não estão atrasadas, foram abandonadas.
 * Contá-las como pendentes faria o app dizer "faltam 12 cenas" para sempre,
 * mesmo depois de a direção ter decidido que aquelas 12 não existem mais.
 */
export function calcularProgresso(cenas: Cena[], registros: RegistroCena[]): Progresso {
  const atual = estadoAtualDasCenas(registros);

  let gravadas = 0, parciais = 0, cortadas = 0;
  let oitavosTotal = 0, oitavosGravados = 0;

  for (const c of cenas) {
    const registro = atual.get(c.id);
    const s = registro?.status;
    const oitavos = paginasParaOitavos(c.paginas);

    if (s === 'cortada') { cortadas++; continue; } // sai do filme, sai da conta

    oitavosTotal += oitavos;

    if (s === 'gravada') {
      gravadas++;
      oitavosGravados += oitavos;
    } else if (s === 'parcial') {
      parciais++;
      // O que a pessoa anotou vale mais que qualquer palpite. Sem anotação,
      // meia cena é o chute honesto — e chutar zero faria uma produção que
      // filmou metade parecer que não filmou nada.
      oitavosGravados += registro?.oitavos_gravados ?? Math.floor(oitavos / 2);
    }
  }

  const cenasTotal = cenas.length;
  const naoGravadas = cenasTotal - gravadas - parciais - cortadas;

  return {
    cenasTotal,
    gravadas,
    parciais,
    naoGravadas,
    cortadas,
    pendentes: cenasTotal - gravadas - cortadas,
    oitavosTotal,
    oitavosGravados,
  };
}

/**
 * O relatório de UM dia — o Daily Production Report.
 *
 * Só o que aconteceu naquela diária, ao contrário do `calcularProgresso`, que
 * olha o filme inteiro. É a diferença entre "como foi ontem" e "como estamos".
 */
export interface RelatorioDoDia {
  gravadas: Cena[];
  parciais: Cena[];
  naoGravadas: Cena[];
  cortadas: Cena[];
  /** Cenas escaladas que ninguém marcou. Perguntar, nunca assumir. */
  semRegistro: Cena[];
  oitavosPrevistos: number;
  oitavosGravados: number;
  setups: number;
}

export function relatorioDoDia(
  cenasDoDia: Cena[],
  registrosDoDia: RegistroCena[]
): RelatorioDoDia {
  const r: RelatorioDoDia = {
    gravadas: [], parciais: [], naoGravadas: [], cortadas: [], semRegistro: [],
    oitavosPrevistos: 0, oitavosGravados: 0, setups: 0,
  };

  for (const cena of cenasDoDia) {
    const oitavos = paginasParaOitavos(cena.paginas);
    r.oitavosPrevistos += oitavos;

    const registro = registrosDoDia.find(x => x.cena_id === cena.id);
    if (!registro) { r.semRegistro.push(cena); continue; }

    r.setups += registro.setups || 0;

    switch (registro.status) {
      case 'gravada':
        r.gravadas.push(cena);
        r.oitavosGravados += oitavos;
        break;
      case 'parcial':
        r.parciais.push(cena);
        r.oitavosGravados += registro.oitavos_gravados ?? Math.floor(oitavos / 2);
        break;
      case 'cortada':
        r.cortadas.push(cena);
        break;
      default:
        r.naoGravadas.push(cena);
    }
  }

  return r;
}

/**
 * As cenas que ficaram para trás — a fila de repescagem.
 *
 * Só entra o que veio de uma diária JÁ FECHADA. Cena não gravada numa diária que
 * ainda está rolando não é pendência, é o dia acontecendo.
 */
export function filaDeRepescagem(
  registros: RegistroCena[],
  diariasFechadas: Set<string>
): RegistroCena[] {
  const atual = estadoAtualDasCenas(registros);
  return [...atual.values()]
    .filter(r => diariasFechadas.has(r.diaria_id))
    .filter(r => r.status === 'nao_gravada' || r.status === 'parcial')
    .sort((a, b) => b.registrado_em - a.registrado_em);
}
