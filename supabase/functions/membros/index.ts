/**
 * Edge Function `membros` — administrar quem participa da produção.
 *
 * POR QUE PRECISA EXISTIR
 * Três coisas que a tela precisa e que a RLS, DE PROPÓSITO, não permite:
 *
 * 1. LER O E-MAIL DE OUTRA PESSOA. `projeto_membros` guarda só o `usuario_id`
 *    (uuid), e a RLS de `auth.users` não deixa o app ler o e-mail de ninguém
 *    além de si. Sem isso a lista de membros mostra uuid.
 *
 * 2. MUDAR O PAPEL. `multiusuario.sql` revoga o update geral em
 *    `projeto_membros` e concede só `perfil_id`. Isso é a trava que impede um
 *    membro de se auto-promover a dono editando a própria linha — e ela não
 *    pode ser afrouxada para o painel funcionar.
 *
 * 3. EXPULSAR. A política de delete é `usuario_id = auth.uid() or e_admin()`:
 *    dá para SAIR, não para tirar outra pessoa.
 *
 * ⚠️ SERVICE ROLE PASSA POR CIMA DE TODA A RLS. Por isso cada ação aqui confere
 * quem está chamando ANTES de fazer qualquer coisa. Uma função assim sem
 * checagem é um endpoint que entrega o e-mail de qualquer conta a quem souber um
 * `projeto_id`.
 *
 * Deploy:
 *   supabase functions deploy membros
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

/** Os papéis que esta função aceita gravar. `dono` não se concede por aqui. */
const PAPEIS = ['admin', 'equipe', 'leitura'];

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

async function usuarioDaRequisicao(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get('Authorization');
  if (!auth) return null;
  const r = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: auth },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id } : null;
}

interface Participacao {
  usuario_id: string;
  papel: string;
  apelido: string | null;
  perfil_id: string | null;
}

/** Todos os membros do projeto, lidos com service role. */
async function membrosDo(projetoId: string): Promise<Participacao[]> {
  const r = await comoServidor(
    `projeto_membros?projeto_id=eq.${encodeURIComponent(projetoId)}&select=usuario_id,papel,apelido,perfil_id`
  );
  const dados = await r.json();
  return Array.isArray(dados) ? dados : [];
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    if (!URL_BASE || !SERVICE_ROLE) {
      return responder({ erro: 'Função mal configurada no servidor.' }, 500);
    }

    const usuario = await usuarioDaRequisicao(req);
    if (!usuario) return responder({ erro: 'Entre na sua conta.' }, 401);

    const { acao, projeto_id, alvo, papel, perfil_id } = await req.json().catch(() => ({}));
    if (!projeto_id) return responder({ erro: 'Produção não informada.' }, 400);

    const membros = await membrosDo(projeto_id);
    const eu = membros.find(m => m.usuario_id === usuario.id);

    /*
      A checagem que sustenta tudo.

      Sem ela, esta função vira um endereço que devolve o e-mail de qualquer
      conta para quem souber um `projeto_id` — e `projeto_id` aparece na URL do
      app, então "saber um" é trivial.
    */
    if (!eu) return responder({ erro: 'Você não participa desta produção.' }, 403);

    // -----------------------------------------------------------------------
    // listar — quem é quem, com e-mail
    // -----------------------------------------------------------------------
    if (acao === 'listar') {
      const comIdentidade = await Promise.all(
        membros.map(async m => {
          const r = await fetch(`${URL_BASE}/auth/v1/admin/users/${m.usuario_id}`, {
            headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
          });
          const u = r.ok ? await r.json() : null;
          return {
            ...m,
            email: u?.email ?? null,
            nome: u?.user_metadata?.nome ?? null,
          };
        })
      );
      return responder({ membros: comIdentidade });
    }

    // Daqui para baixo é administração, e exige mais que ser membro.
    const gere = eu.papel === 'dono' || eu.papel === 'admin';
    if (!gere) return responder({ erro: 'Só quem é dono ou administra pode fazer isso.' }, 403);

    if (!alvo) return responder({ erro: 'Pessoa não informada.' }, 400);
    const oAlvo = membros.find(m => m.usuario_id === alvo);
    if (!oAlvo) return responder({ erro: 'Essa pessoa não está nesta produção.' }, 404);

    /*
      Admin não mexe em dono.

      Sem esta linha, o "posso delegar sem entregar a chave de destruir" não
      valeria nada: bastaria o admin rebaixar o dono a 'equipe' e se promover em
      seguida.
    */
    if (oAlvo.papel === 'dono' && eu.papel !== 'dono') {
      return responder({ erro: 'Só o dono pode mexer no próprio papel.' }, 403);
    }

    // -----------------------------------------------------------------------
    // mudar_papel
    // -----------------------------------------------------------------------
    if (acao === 'mudar_papel') {
      if (!PAPEIS.includes(papel)) {
        return responder({ erro: 'Papel inválido.' }, 400);
      }

      /*
        O ÚLTIMO DONO NÃO PODE SE REBAIXAR.

        Produção sem dono é produção que ninguém consegue destruir nem
        administrar — e `projeto_livre_para_fundar` não salva, porque ela só
        libera projeto VAZIO, e este tem dados. Seria um beco sem saída
        silencioso: tudo continua funcionando até o dia em que alguém precisa
        convidar ou apagar.
      */
      if (oAlvo.papel === 'dono') {
        const outrosDonos = membros.filter(m => m.papel === 'dono' && m.usuario_id !== alvo);
        if (outrosDonos.length === 0) {
          return responder({
            erro: 'Esta é a única pessoa dona da produção. Passe a posse para outra antes de mudar o papel dela.',
          }, 409);
        }
      }

      const r = await comoServidor(
        `projeto_membros?projeto_id=eq.${encodeURIComponent(projeto_id)}&usuario_id=eq.${alvo}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ papel }) }
      );
      if (!r.ok) {
        console.error('[membros] falha ao mudar papel:', await r.text());
        return responder({ erro: 'Não consegui mudar o papel.' }, 500);
      }
      return responder({ ok: true });
    }

    // -----------------------------------------------------------------------
    // remover
    // -----------------------------------------------------------------------
    if (acao === 'remover') {
      // Mesmo raciocínio do rebaixamento: tirar o último dono deixa a produção
      // órfã, e aqui seria pior — não haveria nem como desfazer.
      if (oAlvo.papel === 'dono') {
        const outrosDonos = membros.filter(m => m.papel === 'dono' && m.usuario_id !== alvo);
        if (outrosDonos.length === 0) {
          return responder({
            erro: 'Não dá para remover a única pessoa dona da produção.',
          }, 409);
        }
      }

      const r = await comoServidor(
        `projeto_membros?projeto_id=eq.${encodeURIComponent(projeto_id)}&usuario_id=eq.${alvo}`,
        { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
      );
      if (!r.ok) {
        console.error('[membros] falha ao remover:', await r.text());
        return responder({ erro: 'Não consegui remover a pessoa.' }, 500);
      }
      return responder({ ok: true });
    }

    // -----------------------------------------------------------------------
    // vincular_perfil — o dono diz quem é quem na ficha
    // -----------------------------------------------------------------------
    if (acao === 'vincular_perfil') {
      // Lido junto com o resto no topo: o corpo da requisição só pode ser
      // consumido uma vez, e um `req.clone()` depois da leitura não ajuda.
      const perfilId = perfil_id ?? null;
      const r = await comoServidor(
        `projeto_membros?projeto_id=eq.${encodeURIComponent(projeto_id)}&usuario_id=eq.${alvo}`,
        { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ perfil_id: perfilId }) }
      );
      if (!r.ok) {
        console.error('[membros] falha ao vincular perfil:', await r.text());
        return responder({ erro: 'Não consegui salvar o vínculo.' }, 500);
      }
      return responder({ ok: true });
    }

    return responder({ erro: 'Ação desconhecida.' }, 400);
  } catch (erro) {
    console.error('[membros] erro inesperado:', erro);
    return responder({ erro: 'Erro inesperado.' }, 500);
  }
});
