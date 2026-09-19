import { TABELAS_SINCRONIZADAS } from '../db/db';

/**
 * O TERCEIRO eixo: de quem é o dado.
 *
 * Papel (`permissoes.ts`) diz QUANTO você pode mexer. Departamento diz ONDE. A
 * regra do app é "todo mundo vê tudo, cada um edita o que é do seu
 * departamento" — mas aplicar isso ao pé da letra quebraria o app, e vale
 * entender por quê antes de mexer aqui.
 *
 * A maioria das tabelas NÃO TEM departamento. `cenas`, `locacoes`, `diarias`,
 * `documentos`, `veiculos` — nenhuma carrega `departamento_id`. Se "só edito o
 * que é meu" valesse para todas, a Fotografia entraria e não conseguiria mexer
 * em nada.
 *
 * `despesas` é o caso mais enganoso: PARECE ter departamento, mas não tem. O
 * departamento aparece dentro de `pagadores`/`devedores` como
 * `QuemTipo = 'departamento'` — isso é QUEM PAGA, não DE QUEM É a despesa. São
 * perguntas diferentes, e confundi-las faria o financeiro se fragmentar.
 *
 * Por isso o escopo é decidido área por área, aqui, e não por uma regra
 * genérica que se descobre errada tabela a tabela.
 *
 * ⚠️ Esta lista precisa concordar com o SQL (`supabase/sql/papeis.sql`). Se
 * divergirem, o sintoma é o pior bug deste projeto: a tela deixa editar e o
 * servidor recusa em silêncio, porque RLS barrada devolve vazio, não erro.
 */

export type Escopo =
  /** Só edita quem é do departamento do registro. Dono e admin ignoram. */
  | 'departamental'
  /** Qualquer um que possa escrever edita. Trabalho colaborativo por natureza. */
  | 'comum'
  /** Só dono e admin. */
  | 'restrito';

type TabelaSincronizada = (typeof TABELAS_SINCRONIZADAS)[number];

/**
 * A matriz.
 *
 * O recorte de `restrito` segue um princípio: **dinheiro é da produção, não do
 * departamento.** Um departamento não deve poder lançar despesa no caixa comum
 * sem passar por quem administra. Se um dia a Fotografia precisar lançar a
 * própria despesa, aí sim entra `departamento_id` em `Despesa` — mas isso mexe
 * no cálculo de saldos (`core/calculadora.ts`) e é fase separada.
 *
 * `diarias` é restrito porque criar e fechar diária é ato de produção. O
 * conteúdo de uma diária (as tasks dela) é departamental, e isso está logo
 * abaixo, em `diaria_tasks`.
 */
export const ESCOPO: Record<TabelaSincronizada, Escopo> = {
  // Dinheiro e a espinha da produção: quem administra.
  projetos: 'restrito',
  configuracoes: 'restrito',
  despesas: 'restrito',
  aportes: 'restrito',
  acertos: 'restrito',
  diarias: 'restrito',
  departamentos: 'restrito',

  // De quem é: só o próprio departamento mexe.
  perfis: 'departamental',
  tasks: 'departamental',
  diaria_tasks: 'departamental',

  // Trabalho de todo mundo ao mesmo tempo. Restringir aqui só atrapalharia.
  /*
    `eventos` é COMUM, e não restrito como `diarias`, porque as duas coisas têm
    peso diferente. Criar diária é ato de produção: mexe na numeração e na conta
    de páginas gravadas. Marcar uma visita de locação para quinta é combinar um
    horário — a Arte marca a dela, a Fotografia marca a dela, e obrigar as duas
    a passar por quem administra faria a agenda voltar para o WhatsApp, que é de
    onde ela veio.
  */
  eventos: 'comum',
  locacoes: 'comum',
  documentos: 'comum',
  pastas: 'comum',
  elementos: 'comum',
  cenas: 'comum',
  planos: 'comum',
  roteiro_pdfs: 'comum',
  roteiro_tags: 'comum',
  stripboard_itens: 'comum',
  veiculos: 'comum',
  motoristas: 'comum',

  /*
    O que foi gravado é registro de produção, não de departamento.

    Quem marca cena como gravada é a direção e a produção — o 1º AD ou a
    continuísta, no wrap. Não é a Arte nem a Fotografia, e não porque não se
    confie nelas: é que um DPR com duas versões do mesmo dia não serve para
    discussão nenhuma. Uma boca, um relatório.
  */
  registros_cena: 'restrito',
  registros_plano: 'restrito',

  // Auditoria: ninguém edita, todo mundo escreve o próprio. Ver Etapa 7.
  logs: 'comum',
  /*
    Logagem: é da Fotografia. O boletim de câmera é o documento de trabalho
    do DIT e do 2º AC; direção, produção e continuísta leem.

    Cada linha grava `departamento_id` (o da Fotografia da produção), para que
    a RLS departamental, quando existir, já encontre o dado pronto. Hoje só a
    tela faz valer isto — e a tela da Logagem tem regra própria, porque "quem
    edita" ali inclui quem o dono liberou. Ver `lib/logagem/permissao.ts`.
  */
  log_takes: 'departamental',
  log_estado: 'departamental',
  log_kits: 'departamental',
  log_hds: 'departamental',
  log_backups: 'departamental',
  log_checksums: 'departamental',
};

export function escopoDe(tabela: string): Escopo {
  return ESCOPO[tabela as TabelaSincronizada] ?? 'comum';
}

/**
 * Posso escrever nesta tabela?
 *
 * ⚠️ **ISTO É A TELA, NÃO A SEGURANÇA.** A RLS de hoje faz valer o PAPEL, não o
 * departamento — ver a dívida declarada em `supabase/sql/papeis.sql`. Um membro
 * com o DevTools aberto escreve em tabela de outro departamento. O risco é
 * "colega curioso", não "estranho na internet", porque só quem é membro passa
 * do `e_membro()`.
 *
 * A razão de não estar na RLS ainda é de ordem, não de preguiça: o escopo
 * departamental depende de `projeto_membros.perfil_id` estar preenchido, e quem
 * preenche isso é a Etapa 6, que vem depois. Ligar a regra no servidor antes
 * disso trancaria TODO MUNDO para fora de tasks e fichas, porque hoje quase
 * ninguém tem perfil vinculado.
 */
export function podeEscreverNaTabela(
  tabela: string,
  contexto: {
    /** dono/admin/super-admin ignoram o escopo departamental. */
    ignoraDepartamento: boolean;
    /** Meu departamento, se eu tiver um vinculado. */
    meuDepartamentoId?: string | null;
    /** O departamento do registro que estou tentando mexer. */
    departamentoDoRegistro?: string | null;
  }
): boolean {
  const escopo = escopoDe(tabela);

  if (contexto.ignoraDepartamento) return true;
  if (escopo === 'restrito') return false;
  if (escopo === 'comum') return true;

  // Departamental daqui para baixo.
  //
  // Quem não tem departamento vinculado cai no escopo `comum` e nada mais — não
  // se tranca a pessoa para fora do app inteiro por não ter preenchido a ficha.
  if (!contexto.meuDepartamentoId) return false;

  return contexto.departamentoDoRegistro === contexto.meuDepartamentoId;
}

/**
 * A exceção que confirma a regra: `perfis` é departamental, MAS cada um edita a
 * própria ficha, sempre. Sem isto ninguém atualiza o próprio PIX.
 */
export function podeEditarFicha(perfilId: string, meuPerfilId: string, contexto: {
  ignoraDepartamento: boolean;
  meuDepartamentoId?: string | null;
  departamentoDaFicha?: string | null;
}): boolean {
  if (perfilId && perfilId === meuPerfilId) return true;
  return podeEscreverNaTabela('perfis', {
    ignoraDepartamento: contexto.ignoraDepartamento,
    meuDepartamentoId: contexto.meuDepartamentoId,
    departamentoDoRegistro: contexto.departamentoDaFicha,
  });
}

// ---------------------------------------------------------------------------
// A regra por REGISTRO — a que vale de fato (18/09/2026)
// ---------------------------------------------------------------------------

/**
 * Quem está escrevendo, com o que se sabe dele agora.
 *
 * `departamentoConhecido` é falso enquanto o layout da produção não disse qual é
 * o meu departamento (a ficha ainda carregando, uma escrita fora da produção).
 * Nesse intervalo o departamental PASSA: a trava local falha abrindo, como o
 * resto do cliente, e quem decide é o servidor.
 */
export interface QuemEscreve {
  papel: import('./permissoes').Papel;
  departamentoConhecido: boolean;
  meuPerfilId?: string;
  meuDepartamentoId?: string | null;
  usuarioId?: string;
  meuEmail?: string;
  /** `Projeto.logagem_liberados`: quem o dono liberou na Logagem. */
  liberadosLogagem?: string[];
}

/** Por que não — cada motivo vira uma frase diferente no aviso. */
export type Negacao = 'leitura' | 'restrito' | 'departamental' | 'departamento_da_ficha';

type Registro = { id?: string; departamento_id?: string | null; email?: string } | undefined;

/**
 * Esta escrita pode acontecer? `null` é sim; senão, o motivo.
 *
 * `antes` é a linha como está (ausente numa criação); `depois` é como vai ficar
 * (ausente numa exclusão). Olhar os DOIS é o que barra "mover uma task da
 * Fotografia para a Arte": o `antes` não é meu, então não mexo, nem para
 * trazer para mim.
 *
 * ⚠️ ESPELHO: `supabase/sql/escopo.sql` (`public.escopo_permite`) aplica a
 * mesma regra no servidor. Mudou aqui, muda lá — senão a tela deixa e o
 * servidor recusa, e a recusa volta como aviso para quem não fez nada errado.
 *
 * As regras, em ordem:
 * 1. papel desconhecido (offline, projeto só local, super-admin): passa;
 * 2. `leitura`: nada;
 * 3. dono e admin: tudo;
 * 4. `equipe` em tabela restrita: não; em tabela comum: sim;
 * 5. departamental:
 *    - na Logagem, quem o dono liberou escreve;
 *    - a própria ficha, sempre — mas sem trocar o próprio departamento (senão
 *      "edito minha ficha" viraria "escolho de que departamento sou");
 *    - quem ainda não tem ficha pode criar a sua, com o e-mail da conta;
 *    - registro SEM departamento é de todo mundo (as tasks antigas não têm);
 *    - registro com departamento: só se for o meu, antes e depois.
 */
export function negacaoDaEscrita(
  tabela: string, quem: QuemEscreve, antes?: Registro, depois?: Registro,
): Negacao | null {
  if (quem.papel === 'desconhecido') return null;
  if (quem.papel === 'leitura') return 'leitura';
  if (quem.papel === 'dono' || quem.papel === 'admin') return null;

  const escopo = escopoDe(tabela);
  if (escopo === 'restrito') return 'restrito';
  if (escopo === 'comum') return null;

  if (!quem.departamentoConhecido) return null;

  if (tabela.startsWith('log_') && quem.usuarioId && quem.liberadosLogagem?.includes(quem.usuarioId)) {
    return null;
  }

  const deptoDe = (r: Registro) => r?.departamento_id || null;

  if (tabela === 'perfis') {
    const id = (depois ?? antes)?.id;
    if (id && quem.meuPerfilId && id === quem.meuPerfilId) {
      if (antes && depois && deptoDe(antes) !== deptoDe(depois)) return 'departamento_da_ficha';
      return null;
    }
    const criandoAPropria = !antes && depois && !quem.meuPerfilId && quem.meuEmail
      && depois.email?.trim().toLowerCase() === quem.meuEmail.trim().toLowerCase();
    if (criandoAPropria) return null;
  }

  const meu = quem.meuDepartamentoId || null;
  const podeMexer = (r: Registro) => deptoDe(r) === null || (meu !== null && deptoDe(r) === meu);
  if (antes && !podeMexer(antes)) return 'departamental';
  if (depois && !podeMexer(depois)) return 'departamental';
  return null;
}

/** A frase do aviso, para cada motivo. */
export const FRASE_DA_NEGACAO: Record<Negacao, string> = {
  leitura: 'Seu acesso nesta produção é só de leitura.',
  restrito: 'Só quem administra a produção altera isto.',
  departamental: 'Isto é de outro departamento.',
  departamento_da_ficha: 'Trocar o próprio departamento é com quem administra a produção.',
};
