import type { Cena, HorarioOD, ItemDoDia, TipoItemDia } from '../types';
import { minutosDe } from './stripboard';

/**
 * A linha do tempo do dia: cenas, pausas, deslocamentos e marcos numa lista só.
 *
 * POR QUE ELA EXISTE
 * "Horários / Cronograma" e "Cenas Programadas" viviam em duas caixas que não
 * se falavam. Mas no set elas são a mesma coisa — o cronograma do dia É a
 * sequência de cenas mais as pausas e os deslocamentos entre elas. Separadas,
 * as cenas não tinham horário nenhum, e o cronograma era uma lista de texto
 * que ninguém conseguia manter em pé quando o dia mudava.
 *
 * Aqui elas viram uma coisa só, e o horário de cada item sai por encadeamento:
 * a chamada define o início, e cada item empurra o seguinte pelo tempo que
 * consome.
 */

export const DURACAO_PADRAO: Record<TipoItemDia, number> = {
  cena: 60,
  marco: 0,
  almoco: 60,
  move: 30,
  nota: 0,
};

export const ROTULO_TIPO: Record<TipoItemDia, string> = {
  cena: 'Cena',
  marco: 'Marco do dia',
  almoco: 'Refeição',
  move: 'Deslocamento',
  nota: 'Nota',
};

/**
 * Cor de cada tipo. As mesmas do stripboard — quem viu o dia lá reconhece aqui.
 * Cena não entra: ela usa a cor de ambiente/período, que é informação dela.
 */
export const COR_TIPO: Record<Exclude<TipoItemDia, 'cena'>, string> = {
  marco: 'var(--text-secondary)',
  almoco: '#27ae60',
  move: '#8e44ad',
  nota: '#636e72',
};

/** "07:30" → 450. Devolve `null` no que não for hora. */
export function emMinutos(hora?: string): number | null {
  if (!hora) return null;
  const m = hora.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * 450 → "07:30". Passa da meia-noite sem quebrar: uma diária noturna que vira o
 * dia é rotina, e mostrar "25:10" seria pior que mostrar "01:10".
 */
export function emHora(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Quanto tempo o item consome. Cena sem duração própria cai na estimativa. */
export function duracaoDoItem(item: ItemDoDia, cena?: Cena): number {
  if (item.duracao_min !== undefined) return item.duracao_min;
  if (item.tipo === 'cena') {
    const daEstimativa = minutosDe(cena?.estimativa);
    return daEstimativa || DURACAO_PADRAO.cena;
  }
  return DURACAO_PADRAO[item.tipo];
}

/**
 * O pedaço da diária de onde a linha sai.
 *
 * Não é a `Diaria` inteira de propósito: quando o dia se divide em frentes
 * (spec §3), cada frente tem a sua linha e as suas cenas, e a função precisa
 * conseguir montar a de uma frente sem fingir que ela é a diária toda.
 */
export interface VisaoDoDia {
  linha_do_tempo?: ItemDoDia[];
  horarios?: HorarioOD[];
  cena_ids?: string[];
}

/**
 * Monta a linha do dia, reconciliando com as cenas realmente escaladas.
 *
 * ⚠️ ESTA FUNÇÃO NÃO GRAVA NADA, E ISSO É O PONTO.
 *
 * A diária pode nunca ter tido uma linha do tempo (todas as antigas não têm), e
 * as cenas podem mudar por fora — o stripboard reescreve `cena_ids` quando a
 * diária está em rascunho. Então a linha é sempre derivada na hora:
 *
 * - sem `linha_do_tempo`: nasce dos `horarios` (viram marcos travados) seguidos
 *   das cenas na ordem de `cena_ids`;
 * - com `linha_do_tempo`: as cenas que saíram de `cena_ids` somem, e as que
 *   entraram são acrescentadas no fim — visíveis, para alguém colocar no lugar.
 *
 * Cena nova entrar no fim é decisão, não preguiça: adivinhar onde ela caberia
 * no meio de um dia já montado erra na maioria das vezes, e erro no meio da
 * linha é mais difícil de notar que uma sobra no fim.
 */
export function montarLinhaDoDia(diaria: VisaoDoDia): ItemDoDia[] {
  const escaladas = diaria.cena_ids || [];

  if (!diaria.linha_do_tempo || diaria.linha_do_tempo.length === 0) {
    const marcos: ItemDoDia[] = (diaria.horarios || []).map(h => ({
      id: h.id,
      tipo: rotuloParaTipo(h.evento),
      titulo: h.evento,
      hora_travada: h.hora,
    }));
    const cenas: ItemDoDia[] = escaladas.map(cid => ({
      id: `cena-${cid}`,
      tipo: 'cena' as const,
      cena_id: cid,
    }));
    return [...marcos, ...cenas];
  }

  const naLinha = new Set(
    diaria.linha_do_tempo.filter(i => i.tipo === 'cena').map(i => i.cena_id)
  );
  const sobreviventes = diaria.linha_do_tempo.filter(
    i => i.tipo !== 'cena' || (i.cena_id && escaladas.includes(i.cena_id))
  );
  const novas: ItemDoDia[] = escaladas
    .filter(cid => !naLinha.has(cid))
    .map(cid => ({ id: `cena-${cid}`, tipo: 'cena' as const, cena_id: cid }));

  return [...sobreviventes, ...novas];
}

/**
 * "Almoço" digitado à mão vira o banner verde de refeição.
 *
 * As diárias antigas têm o dia inteiro como texto livre em `horarios`, e sem
 * isto a migração devolveria uma coluna de marcos cinzas iguais — perdendo
 * justamente a leitura rápida que a linha do tempo veio dar.
 */
function rotuloParaTipo(evento: string): TipoItemDia {
  const t = evento.toLowerCase();
  if (/almo|janta|refei|caf[eé]|lanche/.test(t)) return 'almoco';
  if (/deslocamento|company\s*move|mudan[çc]a|translado/.test(t)) return 'move';
  return 'marco';
}

export interface ItemCalculado {
  item: ItemDoDia;
  cena?: Cena;
  /** Início, já resolvido: o travado quando existe, o encadeado quando não. */
  hora: string;
  inicio: number;
  fim: number;
  duracao: number;
  /** `true` quando o horário veio da mão de alguém, não da conta. */
  travado: boolean;
}

export interface DiaCalculado {
  itens: ItemCalculado[];
  /** Fim do último item — o wrap previsto. `null` quando o dia está vazio. */
  wrap: string | null;
  /** Total de minutos ocupados, do primeiro início ao último fim. */
  duracaoTotal: number;
}

/**
 * Encadeia os horários a partir da chamada.
 *
 * A regra da §2.2 em uma frase: **horário travado reinicia a conta**. Um item
 * com hora escrita à mão não é só preservado — ele passa a ser a nova origem,
 * e o que vem depois dele é calculado dali.
 *
 * É o que faz a sobrescrita ser útil de verdade. Se o travado fosse apenas
 * "respeitado", corrigir o almoço para 12h deixaria as cenas da tarde ainda
 * penduradas no horário errado da manhã, e a pessoa teria que travar o dia
 * inteiro à mão para consertar um item.
 */
export function calcularDia(
  itens: ItemDoDia[],
  chamada: string | undefined,
  cenaPorId: (id: string) => Cena | undefined
): DiaCalculado {
  let relogio = emMinutos(chamada) ?? emMinutos('07:00')!;
  let primeiro: number | null = null;

  const calculados: ItemCalculado[] = itens.map(item => {
    const cena = item.cena_id ? cenaPorId(item.cena_id) : undefined;
    const duracao = duracaoDoItem(item, cena);

    const travadoEm = emMinutos(item.hora_travada);
    /*
      Hora travada que caiu ANTES do relógio corrente é aceita mesmo assim.

      Parece errado, e não é: é exatamente o caso da diária que vira o dia. O
      wrap às 02:00 depois de uma chamada às 18:00 é um horário menor no
      relógio e maior no tempo. Recusá-lo forçaria a pessoa a mentir na
      chamada para conseguir escrever a hora real.
    */
    const inicio = travadoEm ?? relogio;
    if (primeiro === null) primeiro = inicio;
    relogio = inicio + duracao;

    return {
      item, cena, duracao,
      inicio,
      fim: inicio + duracao,
      hora: emHora(inicio),
      travado: travadoEm !== null,
    };
  });

  const ultimo = calculados[calculados.length - 1];
  return {
    itens: calculados,
    wrap: ultimo ? emHora(ultimo.fim) : null,
    duracaoTotal: ultimo && primeiro !== null ? ultimo.fim - primeiro : 0,
  };
}

/**
 * O radar de atraso da §5.1.
 *
 * Compara o dia como foi planejado com o dia como está acontecendo: para cada
 * item já marcado com `hora_real`, quanto ele saiu do previsto.
 */
export interface Atraso {
  /** Minutos de diferença. Positivo é atraso, negativo é adiantamento. */
  minutos: number;
  /** Wrap refeito com o atraso corrente aplicado. */
  wrapPrevisto: string | null;
  /** Wrap do plano, sem o atraso. */
  wrapPlanejado: string | null;
  /** Quantos itens já têm hora real. Zero = o dia ainda não começou a ser marcado. */
  marcados: number;
}

export function calcularAtraso(dia: DiaCalculado): Atraso {
  const base = { wrapPlanejado: dia.wrap, wrapPrevisto: dia.wrap };

  /*
    Só o ÚLTIMO item marcado conta.

    Os anteriores já estão embutidos nele: se a cena 4 atrasou 40min e a 2
    começou 40min depois do previsto por causa disso, o atraso do dia continua
    sendo 40min, não 80. Somar diferenças é o erro clássico deste cálculo, e
    ele produz um wrap catastrofista que ninguém acredita — e um radar em que
    ninguém acredita é um radar desligado.
  */
  const marcados = dia.itens.filter(i => emMinutos(i.item.hora_real) !== null);
  if (marcados.length === 0) return { ...base, minutos: 0, marcados: 0 };

  const ultimo = marcados[marcados.length - 1];
  const real = emMinutos(ultimo.item.hora_real)!;
  let minutos = real - ultimo.inicio;

  // Virada de dia: 00:30 real contra 23:50 previsto é 40min de atraso, não
  // 1400 de adiantamento. Meio dia de diferença é o ponto de corte natural.
  if (minutos > 720) minutos -= 1440;
  if (minutos < -720) minutos += 1440;

  return {
    ...base,
    minutos,
    marcados: marcados.length,
    wrapPrevisto: dia.wrap ? emHora(emMinutos(dia.wrap)! + minutos) : null,
  };
}

/** "+40min de atraso" / "15min adiantado" / "no horário". */
export function descreverAtraso(minutos: number): string {
  if (Math.abs(minutos) < 5) return 'no horário';
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60), m = abs % 60;
  const texto = h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
  return minutos > 0 ? `${texto} de atraso` : `${texto} adiantado`;
}
