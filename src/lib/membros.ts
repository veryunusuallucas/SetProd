import { supabase, supabaseConfigurado } from './supabase';
import { linkDoApp } from './urlPublica';
import { papelConvidavel, type PapelConvidavel } from './permissoes';

/**
 * Participação: quem entra em qual projeto.
 *
 * A regra de verdade mora na RLS do Postgres (`supabase/sql/multiusuario.sql`),
 * não aqui. O que este arquivo faz é conversar com ela — e guardar uma cópia
 * local para o app continuar funcionando sem internet.
 */

/**
 * Os quatro papéis, e só estes.
 *
 * `admin` é o mais novo e existe para um caso concreto: delegar a produção sem
 * entregar a chave de destruir. A lista é fechada e o banco tem um `check` com
 * exatamente estes valores (`supabase/sql/papeis.sql`) — inventar um quinto aqui
 * faria a inserção falhar no servidor, não na tela.
 *
 * O que cada um pode está em `permissoes.ts`, num lugar só.
 */
export type PapelMembro = 'dono' | 'admin' | 'equipe' | 'leitura';

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
  /** Quem a pessoa é na equipe desta produção, quando o convite já sabe. */
  perfil_id?: string | null;
  /** Só para conferir na tela. Nunca trava o aceite — ver `AceitarConvite`. */
  email_esperado?: string | null;
}

/**
 * As colunas do convite, num lugar só.
 *
 * Estavam escritas à mão em cada consulta, e uma coluna nova precisava ser
 * lembrada em três lugares — esquecer um faz o campo chegar `undefined` na tela,
 * sem erro nenhum.
 */
const CAMPOS_CONVITE =
  'token, projeto_id, nome_projeto, papel, apelido, expira_em, usado_por, perfil_id, email_esperado';

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
/**
 * Como a pessoa vai aparecer quando o app ainda não sabe quem ela é na ficha.
 *
 * O padrão era "Equipe A" / "Equipe B", herança de quando o app tinha dois lados
 * e duas máquinas. Numa produção de verdade ninguém se chama assim — e o rótulo
 * ainda roubava o nome do conceito que existe no set, a segunda unidade.
 *
 * A ordem é: o nome que a pessoa deu no cadastro, senão a parte do e-mail antes
 * do @. Nunca o e-mail inteiro: ele aparece na ata e na lista de membros, e
 * expor o endereço de todo mundo é vazamento que ninguém pediu.
 */
export function apelidoDaConta(usuario: { email?: string; user_metadata?: any } | null | undefined): string {
  const nome = (usuario?.user_metadata?.nome || '').trim();
  if (nome) return nome;
  const antesDoArroba = (usuario?.email || '').split('@')[0];
  return antesDoArroba || 'Sem nome';
}

export async function entrarComoFundador(projetoId: string, apelido?: string): Promise<boolean> {
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
      apelido: apelido || apelidoDaConta(usuario),
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
export async function garantirParticipacao(projetoId: string, apelido?: string): Promise<void> {
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
 * saudação errar no dia em que você trocar de conta.
 *
 * SAI DO PAPEL, NÃO DO APELIDO.
 * Antes isto lia o apelido da participação e procurava a letra "B" nele. Era
 * frágil por dois motivos: o apelido é texto livre, e um dia alguém se chamaria
 * "Beatriz" e viraria "equipe B" por causa de uma letra. E agora que o apelido
 * é o NOME da pessoa, essa heurística erraria o tempo todo.
 *
 * O que a distinção sempre quis dizer, no fundo, é isto — e agora está
 * explícito: quem funda produções, contra quem foi convidado para as dos outros.
 */
export async function descobrirPersona(): Promise<Persona> {
  if (!supabaseConfigurado) return 'desconhecido';

  try {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao?.session?.user) return 'desconhecido';

    const { data: admin } = await supabase.rpc('e_admin');
    if (admin) return 'admin';

    const participacoes = participacoesLocais().length
      ? participacoesLocais()
      : await sincronizarParticipacoes();

    if (!participacoes.length) return 'desconhecido';
    return participacoes.some(p => p.papel === 'dono') ? 'equipe_a' : 'equipe_b';
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

/**
 * Cria o link de convite já com o papel que a pessoa vai ter.
 *
 * O papel era chumbado em `'equipe'`, e por isso `'leitura'` nunca chegava a
 * existir na prática — o tipo previa, mas nada produzia. Agora quem convida
 * escolhe.
 *
 * `dono` não entra na lista de propósito: posse se transfere numa ação própria,
 * com confirmação, e não por um link que pode ser encaminhado no WhatsApp.
 */
export async function criarConvite(
  projetoId: string,
  nomeProjeto: string,
  papel: PapelConvidavel = 'equipe',
  /**
   * Como quem entrar vai aparecer, enquanto não tiver ficha vinculada.
   *
   * Vazio de propósito quando o convite é genérico: a Edge Function preenche
   * com o nome da conta que aceitar, que é melhor palpite que qualquer rótulo
   * escolhido aqui sem saber quem vai abrir o link.
   */
  apelido?: string | null,
  /** Convite nominal: já diz quem a pessoa é na ficha da equipe. */
  pessoa?: { perfil_id: string; email_esperado?: string | null }
): Promise<Convite> {
  if (!supabaseConfigurado) throw new Error('Supabase não está configurado neste ambiente.');
  if (!papelConvidavel(papel)) throw new Error(`Papel inválido para convite: ${papel}`);

  const token = gerarToken();
  const expira = new Date(Date.now() + DIAS_DE_VALIDADE * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from(TABELA_CONVITES)
    .insert({
      token,
      projeto_id: projetoId,
      nome_projeto: nomeProjeto,
      papel,
      apelido: apelido || null,
      expira_em: expira.toISOString(),
      perfil_id: pessoa?.perfil_id ?? null,
      email_esperado: pessoa?.email_esperado ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Convite;
}

/**
 * Os perfis desta produção que JÁ têm conta vinculada.
 *
 * A tela de aceite usa para oferecer só quem ainda está livre. Mostrar quem já
 * foi reivindicado produziria uma colisão que o índice único do banco recusa na
 * cara da pessoa — e ela não teria como saber por quê.
 */
export async function perfisJaVinculados(projetoId: string): Promise<string[]> {
  if (!supabaseConfigurado) return [];
  const { data, error } = await supabase
    .from(TABELA_MEMBROS)
    .select('perfil_id')
    .eq('projeto_id', projetoId)
    .not('perfil_id', 'is', null);

  if (error) throw error;
  return (data || []).map(l => l.perfil_id as string);
}

export async function convitesDoProjeto(projetoId: string): Promise<Convite[]> {
  const { data, error } = await supabase
    .from(TABELA_CONVITES)
    .select(CAMPOS_CONVITE)
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
    .select(CAMPOS_CONVITE)
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
export async function aceitarConvite(
  token: string
): Promise<{ projeto_id: string; ja_era_membro: boolean; perfil_id: string | null }> {
  const { data, error } = await supabase.functions.invoke('convite', { body: { token } });

  if (error) {
    // O corpo do erro traz a razão de verdade (expirado, já usado, inexistente);
    // o `error.message` sozinho diz só "non-2xx status code".
    const detalhe = await lerDetalheDoErro(error);
    throw new Error(detalhe || error.message);
  }
  if (data?.erro) throw new Error(data.erro);

  await sincronizarParticipacoes();
  return {
    projeto_id: data.projeto_id,
    ja_era_membro: Boolean(data.ja_era_membro),
    perfil_id: data.perfil_id ?? null,
  };
}

async function lerDetalheDoErro(error: any): Promise<string | null> {
  try {
    const corpo = await error?.context?.json?.();
    return corpo?.erro ?? null;
  } catch {
    return null;
  }
}

/** O link que se manda para quem vai entrar na produção. */
export function linkDoConvite(token: string): string {
  return linkDoApp(`convite/${token}`);
}
