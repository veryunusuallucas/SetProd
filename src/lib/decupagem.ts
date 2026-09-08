/**
 * Identidade visual da decupagem: cores por departamento e cores de stripboard.
 *
 * Compatibilidade: as tags gravadas antes usavam ids minúsculos ('elenco',
 * 'arte'...). As novas usam as chaves de departamento em maiúsculas. O mapa
 * `normalizarCategoria` faz a ponte, para nada que já existe no banco quebrar.
 */

export interface TemaDepartamento {
  chave: string;
  rotulo: string;
  bg: string;      // fundo do destaque sobre o PDF
  border: string;  // borda / barra lateral
  text: string;    // cor do texto e dos chips
}

export const DEPARTMENT_THEMES: Record<string, TemaDepartamento> = {
  ELENCO:       { chave: 'ELENCO',       rotulo: 'Elenco',           bg: 'rgba(255, 118, 117, 0.40)', border: '#d63031', text: '#ff7675' },
  FIGURACAO:    { chave: 'FIGURACAO',    rotulo: 'Figuração',        bg: 'rgba(253, 203, 110, 0.40)', border: '#e17055', text: '#fdcb6e' },
  ARTE_OBJETOS: { chave: 'ARTE_OBJETOS', rotulo: 'Arte / Objetos',   bg: 'rgba(85, 239, 196, 0.40)',  border: '#00b894', text: '#55efc4' },
  FIGURINO:     { chave: 'FIGURINO',     rotulo: 'Figurino',         bg: 'rgba(162, 155, 254, 0.40)', border: '#6c5ce7', text: '#a29bfe' },
  MAQUIAGEM_SFX:{ chave: 'MAQUIAGEM_SFX',rotulo: 'Maquiagem / SFX',  bg: 'rgba(0, 184, 148, 0.40)',   border: '#00b894', text: '#00b894' },
  SOM:          { chave: 'SOM',          rotulo: 'Som',              bg: 'rgba(0, 210, 211, 0.40)',   border: '#01a3a4', text: '#00d2d3' },
  VFX:          { chave: 'VFX',          rotulo: 'VFX',              bg: 'rgba(253, 121, 168, 0.40)', border: '#e84393', text: '#fd79a8' },
  VEICULOS:     { chave: 'VEICULOS',     rotulo: 'Veículos',         bg: 'rgba(9, 132, 227, 0.40)',   border: '#0984e3', text: '#0984e3' },
  EQUIPAMENTOS: { chave: 'EQUIPAMENTOS', rotulo: 'Equipamentos',     bg: 'rgba(99, 110, 114, 0.40)',  border: '#2d3436', text: '#636e72' },
  // A regra do mercado: se o personagem INTERAGE com o objeto é Arte/Objetos;
  // se ele só compõe o cenário, é Set Dressing. Muda quem compra e quem monta.
  SET_DRESSING: { chave: 'SET_DRESSING', rotulo: 'Set Dressing',     bg: 'rgba(116, 185, 255, 0.40)', border: '#0984e3', text: '#74b9ff' },
  LOCACAO:      { chave: 'LOCACAO',      rotulo: 'Set / Locação',    bg: 'rgba(223, 230, 233, 0.40)', border: '#b2bec3', text: '#dfe6e9' },
};

/**
 * Categorias criadas pelo usuário no projeto aberto.
 *
 * Fica em módulo (e não passando por props) porque `temaDe` é chamada em dezenas
 * de lugares — de renderizador de PDF a gerador de relatório — e a maioria não
 * tem o projeto à mão. O app abre um projeto por vez, e quem troca de projeto
 * regrava a lista, então não há mistura.
 */
let categoriasExtras: Record<string, TemaDepartamento> = {};

/** Converte um rótulo livre ("Animais") na chave interna ("ANIMAIS"). */
export function chaveDeCategoria(rotulo: string): string {
  return rotulo
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Aceita hex (#rrggbb) e devolve o fundo translúcido usado no destaque. */
function fundoTranslucido(hex: string, alfa = 0.4): string {
  const limpo = hex.replace('#', '');
  const n = parseInt(limpo.length === 3 ? limpo.split('').map(c => c + c).join('') : limpo, 16);
  if (Number.isNaN(n)) return `rgba(99, 110, 114, ${alfa})`;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
}

export function registrarCategoriasExtras(lista?: { chave: string; rotulo: string; cor: string }[]) {
  categoriasExtras = {};
  for (const c of lista || []) {
    if (DEPARTMENT_THEMES[c.chave]) continue; // não deixa sombrear uma padrão
    categoriasExtras[c.chave] = {
      chave: c.chave,
      rotulo: c.rotulo,
      bg: fundoTranslucido(c.cor),
      border: c.cor,
      text: c.cor,
    };
  }
}

/** Todas as categorias válidas agora: as padrão mais as do projeto. */
export function categoriasDisponiveis(): TemaDepartamento[] {
  return [...Object.values(DEPARTMENT_THEMES), ...Object.values(categoriasExtras)];
}

export const DEPARTAMENTOS = Object.values(DEPARTMENT_THEMES);

/** Departamentos ligados por padrão no painel de IA (os mais usados no set). */
export const DEPARTAMENTOS_PADRAO_IA = ['ELENCO', 'FIGURACAO', 'ARTE_OBJETOS', 'FIGURINO', 'SOM', 'VFX', 'VEICULOS'];

/** Ids antigos (minúsculos) → chaves novas. */
const EQUIVALENCIAS: Record<string, string> = {
  elenco: 'ELENCO',
  figuracao: 'FIGURACAO',
  arte: 'ARTE_OBJETOS',
  arte_objetos: 'ARTE_OBJETOS',
  objetos: 'ARTE_OBJETOS',
  props: 'ARTE_OBJETOS',
  figurino: 'FIGURINO',
  maquiagem: 'MAQUIAGEM_SFX',
  maquiagem_sfx: 'MAQUIAGEM_SFX',
  som: 'SOM',
  efeitos: 'VFX',
  vfx: 'VFX',
  veiculos: 'VEICULOS',
  camera: 'EQUIPAMENTOS',
  equipamentos: 'EQUIPAMENTOS',
  outro: 'EQUIPAMENTOS',
};

export function normalizarCategoria(categoria?: string): string {
  if (!categoria) return 'EQUIPAMENTOS';
  const bruta = categoria.trim();
  if (DEPARTMENT_THEMES[bruta] || categoriasExtras[bruta]) return bruta;
  return EQUIVALENCIAS[bruta.toLowerCase()] || 'EQUIPAMENTOS';
}

export function temaDe(categoria?: string): TemaDepartamento {
  const chave = normalizarCategoria(categoria);
  return DEPARTMENT_THEMES[chave] || categoriasExtras[chave] || DEPARTMENT_THEMES.EQUIPAMENTOS;
}

// ---- Stripboard ----

export interface CorStrip {
  bg: string;
  text: string;
  label: string;
}

/**
 * Cor da tira por ambiente + período.
 *
 * Observação: a convenção clássica de papel é branco (INT DIA), amarelo
 * (EXT DIA), azul (INT NOITE) e verde (EXT NOITE). Usamos uma paleta de tela,
 * de contraste mais forte, porque aqui ninguém imprime tira em papel colorido.
 */
export function getStripboardColor(environment?: string, timeOfDay?: string): CorStrip {
  const amb = (environment || '').toUpperCase();
  const hora = (timeOfDay || '').toUpperCase();

  // Sem ambiente nem período, a tira é neutra. (No encadeamento original de
  // if/else o fallback nunca era alcançado: vazio caía em "EXT. NOITE".)
  if (!amb && !hora) return { bg: '#718093', text: '#ffffff', label: 'OUTRO' };

  const isInt = amb.includes('INT');
  const isDay = hora.includes('DIA') || hora.includes('MANH') || hora.includes('TARDE') || hora.includes('AMANHECER');

  if (isInt && isDay) return { bg: '#fbc531', text: '#2f3640', label: 'INT. DIA' };
  if (!isInt && isDay) return { bg: '#00a8ff', text: '#ffffff', label: 'EXT. DIA' };
  if (isInt && !isDay) return { bg: '#e84118', text: '#ffffff', label: 'INT. NOITE' };
  if (!isInt && !isDay) return { bg: '#2f3640', text: '#f5f6fa', label: 'EXT. NOITE' };

  return { bg: '#718093', text: '#ffffff', label: 'OUTRO' };
}

// ---- Páginas em oitavos (padrão da indústria) ----

/** "1 4/8" → 12 oitavos. Aceita "4/8", "2" e "1 4/8". */
export function paginasParaOitavos(paginas?: string): number {
  if (!paginas) return 0;
  const m = paginas.trim().match(/^(?:(\d+)\s*)?(?:(\d+)\/8)?$/);
  if (!m) return 0;
  return (parseInt(m[1] || '0', 10) * 8) + parseInt(m[2] || '0', 10);
}

export function oitavosParaPaginas(oitavos: number): string {
  if (oitavos <= 0) return '—';
  const inteiras = Math.floor(oitavos / 8);
  const resto = oitavos % 8;
  if (inteiras === 0) return `${resto}/8`;
  return resto ? `${inteiras} ${resto}/8` : `${inteiras}`;
}

export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Extração de cenas do roteiro ----

export interface CabecalhoCena {
  numero: string;
  cabecalho: string;
  local: string;
  ambiente: 'int' | 'ext';
  periodo: 'dia' | 'noite';
  pagina: number;
  /** Texto da cena (do cabeçalho até o próximo), usado na análise por IA. */
  corpo: string;
  /**
   * Reconhecida pelo BURACO na numeração, e não pelo padrão INT./EXT.
   *
   * Vale saber porque desta o app sabe menos: sem INT./EXT. e sem período, o
   * ambiente e o dia/noite são chute. A tela mostra isso para a pessoa
   * conferir, em vez de fingir que a cena veio completa.
   */
  pelo_numero?: boolean;
  /**
   * Onde o cabeçalho começa no texto do roteiro inteiro.
   *
   * ⚠️ NÃO É PARA GUARDAR. Vale só durante a extração, para medir quanto de
   * página cada cena ocupa — é o intervalo entre um cabeçalho e o próximo que
   * dá a resposta. Depois de virar uma `Cena`, o número perde o sentido: ele é
   * uma posição NAQUELE texto, e o texto muda na versão seguinte do roteiro.
   */
  indice: number;
  /** Quanto de página a cena ocupa, medido no PDF: "1 2/8". */
  paginas?: string;
}

/**
 * Cabeçalho de cena no padrão do mercado: INT./EXT. LOCAL - PERÍODO.
 *
 * Dois cuidados que custaram cena:
 *  - o local é limitado a 80 caracteres e a captura é preguiçosa, senão quando
 *    o traço some na extração do PDF ela "vaza" e engole a página inteira;
 *  - o período NÃO pode terminar em \b. "MANHÃ" acaba em caractere não-ASCII e
 *    \b não reconhece fronteira ali, então todo cabeçalho de manhã era perdido.
 */
/**
 * Os períodos que fecham um cabeçalho.
 *
 * "PÔR DO SOL" faltava, e faltava caro: uma cena inteira do roteiro de teste
 * ("EXT. ESTACIONAMENTO - PÔR DO SOL") era simplesmente ignorada — 11 cenas
 * detectadas de 12. O resto entrou junto porque é a mesma família de erro:
 * roteirista escreve o horário como quiser, e o que a lista não conhece some
 * sem deixar rastro.
 */
const PERIODOS = [
  'DIA', 'NOITE', 'MANHÃ', 'MANHA', 'TARDE', 'MADRUGADA',
  'AMANHECER', 'ENTARDECER', 'ANOITECER', 'ALVORECER',
  'P[ÔO]R DO SOL', 'NASCER DO SOL', 'CREP[ÚU]SCULO', 'MEIO[- ]DIA',
  'MAIS TARDE', 'CONT[ÍI]NUO', 'CONTINUO',
  /*
    Nem tudo depois do traço é hora do dia — e o roteirista não vai mudar isso.

    "EXT. FAZENDA - MONTAGEM" e "INT. QUARTO - FLASHBACK" dizem o TIPO da cena
    no lugar do período, e é uso corrente. Sem estes, o cabeçalho inteiro deixa
    de ser cabeçalho e a cena some da decupagem sem deixar rastro — foi assim
    que a cena 75 de "Terra Manchada de Sangue" sumiu.

    Elas caem em "dia" na classificação, que é o padrão: montagem e flashback
    não dizem se a diária é diurna ou noturna, e chutar noite seria pior.
  */
  'MONTAGEM', 'FLASHBACK', 'FLASH[- ]?BACK', 'SONHO', 'INSERT', 'INSERÇÃO',
  'PRESENTE', 'PASSADO', 'INTERCALADO',
  // Roteiros em inglês circulam bastante em coprodução.
  'DAY', 'NIGHT', 'CONTINUOUS', 'DAWN', 'DUSK', 'MORNING', 'EVENING',
].join('|');

/**
 * O que pode vir ANTES do período, qualificando-o.
 *
 * "INÍCIO DA MANHÃ", "FIM DE TARDE", "MEIO DA NOITE". A lista de períodos
 * conhece MANHÃ, mas o cabeçalho não começava nela — e a expressão exigia que o
 * período viesse colado ao traço. Resultado: a cena 27 de "Terra Manchada de
 * Sangue" não existia para o app.
 */
const QUALIFICADOR = String.raw`(?:(?:IN[ÍI]CIO|COME[ÇC]O|FIM|FINAL|MEIO)\s+D[AEO]\s+)?`;

/**
 * Cabeçalho de cena no padrão do mercado: 7A. INT./EXT. LOCAL - PERÍODO.
 *
 * O número na frente é OPCIONAL e capturado: tratamento numerado usa sufixo de
 * letra (7A, 7B) para cenas inseridas depois, sem renumerar o roteiro inteiro.
 * Ignorar isso quebra a conversa com o resto da equipe, que chama a cena pelo
 * número impresso.
 *
 * Dois cuidados que custaram cena:
 *  - o local é limitado a 80 caracteres e a captura é preguiçosa, senão quando
 *    o traço some na extração do PDF ela "vaza" e engole a página inteira;
 *  - o período NÃO pode terminar em \b. "MANHÃ" acaba em caractere não-ASCII e
 *    \b não reconhece fronteira ali, então todo cabeçalho de manhã era perdido.
 */
const RE_CABECALHO = new RegExp(
  String.raw`(?:(\d{1,4}\s?[A-Za-z]?)\s*[.):\-–—]\s*)?` +
  String.raw`\b(INT\.?\/EXT\.?|EXT\.?\/INT\.?|INT\.|EXT\.|I\/E\.)\s+` +
  String.raw`([^\n]{2,80}?)\s*[-–—]\s*` +
  `(${QUALIFICADOR}(?:${PERIODOS}))(?![A-Za-zÀ-ÿ])`,
  'gi'
);

function periodoDe(bruto: string): 'dia' | 'noite' {
  const p = bruto.toUpperCase();
  // Anoitecer já é noite na prática da diária; pôr do sol e entardecer ainda
  // são bloco de dia, que é como a produção escala.
  return /NOITE|MADRUGADA|ANOITECER|NIGHT|DUSK|EVENING/.test(p) ? 'noite' : 'dia';
}

/** Normaliza "7 A" e "7a" para "7A" — o mesmo número escrito de jeitos diferentes. */
function numeroImpresso(bruto?: string): string | undefined {
  if (!bruto) return undefined;
  const limpo = bruto.replace(/\s+/g, '').toUpperCase();
  return /^\d{1,4}[A-Z]?$/.test(limpo) ? limpo : undefined;
}

/**
 * Varre o roteiro inteiro e devolve as cenas na ordem em que aparecem.
 *
 * A detecção por padrão é a fonte da verdade — é determinística e não perde
 * cena. A IA entra depois só para enriquecer (elementos, estimativa), nunca
 * para decidir onde a cena começa.
 */
export function extrairCenas(paginas: { numero: number; texto: string }[]): CabecalhoCena[] {
  // Junta tudo mantendo de qual página é cada posição.
  let completo = '';
  const marcos: { inicio: number; pagina: number }[] = [];
  for (const p of paginas) {
    marcos.push({ inicio: completo.length, pagina: p.numero });
    completo += p.texto + '\n';
  }

  const paginaDe = (indice: number) => {
    let atual = marcos[0]?.pagina ?? 1;
    for (const m of marcos) {
      if (m.inicio <= indice) atual = m.pagina;
      else break;
    }
    return atual;
  };

  const achados: {
    indice: number;
    fim: number;
    impresso?: string;
    cab: Omit<CabecalhoCena, 'corpo' | 'numero' | 'indice'>;
  }[] = [];
  RE_CABECALHO.lastIndex = 0;

  for (const m of completo.matchAll(RE_CABECALHO)) {
    const indice = m.index ?? 0;
    const ambiente = m[2].toUpperCase().startsWith('INT') ? 'int' : 'ext';
    const local = m[3].trim().replace(/\s{2,}/g, ' ');
    if (!local) continue;

    achados.push({
      indice,
      fim: indice + m[0].length,
      impresso: numeroImpresso(m[1]),
      cab: {
        cabecalho: m[0].trim().replace(/\s{2,}/g, ' '),
        local,
        ambiente: ambiente as 'int' | 'ext',
        periodo: periodoDe(m[4]),
        pagina: paginaDe(indice),
      },
    });
  }

  /*
    O número é o DO ROTEIRO quando ele existe.

    Antes tudo era renumerado em sequência, e isso desmontava a numeração de
    tratamento: 7A e 7B viravam "7" e "9", e a equipe que pede "a 7B" ficava
    procurando uma cena que o app tinha rebatizado. Só quem não traz número
    impresso recebe um sequencial — e mesmo aí, contando a partir de quantas
    cenas numeradas já passaram, para não colidir.
  */
  const temNumeracao = achados.some(a => a.impresso);

  let proximoAutomatico = 1;
  const cenas: CabecalhoCena[] = achados.map((a, i) => {
    let numero: string;
    if (a.impresso) {
      numero = a.impresso;
    } else if (temNumeracao) {
      // Roteiro numerado com um cabeçalho sem número: marca como derivado do
      // anterior em vez de inventar um número que já existe em outro lugar.
      const anterior = achados[i - 1]?.impresso;
      numero = anterior ? `${anterior}.1` : String(proximoAutomatico++);
    } else {
      numero = String(proximoAutomatico++);
    }

    return {
      ...a.cab,
      numero,
      indice: a.indice,
      corpo: completo.slice(a.fim, achados[i + 1]?.indice ?? completo.length).trim(),
    };
  });

  const todas = ordenar([...cenas, ...preencherBuracos(completo, cenas, paginaDe)]);

  /*
    A MEDIÇÃO VEM DEPOIS DA ORDENAÇÃO, e não podia vir antes.

    Uma cena vai do cabeçalho dela até o cabeçalho seguinte — mas "o seguinte" é
    o seguinte NO ROTEIRO, e as duas passadas encontram as cenas fora de ordem
    (a que foi achada pelo buraco na numeração entra por último). Medindo antes
    de ordenar, a cena 123 mediria daqui até o fim do arquivo.
  */
  return medirEmOitavos(todas, marcos, completo.length);
}

/**
 * Quanto de página cada cena ocupa — a conta que a produção chama de oitavos.
 *
 * POR QUE ISTO EXISTE
 * O campo `paginas` era digitado à mão, cena por cena. Ninguém preenche 128
 * campos, então a conta de "quanto do filme já saiu" ficava zerada — e o
 * dashboard mostrava uma barra parada mesmo com metade do roteiro gravado.
 * A informação sempre esteve no PDF; faltava alguém ler.
 *
 * COMO SE MEDE, E POR QUE ASSIM
 * Oitavo de página é medida de ESPAÇO VERTICAL no papel: divide-se a página em
 * oito faixas e conta-se quantas a cena ocupa. O texto extraído de um PDF não
 * tem altura — tem caracteres. Então a conta é feita por PÁGINA, e não no texto
 * corrido: quanto dos caracteres DAQUELA página pertencem a esta cena.
 *
 * Isso se corrige sozinho no que mais importa. Uma página de diálogo tem pouco
 * texto e muito espaço em branco; uma de ação, o contrário. Medindo em fração
 * da própria página, meia página de diálogo dá 4/8 do mesmo jeito que meia
 * página de ação — o que não aconteceria contando caracteres direto.
 *
 * É uma aproximação, e é assumida como tal: o mínimo é 1/8, porque cena que
 * aparece no roteiro ocupa alguma coisa, e arredondar para zero faria uma cena
 * curta sumir da conta do filme.
 */
function medirEmOitavos(
  cenas: CabecalhoCena[],
  marcos: { inicio: number; pagina: number }[],
  total: number
): CabecalhoCena[] {
  /** Cada página como um intervalo do texto corrido, com o tamanho dela. */
  const faixas = marcos.map((m, i) => {
    const fim = marcos[i + 1]?.inicio ?? total;
    return { inicio: m.inicio, fim, tamanho: Math.max(1, fim - m.inicio) };
  });

  return cenas.map((c, i) => {
    const comeca = c.indice;
    const termina = cenas[i + 1]?.indice ?? total;

    let paginas = 0;
    for (const f of faixas) {
      const ini = Math.max(comeca, f.inicio);
      const fim = Math.min(termina, f.fim);
      if (fim > ini) paginas += (fim - ini) / f.tamanho;
    }

    return { ...c, paginas: oitavosParaPaginas(Math.max(1, Math.round(paginas * 8))) };
  });
}

/**
 * A segunda passada: cenas numeradas que NÃO têm INT./EXT.
 *
 * ⚠️ ELA SÓ OLHA OS BURACOS DA NUMERAÇÃO, e é isso que a torna segura.
 *
 * "123. MONTAGEM DE JORNAIS" é um cabeçalho de verdade e não casa com padrão
 * nenhum: não tem ambiente nem período. Sair caçando "número seguido de
 * maiúsculas" no roteiro inteiro encontraria marcação de página, número de
 * telefone e réplica de diálogo. Mas se a primeira passada achou a 122 e a 124
 * e não achou a 123, então existe uma cena 123 em algum lugar — a numeração do
 * roteiro é a prova, e aí procurar por ela é procurar algo que se sabe existir.
 *
 * O que ela captura depois do número é a sequência de palavras em CAIXA ALTA,
 * que para em "Imagens de jornais…" — a ação já vem em caixa mista.
 */
function preencherBuracos(
  completo: string,
  achadas: CabecalhoCena[],
  paginaDe: (i: number) => number
): CabecalhoCena[] {
  const numeros = achadas
    .map(c => parseInt(c.numero, 10))
    .filter(n => !isNaN(n));
  if (numeros.length < 3) return []; // roteiro sem numeração confiável

  const tem = new Set(numeros);
  const menor = Math.min(...numeros);
  const maior = Math.max(...numeros);

  const novas: CabecalhoCena[] = [];

  for (let n = menor + 1; n < maior; n++) {
    if (tem.has(n)) continue;

    const re = new RegExp(
      // O `(?![a-zà-ÿ])` fecha cada palavra: sem ele, o "I" de "Imagens" — que
      // já é a ação da cena — entrava no título como se fosse mais uma palavra
      // em caixa alta.
      String.raw`\b` + n + String.raw`\s*[.):\-–—]\s+((?:[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9'’\-]*(?![a-zà-ÿ])\s+){0,7}[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9'’\-]*(?![a-zà-ÿ]))`,
      'g'
    );

    /*
      TODAS as ocorrências do número, não a primeira.

      "123" aparece no roteiro antes do cabeçalho — numeração de página, um
      valor no diálogo, o que for. A primeira ocorrência quase nunca é a cena,
      e parar nela era o mesmo que não procurar: no roteiro de teste ela casava
      com uma letra solta e a cena continuava perdida.

      O filtro é o título: duas palavras em caixa alta seguidas. Nome de
      personagem antes da fala tem uma só, e o roteiro está cheio deles.
    */
    let m: RegExpExecArray | null = null;
    for (const tentativa of completo.matchAll(re)) {
      const t = (tentativa[1] || '').trim();
      if (t.split(/\s+/).length >= 2) { m = tentativa as RegExpExecArray; break; }
    }
    if (!m) continue;

    const titulo = m[1].trim().replace(/\s{2,}/g, ' ');
    const indice = m.index ?? 0;
    novas.push({
      numero: String(n),
      cabecalho: `${n}. ${titulo}`,
      local: titulo,
      // Sem INT./EXT. não há o que ler: fica no padrão, e a marca `pelo_numero`
      // diz à tela que estes dois campos são chute e pedem conferência.
      ambiente: 'int',
      periodo: 'dia',
      pagina: paginaDe(indice),
      indice,
      corpo: completo.slice(indice, indice + 2000).trim(),
      pelo_numero: true,
    });
  }

  return novas;
}

/** Devolve as cenas na ordem em que aparecem no roteiro. */
function ordenar(cenas: CabecalhoCena[]): CabecalhoCena[] {
  return [...cenas].sort((a, b) => {
    const na = parseInt(a.numero, 10);
    const nb = parseInt(b.numero, 10);
    if (isNaN(na) || isNaN(nb)) return 0;
    if (na !== nb) return na - nb;
    return a.numero.localeCompare(b.numero);
  });
}

/**
 * Procura um trecho no texto tolerando diferenças de espaço em branco e devolve
 * o pedaço EXATO como está no PDF (é ele que ancora o destaque).
 *
 * O pdf.js junta os fragmentos de texto com espaços, então "SOM DO ALARME" pode
 * aparecer como "SOM  DO ALARME". A comparação literal descartava quase tudo.
 */
export function encontrarTrechoLiteral(textoPagina: string, frase: string): string | null {
  const limpa = frase.trim();
  if (!limpa) return null;
  if (textoPagina.includes(limpa)) return limpa;

  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const partes = limpa.split(/\s+/).map(escapar);
  if (partes.length === 0) return null;

  try {
    const re = new RegExp(partes.join('\\s+'), 'i');
    const achado = textoPagina.match(re);
    return achado ? achado[0] : null;
  } catch {
    return null;
  }
}

/**
 * Reduz um nome de locação à sua forma comparável: sem acento, sem pontuação,
 * sem caixa e sem espaço repetido.
 *
 * "QUARTO DA CASA DE MARCOS, BELVEDERE" e "Quarto da casa de Marcos -
 * Belvedere" são a mesma locação para quem produz, e precisam se encontrar.
 */
export function chaveLocacao(nome?: string): string {
  return (nome || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Acha entre as locações cadastradas a que corresponde ao cabeçalho da cena.
 *
 * Casa pelo nome exato normalizado e, se não achar, aceita que uma contenha a
 * outra — o roteiro costuma trazer mais detalhe ("QUARTO DA CASA DE MARCOS")
 * do que o cadastro ("Casa de Marcos").
 */
export function acharLocacao<T extends { id: string; nome: string }>(
  descricaoCena: string,
  locacoes: T[]
): T | undefined {
  const alvo = chaveLocacao(descricaoCena);
  if (!alvo) return undefined;

  const exata = locacoes.find(l => chaveLocacao(l.nome) === alvo);
  if (exata) return exata;

  // A mais específica ganha: entre "Casa" e "Casa de Marcos", fica a segunda.
  return locacoes
    .filter(l => {
      const k = chaveLocacao(l.nome);
      return k.length > 2 && (alvo.includes(k) || k.includes(alvo));
    })
    .sort((a, b) => chaveLocacao(b.nome).length - chaveLocacao(a.nome).length)[0];
}

/**
 * Departamentos cujas marcações valem para o roteiro inteiro por padrão.
 * Personagem e veículo se repetem em muitas cenas — marcar só na página em que
 * a IA achou seria inútil. Já som e efeito são pontuais.
 */
const ESCOPO_GLOBAL = new Set(['ELENCO', 'FIGURACAO', 'VEICULOS']);

export function escopoPadrao(categoria?: string): boolean {
  return ESCOPO_GLOBAL.has(normalizarCategoria(categoria));
}
