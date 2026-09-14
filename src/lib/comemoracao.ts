/**
 * A comemoração do wrap.
 *
 * ⚠️ O APP JÁ TEM UMA REGRA SOBRE COMEMORAR, e ela vale aqui também. Está
 * escrita em `ui/Faisca.tsx`: *"só em confirmação, nunca em navegação — se tudo
 * faísca, faiscar não quer dizer 'deu certo'"*. O wrap é o momento que mais
 * merece e o único grande que ainda não tinha nada; por isso ele ganha algo
 * maior que uma faísca, e por isso nada mais no app vai ganhar.
 *
 * DOIS MOMENTOS, DOIS PESOS
 *   marcar o wrap  — fogos curtos, sem travar a tela. A equipe ainda desmonta.
 *   fechar a diária — a carta de wrap, com os números do dia.
 *
 * O QUE ELA DIZ É O QUE ACONTECEU
 * Uma comemoração genérica envelhece: o gif engraçado da diária 1 é o mesmo da
 * diária 24, e a piada morre. Os NÚMEROS não envelhecem, porque são outros todo
 * dia — e são a única parte que a pessoa vai querer ler de novo.
 */

import { oitavosParaPaginas } from './decupagem';

/**
 * As frases que a produção encontra no primeiro wrap.
 *
 * São um PONTO DE PARTIDA, não um padrão permanente: a tela de edição já abre
 * com elas na lista, e a partir do primeiro toque quem manda é o Lucas. Uma
 * frase de wrap é da equipe que a diz.
 */
export const FRASES_WRAP_PADRAO: readonly string[] = [
  'É isso. Bom wrap.',
  'Acabou o dia. Amanhã tem mais.',
  'Está no lata.',
  'Corta. Foi bom.',
  'Wrap. Vão com cuidado na estrada.',
  'Mais um dia que virou filme.',
  'Desprodução, pessoal. Obrigado.',
  'O dia acabou e ninguém se machucou. Isso também é resultado.',
  'Guarda tudo com carinho, amanhã abre de novo.',
  'Bom trabalho. Sério.',
];

/** O fecho da última diária. Terminar uma filmagem não é terminar um dia. */
export const FRASES_FIM_PADRAO: readonly string[] = [
  'É um filme.',
  'Acabou. Vocês fizeram um filme.',
  'Último wrap. Esse a gente lembra.',
];

/**
 * Sorteia sem repetir a anterior.
 *
 * O mesmo desenho de `sortearFrase` nas frases do J. Martins, e pelo mesmo
 * motivo: a repetição imediata é a única que a pessoa percebe, e ela é a que
 * faz a surpresa virar bug aos olhos de quem vê.
 */
export function sortear<T>(lista: readonly T[], anterior?: T | null): T | null {
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  let escolhida: T = lista[Math.floor(Math.random() * lista.length)];
  while (escolhida === anterior) {
    escolhida = lista[Math.floor(Math.random() * lista.length)];
  }
  return escolhida;
}

/**
 * A última coisa sorteada, por projeto.
 *
 * Vive no `localStorage` de propósito: "qual foi a frase de ontem" não é dado
 * da produção, não interessa à outra equipe e não vale uma linha no banco nem
 * uma viagem pelo espelho. Se o navegador esquecer, o pior que acontece é uma
 * frase repetir uma vez.
 */
const CHAVE = 'setprod:wrap:';

export function lembrar(projetoId: string, tipo: 'frase' | 'gif', valor: string) {
  try { localStorage.setItem(CHAVE + tipo + ':' + projetoId, valor); } catch { /* modo privado */ }
}

export function ultima(projetoId: string, tipo: 'frase' | 'gif'): string | null {
  try { return localStorage.getItem(CHAVE + tipo + ':' + projetoId); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Os números do dia
// ---------------------------------------------------------------------------

export interface NumeroDoWrap {
  /** "6 cenas", "4 3/8". O valor grande. */
  valor: string;
  /** "gravadas", "de página". O rótulo pequeno embaixo. */
  rotulo: string;
  /** Destaque positivo (adiantado) ou de atenção (atrasado). */
  tom?: 'bom' | 'atencao';
}

export interface DadosDoWrap {
  gravadas: number;
  parciais: number;
  naoGravadas: number;
  oitavosGravados: number;
  setups: number;
  /** Hora em que o dia de fato terminou, quando alguém marcou. */
  wrapReal?: string | null;
  wrapPlanejado?: string | null;
  /** Minutos de diferença entre o real e o planejado. Negativo = adiantado. */
  diferencaMin?: number | null;
}

/**
 * Os números que valem a pena ler no fim do dia.
 *
 * O filtro é duro: cabe o que a pessoa contaria para alguém. "3 setups" não
 * entra num dia de 3 setups porque não diz nada; "18 setups" entra, porque diz
 * que o dia foi duro. Um painel com seis caixinhas viraria relatório, e
 * relatório já existe — este é o momento de olhar e respirar.
 */
export function numerosDoWrap(d: DadosDoWrap): NumeroDoWrap[] {
  const lista: NumeroDoWrap[] = [];

  const cenas = d.gravadas + d.parciais;
  if (cenas > 0) {
    lista.push({
      valor: String(d.gravadas),
      rotulo: d.gravadas === 1 ? 'cena gravada' : 'cenas gravadas',
    });
  }
  if (d.parciais > 0) {
    lista.push({ valor: String(d.parciais), rotulo: d.parciais === 1 ? 'cena parcial' : 'cenas parciais' });
  }
  if (d.oitavosGravados > 0) {
    lista.push({ valor: oitavosParaPaginas(d.oitavosGravados), rotulo: 'de página' });
  }
  /*
    Setups só a partir de um número que significa alguma coisa.

    Abaixo disso o campo costuma estar preenchido pela metade — e um "2 setups"
    num dia de vinte diria ao AD que o app não estava prestando atenção.
  */
  if (d.setups >= 6) {
    lista.push({ valor: String(d.setups), rotulo: 'setups' });
  }
  if (d.wrapReal) {
    const dif = d.diferencaMin;
    lista.push({
      valor: d.wrapReal,
      rotulo: dif === null || dif === undefined || Math.abs(dif) < 5
        ? 'wrap, no horário'
        : dif < 0
          ? `wrap · ${descreverMinutos(-dif)} adiantado`
          : `wrap · ${descreverMinutos(dif)} depois do previsto`,
      tom: dif !== null && dif !== undefined && Math.abs(dif) >= 5
        ? (dif < 0 ? 'bom' : 'atencao')
        : undefined,
    });
  }

  return lista;
}

/** "40min", "1h20". */
export function descreverMinutos(minutos: number): string {
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60), m = abs % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * A linha que situa o dia dentro da produção.
 *
 * "Diária 03 de 12" responde a pergunta que todo mundo faz no wrap sem
 * perguntar — quanto ainda falta. Sem o total (produção que não cadastrou os
 * dias), diz só o número, que é honesto e continua útil.
 */
export function ondeEstamos(numero: number, total?: number): string {
  const n = String(numero).padStart(2, '0');
  if (!total || total < numero) return `Diária ${n}`;
  if (numero === total) return `Diária ${n} de ${total} — a última`;
  const faltam = total - numero;
  return `Diária ${n} de ${total} · ${faltam === 1 ? 'falta 1 dia' : `faltam ${faltam} dias`}`;
}
