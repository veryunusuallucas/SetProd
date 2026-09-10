/**
 * Monta a Ordem do Dia a partir do que está gravado. **Só isso.**
 *
 * Nenhuma decisão de aparência mora aqui — nem cor, nem fonte, nem quebra de
 * página. O que mora aqui é a decisão de CONTEÚDO: o que entra no papel, em que
 * ordem, e com que rótulo.
 *
 * A referência é o modelo que a produção já usa (`.md/BASE DE ORDEM DO DIA`),
 * com três coisas apertadas de onde o mercado faz melhor:
 *
 *  1. **O hospital ao lado do endereço** a que ele se refere, e não numa seção
 *     de emergência lá embaixo. Numa diária que atravessa a cidade, ler
 *     "Hospital X" longe do endereço obriga a cruzar qual das três locações é
 *     a certa — exatamente na hora em que ninguém tem tempo de cruzar nada.
 *  2. **Uma linha de total** na grade: páginas e horas somadas. Uma linha, e
 *     ela responde "o dia cabe?".
 *  3. **As cenas do dia seguinte**, que o modelo pede e que quase nenhuma OD
 *     traz preenchida.
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
import { data as formataData, diaDaSemana } from '../formato';
import {
  campo, campos, podar,
  type Campo, type DocumentoOD, type GrupoDePessoas, type LinhaTabela, type Secao,
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

/** "12:00 às 13:00" a partir do início e da duração. */
function janela(inicio: string, minutos: number): string {
  const base = emMinutos(inicio);
  if (base === null || minutos <= 0) return inicio;
  const fim = base + minutos;
  const hh = String(Math.floor((fim % 1440) / 60)).padStart(2, '0');
  const mm = String(fim % 60).padStart(2, '0');
  return `${inicio} às ${hh}:${mm}`;
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

// ---------------------------------------------------------------------------
// O documento
// ---------------------------------------------------------------------------

export function montarOD(e: EntradaOD): DocumentoOD {
  const { projeto, diaria } = e;
  const cenaPorId = (id: string) => e.cenas.find(c => c.id === id);
  const dia = calcularDia(e.itens, diaria.chamada, cenaPorId);
  const escalados = e.perfis.filter(p => (diaria.equipe_escalada || []).includes(p.id));
  const versao = e.versao ?? diaria.versao_od ?? 1;

  const secoes = podar([
    faixaDoTopo(e, dia.itens),
    secaoLocacoes(e),
    secaoClima(e),
    secaoGrade(e, dia.itens),
    secaoElenco(e, dia.itens),
    secaoEquipe(e, escalados),
    secaoTransporte(e, escalados),
    secaoProximoDia(e),
    secaoObservacoes(e),
    secaoChecklist(e),
    secaoShotList(e, dia.itens),
    secaoGerais(e),
  ]);

  const chamada = diaria.chamada || '—';
  return {
    cabecalho: {
      titulo: 'ORDEM DO DIA',
      producao: projeto.nome,
      diaria: `Diária ${String(diaria.numero).padStart(2, '0')}`,
      data: `${diaDaSemana(diaria.data)} · ${formataData(diaria.data)}`,
      janela: dia.wrap ? `${chamada} às ${dia.wrap}` : undefined,
      versao,
      logo: e.logo,
    },
    secoes,
    rodape: `${projeto.nome} · Diária ${String(diaria.numero).padStart(2, '0')}${versao > 1 ? ` · v${versao}` : ''}`,
  };
}

// ---- Topo: os três quadrantes do modelo -----------------------------------

function faixaDoTopo(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const { diaria } = e;

  const primeiraCena = itens.find(i => i.item.tipo === 'cena');
  const ultimo = itens[itens.length - 1];
  const refeicoes = itens.filter(i => i.item.tipo === 'almoco' || i.item.tipo === 'coffee');

  /*
    Os três marcos do modelo saem da linha do dia, e nenhum deles é campo novo.

    "Preparação inicial" é a chamada; "corta câmera" é a hora em que a primeira
    CENA começa (e não a primeira linha do dia, que costuma ser café ou
    prelight); "desprodução" é o wrap. Pedir os três à mão criaria três lugares
    para a mesma verdade divergir.
  */
  const horarios: Campo[] = campos(
    campo('Chegada da equipe', diaria.chamada),
    campo('Corta câmera', primeiraCena?.hora),
    ...refeicoes.map(r => campo(
      r.item.titulo || (r.item.tipo === 'almoco' ? 'Almoço' : 'Lanche'),
      janela(r.hora, r.duracao),
      r.item.local,
    )),
    campo('Desprodução', ultimo ? janelaFim(ultimo) : null),
  );

  const base: Campo[] = campos(
    campo('Local', diaria.base?.nome),
    campo('Endereço', diaria.base?.endereco),
    campo('Observação', diaria.base?.obs),
  );

  /*
    Direção e produção com o telefone AO LADO do nome.

    O projeto guarda `diretor` e `produtor` como texto solto, digitado na
    criação. Quando a pessoa está na ficha da equipe, o telefone vem junto — e é
    o telefone que faz esse bloco existir. O texto solto continua valendo como
    resposta final: produção pequena não cadastra ninguém.
  */
  const direcao = quemFaz(e.perfis, ['diret'], ['fotografia', 'arte', 'assistente']);
  const assistencia = quemFaz(e.perfis, ['assistente de dire', '1º ad', '1o ad', 'primeiro assistente']);
  const producao = quemFaz(e.perfis, ['produtor', 'produtora', 'produção exec', 'producao exec'], ['assistente', 'auxiliar']);

  const comando: Campo[] = campos(
    ...direcao.slice(0, 2).map(p => campo(p.funcao || 'Direção', nomeCompleto(p), contatoDe(p))),
    direcao.length === 0 ? campo('Direção', e.projeto.diretor) : null,
    ...assistencia.slice(0, 1).map(p => campo(p.funcao || 'Assistência de direção', nomeCompleto(p), contatoDe(p))),
    ...producao.slice(0, 2).map(p => campo(p.funcao || 'Produção', nomeCompleto(p), contatoDe(p))),
    producao.length === 0 ? campo('Produção', e.projeto.produtor) : null,
  );

  return {
    id: 'topo',
    tipo: 'faixa',
    colunas: [
      { peso: 3, secoes: [{ id: 'horarios-chave', tipo: 'campos', titulo: 'Horários do dia', itens: horarios }] },
      { peso: 3, secoes: [{ id: 'base', tipo: 'campos', titulo: 'Base e camarim', itens: base }] },
      { peso: 4, secoes: [{ id: 'comando', tipo: 'campos', titulo: 'Direção e produção', itens: comando }] },
    ],
  };
}

/** O fim do último item do dia — a desprodução. */
function janelaFim(ultimo: ItemCalculado): string {
  const fim = ultimo.fim;
  const hh = String(Math.floor((fim % 1440) / 60)).padStart(2, '0');
  const mm = String(fim % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---- Locações: endereço e hospital na mesma linha -------------------------

function secaoLocacoes(e: EntradaOD): Secao {
  const usadas = (e.diaria.locacoes_ids || [])
    .map(id => e.locacoes.find(l => l.id === id))
    .filter((l): l is Locacao => Boolean(l));

  const temHospital = usadas.some(l => l.hospital_proximo);

  const colunas = [
    { chave: 'set', rotulo: 'Set', peso: 3 },
    { chave: 'endereco', rotulo: 'Endereço', peso: 5 },
    ...(temHospital ? [{ chave: 'hospital', rotulo: 'Hospital mais próximo', peso: 4 }] : []),
  ];

  const linhas: LinhaTabela[] = usadas.map((l, i) => ({
    celulas: {
      set: { texto: `${i + 1}. ${l.nome}`, enfase: 'forte' as const },
      endereco: {
        texto: l.endereco || '—',
        detalhe: [l.contatos?.[0] && `${l.contatos[0].nome} · ${l.contatos[0].telefone}`, l.obs]
          .filter(Boolean).join(' · ') || undefined,
      },
      ...(temHospital ? {
        hospital: {
          texto: l.hospital_proximo || '—',
          detalhe: [l.hospital_telefone, l.hospital_distancia !== undefined
            ? `${(l.hospital_distancia / 1000).toFixed(1).replace('.', ',')} km`
            : null].filter(Boolean).join(' · ') || undefined,
        },
      } : {}),
    },
  }));

  return {
    id: 'locacoes',
    tipo: 'tabela',
    titulo: usadas.length === 1 ? 'Locação' : `Locações do dia (${usadas.length})`,
    tabela: { colunas, linhas },
  };
}

// ---- Clima ----------------------------------------------------------------

function secaoClima(e: EntradaOD): Secao {
  const itens: Campo[] = e.clima.map(g => {
    const d = descreverClima(g.clima.code);
    return {
      rotulo: g.locais.join(' · '),
      valor: `${d.emoji} ${d.texto} · Máx ${Math.round(g.clima.tempMax)}° / Mín ${Math.round(g.clima.tempMin)}° · Chuva ${g.clima.chuvaProb}%`,
      detalhe: `Nascer do sol ${g.clima.sunrise || '--'} · Pôr do sol ${g.clima.sunset || '--'}`,
    };
  });
  return { id: 'clima', tipo: 'campos', titulo: 'Previsão do tempo', itens, colunas: 2 };
}

// ---- A grade hora a hora: o coração do documento --------------------------

function secaoGrade(e: EntradaOD, itens: ItemCalculado[]): Secao {
  const porPersonagem = e.cenasPorPersonagem;

  /** Os números de elenco que aparecem numa cena: "1, 3, 7". */
  const elencoDaCena = (cenaId: string): string => {
    const nela = e.personagens
      .filter(p => porPersonagem.get(p.id)?.has(cenaId))
      .sort((a, b) => (a.cast_id ?? 999) - (b.cast_id ?? 999));
    return nela.map(p => p.cast_id ?? p.nome).join(', ');
  };

  const temElenco = e.personagens.length > 0;

  const colunas = [
    { chave: 'hora', rotulo: 'Horário', peso: 2, alinhamento: 'centro' as const },
    { chave: 'cena', rotulo: 'Cena', peso: 2, alinhamento: 'centro' as const },
    { chave: 'ie', rotulo: 'I/E', peso: 1, alinhamento: 'centro' as const },
    { chave: 'dn', rotulo: 'D/N', peso: 1, alinhamento: 'centro' as const },
    { chave: 'locacao', rotulo: 'Locação', peso: 3 },
    { chave: 'sinopse', rotulo: 'Sinopse', peso: 7 },
    { chave: 'planos', rotulo: 'Planos', peso: 3 },
    { chave: 'paginas', rotulo: 'Págs', peso: 1, alinhamento: 'centro' as const },
    ...(temElenco ? [{ chave: 'elenco', rotulo: 'Elenco', peso: 2, alinhamento: 'centro' as const }] : []),
  ];

  const linhas: LinhaTabela[] = [];
  /** Oitavos já contados — cena partida em dois trechos não conta duas vezes. */
  const jaContadas = new Set<string>();
  let oitavos = 0;
  let minutosDeCena = 0;

  for (const c of itens) {
    if (c.item.tipo !== 'cena' || !c.cena) {
      /*
        Marco atravessa a grade inteira em vez de preencher as colunas.

        As colunas são sobre cena: um almoço não tem interior/exterior nem
        elenco, e distribuí-lo entre elas produziria sete traços por linha. Numa
        diária com café, deslocamento, almoço e lanche isso é metade da grade
        preenchida com nada.
      */
      const destino = c.item.locacao_id
        ? e.locacoes.find(l => l.id === c.item.locacao_id)
        : undefined;
      const texto = [
        c.item.titulo || rotuloPadrao(c.item.tipo),
        destino ? `→ ${destino.nome}${destino.endereco ? ` · ${destino.endereco}` : ''}` : '',
        c.item.local || '',
      ].filter(Boolean).join('  ');
      linhas.push({ celulas: {}, faixa: { texto, hora: c.hora } });
      continue;
    }

    const cena = c.cena;
    const planos = e.planosPorCena.get(cena.id) || [];
    const trecho = rotuloDoTrecho(c.item, planos);
    const quantos = c.item.planos_ids ? c.item.planos_ids.length : planos.length;

    minutosDeCena += c.duracao;
    /*
      As PÁGINAS aparecem uma vez por cena, e não uma vez por trecho.

      Cena partida entra duas vezes na grade, e imprimir "2 4/8" nas duas faz
      quem soma a coluna chegar a um dia maior do que ele é — justamente o
      número que a produção usa para decidir se o dia cabe. A cena continua
      sendo uma só; o que se partiu foi a agenda.
    */
    const primeiraVez = !jaContadas.has(cena.id);
    if (primeiraVez) {
      jaContadas.add(cena.id);
      oitavos += paginasParaOitavos(cena.paginas);
    }

    linhas.push({
      celulas: {
        hora: { texto: c.hora, enfase: 'forte' },
        cena: { texto: `${cena.numero}${c.item.parte || ''}`, enfase: 'forte' },
        ie: (cena.ambiente || 'ext').toUpperCase() === 'INT' ? 'INT' : 'EXT',
        dn: (cena.periodo || 'dia') === 'noite' ? 'NOITE' : 'DIA',
        locacao: e.locacoes.find(l => l.id === cena.locacao_id)?.nome || '—',
        sinopse: cena.descricao || '—',
        planos: trecho
          ? { texto: trecho, detalhe: `${quantos} plano${quantos === 1 ? '' : 's'}` }
          : quantos
            ? `${quantos} plano${quantos === 1 ? '' : 's'}`
            : '—',
        paginas: primeiraVez ? (cena.paginas || '—') : '·',
        ...(temElenco ? { elenco: elencoDaCena(cena.id) || '—' } : {}),
      },
    });
  }

  /*
    A linha de total responde "o dia cabe?" — e é a soma das CENAS, não do dia.

    Deslocamento e almoço ocupam o relógio mas não produzem filme; somá-los aqui
    daria um número maior e menos útil, porque a pergunta que essa linha
    responde é sobre a carga de filmagem.
  */
  return {
    id: 'grade',
    tipo: 'tabela',
    titulo: 'Descrição de atividades hora a hora',
    tabela: {
      colunas,
      linhas,
      total: oitavos > 0 || minutosDeCena > 0
        ? {
            sinopse: `Total do dia — ${duracaoTexto(minutosDeCena)} de gravação`,
            paginas: oitavosParaPaginas(oitavos),
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
    case 'wrap': return 'Wrap';
    case 'prelight': return 'Prelight';
    case 'ensaio': return 'Ensaio';
    case 'preparacao': return 'Preparação';
    default: return 'Marco';
  }
}

// ---- Elenco: a segunda página do modelo -----------------------------------

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
        cenas: cenas.join(', ') || '—',
        personagem: { texto: p.nome, enfase: 'forte' as const },
        ator: ator ? nomeCompleto(ator) : '—',
        chegada: h.chegada || '—',
        maqfig: h.maq_fig || '—',
        noset: h.no_set || '—',
        fim: h.fim || '—',
        obs: h.obs || p.notas || '',
      },
    };
  });

  return {
    id: 'elenco',
    tipo: 'tabela',
    titulo: 'Elenco na ordem da OD',
    tabela: {
      colunas: [
        { chave: 'id', rotulo: '#', peso: 1, alinhamento: 'centro' },
        { chave: 'cenas', rotulo: 'Cenas', peso: 2, alinhamento: 'centro' },
        { chave: 'personagem', rotulo: 'Personagem', peso: 4 },
        { chave: 'ator', rotulo: 'Elenco', peso: 4 },
        { chave: 'chegada', rotulo: 'Chegada', peso: 2, alinhamento: 'centro' },
        { chave: 'maqfig', rotulo: 'Maq/Fig', peso: 2, alinhamento: 'centro' },
        { chave: 'noset', rotulo: 'No set', peso: 2, alinhamento: 'centro' },
        { chave: 'fim', rotulo: 'Fim', peso: 2, alinhamento: 'centro' },
        { chave: 'obs', rotulo: 'Observações', peso: 5 },
      ],
      linhas,
    },
  };
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
    titulo: 'Observações do dia',
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
    nota: 'Referência da equipe de câmera. Os horários mandam na grade acima.',
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
    titulo: 'Observações gerais',
    corpo: e.projeto.observacoes_od || '',
  };
}
