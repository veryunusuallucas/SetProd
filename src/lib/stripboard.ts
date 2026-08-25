/**
 * Linha do tempo do stripboard: cenas e marcadores na mesma ordem.
 *
 * O stripboard não é só uma lista de cenas ordenadas — é onde a produção
 * decide o dia. Uma quebra de diária no meio muda o significado de tudo que
 * vem depois, e um almoço entre duas cenas é a diferença entre um dia que
 * fecha e um que estoura.
 *
 * Por isso cenas e marcadores dividem o mesmo campo `ordem`: a posição
 * relativa entre eles É a informação.
 */
import type { Cena, StripboardItem, TipoStripboardItem } from '../types';
import { paginasParaOitavos, oitavosParaPaginas } from './decupagem';

export type ItemLinha =
  | { tipo: 'SCENE'; id: string; ordem: number; cena: Cena }
  | { tipo: TipoStripboardItem; id: string; ordem: number; item: StripboardItem };

/** Métricas de um dia, recalculadas a cada mudança de ordem. */
export interface ResumoDia {
  numero: number;
  cenas: number;
  oitavos: number;
  paginas: string;
  minutos: number;
  duracao: string;
  /** Locações distintas do dia — quantas mais, mais deslocamento. */
  locacoes: string[];
}

export const ROTULOS: Record<TipoStripboardItem, string> = {
  DAY_BREAK: 'Quebra de diária',
  BANNER_LUNCH: 'Almoço',
  BANNER_MOVE: 'Mudança de locação',
  BANNER_NOTE: 'Nota',
};

/** Cores dos marcadores (as das cenas ficam em decupagem.ts). */
export const CORES_MARCADOR: Record<TipoStripboardItem, { bg: string; text: string }> = {
  DAY_BREAK: { bg: '#2d3436', text: '#ffffff' },
  BANNER_LUNCH: { bg: '#27ae60', text: '#ffffff' },
  BANNER_MOVE: { bg: '#8e44ad', text: '#ffffff' },
  BANNER_NOTE: { bg: '#636e72', text: '#ffffff' },
};

/** Junta cenas e marcadores numa lista só, na ordem de filmagem. */
export function montarLinha(cenas: Cena[], itens: StripboardItem[]): ItemLinha[] {
  const deCena = (c: Cena) => c.ordem ?? (parseInt(c.numero.replace(/\D/g, '')) || 0);

  const linha: ItemLinha[] = [
    ...cenas.map(c => ({ tipo: 'SCENE' as const, id: c.id, ordem: deCena(c), cena: c })),
    ...itens.map(i => ({ tipo: i.tipo, id: i.id, ordem: i.ordem, item: i })),
  ];

  return linha.sort((a, b) => a.ordem - b.ordem);
}

/** "45min", "2h", "1h30" → minutos. Devolve 0 quando não dá para ler. */
export function minutosDe(estimativa?: string): number {
  if (!estimativa) return 0;
  const t = estimativa.toLowerCase().replace(/\s/g, '');

  const horaEMin = t.match(/^(\d+)h(\d+)/);
  if (horaEMin) return parseInt(horaEMin[1], 10) * 60 + parseInt(horaEMin[2], 10);

  const soHora = t.match(/^([\d.,]+)h$/);
  if (soHora) return Math.round(parseFloat(soHora[1].replace(',', '.')) * 60);

  const soMin = t.match(/^(\d+)(min|m)?$/);
  if (soMin) return parseInt(soMin[1], 10);

  return 0;
}

export function formatarDuracao(minutos: number): string {
  if (minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * Calcula o resumo de cada dia percorrendo a linha do tempo.
 *
 * O acumulador zera a cada DAY_BREAK. Banners de evento somam TEMPO mas não
 * páginas — almoço não filma, mas ocupa o dia, e ignorá-lo é como a produção
 * estoura o horário no papel.
 */
export function resumirDias(linha: ItemLinha[], nomeLocacao: (cena: Cena) => string): Map<string, ResumoDia> {
  const porQuebra = new Map<string, ResumoDia>();

  let dia = 1;
  let atual: ResumoDia = { numero: dia, cenas: 0, oitavos: 0, paginas: '—', minutos: 0, duracao: '—', locacoes: [] };
  const locacoesDoDia = new Set<string>();
  /** Chave do bloco corrente: id da quebra que o fecha, ou 'inicio'. */
  let blocoAberto: ItemLinha[] = [];

  const fechar = (chave: string) => {
    atual.paginas = oitavosParaPaginas(atual.oitavos);
    atual.duracao = formatarDuracao(atual.minutos);
    atual.locacoes = [...locacoesDoDia];
    porQuebra.set(chave, atual);
  };

  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') {
      fechar(it.id);
      dia += 1;
      atual = { numero: dia, cenas: 0, oitavos: 0, paginas: '—', minutos: 0, duracao: '—', locacoes: [] };
      locacoesDoDia.clear();
      blocoAberto = [];
      continue;
    }

    blocoAberto.push(it);

    if (it.tipo === 'SCENE') {
      atual.cenas += 1;
      atual.oitavos += paginasParaOitavos(it.cena.paginas);
      atual.minutos += minutosDe(it.cena.estimativa);
      const loc = nomeLocacao(it.cena);
      if (loc) locacoesDoDia.add(loc);
    } else {
      atual.minutos += it.item.duracao_min || 0;
    }
  }

  // O último bloco não tem quebra depois dele; guardamos sob uma chave fixa
  // para o rodapé conseguir mostrar o total do dia final.
  fechar('__ultimo__');
  return porQuebra;
}

/** Número da diária a que uma posição da linha pertence (1 é o primeiro dia). */
export function diaNaPosicao(linha: ItemLinha[], indice: number): number {
  let dia = 1;
  for (let i = 0; i < indice; i++) if (linha[i].tipo === 'DAY_BREAK') dia += 1;
  return dia;
}

/** Cenas de um dia específico, para exportar direto numa Ordem do Dia. */
export function cenasDoDia(linha: ItemLinha[], numeroDoDia: number): Cena[] {
  const out: Cena[] = [];
  let dia = 1;
  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') { dia += 1; continue; }
    if (dia === numeroDoDia && it.tipo === 'SCENE') out.push(it.cena);
  }
  return out;
}

/** O bloco final, que não tem quebra depois dele. */
export const ULTIMO_BLOCO = '__ultimo__';

/**
 * As cenas do bloco que uma quebra fecha — pelo ID da quebra, não pelo número.
 *
 * O número do dia é frágil de propósito: ele é POSICIONAL. Adicionar uma quebra
 * no começo empurra todo mundo, e o "dia 3" de ontem é o "dia 4" de hoje. Uma
 * diária que guardasse o número apontaria para o bloco errado no dia seguinte.
 *
 * Devolve `null` quando a quebra não existe mais — foi apagada. Esse caso NÃO é
 * "nenhuma cena": é "perdi a referência", e confundir os dois faria a Ordem do
 * Dia esvaziar sozinha porque alguém removeu um marcador.
 */
export function cenasDaQuebra(linha: ItemLinha[], quebraId: string): Cena[] | null {
  if (quebraId === ULTIMO_BLOCO) {
    const totalDias = linha.filter(i => i.tipo === 'DAY_BREAK').length + 1;
    return cenasDoDia(linha, totalDias);
  }

  const indice = linha.findIndex(i => i.id === quebraId);
  if (indice < 0) return null;

  return cenasDoDia(linha, diaNaPosicao(linha, indice));
}

/**
 * Reagrupa as cenas juntando as da mesma locação, sem cruzar quebras de diária.
 *
 * Cada troca de locação num dia de filmagem custa horas de deslocamento e
 * remontagem. Agrupar é a primeira coisa que um assistente de direção faz com
 * um stripboard cru.
 *
 * Dentro de cada locação, INT e EXT ficam juntos e a ordem original é
 * preservada — quem decide o resto é quem conhece a luz do lugar.
 */
export function agruparPorLocacao(linha: ItemLinha[], nomeLocacao: (cena: Cena) => string): ItemLinha[] {
  const saida: ItemLinha[] = [];
  let bloco: ItemLinha[] = [];

  const despejar = () => {
    const cenas = bloco.filter((i): i is Extract<ItemLinha, { tipo: 'SCENE' }> => i.tipo === 'SCENE');
    const outros = bloco.filter(i => i.tipo !== 'SCENE');

    const grupos = new Map<string, typeof cenas>();
    for (const c of cenas) {
      const chave = nomeLocacao(c.cena) || 'sem locação';
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave)!.push(c);
    }

    for (const g of grupos.values()) {
      // INT antes de EXT: dentro do mesmo lugar, interno costuma independer da luz.
      g.sort((a, b) => (a.cena.ambiente === 'int' ? 0 : 1) - (b.cena.ambiente === 'int' ? 0 : 1));
      saida.push(...g);
    }
    // Banners do bloco vão para o fim dele; a pessoa reposiciona se quiser.
    saida.push(...outros);
    bloco = [];
  };

  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') {
      despejar();
      saida.push(it);
      continue;
    }
    bloco.push(it);
  }
  despejar();

  return saida;
}
