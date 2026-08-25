import type { PapelMembro } from './membros';

/**
 * O que cada papel pode fazer.
 *
 * ⚠️ ISTO É A TELA, NÃO A SEGURANÇA. Quem impede de verdade é a RLS do Postgres
 * (`supabase/sql/papeis.sql`). Este arquivo existe para a tela não oferecer
 * botões que o servidor vai recusar — botão que falha depois de clicado é pior
 * que botão ausente. As duas listas precisam concordar; se divergirem, o sintoma
 * é a pior classe de bug deste projeto: a tela deixa editar e o servidor recusa
 * em silêncio, porque RLS barrada devolve vazio, não erro.
 *
 * OS DOIS EIXOS
 * Papel responde "o que esta CONTA pode fazer". Não confundir com departamento,
 * que responde "quem esta PESSOA é no filme" e mora em `perfis.departamento_id`
 * — ver `escopo.ts`. Um Diretor pode ser 'leitura'; um assistente de produção
 * que toca o app o dia inteiro pode ser 'admin'.
 */

export type Acao =
  | 'ver'
  | 'editar_producao'
  | 'editar_financeiro'
  | 'editar_equipamentos'
  | 'convidar'
  | 'gerir_membros'
  | 'destruir';

/** Papel + o caso "ainda não sei" (offline, projeto só local, sem Supabase). */
export type Papel = PapelMembro | 'desconhecido';

const TUDO: Acao[] = [
  'ver', 'editar_producao', 'editar_financeiro', 'editar_equipamentos',
  'convidar', 'gerir_membros', 'destruir',
];

const TABELA: Record<Papel, Acao[]> = {
  /** Quem criou a produção. Só ele destrói. */
  dono: TUDO,

  /**
   * O "posso delegar a produção sem entregar a chave de destruir".
   * Faz tudo o que o dono faz, menos apagar a produção do servidor.
   */
  admin: TUDO.filter(a => a !== 'destruir'),

  /** Trabalha na produção. Não convida ninguém e não mexe em papel de ninguém. */
  equipe: ['ver', 'editar_producao', 'editar_financeiro', 'editar_equipamentos'],

  /** Acompanha. Cliente, coprodutor, diretor que só quer ver a diária. */
  leitura: ['ver'],

  /**
   * FALHA ABRINDO — para editar.
   *
   * Não saber o papel acontece o tempo todo em situação legítima: avião, set sem
   * sinal, produção que só existe neste navegador e nunca foi compartilhada.
   * Trancar aí não protegeria nada (quem protege é a RLS) e trancaria a pessoa
   * para fora do próprio trabalho.
   *
   * Mas FALHA FECHANDO para administrar. Convidar, mexer em papel e destruir
   * dependem do servidor de qualquer jeito: mostrar esses botões sem saber quem
   * é a pessoa só produziria um clique que termina em erro.
   */
  desconhecido: ['ver', 'editar_producao', 'editar_financeiro', 'editar_equipamentos'],
};

export function pode(papel: Papel, acao: Acao): boolean {
  return TABELA[papel]?.includes(acao) ?? false;
}

/** Os papéis que um convite pode conceder. `dono` nunca sai por link. */
export const PAPEIS_CONVIDAVEIS = ['admin', 'equipe', 'leitura'] as const;
export type PapelConvidavel = (typeof PAPEIS_CONVIDAVEIS)[number];

export function papelConvidavel(valor: unknown): valor is PapelConvidavel {
  return typeof valor === 'string' && (PAPEIS_CONVIDAVEIS as readonly string[]).includes(valor);
}

/** Como o papel aparece na tela, e o que ele significa em uma linha. */
export const DESCRICAO: Record<PapelMembro, { nome: string; resumo: string }> = {
  dono: { nome: 'Dono', resumo: 'Faz tudo, inclusive apagar a produção.' },
  admin: { nome: 'Administra', resumo: 'Faz tudo e convida gente. Não apaga a produção.' },
  equipe: { nome: 'Equipe', resumo: 'Trabalha na produção. Não convida nem muda papéis.' },
  leitura: { nome: 'Só leitura', resumo: 'Vê tudo, não altera nada.' },
};
