import type { Cena, Diaria, RegistroCena } from '../types';
import { estadoAtualDasCenas, filaDeRepescagem } from './registroSet';

/**
 * O recálculo no nível do PROJETO (spec §5.2).
 *
 * A linha do dia responde "a que horas vamos acabar hoje". Isto responde a
 * pergunta cara: **no ritmo em que estamos indo, o filme cabe nas diárias que
 * ainda temos?** É a diferença entre um app que registra e um que avisa.
 *
 * Ele é deliberadamente simples — cenas por dia, não páginas por dia. Páginas
 * seriam mais precisas na teoria, e piores na prática: dependem de todo mundo
 * ter preenchido os oitavos de cada cena, e diária nenhuma se atrasa esperando
 * o dado ficar completo. Cena por dia é grosseiro e está sempre disponível.
 */

export interface Ritmo {
  /** Quantas diárias já fecharam. Sem pelo menos uma, não há ritmo a medir. */
  diariasFechadas: number;
  /** Diárias criadas e ainda abertas — o que resta do plano. */
  diariasRestantes: number;
  cenasTotais: number;
  cenasGravadas: number;
  /** Cenas que ficaram para trás em dias já fechados e ainda não saíram. */
  pendentes: number;
  /** De quantas diárias diferentes vêm essas pendências. */
  diariasComPendencia: number;
  /** Cenas que ainda precisam ser filmadas (fora as cortadas). */
  cenasRestantes: number;
  /** Cenas por diária, no ritmo até aqui. `null` enquanto não dá para saber. */
  cenasPorDia: number | null;
  /** Quantas diárias o resto do filme pede, nesse ritmo. */
  diariasNecessarias: number | null;
  /** Positivo = faltam diárias. Negativo = sobram. */
  diferenca: number | null;
}

export function calcularRitmo(
  cenas: Cena[],
  registros: RegistroCena[],
  diarias: Diaria[]
): Ritmo {
  const fechadas = diarias.filter(d => d.fechada);
  const mapaFechadas = new Map(fechadas.map(d => [d.id, d.numero]));

  const atual = estadoAtualDasCenas(registros);
  const gravadas = [...atual.values()].filter(r => r.status === 'gravada');
  const cortadas = [...atual.values()].filter(r => r.status === 'cortada');

  const fila = filaDeRepescagem(registros, new Set(mapaFechadas.keys()));

  /*
    Cena pendente que já foi reencaixada num dia aberto sai da conta.

    O registro antigo continua no banco de propósito (é a história do projeto),
    então filtrar pelo registro sozinho contaria a mesma cena duas vezes: uma
    como pendência e outra como trabalho já reagendado. O que decide é se ela
    está escalada em alguma diária que ainda não fechou.
  */
  const escaladasEmAberto = new Set(
    diarias.filter(d => !d.fechada).flatMap(d => d.cena_ids || [])
  );
  const pendentesDeVerdade = fila.filter(r => !escaladasEmAberto.has(r.cena_id));

  const cenasRestantes = Math.max(0, cenas.length - gravadas.length - cortadas.length);
  const diariasRestantes = diarias.filter(d => !d.fechada).length;

  const cenasPorDia = fechadas.length > 0 && gravadas.length > 0
    ? gravadas.length / fechadas.length
    : null;

  const diariasNecessarias = cenasPorDia && cenasPorDia > 0
    ? Math.ceil(cenasRestantes / cenasPorDia)
    : null;

  return {
    diariasFechadas: fechadas.length,
    diariasRestantes,
    cenasTotais: cenas.length,
    cenasGravadas: gravadas.length,
    pendentes: pendentesDeVerdade.length,
    diariasComPendencia: new Set(pendentesDeVerdade.map(r => r.diaria_id)).size,
    cenasRestantes,
    cenasPorDia,
    diariasNecessarias,
    diferenca: diariasNecessarias === null ? null : diariasNecessarias - diariasRestantes,
  };
}

export type GravidadeDoRitmo = 'ok' | 'atencao' | 'alerta';

export interface AvisoDeRitmo {
  gravidade: GravidadeDoRitmo;
  titulo: string;
  detalhe: string;
}

/**
 * O que dizer sobre o ritmo — ou nada.
 *
 * Devolve `null` quando não há o que avisar, e isso é metade do desenho. Um
 * painel que diz "tudo certo" todo dia treina a pessoa a não ler o painel; aí,
 * no dia em que ele diz outra coisa, ninguém repara.
 */
export function avisoDoRitmo(r: Ritmo): AvisoDeRitmo | null {
  if (r.diferenca !== null && r.diferenca > 0) {
    return {
      gravidade: 'alerta',
      titulo: r.diferenca === 1
        ? 'No ritmo atual, falta 1 diária para o filme fechar'
        : `No ritmo atual, faltam ${r.diferenca} diárias para o filme fechar`,
      detalhe: `Saíram ${arredondar(r.cenasPorDia!)} cenas por dia em ${r.diariasFechadas} ${r.diariasFechadas === 1 ? 'diária' : 'diárias'}. Sobram ${r.cenasRestantes} cenas e ${r.diariasRestantes} ${r.diariasRestantes === 1 ? 'dia marcado' : 'dias marcados'}.`,
    };
  }

  if (r.pendentes > 0) {
    return {
      gravidade: 'atencao',
      titulo: r.pendentes === 1
        ? '1 cena ficou para trás e ainda não foi remarcada'
        : `${r.pendentes} cenas ficaram para trás e ainda não foram remarcadas`,
      detalhe: `${r.diariasComPendencia === 1 ? 'De 1 diária anterior' : `De ${r.diariasComPendencia} diárias anteriores`}. Encaixe na fila de repescagem antes que o calendário feche.`,
    };
  }

  return null;
}

/** "2,5" — uma casa, e sem casa nenhuma quando é inteiro. */
function arredondar(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', ',');
}
