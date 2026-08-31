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
