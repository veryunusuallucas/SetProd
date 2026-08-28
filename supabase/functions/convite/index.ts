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

/**
 * Os papéis que um convite pode conceder.
 *
 * Precisa existir aqui e não só no app: esta função roda com service role e
 * passa por cima de toda a RLS, então o que ela grava em `projeto_membros` é
 * lei. Ela lia `convite.papel` cru do banco e mandava direto para a inserção —
 * um papel inventado viraria um membro com papel que `permissoes.ts` não
 * conhece, e a tela dele ficaria sem botão nenhum sem ninguém entender por quê.
 *
 * `dono` está fora de propósito: posse se transfere numa ação própria, com
 * confirmação, e não por um link que pode ser encaminhado no WhatsApp.
 *
 * ⚠️ Esta lista tem que bater com `PAPEIS_CONVIDAVEIS` em `src/lib/permissoes.ts`
 * e com o `check` de `papel` em `supabase/sql/papeis.sql`. Três lugares, mesma
 * lista — se divergirem, o sintoma é uma inserção que falha longe daqui.
 */
const PAPEIS_PERMITIDOS = ['admin', 'equipe', 'leitura'];

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
async function usuarioDaRequisicao(
  req: Request
): Promise<{ id: string; email?: string; nome?: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;

  const resposta = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: auth },
  });
  if (!resposta.ok) return null;

  const usuario = await resposta.json();
  if (!usuario?.id) return null;
  return {
    id: usuario.id,
    email: usuario.email,
    // Veio do `signUp({ options: { data: { nome } } })` da tela de cadastro.
    nome: usuario.user_metadata?.nome,
  };
}

/**
 * Como a pessoa vai aparecer enquanto não tiver ficha vinculada.
 *
 * O padrão era chumbado em "Equipe B", herança de quando o app tinha dois lados.
 * Agora sai de quem realmente aceitou o convite. Nunca o e-mail inteiro: ele
 * aparece na ata e na lista de membros, e expor o endereço de todo mundo é
 * vazamento que ninguém pediu.
 *
 * ⚠️ Mesma regra de `apelidoDaConta` em `src/lib/membros.ts`. Se mudar lá, mude
 * aqui — os dois preenchem a mesma coluna.
 */
function apelidoDaConta(usuario: { email?: string; nome?: string }): string {
  const nome = (usuario.nome || '').trim();
  if (nome) return nome;
  return (usuario.email || '').split('@')[0] || 'Sem nome';
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
      `convites?token=eq.${encodeURIComponent(token)}&select=token,projeto_id,papel,apelido,expira_em,usado_por,perfil_id,multiuso,ativo,usos`
    );
    const achados = await busca.json();
    const convite = Array.isArray(achados) ? achados[0] : null;

    if (!convite) {
      return responder({ erro: 'Este convite não existe. Peça um link novo.' }, 404);
    }

    /*
      2. Ainda vale?

      DOIS MODOS DE CONVITE, e a ordem das checagens importa.

      O de USO ÚNICO queima em `usado_por` — é o padrão, e limita o estrago de um
      link encaminhado sem querer.

      O MULTIUSO não queima: aceita quem chegar enquanto estiver ligado. Serve
      para mandar um link no grupo da produção em vez de cinco links diferentes.
      Em troca, quem tiver o link entra — por isso o interruptor `ativo`, que é
      a forma de fechar a porta sem esperar os 7 dias.

      `ativo` é conferido ANTES de tudo: um convite desligado não deveria nem
      dizer se expirou ou se já foi usado. Quanto menos um link morto conta sobre
      o projeto, melhor.
    */
    if (convite.ativo === false) {
      return responder({ erro: 'Este link foi desligado por quem administra a produção.' }, 403);
    }

    if (!convite.multiuso && convite.usado_por) {
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
    //
    // O papel passa pela lista permitida antes de virar participação. Cair no
    // 'equipe' quando o valor não é reconhecido é o lado seguro: dá o papel
    // comum, nunca um mais poderoso do que o convite pedia.
    const papel = PAPEIS_PERMITIDOS.includes(convite.papel) ? convite.papel : 'equipe';

    /*
      O vínculo com a ficha da equipe entra JUNTO com a participação.

      Podia ser um update depois, mas não deve: se o segundo passo falhasse, a
      pessoa entraria na produção sem saber quem é — e o único jeito de
      consertar seria ela achar o dropdown escondido em "Compartilhar". Numa
      inserção só, ou entra vinculada ou não entra.

      Se o perfil já tiver dono, o índice único recusa a linha inteira. Nesse
      caso a gente tenta de novo sem o vínculo: ficar de fora da produção seria
      pior que entrar sem saber quem é.
    */
    const linha: Record<string, unknown> = {
      projeto_id: convite.projeto_id,
      usuario_id: usuario.id,
      papel,
      apelido: convite.apelido || apelidoDaConta(usuario),
    };
    if (convite.perfil_id) linha.perfil_id = convite.perfil_id;

    let entrada = await comoServidor('projeto_membros', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(linha),
    });

    if (!entrada.ok && convite.perfil_id) {
      const detalhe = await entrada.text();
      console.warn('[convite] entrada com perfil_id falhou, tentando sem:', detalhe);
      delete linha.perfil_id;
      entrada = await comoServidor('projeto_membros', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(linha),
      });
    }

    if (!entrada.ok) {
      const detalhe = await entrada.text();
      console.error('[convite] falha ao inserir participação:', detalhe);
      return responder({ erro: 'Não consegui te adicionar ao projeto.' }, 500);
    }

    /*
      5. Marca o uso.

      Só depois da entrada dar certo: marcar antes deixaria a pessoa de fora com
      um convite gasto na mão, sem jeito de tentar de novo.

      NO USO ÚNICO, queima. O filtro `usado_por=is.null` é o que segura duas
      pessoas clicando no mesmo link ao mesmo tempo — a segunda atualiza zero
      linhas e não entra.

      NO MULTIUSO, só conta. `usado_por` fica intacto, senão o próximo cairia no
      "já foi usado por outra pessoa". O contador serve para a tela dizer quantas
      pessoas entraram — que é a informação que decide quando desligar o link.
    */
    if (convite.multiuso) {
      await comoServidor(`convites?token=eq.${encodeURIComponent(token)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          usos: (convite.usos ?? 0) + 1,
          usado_em: new Date().toISOString(),
        }),
      });
    } else {
      await comoServidor(
        `convites?token=eq.${encodeURIComponent(token)}&usado_por=is.null`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            usado_por: usuario.id,
            usado_em: new Date().toISOString(),
            usos: 1,
          }),
        }
      );
    }

    // `perfil_id` volta para a tela saber se ainda precisa perguntar quem a
    // pessoa é. Sem convite nominal, ele vem nulo e a tela de aceite assume.
    return responder({
      projeto_id: convite.projeto_id,
      ja_era_membro: false,
      perfil_id: linha.perfil_id ?? null,
    });
  } catch (erro) {
    console.error('[convite] erro inesperado:', erro);
    return responder({ erro: 'Erro inesperado ao aceitar o convite.' }, 500);
  }
});
