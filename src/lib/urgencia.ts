import type { Task } from '../types';

/**
 * Quão perto do prazo uma tarefa está — e o que dizer sobre isso.
 *
 * POR QUE ISTO EXISTE
 * A lista era ordenada pela ordem em que as tarefas foram criadas, e o prazo
 * aparecia como uma data pequena no rodapé do cartão. Numa coluna com quinze
 * tarefas, a que vence amanhã podia estar em décimo lugar, escrita do mesmo
 * jeito que a que vence em três meses. O dado estava lá e não informava nada.
 *
 * Aqui ele vira duas coisas: a ORDEM (o que vence antes sobe) e uma ETIQUETA
 * que se lê de relance.
 */

export type NivelUrgencia = 'atrasada' | 'hoje' | 'curto' | 'semana' | 'tranquila' | 'sem_prazo';

export interface Urgencia {
  nivel: NivelUrgencia;
  /** O que a etiqueta diz. `null` quando não há etiqueta a mostrar. */
  rotulo: string | null;
  cor: string;
  /** Dias até o prazo. Negativo é atraso. `null` sem prazo. */
  dias: number | null;
}

/**
 * Os cortes, e por que são estes.
 *
 * Até 2 dias é "prazo curto" porque é o horizonte em que ainda dá para mudar o
 * plano do dia: pedir ajuda, remanejar, cortar escopo. Passou disso e vira
 * "esta semana", que é aviso, não alarme.
 *
 * Acima de uma semana NÃO ganha etiqueta. Uma etiqueta em toda tarefa é uma
 * tela sem etiqueta nenhuma — o olho para de ver o que está sempre lá, e aí a
 * de amanhã se perde junto com as outras.
 */
const CURTO_DIAS = 2;
const SEMANA_DIAS = 7;

/** Hoje em `YYYY-MM-DD`, pelo relógio local. */
export function hojeISO(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

/**
 * Diferença em dias entre duas datas `YYYY-MM-DD`.
 *
 * Monta as duas ao MEIO-DIA local. Nem meia-noite nem UTC: no dia da virada do
 * horário de verão, um dos dois lados ganha ou perde uma hora, e a divisão por
 * 24h devolveria 0,96 dia — que arredonda para o dia errado. Ao meio-dia sobra
 * folga para a hora perdida em qualquer direção.
 */
export function diasEntre(de: string, para: string): number {
  const monta = (iso: string) => {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d, 12, 0, 0);
  };
  return Math.round((monta(para).getTime() - monta(de).getTime()) / 86_400_000);
}

export function urgenciaDe(task: Task, hoje: string = hojeISO()): Urgencia {
  /*
    Tarefa FEITA não tem urgência, mesmo com o prazo estourado.

    Ela cumpriu o que tinha para cumprir; marcá-la de vermelho encheria a coluna
    "Feito" de alarme por trabalho que já acabou — e alarme sobre o passado é
    exatamente o tipo de ruído que faz alguém parar de olhar as etiquetas.
  */
  if (task.status === 'done') return { nivel: 'sem_prazo', rotulo: null, cor: 'var(--text-muted)', dias: null };

  if (!task.data_conclusao) return { nivel: 'sem_prazo', rotulo: null, cor: 'var(--text-muted)', dias: null };

  const dias = diasEntre(hoje, task.data_conclusao);

  if (dias < 0) {
    return {
      nivel: 'atrasada',
      rotulo: dias === -1 ? 'ATRASADA 1 DIA' : `ATRASADA ${Math.abs(dias)} DIAS`,
      cor: 'var(--color-danger)',
      dias,
    };
  }
  if (dias === 0) return { nivel: 'hoje', rotulo: 'É HOJE', cor: 'var(--color-danger)', dias };
  if (dias <= CURTO_DIAS) {
    return {
      nivel: 'curto',
      rotulo: dias === 1 ? 'PRAZO CURTO · AMANHÃ' : `PRAZO CURTO · ${dias} DIAS`,
      cor: 'var(--color-warning)',
      dias,
    };
  }
  if (dias <= SEMANA_DIAS) {
    return { nivel: 'semana', rotulo: `EM ${dias} DIAS`, cor: 'var(--text-secondary)', dias };
  }
  return { nivel: 'tranquila', rotulo: null, cor: 'var(--text-muted)', dias };
}

/**
 * Ordena por prazo: o que vence antes vem primeiro.
 *
 * ⚠️ SEM PRAZO VAI PARA O FIM, e não para o começo.
 *
 * Ordenar por data com `undefined` no meio é o clássico que joga metade da
 * lista para cima sem querer. E o lugar delas é o fim mesmo: tarefa sem data é
 * tarefa que ninguém prometeu para quando — ela não pode empurrar para baixo a
 * que vence amanhã.
 *
 * Empate de data mantém a ordem de criação: numa produção, duas tarefas do
 * mesmo dia costumam ter sido escritas na ordem em que se pretende fazê-las.
 */
export function ordenarPorPrazo(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = a.data_conclusao, pb = b.data_conclusao;
    if (pa && pb) return pa.localeCompare(pb) || a.data_criacao - b.data_criacao;
    if (pa) return -1;
    if (pb) return 1;
    return a.data_criacao - b.data_criacao;
  });
}

/** Quantas subtarefas faltam. Zero quando não há subtarefa nenhuma. */
export function subtarefasPendentes(task: Task): number {
  return (task.subtarefas || []).filter(s => !s.concluida && s.titulo.trim()).length;
}
