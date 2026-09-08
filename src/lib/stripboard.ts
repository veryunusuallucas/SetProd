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
  BANNER_SNACK: 'Lanche',
  BANNER_MOVE: 'Mudança de locação',
  BANNER_NOTE: 'Nota',
};

/** Cores dos marcadores (as das cenas ficam em decupagem.ts). */
export const CORES_MARCADOR: Record<TipoStripboardItem, { bg: string; text: string }> = {
  DAY_BREAK: { bg: '#2d3436', text: '#ffffff' },
  BANNER_LUNCH: { bg: '#27ae60', text: '#ffffff' },
  // Verde mais claro que o do almoço: é parente dele, e não outra coisa.
  BANNER_SNACK: { bg: '#16a085', text: '#ffffff' },
  BANNER_MOVE: { bg: '#8e44ad', text: '#ffffff' },
  BANNER_NOTE: { bg: '#636e72', text: '#ffffff' },
};

/**
 * As refeições que o menu do stripboard oferece.
 *
 * Quatro botões de refeição na barra seriam quatro botões para a mesma ideia.
 * Aqui elas são presets de um botão só — o que muda entre elas é o nome e a
 * duração, e as duas coisas continuam editáveis depois de inseridas.
 */
export const REFEICOES: { rotulo: string; tipo: TipoStripboardItem; duracao_min: number }[] = [
  { rotulo: 'Café da manhã', tipo: 'BANNER_SNACK', duracao_min: 30 },
  { rotulo: 'Almoço', tipo: 'BANNER_LUNCH', duracao_min: 60 },
  { rotulo: 'Jantar', tipo: 'BANNER_LUNCH', duracao_min: 60 },
  { rotulo: 'Lanche', tipo: 'BANNER_SNACK', duracao_min: 20 },
];

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

/**
 * TUDO de um dia — cenas E banners — na ordem em que está no stripboard.
 *
 * `cenasDoDia` devolve só as cenas, e por muito tempo isso bastou: a Ordem do
 * Dia só queria a lista. A linha do tempo quer o dia inteiro, porque o almoço e
 * o company move que alguém já planejou no stripboard são exatamente o que faz
 * os horários baterem — sem eles, a conta dá um dia sem pausa nenhuma.
 */
export function blocoDoDia(linha: ItemLinha[], numeroDoDia: number): ItemLinha[] {
  const out: ItemLinha[] = [];
  let dia = 1;
  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') { dia += 1; continue; }
    if (dia === numeroDoDia) out.push(it);
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
  const bloco = blocoDaQuebra(linha, quebraId);
  return bloco === null ? null : bloco.flatMap(i => (i.tipo === 'SCENE' ? [i.cena] : []));
}

/** O mesmo bloco, mas inteiro — com os banners. Mesma regra do `null`. */
export function blocoDaQuebra(linha: ItemLinha[], quebraId: string): ItemLinha[] | null {
  if (quebraId === ULTIMO_BLOCO) {
    const totalDias = linha.filter(i => i.tipo === 'DAY_BREAK').length + 1;
    return blocoDoDia(linha, totalDias);
  }

  const indice = linha.findIndex(i => i.id === quebraId);
  if (indice < 0) return null;

  return blocoDoDia(linha, diaNaPosicao(linha, indice));
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

// ---------------------------------------------------------------------------
// Outras formas de organizar a ordem de filmagem
// ---------------------------------------------------------------------------

/**
 * As maneiras de reorganizar que a barra do stripboard oferece.
 *
 * Todas seguem a mesma regra: **a quebra de diária é uma parede**. Reorganizar
 * embaralha as cenas dentro de cada dia, nunca entre dias — mover uma cena de
 * quarta-feira para segunda por causa de uma ordenação automática seria remontar
 * a produção pelas costas de quem a montou.
 */
export type ModoDeOrdenar = 'roteiro' | 'locacao' | 'ambiente' | 'periodo';

export const MODOS_DE_ORDENAR: { modo: ModoDeOrdenar; rotulo: string; ajuda: string }[] = [
  { modo: 'roteiro', rotulo: 'Ordem do roteiro', ajuda: 'Volta à sequência em que as cenas aparecem no roteiro, pelo número.' },
  { modo: 'locacao', rotulo: 'Agrupar por locação', ajuda: 'Junta as cenas do mesmo lugar — é o que economiza deslocamento.' },
  { modo: 'ambiente', rotulo: 'Agrupar por INT / EXT', ajuda: 'Internos de um lado, externos do outro. Externo depende do tempo; interno, não.' },
  { modo: 'periodo', rotulo: 'Agrupar por dia / noite', ajuda: 'Junta o que é diurno e o que é noturno, para não virar a jornada duas vezes.' },
];

/**
 * Reordena as cenas de cada dia por um critério, sem atravessar as quebras.
 *
 * `ordem do roteiro` desfaz qualquer agrupamento e devolve a sequência numérica
 * — é o "desfazer" de quem experimentou uma organização e não gostou. Ele
 * também respeita as quebras: cada dia volta à ordem do roteiro entre as suas
 * próprias paredes.
 */
export function reordenar(
  linha: ItemLinha[],
  modo: ModoDeOrdenar,
  nomeLocacao: (cena: Cena) => string
): ItemLinha[] {
  if (modo === 'locacao') return agruparPorLocacao(linha, nomeLocacao);

  const chaveDe = (c: Cena): string => {
    if (modo === 'ambiente') return c.ambiente === 'int' ? '1-int' : '2-ext';
    if (modo === 'periodo') return c.periodo === 'noite' ? '2-noite' : '1-dia';
    return '';
  };

  /** Número da cena como número, para "7A" vir logo depois de "7". */
  const ordemNoRoteiro = (c: Cena): [number, string] => {
    const n = parseInt(c.numero.replace(/\D/g, ''), 10);
    return [isNaN(n) ? Number.MAX_SAFE_INTEGER : n, c.numero];
  };

  const saida: ItemLinha[] = [];
  let bloco: ItemLinha[] = [];

  const despejar = () => {
    const cenas = bloco.filter((i): i is Extract<ItemLinha, { tipo: 'SCENE' }> => i.tipo === 'SCENE');
    const outros = bloco.filter(i => i.tipo !== 'SCENE');

    cenas.sort((a, b) => {
      const ka = chaveDe(a.cena), kb = chaveDe(b.cena);
      if (ka !== kb) return ka < kb ? -1 : 1;
      // Dentro do grupo, a ordem do roteiro — que é a que a equipe já conhece.
      const [na, ta] = ordemNoRoteiro(a.cena);
      const [nb, tb] = ordemNoRoteiro(b.cena);
      return na !== nb ? na - nb : ta.localeCompare(tb);
    });

    saida.push(...cenas, ...outros);
    bloco = [];
  };

  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') { despejar(); saida.push(it); continue; }
    bloco.push(it);
  }
  despejar();

  return saida;
}

/**
 * Onde encaixar uma cena para que ela caia DENTRO de um dia do stripboard.
 *
 * Serve ao caminho inverso do normal: em vez de o stripboard mandar cenas para
 * a diária, alguém acrescenta uma cena na Ordem do Dia e ela precisa aparecer
 * no dia certo do stripboard. Sem isto, a cena some na abertura seguinte — o
 * rascunho espelha o bloco, e o que não está no bloco não sobrevive.
 *
 * Devolve um `ordem` que põe a cena no FIM daquele dia, logo antes da quebra
 * que o fecha. Fim e não começo porque cena acrescentada depois é, quase
 * sempre, cena que se decidiu encaixar "se der tempo" — e quem quiser em outro
 * lugar arrasta, que é o gesto natural do stripboard.
 *
 * `null` quando a quebra não existe mais. Não é "põe no fim": é "perdi a
 * referência", e chutar um dia aqui escalaria a cena para o dia errado.
 */
export function ordemParaEntrarNoBloco(linha: ItemLinha[], quebraId: string): number | null {
  const totalDias = linha.filter(i => i.tipo === 'DAY_BREAK').length + 1;

  let numero: number;
  if (quebraId === ULTIMO_BLOCO) {
    numero = totalDias;
  } else {
    const i = linha.findIndex(x => x.id === quebraId);
    if (i < 0) return null;
    numero = diaNaPosicao(linha, i);
  }

  let dia = 1;
  /** Último item do bloco, a quebra que o fecha e a que o abre. */
  let ultimo: ItemLinha | null = null;
  let fecha: ItemLinha | null = null;
  let abre: ItemLinha | null = null;

  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') {
      if (dia === numero) { fecha = it; break; }
      dia += 1;
      if (dia === numero) abre = it;
      continue;
    }
    if (dia === numero) ultimo = it;
  }

  // Bloco final: nada o fecha, então basta vir depois de tudo.
  if (!fecha) return (ultimo?.ordem ?? abre?.ordem ?? 0) + 1;

  // O bloco tem cenas: entra entre a última delas e a quebra.
  if (ultimo) return (ultimo.ordem + fecha.ordem) / 2;

  // Dia vazio: no meio do espaço entre as duas quebras que o delimitam.
  const inicio = abre ? abre.ordem : fecha.ordem - 1;
  return (inicio + fecha.ordem) / 2;
}
