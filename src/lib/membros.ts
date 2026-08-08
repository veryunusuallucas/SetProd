import { supabase, supabaseConfigurado } from './supabase';

/**
 * Participação: quem entra em qual projeto.
 *
 * A regra de verdade mora na RLS do Postgres (`supabase/sql/multiusuario.sql`),
 * não aqui. O que este arquivo faz é conversar com ela — e guardar uma cópia
 * local para o app continuar funcionando sem internet.
 */

export type PapelMembro = 'dono' | 'equipe' | 'leitura';

export interface Participacao {
  projeto_id: string;
  usuario_id: string;
  papel: PapelMembro;
  apelido?: string | null;
  /** Quem eu sou na equipe desta produção (id do perfil no cadastro). */
  perfil_id?: string | null;
  criado_em?: string;
}

export interface Convite {
  token: string;
  projeto_id: string;
  nome_projeto?: string | null;
  papel: PapelMembro;
  apelido?: string | null;
  expira_em: string;
  usado_por?: string | null;
}

const TABELA_MEMBROS = 'projeto_membros';
const TABELA_CONVITES = 'convites';

/** Quanto tempo o convite vale. Curto porque link de convite vaza fácil. */
const DIAS_DE_VALIDADE = 7;

// ---------------------------------------------------------------------------
// Cópia local
// ---------------------------------------------------------------------------

/**
 * As participações ficam espelhadas no localStorage.
 *
 * Não é cache por velocidade: é o que faz o app abrir sem internet. Sem isto, a
 * tela de um projeto ficaria esperando uma resposta que não vem — e o app é
 * offline-first desde o começo.
 */
const CHAVE_LOCAL = 'setprod_participacoes';

function lerLocal(): Participacao[] {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    return bruto ? JSON.parse(bruto) : [];
  } catch {
    return [];
  }
}

function gravarLocal(lista: Participacao[]) {
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista));
  // Avisa quem já está montado — o `storage` do navegador só dispara em OUTRAS
  // abas, então sem isto a própria aba que mudou não se atualizaria.
  window.dispatchEvent(new Event('setprod-participacoes'));
}

export function participacoesLocais(): Participacao[] {
  return lerLocal();
}

export function participacaoLocal(projetoId: string): Participacao | undefined {
  return lerLocal().find(p => p.projeto_id === projetoId);
}

export function limparParticipacoesLocais() {
  localStorage.removeItem(CHAVE_LOCAL);
  window.dispatchEvent(new Event('setprod-participacoes'));
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

/** Busca no servidor de quais projetos eu participo e atualiza a cópia local. */
export async function sincronizarParticipacoes(): Promise<Participacao[]> {
  if (!supabaseConfigurado) return lerLocal();

  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao?.session?.user;
  if (!usuario) return lerLocal();

  const { data, error } = await supabase
    .from(TABELA_MEMBROS)
    .select('projeto_id, usuario_id, papel, apelido, perfil_id, criado_em')
    .eq('usuario_id', usuario.id);

  if (error) {
    // Offline ou servidor fora: a cópia local segue valendo. Não é hora de
    // trancar ninguém para fora do próprio trabalho.
    console.warn('[SetProd] Não consegui ler as participações:', error.message);
    return lerLocal();
  }

  const lista = (data || []) as Participacao[];
  gravarLocal(lista);
  return lista;
}

/** Quem mais está neste projeto. Serve para a tela de compartilhamento. */
export async function membrosDoProjeto(projetoId: string): Promise<Participacao[]> {
  if (!supabaseConfigurado) return [];

  const { data, error } = await supabase
    .from(TABELA_MEMBROS)
    .select('projeto_id, usuario_id, papel, apelido, perfil_id, criado_em')
    .eq('projeto_id', projetoId)
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return (data || []) as Participacao[];
}

// ---------------------------------------------------------------------------
// Entrar e sair
// ---------------------------------------------------------------------------

/**
 * Registra quem criou o projeto como primeiro membro.
 *
 * TEM QUE RODAR ANTES DE QUALQUER DADO SUBIR. A regra do servidor só aceita o
 * fundador enquanto o projeto está vazio — sem membro nenhum e sem nenhuma
 * linha no espelho. É assim que um projeto abandonado deixa de ser reclamável
 * por quem souber o id; o preço é esta ordem.
 *
 * Falhar aqui não impede de trabalhar: o projeto existe no IndexedDB de todo
 * jeito. Só não será compartilhável até a participação entrar.
 */
export async function entrarComoFundador(projetoId: string, apelido = 'Equipe A'): Promise<boolean> {
  if (!supabaseConfigurado) return false;

  // Tudo dentro do try: esta função é chamada sem `await` na criação do
  // projeto, e uma promessa rejeitada solta aí vira erro não tratado no
  // console — sem nada quebrado, mas parecendo que quebrou.
  try {
    const { data: sessao } = await supabase.auth.getSession();
    const usuario = sessao?.session?.user;
    if (!usuario) return false;

    const { error } = await supabase.from(TABELA_MEMBROS).insert({
      projeto_id: projetoId,
      usuario_id: usuario.id,
      papel: 'dono',
      apelido,
    });

    if (error) {
      console.warn('[SetProd] Não consegui registrar a participação do fundador:', error.message);
      return false;
    }

    await sincronizarParticipacoes();
    return true;
  } catch (e) {
    console.warn('[SetProd] Falha ao registrar o fundador:', e);
    return false;
  }
}

/**
 * Garante que eu participo deste projeto, se ele for meu.
 *
 * Existe porque registrar o fundador não segura mais a tela na hora de criar:
 * se aquela tentativa falhou (sem internet, servidor fora), ela precisa de uma
 * segunda chance — e a segunda chance é abrir o projeto.
 *
 * Não força nada: só tenta quando o projeto ainda está livre. Se outra pessoa
 * já é dona, o servidor recusa, que é exatamente o que deve acontecer.
 */
export async function garantirParticipacao(projetoId: string, apelido = 'Equipe A'): Promise<void> {
  if (!supabaseConfigurado) return;
  if (participacaoLocal(projetoId)) return;

  try {
    const lista = await sincronizarParticipacoes();
    if (lista.some(p => p.projeto_id === projetoId)) return;

    const { data: livre } = await supabase.rpc('projeto_livre_para_fundar', { p_projeto: projetoId });
    if (livre) await entrarComoFundador(projetoId, apelido);
  } catch (e) {
    console.warn('[SetProd] Não consegui conferir a participação:', e);
  }
}

/**
 * Diz quem eu sou na equipe desta produção.
 *
 * Vai para o servidor porque é sobre a pessoa, não sobre o aparelho: quem abre
 * o app no celular depois de configurar no computador continua sendo a mesma
 * pessoa. (Antes isto era o dropdown de simulação, e morria no localStorage.)
 */
export async function definirMeuPerfil(projetoId: string, perfilId: string | null): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao?.session?.user;
  if (!usuario) return;

  const { error } = await supabase
    .from(TABELA_MEMBROS)
    .update({ perfil_id: perfilId })
    .eq('projeto_id', projetoId)
    .eq('usuario_id', usuario.id);

  if (error) throw error;
  await sincronizarParticipacoes();
}

/** Sai do projeto. Não apaga nada: só desfaz o vínculo desta conta. */
export async function sairDoProjeto(projetoId: string): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession();
  const usuario = sessao?.session?.user;
  if (!usuario) return;

  const { error } = await supabase
    .from(TABELA_MEMBROS)
    .delete()
    .eq('projeto_id', projetoId)
    .eq('usuario_id', usuario.id);

  if (error) throw error;
  await sincronizarParticipacoes();
}

/**
 * Apaga o projeto do servidor de vez — espelho, convites e participações.
 *
 * O apagar do dia a dia é lápide; isto é a saída definitiva, para o projeto que
 * acabou. Sem ela o espelho de um projeto morto ficaria no banco para sempre.
 */
export async function purgarProjetoNoServidor(projetoId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;
  const { data, error } = await supabase.rpc('purgar_projeto', { p_projeto: projetoId });
  if (error) throw error;
  await sincronizarParticipacoes();
  return (data as number) ?? 0;
}

// ---------------------------------------------------------------------------
// Quem está usando
// ---------------------------------------------------------------------------

export type Persona = 'admin' | 'equipe_a' | 'equipe_b' | 'desconhecido';

/**
 * Quem é a pessoa logada, do ponto de vista da tela inicial.
 *
 * Não olha o e-mail: e-mail muda, e chumbar endereço no código faria a
 * saudação errar no dia em que você trocar de conta. Sai do que o servidor já
 * sabe — se é super-admin, e qual apelido a participação dá a esta conta.
 */
export async function descobrirPersona(): Promise<Persona> {
  if (!supabaseConfigurado) return 'desconhecido';

  try {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao?.session?.user) return 'desconhecido';

    const { data: admin } = await supabase.rpc('e_admin');
    if (admin) return 'admin';

    // O apelido vem da participação ("Equipe A" para quem criou, "Equipe B"
    // para quem entrou por convite). Uso a mais antiga: é a que define a
    // pessoa, e não o último projeto em que ela entrou de carona.
    const participacoes = participacoesLocais().length
      ? participacoesLocais()
      : await sincronizarParticipacoes();

    const maisAntiga = [...participacoes].sort(
      (a, b) => (a.criado_em || '').localeCompare(b.criado_em || '')
    )[0];

    if (!maisAntiga?.apelido) return 'desconhecido';
    return /\bB\b/i.test(maisAntiga.apelido) ? 'equipe_b' : 'equipe_a';
  } catch {
    return 'desconhecido';
  }
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

/** Token de convite: 32 hex de fonte criptográfica, não `Math.random`. */
function gerarToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function criarConvite(
  projetoId: string,
  nomeProjeto: string,
  apelido = 'Equipe B'
): Promise<Convite> {
  if (!supabaseConfigurado) throw new Error('Supabase não está configurado neste ambiente.');

  const token = gerarToken();
  const expira = new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from(TABELA_CONVITES)
    .insert({
      token,
      projeto_id: projetoId,
      nome_projeto: nomeProjeto,
      papel: 'equipe',
      apelido,
      expira_em: expira.toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as Convite;
}

export async function convitesDoProjeto(projetoId: string): Promise<Convite[]> {
  const { data, error } = await supabase
    .from(TABELA_CONVITES)
    .select('token, projeto_id, nome_projeto, papel, apelido, expira_em, usado_por')
    .eq('projeto_id', projetoId)
    .order('criado_em', { ascending: false });

  if (error) throw error;
  return (data || []) as Convite[];
}

export async function revogarConvite(token: string): Promise<void> {
  const { error } = await supabase.from(TABELA_CONVITES).delete().eq('token', token);
  if (error) throw error;
}

/** Lê o convite para a tela de aceite mostrar de que projeto se trata. */
export async function lerConvite(token: string): Promise<Convite | null> {
  const { data, error } = await supabase
    .from(TABELA_CONVITES)
    .select('token, projeto_id, nome_projeto, papel, apelido, expira_em, usado_por')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  return (data as Convite) ?? null;
}

/**
 * Aceita o convite.
 *
 * Passa por Edge Function e não por escrita direta porque quem aceita AINDA NÃO
 * É MEMBRO — nenhuma política baseada em participação o deixaria entrar. E abrir
 * uma política para "qualquer um se inserir" daria a qualquer pessoa logada a
 * chave de qualquer projeto, bastando saber o id. A função roda com service
 * role e é o único caminho.
 */
export async function aceitarConvite(token: string): Promise<{ projeto_id: string }> {
  const { data, error } = await supabase.functions.invoke('convite', { body: { token } });

  if (error) {
    // O corpo do erro traz a razão de verdade (expirado, já usado, inexistente);
    // o `error.message` sozinho diz só "non-2xx status code".
    const detalhe = await lerDetalheDoErro(error);
    throw new Error(detalhe || error.message);
  }
  if (data?.erro) throw new Error(data.erro);

  await sincronizarParticipacoes();
  return { projeto_id: data.projeto_id };
}

async function lerDetalheDoErro(error: any): Promise<string | null> {
  try {
    const corpo = await error?.context?.json?.();
    return corpo?.erro ?? null;
  } catch {
    return null;
  }
}

/** URL que a Equipe A manda para a Equipe B. */
export function linkDoConvite(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}convite/${token}`.replace(/([^:])\/\//g, '$1/');
}
