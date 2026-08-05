/**
 * Edge Function `gemini` — o único lugar onde a chave da API existe.
 *
 * Por que isto existe: enquanto o navegador precisava da chave para chamar o
 * Gemini, qualquer usuário logado conseguia lê-la (pela tabela ou pelo inspetor
 * de rede). Aqui a chave vive como secret do Supabase, no servidor. O app manda
 * o prompt, a função responde com o texto — e a chave nunca sai daqui.
 *
 * Deploy e segredo:
 *   supabase secrets set GEMINI_API_KEY=xxx
 *   supabase functions deploy gemini
 *
 * O Supabase valida o JWT automaticamente, então só quem está logado no app
 * consegue chamar.
 *
 * CONTROLE DE GASTO
 * O cliente NÃO escolhe o modelo. Antes ele escolhia, e bastava abrir o
 * inspetor de rede para pedir um modelo caro. Aqui só rodam modelos Flash, e
 * há um teto de chamadas por usuário — nada que o navegador mande muda isso.
 */

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Modelos aceitos, em ordem de preferência. Só Flash: é o que tem nível
 * gratuito folgado. Se um não existir para esta chave (o Google restringiu o
 * acesso aos 1.5 antigos), a função cai para o próximo automaticamente.
 *
 * Dá para fixar um pelo secret GEMINI_MODELO — mas ele também precisa ser Flash.
 */
const MODELOS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

/**
 * Último modelo que realmente respondeu, lembrado enquanto a instância vive.
 *
 * Sem isto, toda chamada refazia a via-crúcis: tentar um modelo aposentado,
 * levar 429/404, tentar o seguinte. Numa decupagem de 30 cenas seriam quase
 * 90 requisições desperdiçadas — e as recusas por cota contam contra você.
 */
let modeloQueFunciona: string | null = null;

const LIMITE_PROMPT = 200_000; // ~50k tokens: evita conta surpresa

/** Teto por usuário. Uma decupagem de 30 cenas gasta ~60 chamadas no modo minucioso. */
const LIMITE_POR_USUARIO = 300;
const JANELA_MS = 60 * 60 * 1000; // 1 hora

/**
 * Teto do PROJETO INTEIRO por dia, somando todo mundo.
 *
 * O limite por usuário não segura uma equipe: cinco pessoas dentro do próprio
 * limite ainda multiplicam o consumo por cinco. Este é o número que impede a
 * conta de crescer sem ninguém perceber. 1500 dá ~25 decupagens completas por
 * dia — muito acima do uso real de uma produção.
 */
const LIMITE_DIARIO_GLOBAL = 1500;

/**
 * Conta e registra a chamada no banco, com a chave de serviço.
 *
 * Fica no servidor de propósito: o contador do processo (o Map acima) morre
 * quando o Supabase recicla a instância, e some justamente sob uso pesado —
 * que é quando ele precisaria funcionar.
 *
 * Se a tabela não existir, devolve `null` e a chamada segue: nunca derrubar a
 * IA por causa do contador.
 */
async function registrarChamadaGlobal(usuario: string): Promise<{ excedeu: boolean; usadas: number } | null> {
  const url = Deno.env.get('SUPABASE_URL');
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !servico) return null;

  const cabecalhos = {
    apikey: servico,
    Authorization: `Bearer ${servico}`,
    'Content-Type': 'application/json',
  };
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const contagem = await fetch(
      `${url}/rest/v1/ia_chamadas?select=id&criado_em=gte.${desde}`,
      { method: 'HEAD', headers: { ...cabecalhos, Prefer: 'count=exact' } }
    );
    if (!contagem.ok) return null;

    // O total vem no cabeçalho content-range, no formato "*/123".
    const usadas = parseInt(contagem.headers.get('content-range')?.split('/')[1] || '0', 10);
    if (usadas >= LIMITE_DIARIO_GLOBAL) return { excedeu: true, usadas };

    await fetch(`${url}/rest/v1/ia_chamadas`, {
      method: 'POST',
      headers: cabecalhos,
      body: JSON.stringify({ user_id: usuario === 'anonimo' ? null : usuario }),
    });

    return { excedeu: false, usadas: usadas + 1 };
  } catch (e) {
    console.error('Contador global indisponível:', e);
    return null;
  }
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Contador por usuário. Vive na memória da instância, então reinicia quando o
 * Supabase recicla o processo — é um freio contra uso descontrolado, não um
 * cofre. A trava dura contra conta alta é não ativar faturamento no Google.
 */
const usos = new Map<string, { contagem: number; desde: number }>();

function idDoUsuario(req: Request): string {
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  try {
    // O Supabase já validou a assinatura antes de chegar aqui; só lemos o "sub".
    const payload = JSON.parse(atob(token.split('.')[1]));
    return String(payload.sub || 'anonimo');
  } catch {
    return 'anonimo';
  }
}

function excedeuCota(usuario: string): boolean {
  const agora = Date.now();
  const atual = usos.get(usuario);

  if (!atual || agora - atual.desde > JANELA_MS) {
    usos.set(usuario, { contagem: 1, desde: agora });
    return false;
  }

  atual.contagem += 1;
  return atual.contagem > LIMITE_POR_USUARIO;
}

/**
 * Extrai do erro do Google um resumo curto e seguro para mostrar na tela.
 *
 * O corpo do erro traz o motivo real ("quota exceeded", "model not found"),
 * que é o que permite distinguir cota de modelo errado sem abrir os logs. Vai
 * truncado e sem nada que pareça chave.
 */
function resumirErroDoGoogle(bruto: string): string {
  try {
    const corpo = JSON.parse(bruto);
    const msg = corpo?.error?.message || corpo?.message || '';
    const status = corpo?.error?.status || '';
    return `${status} ${msg}`.trim().replace(/AIza[\w-]+/g, '[chave]').slice(0, 300);
  } catch {
    return bruto.replace(/AIza[\w-]+/g, '[chave]').slice(0, 200);
  }
}

/** Só Flash passa. Um modelo Pro configurado por engano é ignorado. */
function modelosPermitidos(): string[] {
  const fixado = Deno.env.get('GEMINI_MODELO')?.trim();
  const base = fixado && /flash/i.test(fixado)
    ? [fixado, ...MODELOS.filter(m => m !== fixado)]
    : MODELOS;

  // O que funcionou por último vai na frente.
  if (modeloQueFunciona && modeloQueFunciona !== base[0]) {
    return [modeloQueFunciona, ...base.filter(m => m !== modeloQueFunciona)];
  }
  return base;
}

/**
 * Pergunta ao Google quais modelos ESTA chave aceita.
 *
 * Os nomes de modelo mudam e são liberados por conta: a lista fixa acima
 * envelhece e vira "modelo não encontrado". Em vez de adivinhar nome novo a
 * cada seis meses, quando a lista fixa falha a função descobre sozinha.
 *
 * Continua valendo a regra de gasto: só entram modelos Flash, nunca Pro.
 */
async function descobrirModelosFlash(chave: string): Promise<string[]> {
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${chave}`);
    if (!r.ok) return [];
    const dados = await r.json();

    return (dados.models || [])
      .filter((m: { name?: string; supportedGenerationMethods?: string[] }) =>
        (m.supportedGenerationMethods || []).includes('generateContent') &&
        /flash/i.test(m.name || '') &&
        !/pro/i.test(m.name || ''))
      .map((m: { name: string }) => m.name.replace(/^models\//, ''))
      // Estáveis antes de preview/exp: modelo experimental cai mais.
      .sort((a: string, b: string) => {
        const instavel = (s: string) => /preview|exp|thinking/i.test(s) ? 1 : 0;
        return instavel(a) - instavel(b);
      });
  } catch {
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ erro: 'Use POST.' }, 405);

  const chave = Deno.env.get('GEMINI_API_KEY');
  if (!chave) {
    return json({ erro: 'GEMINI_API_KEY não configurada no servidor.' }, 500);
  }

  const usuario = idDoUsuario(req);
  if (excedeuCota(usuario)) {
    return json({
      erro: `Limite de ${LIMITE_POR_USUARIO} análises por hora atingido. Tente de novo mais tarde.`,
    }, 429);
  }

  let corpo: { prompt?: string; schema?: unknown; listarModelos?: boolean };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: 'Corpo inválido.' }, 400);
  }

  // Diagnóstico: devolve o que esta chave aceita. Só nomes de modelo, nada mais.
  if (corpo.listarModelos) {
    return json({ modelos: await descobrirModelosFlash(chave) });
  }

  const global = await registrarChamadaGlobal(usuario);
  if (global?.excedeu) {
    return json({
      erro: `A produção já usou as ${LIMITE_DIARIO_GLOBAL} análises de hoje. Volta amanhã.`,
      usadasHoje: global.usadas,
    }, 429);
  }

  const prompt = (corpo.prompt || '').trim();
  if (!prompt) return json({ erro: 'Prompt vazio.' }, 400);
  if (prompt.length > LIMITE_PROMPT) {
    return json({ erro: `Prompt grande demais (${prompt.length} caracteres).` }, 413);
  }

  // Structured output: com um schema, o modelo é OBRIGADO a devolver JSON
  // válido naquele formato. Elimina cerca de markdown, texto de conversa e
  // campo faltando — os três motivos de o parse quebrar antes.
  const generationConfig: Record<string, unknown> = {};
  if (corpo.schema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = corpo.schema;
  }

  const requisicao = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
  });

  let ultimoErro: { status: number; mensagem: string; motivo?: string } =
    { status: 502, mensagem: 'Não foi possível falar com a IA.' };

  // Primeiro a lista conhecida; se nenhuma servir, pergunta ao Google o que
  // existe para esta chave. Assim um nome de modelo aposentado não derruba a
  // IA do app inteiro.
  let candidatos = modelosPermitidos();
  let jaDescobriu = false;

  for (let i = 0; i < candidatos.length; i++) {
    const modelo = candidatos[i];

    // Chegou ao fim da lista fixa sem sucesso: amplia com a descoberta.
    if (i === candidatos.length - 1 && !jaDescobriu) {
      jaDescobriu = true;
      const achados = (await descobrirModelosFlash(chave)).filter(m => !candidatos.includes(m));
      if (achados.length) candidatos = [...candidatos, ...achados];
    }

    try {
      const resposta = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${chave}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requisicao }
      );

      if (resposta.ok) {
        const dados = await resposta.json();
        const texto = dados?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (typeof texto !== 'string') {
          const motivo = dados?.candidates?.[0]?.finishReason || dados?.promptFeedback?.blockReason;
          return json({ erro: `A IA não retornou texto${motivo ? ` (${motivo})` : ''}.` }, 502);
        }
        modeloQueFunciona = modelo;
        return json({ texto, modelo });
      }

      const detalhe = await resposta.text();
      // Nunca devolve a chave nem a URL completa para o cliente.
      console.error(`Gemini recusou (${modelo}):`, resposta.status, detalhe.slice(0, 500));

      if (resposta.status === 400 && /API key not valid/i.test(detalhe)) {
        return json({ erro: 'A chave da IA no servidor é inválida.' }, 500);
      }

      // 404 = modelo não existe para esta chave. 429 = sem cota NESTE modelo
      // (o nível gratuito varia por modelo). Nos dois casos vale tentar o
      // próximo da lista antes de desistir — parar no primeiro 429 escondia
      // um modelo que teria funcionado.
      if (resposta.status === 404 || resposta.status === 429) {
        ultimoErro = {
          status: resposta.status === 429 ? 429 : 502,
          mensagem: resposta.status === 429
            ? 'Sem cota gratuita em nenhum modelo Flash agora. Espere alguns minutos e tente de novo.'
            : 'Nenhum modelo Flash está disponível para esta chave.',
          motivo: resumirErroDoGoogle(detalhe),
        };
        continue;
      }

      return json({
        erro: `A IA recusou a requisição (${resposta.status}).`,
        motivo: resumirErroDoGoogle(detalhe),
      }, 502);
    } catch (e) {
      console.error(`Falha ao chamar o Gemini (${modelo}):`, e);
      ultimoErro = { status: 502, mensagem: 'Não foi possível falar com a IA.', motivo: String(e).slice(0, 200) };
    }
  }

  return json({ erro: ultimoErro.mensagem, motivo: ultimoErro.motivo }, ultimoErro.status);
});
