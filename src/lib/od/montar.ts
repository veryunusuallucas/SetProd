/**
 * Monta a Ordem do Dia a partir do que está gravado. **Só isso.**
 *
 * Nenhuma decisão de aparência mora aqui — nem cor, nem fonte, nem quebra de
 * página. O que mora aqui é a decisão de CONTEÚDO: o que entra no papel, em que
 * ordem, e com que rótulo.
 *
 * A REFERÊNCIA É O MODELO DO SET (09/10/2026). A ordem das seções é a da OD
 * que a equipe do Lucas monta à mão (`.md/referencias/Canção de Outono - OD -
 * Dia 1`, sobre o modelo SESI): chamada e fim do dia grandes, a faixa de
 * horários numa linha, locação/bases/tempo lado a lado, as cenas com o
 * "Prep" e o "Roda" de cada uma, o elenco e os veículos. Tudo isso é a página 1
 * — a OD **simples**. A **completa** acrescenta uma página de referência
 * (equipe, próximo dia, checklist, decupagem).
 *
 * Três coisas do SetProd ficaram, porque o modelo não tem e fazem falta:
 *  1. **O hospital de cada locação**, e não um só para o dia.
 *  2. **Uma linha de total** na grade: páginas e horas somadas.
 *  3. **As cenas do dia seguinte**, na página de referência.
 */
import type {
  Cena, Departamento, Diaria, DiariaTask, Elemento, ItemDoDia,
  Locacao, Perfil, Plano, Projeto,
} from '../../types';
import type { ClimaDia } from '../clima';
import { descreverClima } from '../clima';
import { calcularDia, emMinutos, type ItemCalculado } from '../linhaDoDia';
import { oitavosParaPaginas, paginasParaOitavos } from '../decupagem';
import { rotuloDoTrecho } from '../partirCena';
import { data as formataData, diaPorExtenso, horaDoSet } from '../formato';
import {
  campo, campos, podar, textoDaCelula,
  BLOCOS_OD, TODOS_OS_BLOCOS,
  type BlocoOD, type Campo, type ColunaTabela, type DocumentoOD, type GrupoDePessoas,
  type LinhaTabela, type Secao,
} from './tipos';

export interface DiaVizinho {
  numero: number;
  data: string;
  cenas: { cena: Cena; item: ItemDoDia }[];
}

export interface EntradaOD {
  projeto: Projeto;
  diaria: Diaria;
  /** A linha do tempo do dia, já montada (ver `montarLinhaDoDia`). */
  itens: ItemDoDia[];
  cenas: Cena[];
  planosPorCena: Map<string, Plano[]>;
  locacoes: Locacao[];
  perfis: Perfil[];
  departamentos: Departamento[];
  /** Personagens do projeto — `Elemento` de categoria ELENCO. */
  personagens: Elemento[];
  /** Em que cenas cada personagem aparece: `elemento_id` → ids de cena. */
  cenasPorPersonagem: Map<string, Set<string>>;
  clima: { locais: string[]; clima: ClimaDia }[];
  tasks: DiariaTask[];
  /** O dia seguinte, para o bloco de antecipação. */
  proximo?: DiaVizinho;
  /** Quantas diárias a produção tem — o "de 12" de "Diária 3 de 12". */
  totalDiarias?: number;
  /** Logo já resolvido para algo que o renderizador consegue abrir. */
  logo?: string;
  /** Sobrepõe `diaria.versao_od` quando o banco ainda não devolveu a nova. */
  versao?: number;
}

// ---------------------------------------------------------------------------
// Ajudas
// ---------------------------------------------------------------------------

const nomeCompleto = (p: Perfil) => `${p.nome} ${p.sobrenome || ''}`.trim();

/** "10h 30m", "45m". Minutos zerados não viram "0m" pendurado. */
export function duracaoTexto(minutos: number): string {
  if (minutos <= 0) return '—';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Minutos do dia → "07h30". Passa da meia-noite sem virar "25h". */
function hora(minutos: number): string {
  const hh = String(Math.floor((((minutos % 1440) + 1440) % 1440) / 60)).padStart(2, '0');
  return `${hh}h${String(((minutos % 60) + 60) % 60).padStart(2, '0')}`;
}

/** "12h00 às 13h00" de um item já calculado. Item sem duração é só a hora. */
function janela(i: ItemCalculado): string {
  return i.fim > i.inicio ? `${hora(i.inicio)} às ${hora(i.fim)}` : hora(i.inicio);
}

/**
 * Quem faz esta função na equipe.
 *
 * Casa por pedaço, para "1º Assistente de Direção" entrar em "assistente de
 * dire". E aceita exclusões porque em cinema o mesmo radical nomeia cargos
 * distantes: "Diretora de Fotografia" e "Diretor de Arte" casam com "diret" e
 * não são a direção — são chefes dos seus departamentos, e é na lista de
 * equipe que a produção os procura.
 */
function quemFaz(perfis: Perfil[], termos: string[], exceto: string[] = []): Perfil[] {
  const alvo = termos.map(t => t.toLowerCase());
  const fora = exceto.map(t => t.toLowerCase());
  return perfis.filter(p => {
    const f = (p.funcao || '').toLowerCase();
    return alvo.some(t => f.includes(t)) && !fora.some(t => f.includes(t));
  });
}

function contatoDe(p: Perfil): string | undefined {
  return p.telefone || p.email || undefined;
}

const direcaoDe = (perfis: Perfil[]) => quemFaz(perfis, ['diret'], ['fotografia', 'arte', 'assistente', 'produ']);

/**
 * Preparação que vem logo antes de uma cena é DA cena.
 *
 * No modelo do set, "Prep 08h00 - 08h45 / Roda 08h45 - 11h30" é uma linha só:
 * a preparação existe por causa daquela cena. Como linha solta, a grade ficava
 * com um "Prep" entre cada cena e o par se perdia.
 */
function ePreparacao(i: ItemCalculado): boolean {
  return i.item.tipo === 'preparacao' || i.item.tipo === 'prelight' || /^prep/i.test(i.item.titulo || '');
}

/**
 * As locações do dia: as escolhidas na diária E as das cenas escaladas.
 *
 * Só a lista da diária não basta: na Canção de Outono, a diária apontava para
 * uma locação apagada, as cenas tinham locação, e a OD saiu sem endereço, sem
 * hospital e sem tempo (09/10/2026). A cena sabe onde é filmada.
 */
function locacoesDoDia(e: EntradaOD, itens: ItemCalculado[]): Locacao[] {
  const ids = [
    ...(e.diaria.locacoes_ids || []),
    ...itens.map(i => i.cena?.locacao_id),
    ...itens.map(i => i.item.locacao_id),
  ].filter((id): id is string => Boolean(id));
  return [...new Set(ids)]
    .map(id => e.locacoes.find(l => l.id === id))
    .filter((l): l is Locacao => Boolean(l));
}

// ---------------------------------------------------------------------------
// O documento
// ---------------------------------------------------------------------------

/**
 * `blocos`: quais blocos entram, de `BLOCOS_OD`. A OD padrão passa
 * `BLOCOS_PADRAO`; a detalhada, o que a pessoa marcou. Sem nada, entra tudo —
 * é o que o e-mail e o WhatsApp recebem.
 */
export function montarOD(e: EntradaOD, blocos: readonly BlocoOD[] = TODOS_OS_BLOCOS): DocumentoOD {
  const { projeto, diaria } = e;
  const cenaPorId = (id: string) => e.cenas.find(c => c.id === id);
  const dia = calcularDia(e.itens, diaria.chamada, cenaPorId);
  const escalados = e.perfis.filter(p => (diaria.equipe_escalada || []).includes(p.id));
  const versao = e.versao ?? diaria.versao_od ?? 1;
  const locacoes = locacoesDoDia(e, dia.itens);

  const montar: Record<BlocoOD, () => Secao> = {
    'horarios': () => secaoHorarios(e, dia.itens),
    'gerais': () => secaoGerais(e),
    'ponto': () => secaoPonto(e),
    'lugar': () => faixaDoLugar(e, locacoes),
    'grade': () => secaoGrade(e, dia.itens),
    'observacoes': () => secaoObservacoes(e),
    'elenco': () => secaoElenco(e, dia.itens),
    'figuracao': () => secaoFiguracao(e, dia.itens),
    'veiculos-cena': () => secaoVeiculosDeCena(e),
    'transporte': () => secaoTransporte(e, escalados),
    'contatos': () => secaoContatos(e),
    'equipe': () => secaoEquipe(e, escalados),
    'proximo-dia': () => secaoProximoDia(e),
    'checklist': () => secaoChecklist(e),
    'shotlist': () => secaoShotList(e, dia.itens),
  };
  const pedidos = new Set(blocos);
  const doPapel = (referencia: boolean) => podar(
    BLOCOS_OD.filter(b => pedidos.has(b.id) && Boolean('referencia' in b && b.referencia) === referencia).map(b => montar[b.id]()),
  );

  /*
    A página de referência começa numa folha nova: a página 1 é o que vai
    pendurado no set; o resto é para quem prepara.
  */
  const paginaUm = doPapel(false);
  const referencia = doPapel(true);
  if (referencia[0]) referencia[0] = { ...referencia[0], novaPagina: true };

  const numero = String(diaria.numero).padStart(2, '0');
  const direcao = direcaoDe(e.perfis);
  return {
    cabecalho: {
      titulo: 'ORDEM DO DIA',
      producao: projeto.nome,
      diaria: e.totalDiarias ? `Diária ${diaria.numero} de ${e.totalDiarias}` : `Diária ${numero}`,
      data: diaPorExtenso(diaria.data),
      janela: dia.wrap ? `${horaDoSet(diaria.chamada)} às ${horaDoSet(dia.wrap)}` : undefined,
      chamada: diaria.chamada ? horaDoSet(diaria.chamada) : undefined,
      fim: dia.wrap ? horaDoSet(dia.wrap) : undefined,
      direcao: direcao.length ? direcao.map(nomeCompleto).join(' e ') : projeto.diretor || undefined,
      versao,
      logo: e.logo,
    },
    secoes: [...paginaUm, ...referencia],
    rodape: `${projeto.nome} · Diária ${numero}${versao > 1 ? ` · v${versao}` : ''}`,
  };
}

// ---- A faixa de horários: o dia numa linha --------------------------------

function secaoHorarios(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const { diaria } = e;
  const cenas = itens.filter(i => i.item.tipo === 'cena');
  const primeira = cenas[0];
  const ultima = cenas[cenas.length - 1];
  const primeiraPrep = itens.find((i, n) => ePreparacao(i) && itens[n + 1]?.item.tipo === 'cena');

  /*
    Os marcos saem da linha do dia, e nenhum deles é campo novo. "Roda" é a
    primeira CENA (e não a primeira linha do dia, que costuma ser café); "corta"
    é o fim da última cena; "desprodução" é o item de wrap. Pedir os três à mão
    criaria três lugares para a mesma verdade divergir.
  */
  const marcos: { rotulo: string; valor: string; minuto: number }[] = [];
  const chamada = emMinutos(diaria.chamada);
  if (chamada !== null) marcos.push({ rotulo: 'Chamada', valor: horaDoSet(diaria.chamada), minuto: chamada });
  for (const r of itens.filter(i => i.item.tipo === 'almoco' || i.item.tipo === 'coffee')) {
    marcos.push({ rotulo: r.item.titulo || (r.item.tipo === 'almoco' ? 'Almoço' : 'Lanche'), valor: janela(r), minuto: r.inicio });
  }
  if (primeiraPrep) {
    const onde = primeiraPrep.item.local || itens[itens.indexOf(primeiraPrep) + 1]?.cena?.descricao;
    marcos.push({ rotulo: `Preparação${onde ? ` ${onde}` : ''}`, valor: janela(primeiraPrep), minuto: primeiraPrep.inicio });
  }
  if (primeira) marcos.push({ rotulo: 'Roda', valor: hora(primeira.inicio), minuto: primeira.inicio });
  if (ultima) marcos.push({ rotulo: 'Corta', valor: hora(ultima.fim), minuto: ultima.fim });
  const wrap = itens.find(i => i.item.tipo === 'wrap');
  if (wrap) marcos.push({ rotulo: 'Desprodução', valor: janela(wrap), minuto: wrap.inicio });

  marcos.sort((a, b) => a.minuto - b.minuto);

  return {
    id: 'horarios',
    tipo: 'tabela',
    tabela: {
      colunas: marcos.map((m, n) => ({ chave: `m${n}`, rotulo: m.rotulo, peso: 1, alinhamento: 'centro' as const })),
      linhas: marcos.length
        ? [{ celulas: Object.fromEntries(marcos.map((m, n) => [`m${n}`, { texto: m.valor, enfase: 'forte' as const }])) }]
        : [],
    },
  };
}

// ---- Locação, bases e tempo, lado a lado ----------------------------------

function faixaDoLugar(e: EntradaOD, usadas: Locacao[]): Secao {
  const locacoes: Campo[] = usadas.map((l, i) => ({
    rotulo: usadas.length > 1 ? `Locação ${i + 1}` : 'Locação',
    valor: l.nome,
    detalhe: [
      l.endereco,
      l.contatos?.[0] && `${l.contatos[0].nome} · ${l.contatos[0].telefone}`,
      l.obs,
    ].filter(Boolean).join(' · ') || undefined,
  }));

  /* As bases por função (`bases`) mandam; `base` é das diárias antigas. */
  const base: Campo[] = e.diaria.bases?.some(b => b.local.trim())
    ? campos(...e.diaria.bases.map(b => campo(b.rotulo, b.local)))
    : campos(
        campo('Base', e.diaria.base?.nome, e.diaria.base?.endereco),
        campo('Observação', e.diaria.base?.obs),
      );

  const tempo: Campo[] = e.clima.map(g => {
    const d = descreverClima(g.clima.code);
    return {
      rotulo: g.locais.join(' · '),
      valor: `${d.emoji} ${d.texto} · ${Math.round(g.clima.tempMin)}° a ${Math.round(g.clima.tempMax)}° · chuva ${g.clima.chuvaProb}%`,
      detalhe: `Sol ${g.clima.sunrise || '--'} às ${g.clima.sunset || '--'}`,
    };
  });

  /*
    O hospital fica embaixo do tempo, como no modelo — mas um por locação, com
    o nome dela. Numa diária que atravessa a cidade, "o hospital" sozinho obriga
    a adivinhar de qual endereço ele é o mais próximo.
  */
  const hospitais: Campo[] = usadas
    .filter(l => l.hospital_proximo)
    .map(l => ({
      rotulo: usadas.length > 1 ? `Hospital · ${l.nome}` : 'Hospital mais próximo',
      valor: l.hospital_proximo!,
      detalhe: [l.hospital_telefone, l.hospital_distancia !== undefined
        ? `${(l.hospital_distancia / 1000).toFixed(1).replace('.', ',')} km`
        : null].filter(Boolean).join(' · ') || undefined,
    }));

  return {
    id: 'lugar',
    tipo: 'faixa',
    colunas: [
      { peso: 4, secoes: [{ id: 'locacoes', tipo: 'campos', titulo: usadas.length > 1 ? 'Locações' : 'Locação', itens: locacoes }] },
      { peso: 3, secoes: [{ id: 'base', tipo: 'campos', titulo: 'Bases', itens: base }] },
      { peso: 5, secoes: [{ id: 'tempo', tipo: 'campos', titulo: 'Previsão do tempo', itens: [...tempo, ...hospitais] }] },
    ],
  };
}

// ---- As cenas do dia: o coração do documento ------------------------------

function secaoGrade(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const porPersonagem = e.cenasPorPersonagem;

  /** Os números de elenco que aparecem numa cena: "1, 3, 7". */
  const elencoDaCena = (cenaId: string): string => {
    const nela = e.personagens
      .filter(p => porPersonagem.get(p.id)?.has(cenaId))
      .sort((a, b) => (a.cast_id ?? 999) - (b.cast_id ?? 999));
    return nela.map(p => p.cast_id ?? p.nome).join(', ');
  };

  const linhas: LinhaTabela[] = [];
  /** Oitavos já contados — cena partida em dois trechos não conta duas vezes. */
  const jaContadas = new Set<string>();
  let oitavos = 0;
  let minutosDeCena = 0;
  let algumaPagina = false;
  let algumElenco = false;

  itens.forEach((c, n) => {
    // A preparação de uma cena entra na linha dela (ver `ePreparacao`).
    if (ePreparacao(c) && itens[n + 1]?.item.tipo === 'cena') return;

    if (c.item.tipo !== 'cena' || !c.cena) {
      /*
        Marco atravessa a grade inteira em vez de preencher as colunas: um
        almoço não tem interior/exterior nem elenco, e distribuí-lo entre elas
        produziria sete traços por linha.
      */
      const destino = c.item.locacao_id ? e.locacoes.find(l => l.id === c.item.locacao_id) : undefined;
      const texto = [
        (c.item.titulo || rotuloPadrao(c.item.tipo)).toUpperCase(),
        destino ? `→ ${destino.nome}${destino.endereco ? ` · ${destino.endereco}` : ''}` : '',
        c.item.local || '',
      ].filter(Boolean).join('  ');
      linhas.push({ celulas: {}, faixa: { texto, hora: janela(c) } });
      return;
    }

    const cena = c.cena;
    const planos = e.planosPorCena.get(cena.id) || [];
    const trecho = rotuloDoTrecho(c.item, planos);
    const quantos = c.item.planos_ids ? c.item.planos_ids.length : planos.length;
    const prep = n > 0 && ePreparacao(itens[n - 1]) ? itens[n - 1] : undefined;

    minutosDeCena += c.duracao;
    /*
      As PÁGINAS aparecem uma vez por cena, e não uma vez por trecho: cena
      partida entra duas vezes na grade, e imprimir "2 4/8" nas duas faz quem
      soma a coluna chegar a um dia maior do que ele é.
    */
    const primeiraVez = !jaContadas.has(cena.id);
    if (primeiraVez) {
      jaContadas.add(cena.id);
      oitavos += paginasParaOitavos(cena.paginas);
    }
    if (cena.paginas) algumaPagina = true;
    const elenco = elencoDaCena(cena.id);
    if (elenco) algumElenco = true;
    const locacao = e.locacoes.find(l => l.id === cena.locacao_id)?.nome;

    linhas.push({
      celulas: {
        rodando: {
          texto: `Roda ${hora(c.inicio)} - ${hora(c.fim)}`,
          enfase: 'forte',
          detalhe: prep ? `Prep ${hora(prep.inicio)} - ${hora(prep.fim)}` : undefined,
        },
        cena: {
          texto: `${cena.numero}${c.item.parte || ''}`,
          enfase: 'forte',
          detalhe: cena.dia_historia ? `Dia ${cena.dia_historia.replace(/^dias*/i, '')}` : undefined,
        },
        iedn: {
          texto: (cena.ambiente || 'ext').toUpperCase() === 'INT' ? 'INT' : 'EXT',
          detalhe: (cena.periodo || 'dia') === 'noite' ? 'NOITE' : 'DIA',
        },
        // A sinopse embaixo do set, como no modelo; sem ela, a locação.
        set: { texto: cena.descricao || '—', enfase: 'forte', detalhe: cena.sinopse?.trim() || locacao },
        planos: quantos
          ? { texto: String(quantos), detalhe: trecho || undefined }
          : '—',
        paginas: primeiraVez ? (cena.paginas || '—') : '·',
        elenco: elenco || '—',
      },
    });
  });

  /*
    Coluna sem nenhum dado não entra: a OD da Canção de Outono saiu com
    "Págs" e "Elenco" inteiras em traço, porque nenhuma cena tinha página nem
    elenco ligado. Coluna de traços ocupa a largura que a sinopse precisa.
  */
  const colunas: ColunaTabela[] = [
    { chave: 'rodando', rotulo: 'Rodando', peso: 3 },
    { chave: 'cena', rotulo: 'Cena', peso: 1.2, alinhamento: 'centro' },
    { chave: 'iedn', rotulo: 'I/E D/N', peso: 1.3, alinhamento: 'centro' },
    { chave: 'set', rotulo: 'Set / sinopse', peso: 8 },
    { chave: 'planos', rotulo: 'Planos', peso: 1.4, alinhamento: 'centro' },
    ...(algumaPagina ? [{ chave: 'paginas', rotulo: 'Págs', peso: 1.2, alinhamento: 'centro' as const }] : []),
    ...(algumElenco ? [{ chave: 'elenco', rotulo: 'Elenco', peso: 1.8, alinhamento: 'centro' as const }] : []),
  ];

  /*
    A linha de total responde "o dia cabe?" — e é a soma das CENAS, não do dia:
    deslocamento e almoço ocupam o relógio mas não produzem filme.
  */
  return {
    id: 'grade',
    tipo: 'tabela',
    titulo: 'Cenas do dia',
    tabela: {
      colunas,
      linhas,
      total: oitavos > 0 || minutosDeCena > 0
        ? {
            set: `Total do dia — ${duracaoTexto(minutosDeCena)} de gravação`,
            paginas: oitavos > 0 ? oitavosParaPaginas(oitavos) : '',
          }
        : undefined,
    },
  };
}

function rotuloPadrao(tipo: ItemDoDia['tipo']): string {
  switch (tipo) {
    case 'almoco': return 'Almoço';
    case 'coffee': return 'Lanche';
    case 'move': return 'Deslocamento';
    case 'wrap': return 'Desprodução';
    case 'prelight': return 'Prelight';
    case 'ensaio': return 'Ensaio';
    case 'preparacao': return 'Preparação';
    default: return 'Marco';
  }
}

// ---- Elenco ---------------------------------------------------------------

/**
 * "Café da Manhã 5 + Almoço 9": quantas refeições pedir para um grupo, na
 * ordem do dia. Só as refeições que têm número.
 */
function refeicoesDe(e: EntradaOD, itens: ItemCalculado[], grupo: 'elenco' | 'figuracao'): string {
  const contagem = e.diaria.refeicoes?.[grupo] || {};
  return itens
    .filter(i => (i.item.tipo === 'almoco' || i.item.tipo === 'coffee') && contagem[i.item.id] > 0)
    .map(i => `${i.item.titulo || (i.item.tipo === 'almoco' ? 'Almoço' : 'Lanche')} ${contagem[i.item.id]}`)
    .join(' + ');
}

function secaoElenco(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const cenasDoDia = itens
    .filter(i => i.item.tipo === 'cena' && i.cena)
    .map(i => i.cena!) as Cena[];
  const horarios = e.diaria.elenco || {};

  const noDia = e.personagens
    .map(p => {
      const nelas = cenasDoDia.filter(c => e.cenasPorPersonagem.get(p.id)?.has(c.id));
      return { p, cenas: [...new Set(nelas.map(c => c.numero))] };
    })
    .filter(x => x.cenas.length > 0 || horarios[x.p.id])
    .sort((a, b) => (a.p.cast_id ?? 999) - (b.p.cast_id ?? 999));

  const linhas: LinhaTabela[] = noDia.map(({ p, cenas }) => {
    const h = horarios[p.id] || {};
    const ator = p.perfil_id ? e.perfis.find(x => x.id === p.perfil_id) : undefined;
    return {
      celulas: {
        id: p.cast_id !== undefined ? String(p.cast_id) : '—',
        personagem: { texto: p.nome, enfase: 'forte' as const },
        ator: ator ? nomeCompleto(ator) : '—',
        cenas: cenas.join(', ') || '—',
        chegada: horaDoSet(h.chegada),
        // `maq_fig` é o campo antigo (make e figurino juntos): sai como make.
        make: horaDoSet(h.make || h.maq_fig),
        figurino: horaDoSet(h.figurino),
        mic: horaDoSet(h.mic),
        noset: { texto: horaDoSet(h.no_set), enfase: 'forte' as const },
        fim: horaDoSet(h.fim),
        obs: h.obs || p.notas || '',
      },
    };
  });

  /* Coluna que ninguém preencheu não entra: o modelo tem make, figurino e
     mic, mas uma produção sem som direto não precisa de uma coluna de traços. */
  const tem = (chave: string) => linhas.some(l => {
    const v = textoDaCelula(l.celulas[chave]);
    return v && v !== '—';
  });
  const opcional = (chave: string, rotulo: string, peso = 1.4): ColunaTabela[] =>
    tem(chave) ? [{ chave, rotulo, peso, alinhamento: 'centro' }] : [];

  if (e.diaria.aviso_elenco?.trim()) {
    linhas.unshift({ celulas: {}, faixa: { texto: e.diaria.aviso_elenco.trim().toUpperCase() } });
  }

  const refeicoes = refeicoesDe(e, itens, 'elenco');
  const total = noDia.length
    ? `Elenco total: ${noDia.length}${refeicoes ? ` = [ ${refeicoes} ]` : ''}`
    : '';

  return {
    id: 'elenco',
    tipo: 'tabela',
    titulo: 'Elenco',
    tabela: {
      colunas: [
        { chave: 'id', rotulo: 'ID', peso: 0.7, alinhamento: 'centro' },
        { chave: 'personagem', rotulo: 'Personagem', peso: 3 },
        { chave: 'ator', rotulo: 'Ator/atriz', peso: 3 },
        { chave: 'cenas', rotulo: 'Cenas', peso: 2, alinhamento: 'centro' },
        { chave: 'chegada', rotulo: 'Chegada', peso: 1.4, alinhamento: 'centro' },
        ...opcional('make', 'Make'),
        ...opcional('figurino', 'Figurino'),
        ...opcional('mic', 'Mic'),
        { chave: 'noset', rotulo: 'No set', peso: 1.4, alinhamento: 'centro' },
        ...opcional('fim', 'Fim'),
        ...(tem('obs') ? [{ chave: 'obs', rotulo: 'Observações', peso: 3 }] : []),
      ],
      // Sem ninguém do elenco no dia a tabela não sai (o aviso sozinho não é
      // um elenco). O total vai numa faixa: numa célula, a conta das
      // refeições quebrava em três linhas.
      linhas: noDia.length ? [...linhas, { celulas: {}, faixa: { texto: total.toUpperCase() } }] : [],
    },
  };
}

// ---- Figuração ------------------------------------------------------------

/** Estava no app desde a diária completa e nunca chegava ao papel. */
function secaoFiguracao(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const f = e.diaria.figuracao;
  const refeicoes = refeicoesDe(e, itens, 'figuracao');
  return {
    id: 'figuracao',
    tipo: 'campos',
    titulo: 'Figuração',
    colunas: 4,
    itens: campos(
      campo('Quantidade', f?.quantidade ? String(f.quantidade) : null),
      campo('Chegada', f?.chamada ? horaDoSet(f.chamada) : null),
      campo('Desprodução', f?.wrap ? horaDoSet(f.wrap) : null),
      campo('Observação', f?.notas),
      campo('Refeições', refeicoes),
    ),
  };
}

// ---- Ponto de encontro e veículos de cena ---------------------------------

/** A primeira linha do quadro de lugar no modelo: "Saída às 6h · Metrô…". */
function secaoPonto(e: EntradaOD): Secao {
  return {
    id: 'ponto',
    tipo: 'campos',
    itens: campos(campo('Ponto de encontro', e.diaria.ponto_encontro)),
  };
}

function secaoVeiculosDeCena(e: EntradaOD): Secao {
  const linhas: LinhaTabela[] = (e.diaria.veiculos_cena || [])
    .filter(v => v.veiculo?.trim())
    .map(v => ({
      celulas: {
        cena: v.cena || '—',
        veiculo: { texto: v.veiculo, enfase: 'forte' as const },
        responsavel: v.responsavel || '—',
        chegada: { texto: horaDoSet(v.chegada), enfase: 'forte' as const },
        local: v.local || '—',
        termino: horaDoSet(v.termino),
      },
    }));
  return {
    id: 'veiculos-cena',
    tipo: 'tabela',
    titulo: 'Veículos de cena',
    tabela: {
      colunas: [
        { chave: 'cena', rotulo: 'Cena', peso: 1, alinhamento: 'centro' },
        { chave: 'veiculo', rotulo: 'Veículo', peso: 3 },
        { chave: 'responsavel', rotulo: 'Responsável', peso: 3 },
        { chave: 'chegada', rotulo: 'Chegada', peso: 1.5, alinhamento: 'centro' },
        { chave: 'local', rotulo: 'Locação / base', peso: 4 },
        { chave: 'termino', rotulo: 'Término', peso: 1.5, alinhamento: 'centro' },
      ],
      linhas,
    },
  };
}

// ---- Contatos: o pé da página 1 -------------------------------------------

/*
  Direção, assistência e produção com o telefone AO LADO do nome. O projeto
  guarda `diretor` e `produtor` como texto solto; quando a pessoa está na ficha,
  o telefone vem junto. O texto solto continua valendo: produção pequena não
  cadastra ninguém. Os canais de rádio da produção vêm junto, como no modelo.
*/
function secaoContatos(e: EntradaOD): Secao {
  const direcao = direcaoDe(e.perfis);
  const assistencia = quemFaz(e.perfis, ['assistente de dire', '1º ad', '2º ad', '1o ad', 'primeiro assistente', 'segundo assistente']);
  const producao = quemFaz(e.perfis, ['produtor', 'produtora', 'produção', 'producao', 'platô', 'plato'], ['assistente', 'auxiliar', 'elenco']);
  const radio = (e.projeto.canais_radio || '')
    .split('\n').map(l => l.trim()).filter(Boolean).join(' · ');

  const pessoas: Secao = {
    id: 'contatos-pessoas',
    tipo: 'campos',
    titulo: 'Contatos',
    colunas: 4,
    itens: campos(
      ...direcao.slice(0, 2).map(p => campo(p.funcao || 'Direção', nomeCompleto(p), contatoDe(p))),
      direcao.length === 0 ? campo('Direção', e.projeto.diretor) : null,
      ...assistencia.slice(0, 3).map(p => campo(p.funcao || 'Assistência de direção', nomeCompleto(p), contatoDe(p))),
      ...producao.slice(0, 3).map(p => campo(p.funcao || 'Produção', nomeCompleto(p), contatoDe(p))),
      producao.length === 0 ? campo('Produção', e.projeto.produtor) : null,
    ),
  };
  // O rádio numa linha inteira: numa quarta parte da largura, sete canais
  // quebravam em três linhas.
  const canais: Secao = { id: 'contatos-radio', tipo: 'campos', itens: campos(campo('Canais de rádio', radio)) };
  return { id: 'contatos', tipo: 'faixa', colunas: [{ peso: 1, secoes: [pessoas, canais] }] };
}

// ---- Equipe ---------------------------------------------------------------

function secaoEquipe(e: EntradaOD, escalados: Perfil[]): Secao {
  const confirmados = new Set(e.diaria.confirmacoes || []);
  const porDepto = new Map<string, Perfil[]>();

  for (const p of escalados) {
    const dep = e.departamentos.find(d => d.id === p.departamento_id);
    const nome = dep?.nome || 'Equipe';
    if (!porDepto.has(nome)) porDepto.set(nome, []);
    porDepto.get(nome)!.push(p);
  }

  const grupos: GrupoDePessoas[] = [...porDepto.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([nome, pessoas]) => ({
      nome,
      pessoas: pessoas
        .sort((a, b) => nomeCompleto(a).localeCompare(nomeCompleto(b), 'pt-BR'))
        .map(p => ({
          nome: nomeCompleto(p),
          funcao: p.funcao,
          contato: contatoDe(p),
          radio: p.radio,
          confirmado: confirmados.has(p.id),
        })),
    }));

  return {
    id: 'equipe',
    tipo: 'pessoas',
    titulo: `Contato da equipe (${escalados.length})`,
    grupos,
    colunas: 2,
  };
}

// ---- Transporte -----------------------------------------------------------

function secaoTransporte(e: EntradaOD, escalados: Perfil[]): Secao {
  const linhas: LinhaTabela[] = (e.diaria.comboios || []).map(c => ({
    celulas: {
      veiculo: { texto: c.veiculo || 'Veículo', enfase: 'forte' as const },
      motorista: c.motorista || '—',
      ponto: c.ponto_encontro || '—',
      saida: { texto: c.saida || '—', enfase: 'forte' as const },
      passageiros: c.passageiros_ids
        .map(id => escalados.find(p => p.id === id) || e.perfis.find(p => p.id === id))
        .filter((p): p is Perfil => Boolean(p))
        .map(nomeCompleto).join(', ') || '—',
    },
  }));

  const secoes: Secao[] = [];
  if (e.diaria.transporte?.trim()) {
    secoes.push({ id: 'transporte-texto', tipo: 'texto', titulo: 'Mapa de transporte', corpo: e.diaria.transporte });
  }
  if (linhas.length > 0) {
    secoes.push({
      id: 'comboios',
      tipo: 'tabela',
      titulo: secoes.length === 0 ? 'Mapa de transporte' : undefined,
      tabela: {
        colunas: [
          { chave: 'veiculo', rotulo: 'Veículo', peso: 3 },
          { chave: 'motorista', rotulo: 'Motorista', peso: 3 },
          { chave: 'ponto', rotulo: 'Ponto de encontro', peso: 4 },
          { chave: 'saida', rotulo: 'Saída', peso: 2, alinhamento: 'centro' },
          { chave: 'passageiros', rotulo: 'Passageiros', peso: 6 },
        ],
        linhas,
      },
    });
  }

  // Uma faixa de uma coluna só: é o jeito de agrupar as duas seções num bloco.
  return { id: 'transporte', tipo: 'faixa', colunas: [{ peso: 1, secoes }] };
}

// ---- O dia seguinte -------------------------------------------------------

function secaoProximoDia(e: EntradaOD): Secao {
  const p = e.proximo;
  const linhas: LinhaTabela[] = (p?.cenas || []).map(({ cena, item }) => {
    const planos = e.planosPorCena.get(cena.id) || [];
    const quantos = item.planos_ids ? item.planos_ids.length : planos.length;
    return {
      celulas: {
        cena: { texto: `${cena.numero}${item.parte || ''}`, enfase: 'forte' as const },
        ie: (cena.ambiente || 'ext').toUpperCase() === 'INT' ? 'INT' : 'EXT',
        dn: (cena.periodo || 'dia') === 'noite' ? 'NOITE' : 'DIA',
        locacao: e.locacoes.find(l => l.id === cena.locacao_id)?.nome || '—',
        sinopse: cena.descricao || '—',
        planos: quantos ? `${quantos}` : '—',
        paginas: cena.paginas || '—',
      },
    };
  });

  return {
    id: 'proximo-dia',
    tipo: 'tabela',
    titulo: p ? `Cenas do próximo dia — Diária ${String(p.numero).padStart(2, '0')} · ${formataData(p.data)}` : 'Cenas do próximo dia',
    tabela: {
      colunas: [
        { chave: 'cena', rotulo: 'Cena', peso: 2, alinhamento: 'centro' },
        { chave: 'ie', rotulo: 'I/E', peso: 1, alinhamento: 'centro' },
        { chave: 'dn', rotulo: 'D/N', peso: 1, alinhamento: 'centro' },
        { chave: 'locacao', rotulo: 'Locação', peso: 3 },
        { chave: 'sinopse', rotulo: 'Sinopse', peso: 8 },
        { chave: 'planos', rotulo: 'Planos', peso: 1, alinhamento: 'centro' },
        { chave: 'paginas', rotulo: 'Págs', peso: 1, alinhamento: 'centro' },
      ],
      linhas,
    },
  };
}

// ---- Observações, checklist, shot list ------------------------------------

function secaoObservacoes(e: EntradaOD): Secao {
  return {
    id: 'observacoes',
    tipo: 'texto',
    titulo: 'Informações do dia',
    corpo: e.diaria.observacoes || '',
  };
}

function secaoChecklist(e: EntradaOD): Secao {
  return {
    id: 'checklist',
    tipo: 'lista',
    titulo: 'Checklist da produção',
    itens: e.tasks.map(t => `${t.status === 'concluido' ? '☑' : '☐'} ${t.descricao}`),
    colunas: 2,
  };
}

function secaoShotList(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const cenas = [...new Map(
    itens.filter(i => i.cena).map(i => [i.cena!.id, i.cena!] as const)
  ).values()];

  const linhas: LinhaTabela[] = [];
  for (const cena of cenas) {
    const planos = e.planosPorCena.get(cena.id) || [];
    if (planos.length === 0) continue;
    linhas.push({ celulas: {}, faixa: { texto: `Cena ${cena.numero} — ${cena.descricao}` } });
    for (const p of planos) {
      linhas.push({
        celulas: {
          numero: { texto: p.numero, enfase: 'forte' as const },
          acao: p.descricao || '—',
          tamanho: p.tamanho || '—',
          movimento: p.movimento || '—',
          lente: p.lente || '—',
        },
      });
    }
  }

  return {
    id: 'shotlist',
    tipo: 'tabela',
    titulo: 'Decupagem do dia',
    nota: 'Referência da equipe de câmera. Os horários mandam nas cenas do dia, na página 1.',
    tabela: {
      colunas: [
        { chave: 'numero', rotulo: 'Plano', peso: 1, alinhamento: 'centro' },
        { chave: 'acao', rotulo: 'Ação', peso: 8 },
        { chave: 'tamanho', rotulo: 'Tamanho', peso: 3 },
        { chave: 'movimento', rotulo: 'Movimento', peso: 3 },
        { chave: 'lente', rotulo: 'Lente', peso: 2 },
      ],
      linhas,
    },
  };
}

function secaoGerais(e: EntradaOD): Secao {
  return {
    id: 'gerais',
    tipo: 'texto',
    corpo: e.projeto.observacoes_od || '',
  };
}
