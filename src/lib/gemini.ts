import { supabase, supabaseConfigurado } from './supabase';
import { DEPARTAMENTOS_PADRAO_IA, normalizarCategoria } from './decupagem';

/**
 * Ponte com a IA.
 *
 * A chave da API NÃO existe no navegador. Todas as chamadas passam pela Edge
 * Function `gemini` do Supabase, que guarda a chave como secret do servidor.
 * Assim nem um usuário logado consegue lê-la — antes, bastava abrir o inspetor
 * de rede ou consultar a tabela de configuração.
 */

export const ERRO_SEM_CHAVE =
  'A IA não está disponível: a função `gemini` não está publicada no Supabase ou está sem a chave.';

/** A IA só pode ser usada com Supabase configurado e usuário logado. */
export function iaDisponivel(): boolean {
  return supabaseConfigurado;
}

/**
 * Envia um prompt e devolve o texto. Erros vêm em português, prontos para a tela.
 * Com `schema`, o modelo é obrigado a responder JSON naquele formato.
 */
async function chamarIA(prompt: string, schema?: unknown): Promise<string> {
  if (!supabaseConfigurado) throw new Error(ERRO_SEM_CHAVE);

  // O modelo NÃO vai daqui de propósito: quem escolhe é a Edge Function, que só
  // aceita Flash. Mandar o modelo pelo navegador seria pedir para alguém trocar
  // por um caro no inspetor de rede.
  const { data, error } = await supabase.functions.invoke('gemini', {
    body: { prompt, ...(schema ? { schema } : {}) },
  });

  if (error) {
    // A função responde o motivo no corpo mesmo quando o status não é 2xx.
    let detalhe = error.message;
    try {
      const corpo = await (error as any).context?.json?.();
      if (corpo?.erro) detalhe = corpo.erro;
      // `motivo` traz o texto do próprio Google (cota, modelo inexistente).
      // Sem ele, todo problema virava a mesma mensagem genérica na tela.
      if (corpo?.motivo) detalhe += ` [${corpo.motivo}]`;
    } catch { /* mantém a mensagem original */ }

    // Quando a função não existe, o SDK devolve "Failed to send a request to
    // the Edge Function" — que não diz nada a quem está usando o app.
    if (/not found|404|failed to send a request/i.test(detalhe)) {
      throw new Error(ERRO_SEM_CHAVE);
    }
    if (/401|403|jwt/i.test(detalhe)) {
      throw new Error('Sessão expirada. Saia e entre de novo para usar a IA.');
    }
    throw new Error(detalhe);
  }

  if (data?.erro) throw new Error(data.erro);
  if (typeof data?.texto !== 'string') throw new Error('A IA não retornou texto.');

  return data.texto;
}

/** Remove cercas de markdown que o modelo às vezes acrescenta. */
function limpar(texto: string): string {
  return texto.replace(/```(?:json|html)?/g, '').trim();
}

/**
 * Respiro entre chamadas seguidas. O nível gratuito do Gemini limita
 * requisições por minuto; sem pausa, uma decupagem de 30 cenas dispara tudo de
 * uma vez e a metade final volta com erro de cota.
 */
const INTERVALO_MS = 1500;

const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Erro de cota não é falha de uma cena: é o Google dizendo "chega". Continuar o
 * laço só produz 30 erros iguais, então ele interrompe a análise e vai à tela.
 */
function ehErroDeCota(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /cota|quota|429|limite de \d+ an[áa]lises/i.test(msg);
}

// ---- Decupagem: elementos de uma cena ----

export async function sugerirBreakdownCena(_projetoId: string, descricaoCena: string) {
  const prompt = `Você é um assistente de produção de cinema focado em decupagem técnica.
Dada a descrição de uma cena, identifique os elementos necessários, classificando-os em categorias:
elenco, figuracao, arte, figurino, maquiagem, efeitos, camera, outro.

Responda APENAS com um objeto JSON válido, neste formato exato (as chaves devem ser em português sem acento e o valor uma lista de strings):
{
  "elenco": ["Personagem A", "Personagem B"],
  "arte": ["Carro vermelho", "Arma", "Dinheiro"],
  "figurino": ["Roupa rasgada"]
}
Se uma categoria não tiver itens, deixe como array vazio [].
A cena é: "${descricaoCena}"`;

  const texto = await chamarIA(prompt);
  return JSON.parse(limpar(texto)) as Record<string, string[]>;
}

// ---- Ordem do Dia ----

export async function gerarOrdemDoDia(
  projeto: any,
  diaria: any,
  equipe: any[],
  _locacoes: any[],
  _departamentos: any[],
  _cenasGlobais: any[]
) {
  const prompt = `Você é um assistente de produção. Crie uma Ordem do Dia profissional em formato HTML.
Projeto: ${projeto.nome}
Diária: ${diaria.numero} (${diaria.data})
Equipe: ${equipe.map(e => e.nome).join(', ')}
Responda APENAS com o código HTML. Sem formatação markdown.`;

  return limpar(await chamarIA(prompt));
}

// ---- Relatório diagramado (Gestão de Dados) ----

/**
 * A IA recebe dados já apurados pelo app e serve apenas de diagramadora.
 * Ela NÃO pode inventar, calcular ou completar nada — campo vazio permanece
 * vazio. Se alterar um número, o relatório deixa de valer como prestação de contas.
 */
export async function diagramarRelatorio(params: {
  tituloProjeto: string;
  instrucoes?: string;
  blocos: { titulo: string; conteudo: string }[];
}): Promise<string> {
  const { tituloProjeto, instrucoes, blocos } = params;
  const dados = blocos.map(b => `### ${b.titulo}\n${b.conteudo}`).join('\n\n');

  const prompt = `Você é uma DIAGRAMADORA de relatórios de produção audiovisual.
Sua função é apenas formatar visualmente os dados abaixo em HTML bonito e profissional.

REGRAS ABSOLUTAS — o descumprimento invalida o relatório:
1. NUNCA invente, altere, recalcule ou complete dados. Números, nomes, datas e valores
   devem aparecer EXATAMENTE como estão abaixo.
2. Se um campo estiver vazio, deixe vazio ou escreva "—". Nunca preencha com suposição.
3. Não acrescente seções, totais ou observações que não estejam nos dados.
4. Sua liberdade criativa é somente visual: hierarquia, tabelas, espaçamento, agrupamento.

FORMATO DE SAÍDA:
- Responda APENAS com o HTML do corpo (sem <html>, <head> ou <body>).
- Use CSS inline (style="...") — o HTML será impresso e precisa ser autossuficiente.
- Paleta sóbria para papel: fundo branco, texto escuro, títulos com linha divisória.
- Use tabelas para dados tabulares e cabeçalho com o nome do projeto.
- Tipografia: Arial, sans-serif. Deve caber bem em papel A4.

PROJETO: ${tituloProjeto}
${instrucoes ? `PEDIDO DO USUÁRIO (só afeta a apresentação): ${instrucoes}` : ''}

DADOS:
${dados}`;

  return limpar(await chamarIA(prompt));
}

// ---- Análise de roteiro (Decupagem → aba Roteiro) ----

export interface CenaDetectada {
  numero: string;
  cabecalho: string;
  local: string;
  ambiente: 'int' | 'ext';
  periodo: 'dia' | 'noite';
  pagina: number;
  /** Tamanho da cena em oitavos, ex: "1 4/8". */
  paginas?: string;
}

export interface ElementoDetectado {
  /** Trecho EXATO como aparece no PDF — é o que permite marcar em cima da página. */
  texto: string;
  categoria: string;
  pagina: number;
}

export interface AnaliseRoteiro {
  cenas: CenaDetectada[];
  elementos: ElementoDetectado[];
}

/** Schema que o Gemini é obrigado a seguir (structured output). */
function montarSchema(separarCenas: boolean, analiseTecnica: boolean, departamentos: string[]) {
  const propriedades: Record<string, unknown> = {};

  if (separarCenas) {
    propriedades.cenas = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          numero: { type: 'STRING' },
          cabecalho: { type: 'STRING' },
          local: { type: 'STRING' },
          ambiente: { type: 'STRING', enum: ['int', 'ext'] },
          periodo: { type: 'STRING', enum: ['dia', 'noite'] },
          pagina: { type: 'INTEGER' },
          paginas: { type: 'STRING', description: 'Tamanho da cena em oitavos, ex: "1 4/8"' },
        },
        required: ['local', 'ambiente', 'periodo', 'pagina'],
      },
    };
  }

  if (analiseTecnica) {
    propriedades.elementos = {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          texto: { type: 'STRING', description: 'Trecho copiado LITERALMENTE do roteiro' },
          categoria: { type: 'STRING', enum: departamentos },
          pagina: { type: 'INTEGER' },
        },
        required: ['texto', 'categoria', 'pagina'],
      },
    };
  }

  return {
    type: 'OBJECT',
    properties: propriedades,
    required: Object.keys(propriedades),
  };
}

/**
 * Manda o roteiro em lotes de páginas e pede cenas e/ou elementos.
 *
 * Ponto crítico: os elementos precisam vir com o TRECHO EXATO do texto, porque é
 * por ele que a marcação é ancorada na página do PDF. Se a IA parafrasear, o
 * destaque não aparece — por isso o prompt insiste nisso e nós descartamos
 * qualquer trecho que não exista literalmente na página.
 */
export async function analisarRoteiro(params: {
  paginas: { numero: number; texto: string }[];
  separarCenas: boolean;
  analiseTecnica: boolean;
  /** Chaves de DEPARTMENT_THEMES que a IA pode usar. */
  departamentos?: string[];
  onProgresso?: (feito: number, total: number) => void;
}): Promise<AnaliseRoteiro> {
  const { paginas, separarCenas, analiseTecnica, onProgresso } = params;
  const departamentos = params.departamentos?.length ? params.departamentos : DEPARTAMENTOS_PADRAO_IA;
  const schema = montarSchema(separarCenas, analiseTecnica, departamentos);

  const TAMANHO_LOTE = 5;
  const lotes: { numero: number; texto: string }[][] = [];
  for (let i = 0; i < paginas.length; i += TAMANHO_LOTE) {
    lotes.push(paginas.slice(i, i + TAMANHO_LOTE));
  }

  const cenas: CenaDetectada[] = [];
  const elementos: ElementoDetectado[] = [];

  for (let i = 0; i < lotes.length; i++) {
    const lote = lotes[i];
    const corpo = lote.map(p => `--- PÁGINA ${p.numero} ---\n${p.texto}`).join('\n\n');

    const pedidos: string[] = [];
    if (separarCenas) {
      pedidos.push(
        '- "cenas": um item por cabeçalho de cena (INT./EXT. LOCAL - PERÍODO). ' +
        'Em "paginas", estime o tamanho da cena em oitavos de página, no formato "1 4/8".'
      );
    }
    if (analiseTecnica) {
      pedidos.push(
        `- "elementos": elementos de produção citados no texto, nos departamentos [${departamentos.join(', ')}].\n` +
        '  O campo "texto" é obrigatoriamente uma cópia EXATA e CURTA (1 a 5 palavras) de algo\n' +
        '  escrito no roteiro — como "luvas amarelas" ou "MARIA". Não reescreva, não traduza e\n' +
        '  não normalize maiúsculas: esse trecho é usado para destacar a marcação no PDF.\n' +
        '  Se não conseguir copiar exatamente, omita o item.'
      );
    }

    const prompt = `Você analisa roteiros audiovisuais e extrai dados de produção.

O que extrair:
${pedidos.join('\n')}

Se não houver nada, devolva lista vazia.

ROTEIRO:
${corpo}`;

    try {
      const json = JSON.parse(limpar(await chamarIA(prompt, schema)));

      if (Array.isArray(json.cenas)) {
        for (const c of json.cenas) {
          if (!c?.local) continue;
          cenas.push({
            numero: String(c.numero ?? ''),
            cabecalho: String(c.cabecalho || ''),
            local: String(c.local),
            ambiente: c.ambiente === 'int' ? 'int' : 'ext',
            periodo: c.periodo === 'noite' ? 'noite' : 'dia',
            pagina: Number(c.pagina) || lote[0].numero,
            paginas: c.paginas ? String(c.paginas) : undefined,
          });
        }
      }

      if (Array.isArray(json.elementos)) {
        for (const e of json.elementos) {
          const trecho = String(e?.texto || '').trim();
          if (!trecho) continue;

          // Só aceitamos o que existe literalmente na página — senão não dá para marcar.
          const pagina = Number(e.pagina) || lote[0].numero;
          const paginaTexto = lote.find(p => p.numero === pagina)?.texto
            || lote.map(p => p.texto).join(' ');
          if (!paginaTexto.includes(trecho)) continue;

          elementos.push({
            texto: trecho,
            categoria: normalizarCategoria(String(e.categoria)),
            pagina,
          });
        }
      }
    } catch (err) {
      console.warn(`[SetProd] Falha ao analisar o lote de páginas ${lote[0].numero}+`, err);
    }

    onProgresso?.(i + 1, lotes.length);
  }

  return { cenas, elementos };
}

/**
 * Extrai elementos de produção CENA A CENA.
 *
 * Antes eu mandava blocos de 5 páginas cruas e pedia cenas + elementos na mesma
 * chamada. Dava dois problemas: o modelo perdia cenas no meio do bloco e, sem
 * fronteira clara, às vezes despejava a página inteira no campo "local".
 * Agora a separação de cenas é feita por padrão de cabeçalho (determinística) e
 * a IA recebe uma cena por vez, com o texto dela — contexto curto e focado.
 */
export async function extrairElementosDeCenas(params: {
  cenas: { numero: string; cabecalho: string; corpo: string; pagina: number }[];
  departamentos: string[];
  /**
   * Segunda passada em cada cena, procurando o que escapou na primeira.
   * Continua sendo o mesmo modelo Flash — o ganho vem de reler com calma, não
   * de um modelo mais caro. Dobra o tempo e o número de chamadas.
   */
  minucioso?: boolean;
  onProgresso?: (feito: number, total: number) => void;
}): Promise<{ texto: string; categoria: string; pagina: number; cenaNumero: string }[]> {
  const { cenas, departamentos, minucioso, onProgresso } = params;

  const schema = {
    type: 'OBJECT',
    properties: {
      elementos: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            texto: { type: 'STRING', description: 'Trecho copiado LITERALMENTE do roteiro, 1 a 5 palavras' },
            categoria: { type: 'STRING', enum: departamentos },
          },
          required: ['texto', 'categoria'],
        },
      },
    },
    required: ['elementos'],
  };

  const resultado: { texto: string; categoria: string; pagina: number; cenaNumero: string }[] = [];

  /** Evita repetir o mesmo trecho na mesma cena entre as duas passadas. */
  const jaVisto = new Set<string>();

  const regras = `REGRA CRÍTICA: o campo "texto" deve ser uma cópia EXATA de algo escrito na cena
abaixo — mesmas palavras, mesma acentuação, mesmas maiúsculas. De 1 a 5 palavras.
Esse trecho é usado para destacar a marcação em cima do PDF; se você reescrever,
a marcação não aparece. Se não conseguir copiar exatamente, omita o item.

Não invente elementos que não estão escritos. Prefira poucos itens corretos a muitos duvidosos.`;

  const total = cenas.length * (minucioso ? 2 : 1);
  let feito = 0;

  for (const cena of cenas) {
    // Cena muito longa é cortada: o que interessa aparece no começo, e prompt
    // gigante degrada a atenção do modelo.
    const corpo = cena.corpo.slice(0, 6000);
    const cabecalhoCena = `CENA ${cena.numero} — ${cena.cabecalho}\n${corpo}`;

    const anotar = (lista: unknown) => {
      if (!Array.isArray(lista)) return;
      for (const e of lista) {
        const texto = String((e as { texto?: unknown })?.texto || '').trim();
        if (!texto) continue;

        const chave = `${cena.numero}|${texto.toLowerCase()}`;
        if (jaVisto.has(chave)) continue;
        jaVisto.add(chave);

        resultado.push({
          texto,
          categoria: normalizarCategoria(String((e as { categoria?: unknown }).categoria)),
          pagina: cena.pagina,
          cenaNumero: cena.numero,
        });
      }
    };

    const passada = async (prompt: string) => {
      const bruto = await chamarIA(prompt, schema);
      anotar(JSON.parse(limpar(bruto)).elementos);
    };

    try {
      await passada(`Você faz decupagem de produção audiovisual.

Liste os elementos que a produção precisa providenciar nesta cena, nos departamentos:
${departamentos.join(', ')}.

${regras}

${cabecalhoCena}`);
    } catch (err) {
      if (ehErroDeCota(err)) throw err;
      console.warn(`[SetProd] Falha ao analisar a cena ${cena.numero}`, err);
    }

    onProgresso?.(++feito, total);

    if (!minucioso) {
      await pausa(INTERVALO_MS);
      continue;
    }

    // Segunda passada: o modelo relê a cena sabendo o que já foi pego. Custa
    // outra chamada de Flash, e é aí que aparecem os itens de departamento
    // menos óbvio (som, VFX) que a primeira leitura costuma deixar passar.
    const achadosDaCena = resultado
      .filter(r => r.cenaNumero === cena.numero)
      .map(r => `- ${r.texto}`)
      .join('\n');

    try {
      await pausa(INTERVALO_MS);
      await passada(`Você faz decupagem de produção audiovisual e está REVISANDO uma cena.

Estes elementos JÁ foram identificados:
${achadosDaCena || '(nenhum)'}

Releia a cena e liste APENAS o que ficou de fora, nos departamentos:
${departamentos.join(', ')}.
Não repita nada da lista acima. Se nada escapou, devolva a lista vazia.

${regras}

${cabecalhoCena}`);
    } catch (err) {
      if (ehErroDeCota(err)) throw err;
      console.warn(`[SetProd] Falha na revisão da cena ${cena.numero}`, err);
    }

    onProgresso?.(++feito, total);
    await pausa(INTERVALO_MS);
  }

  return resultado;
}
