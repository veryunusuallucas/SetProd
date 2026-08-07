/**
 * Edge Function `convite` — o único caminho para entrar num projeto por convite.
 *
 * POR QUE PRECISA EXISTIR
 * Quem está aceitando um convite ainda NÃO É MEMBRO do projeto. Toda a RLS de
 * `projeto_membros` se apoia em participação, então nenhuma política deixaria
 * essa pessoa entrar. A saída preguiçosa seria uma política do tipo "qualquer
 * um pode se inserir" — e aí bastaria saber o id de um projeto para entrar nele
 * e ler orçamento, roteiro e contatos de todo mundo.
 *
 * Aqui a decisão é do servidor: ele confere o token, a validade e se já foi
 * usado, e só então grava a participação com service role.
 *
 * Deploy:
 *   supabase functions deploy convite
 *
 * A SUPABASE_SERVICE_ROLE_KEY já existe no ambiente das functions; não precisa
 * criar secret. Ela passa por cima de toda a RLS — por isso este arquivo é
 * curto e não faz nada além do que precisa.
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

const URL_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Consulta o Postgres direto pelo PostgREST, com service role (sem RLS). */
async function comoServidor(caminho: string, init: RequestInit = {}) {
  return fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

/** Quem está chamando, a partir do JWT que o app manda. */
async function usuarioDaRequisicao(req: Request): Promise<{ id: string; email?: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;

  const resposta = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: auth },
  });
  if (!resposta.ok) return null;

  const usuario = await resposta.json();
  return usuario?.id ? { id: usuario.id, email: usuario.email } : null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!URL_BASE || !SERVICE_ROLE) {
      return responder({ erro: 'Função mal configurada no servidor.' }, 500);
    }

    const usuario = await usuarioDaRequisicao(req);
    if (!usuario) {
      return responder({ erro: 'Entre na sua conta antes de aceitar o convite.' }, 401);
    }

    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== 'string') {
      return responder({ erro: 'Convite inválido.' }, 400);
    }

    // 1. O convite existe?
    const busca = await comoServidor(
      `convites?token=eq.${encodeURIComponent(token)}&select=token,projeto_id,papel,apelido,expira_em,usado_por`
    );
    const achados = await busca.json();
    const convite = Array.isArray(achados) ? achados[0] : null;

    if (!convite) {
      return responder({ erro: 'Este convite não existe. Peça um link novo.' }, 404);
    }

    // 2. Ainda vale?
    if (convite.usado_por) {
      // Se quem já usou foi a própria pessoa, isto é só um link reaberto —
      // dizer "já foi usado" assustaria à toa.
      if (convite.usado_por === usuario.id) {
        return responder({ projeto_id: convite.projeto_id, ja_era_membro: true });
      }
      return responder({ erro: 'Este convite já foi usado por outra pessoa.' }, 409);
    }

    if (new Date(convite.expira_em).getTime() < Date.now()) {
      return responder({ erro: 'Este convite expirou. Peça um link novo.' }, 410);
    }

    // 3. Já é membro? (link aberto duas vezes, por exemplo)
    const jaMembro = await comoServidor(
      `projeto_membros?projeto_id=eq.${encodeURIComponent(convite.projeto_id)}&usuario_id=eq.${usuario.id}&select=projeto_id`
    );
    const membros = await jaMembro.json();
    if (Array.isArray(membros) && membros.length) {
      return responder({ projeto_id: convite.projeto_id, ja_era_membro: true });
    }

    // 4. Entra.
    const entrada = await comoServidor('projeto_membros', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        projeto_id: convite.projeto_id,
        usuario_id: usuario.id,
        papel: convite.papel || 'equipe',
        apelido: convite.apelido || 'Equipe B',
      }),
    });

    if (!entrada.ok) {
      const detalhe = await entrada.text();
      console.error('[convite] falha ao inserir participação:', detalhe);
      return responder({ erro: 'Não consegui te adicionar ao projeto.' }, 500);
    }

    // 5. Queima o token.
    //
    // Só depois da entrada dar certo: queimar antes deixaria a pessoa de fora
    // com um convite gasto na mão, sem jeito de tentar de novo.
    //
    // O filtro `usado_por=is.null` é o que segura duas pessoas clicando no mesmo
    // link ao mesmo tempo — a segunda atualiza zero linhas.
    await comoServidor(
      `convites?token=eq.${encodeURIComponent(token)}&usado_por=is.null`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ usado_por: usuario.id, usado_em: new Date().toISOString() }),
      }
    );

    return responder({ projeto_id: convite.projeto_id, ja_era_membro: false });
  } catch (erro) {
    console.error('[convite] erro inesperado:', erro);
    return responder({ erro: 'Erro inesperado ao aceitar o convite.' }, 500);
  }
});
