/**
 * Edge Function `enviar-od` — manda a Ordem do Dia por email para a equipe.
 *
 * POR QUE NO SERVIDOR
 * A chave do Resend não pode existir no navegador. Qualquer chave que chegue ao
 * app é pública na prática: está no bundle, no DevTools e no cache do service
 * worker. Quem a pegasse mandaria email em nome do domínio da produção — e é o
 * domínio que carrega a reputação de entrega.
 *
 * É a mesma decisão da function `gemini`: segredo mora no Supabase, e o app só
 * consegue pedir uma ação, nunca ler a chave.
 *
 * Deploy:
 *   supabase functions deploy enviar-od
 *   supabase secrets set RESEND_API_KEY=...
 *   supabase secrets set REMETENTE_OD="Produção <od@seudominio.com.br>"
 *
 * ⚠️ O DOMÍNIO PRECISA SER VERIFICADO NO RESEND (registros DNS, uma vez).
 * Sem isso o Resend só entrega para o email do dono da conta, e o resto vai
 * para spam ou nem sai. Enquanto não houver domínio, dá para usar o remetente
 * de teste do Resend — que só manda para você mesmo.
 */

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const CHAVE = Deno.env.get('RESEND_API_KEY') ?? '';
const REMETENTE = Deno.env.get('REMETENTE_OD') ?? 'SetProd <onboarding@resend.dev>';

/** Teto por chamada. Uma OD vai para a equipe, não para uma lista de mala direta. */
const MAX_DESTINATARIOS = 60;

interface Anexo {
  /** Nome do arquivo como ele chega na caixa de entrada. */
  filename: string;
  /** Conteúdo em base64. */
  content: string;
}

interface Pedido {
  para: string[];
  assunto: string;
  html: string;
  anexos?: Anexo[];
}

function emailValido(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Use POST.' }, 405);

  /*
    Só entra quem está logado.

    A function fica atrás do gateway do Supabase, que já valida a assinatura do
    JWT — mas ele aceita a chave anônima também, e a anônima está no app. Exigir
    um `sub` no token é o que separa "veio do meu app" de "veio de alguém
    logado", e sem isso a function vira um relay de email aberto.
  */
  const auth = req.headers.get('Authorization') || '';
  let usuario = '';
  try {
    const payload = JSON.parse(atob(auth.replace(/^Bearer\s+/i, '').split('.')[1]));
    usuario = String(payload.sub || '');
  } catch {
    usuario = '';
  }
  if (!usuario) return responder({ error: 'Faça login para enviar a Ordem do Dia.' }, 401);

  if (!CHAVE) {
    return responder({
      error: 'O envio de email ainda não foi configurado. Falta a chave do Resend no Supabase (RESEND_API_KEY).',
    }, 503);
  }

  let pedido: Pedido;
  try {
    pedido = await req.json();
  } catch {
    return responder({ error: 'Corpo inválido.' }, 400);
  }

  const para = (pedido.para || []).map(e => e.trim().toLowerCase()).filter(emailValido);
  const unicos = [...new Set(para)];

  if (unicos.length === 0) {
    return responder({ error: 'Nenhum email válido na lista. Cadastre o email da equipe nas fichas.' }, 400);
  }
  if (unicos.length > MAX_DESTINATARIOS) {
    return responder({ error: `São ${unicos.length} destinatários; o limite por envio é ${MAX_DESTINATARIOS}.` }, 400);
  }
  if (!pedido.assunto?.trim() || !pedido.html?.trim()) {
    return responder({ error: 'Assunto e conteúdo são obrigatórios.' }, 400);
  }

  /*
    A equipe vai em BCC, e o TO é o próprio remetente.

    Com todo mundo no TO, cada pessoa recebe a lista completa de emails da
    equipe — dado pessoal de terceiros, distribuído sem que ninguém tenha
    concordado. E qualquer "responder a todos" vira uma thread com a produção
    inteira dentro.
  */
  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CHAVE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: REMETENTE,
      to: [REMETENTE.replace(/^.*<|>$/g, '')],
      bcc: unicos,
      subject: pedido.assunto.trim(),
      html: pedido.html,
      attachments: (pedido.anexos || []).map(a => ({ filename: a.filename, content: a.content })),
    }),
  });

  const corpo = await resposta.text();

  if (!resposta.ok) {
    // A mensagem do Resend diz o que está errado (domínio não verificado,
    // remetente inválido), e é justamente o que faz a diferença entre "arrume o
    // DNS" e "arrume o endereço". Vai truncada e sem nada que pareça chave.
    const detalhe = corpo.replace(/re_[\w-]+/g, '[chave]').slice(0, 300);
    return responder({ error: `O serviço de email recusou o envio (${resposta.status}). ${detalhe}` }, 502);
  }

  return responder({ ok: true, enviados: unicos.length });
});
