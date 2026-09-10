/**
 * A Ordem do Dia como DADOS.
 *
 * ⚠️ ESTE ARQUIVO NÃO CONHECE HTML, PDF NEM REACT. De propósito.
 *
 * O documento que a equipe recebe era uma string montada por concatenação
 * dentro de `DiariaModule.tsx`, e a MESMA string servia três destinos com
 * exigências opostas: o papel, o corpo do e-mail e o relatório do dia. Melhorar
 * o papel estragava o e-mail — foi por isso que ninguém melhorou.
 *
 * Aqui a OD vira uma estrutura tipada. Quem a monta (`montar.ts`) não decide
 * nada sobre aparência; quem a desenha (`pdf.tsx`, `html.ts`) não decide nada
 * sobre conteúdo. O papel pôde virar grade sem quebrar o e-mail porque essa
 * linha existe.
 *
 * E há um efeito que não é de organização: **não existe o que conferir quando
 * não existe quem invente**. `conferirOD` continua guardando o caminho da IA,
 * que agora é opcional — o caminho principal não passa por ela.
 */

/** Como uma célula deve aparecer. Peso, não cor: a cor é do renderizador. */
export type Enfase = 'forte' | 'fraco';

export interface Celula {
  texto: string;
  enfase?: Enfase;
  /** Segunda linha, menor. A sinopse embaixo do cabeçalho da cena. */
  detalhe?: string;
}

/** Texto puro também vale como célula — a maioria delas é só isso. */
export type ValorCelula = string | Celula;

export interface ColunaTabela {
  chave: string;
  rotulo: string;
  /**
   * Peso da coluna na largura total, como no `flex` do CSS. Não é pixel nem
   * porcentagem: o renderizador reparte o que tem entre as colunas presentes,
   * então esconder uma coluna não deixa buraco.
   */
  peso: number;
  alinhamento?: 'esq' | 'centro' | 'dir';
}

export interface LinhaTabela {
  celulas: Record<string, ValorCelula>;
  /**
   * A linha não é uma cena — é um marco do dia (almoço, deslocamento, wrap).
   *
   * Ela atravessa a grade inteira em vez de preencher as colunas, porque as
   * colunas são sobre cena e um almoço não tem I/E nem elenco. É o que faz a
   * grade continuar legível quando o dia tem seis paradas.
   */
  faixa?: { texto: string; hora?: string };
}

export interface Tabela {
  colunas: ColunaTabela[];
  linhas: LinhaTabela[];
  /** Linha de fechamento: total de páginas, total de horas. */
  total?: Record<string, string>;
}

export interface Campo {
  rotulo: string;
  valor: string;
  /** Linha secundária — endereço embaixo do nome, telefone embaixo da pessoa. */
  detalhe?: string;
}

export interface PessoaNaLista {
  nome: string;
  funcao?: string;
  contato?: string;
  /** Canal do rádio. Vazio na maioria das produções, e some quando vazio. */
  radio?: string;
  /**
   * Esta pessoa confirmou presença.
   *
   * É um campo, e não um "✓" colado no nome. Colado, o papel saía com "Joana
   * Ribeiro ok" — as fontes do PDF não têm o símbolo, e a troca automática
   * transformava a marca em palavra no meio do nome de alguém.
   */
  confirmado?: boolean;
  /** O horário DESTA pessoa, quando não é o geral. */
  chamada?: string;
}

export interface GrupoDePessoas {
  nome: string;
  pessoas: PessoaNaLista[];
}

/**
 * Os cinco formatos em que qualquer coisa da OD cabe.
 *
 * Cinco, e não um por bloco: cada formato novo é um formato que os DOIS
 * renderizadores precisam aprender a desenhar. A grade hora a hora, as cenas do
 * dia seguinte e o elenco são a mesma `tabela` com colunas diferentes.
 */
export type Secao =
  | { id: string; tipo: 'campos'; titulo?: string; itens: Campo[]; colunas?: number }
  | { id: string; tipo: 'tabela'; titulo?: string; nota?: string; tabela: Tabela }
  | { id: string; tipo: 'texto'; titulo?: string; corpo: string }
  | { id: string; tipo: 'lista'; titulo?: string; itens: string[]; colunas?: number }
  | { id: string; tipo: 'pessoas'; titulo?: string; grupos: GrupoDePessoas[]; colunas?: number }
  /**
   * Seções lado a lado.
   *
   * É o que faz os quadrantes do topo do modelo existirem — "CHEGADA EQUIPE",
   * "BASE E CAMARIM" e "SETS" são três blocos numa linha, não três seções
   * empilhadas. Sem isto, a primeira página do modelo não fecha.
   */
  | { id: string; tipo: 'faixa'; colunas: { peso?: number; secoes: Secao[] }[] };

export interface CabecalhoOD {
  /** 'ORDEM DO DIA'. Fica no dado porque um dia pode virar 'CALL SHEET'. */
  titulo: string;
  producao: string;
  /** 'Diária 03'. */
  diaria: string;
  data: string;
  /** '07h00 às 19h30' — a janela do dia, já calculada. */
  janela?: string;
  versao?: number;
  /** Logo da produtora, já resolvido para algo que o renderizador abre. */
  logo?: string;
}

export interface DocumentoOD {
  cabecalho: CabecalhoOD;
  secoes: Secao[];
  /** Uma linha no pé de cada página. */
  rodape?: string;
}

/** Um `Campo` só existe se tiver valor. Evita "Endereço: —" no papel. */
export function campo(rotulo: string, valor?: string | null, detalhe?: string | null): Campo | null {
  const v = (valor || '').trim();
  if (!v) return null;
  return { rotulo, valor: v, detalhe: detalhe?.trim() || undefined };
}

/** Tira os nulos de uma lista de campos montada com `campo()`. */
export function campos(...itens: (Campo | null)[]): Campo[] {
  return itens.filter((c): c is Campo => c !== null);
}

/**
 * Descarta seção vazia.
 *
 * ⚠️ É a regra que faz os campos novos serem opcionais de verdade: quem não
 * preencher a base, o rádio ou os horários de elenco continua com uma OD
 * inteira — o bloco some, não fica vazio pedindo desculpa.
 */
export function secaoTemConteudo(s: Secao): boolean {
  switch (s.tipo) {
    case 'campos': return s.itens.length > 0;
    case 'tabela': return s.tabela.linhas.length > 0;
    case 'texto': return s.corpo.trim().length > 0;
    case 'lista': return s.itens.length > 0;
    case 'pessoas': return s.grupos.some(g => g.pessoas.length > 0);
    case 'faixa': {
      return s.colunas.some(c => c.secoes.some(secaoTemConteudo));
    }
  }
}

/** Poda recursiva: some com as vazias e com as faixas que ficaram sem nada. */
export function podar(secoes: Secao[]): Secao[] {
  return secoes
    .map(s => (s.tipo === 'faixa'
      ? {
          ...s,
          colunas: s.colunas
            .map(c => ({ ...c, secoes: podar(c.secoes) }))
            .filter(c => c.secoes.length > 0),
        }
      : s))
    .filter(secaoTemConteudo);
}

/** O texto de uma célula, seja ela string ou objeto. */
export function textoDaCelula(v?: ValorCelula): string {
  if (!v) return '';
  return typeof v === 'string' ? v : v.texto;
}
