import type { Cena, Diaria, RegistroCena } from '../types';
import { estadoAtualDasCenas, filaDeRepescagem } from './registroSet';
import { paginasParaOitavos, oitavosParaPaginas } from './decupagem';

/**
 * O recálculo no nível do PROJETO (spec §5.2).
 *
 * A linha do dia responde "a que horas vamos acabar hoje". Isto responde a
 * pergunta cara: **no ritmo em que estamos indo, o filme cabe nas diárias que
 * ainda temos?** É a diferença entre um app que registra e um que avisa.
 *
 * A CONTA É EM CENAS POR DIA, e as páginas entram só como leitura ao lado.
 *
 * Páginas por dia é a métrica da indústria e seria mais precisa — cena tem
 * tamanho, e quatro cenas curtas não são quatro cenas longas. Só que ela
 * depende de alguém ter preenchido os oitavos de cada cena, e produção nenhuma
 * espera o dado ficar completo. Se a previsão dependesse das páginas, ela
 * simplesmente não apareceria na maioria dos projetos.
 *
 * Então: cena por dia decide o alerta, porque está sempre disponível; páginas
 * por dia aparecem na frase quando existirem, porque é o número que faz um AD
 * reconhecer o ritmo do próprio filme.
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

  /**
   * Páginas por dia, quando o roteiro está decupado em oitavos.
   *
   * É a métrica que a indústria usa de verdade — cinco páginas por dia é a
   * referência de um independente, e o número diz mais que "quatro cenas"
   * porque cena tem tamanho. Fica ao lado, não no lugar: depende de alguém ter
   * preenchido as páginas de cada cena, e diária nenhuma espera esse dado ficar
   * completo.
   */
  paginasPorDia: string | null;
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

  /*
    Oitavos gravados por diária fechada.

    Cena parcial conta o que o registro disser; sem esse número, metade — a
    mesma regra do resto do app, para o total não pular quando alguém preenche
    a cobertura de uma cena e não de outra.
  */
  const porId = new Map(cenas.map(c => [c.id, c]));
  const oitavosGravados = [...atual.values()].reduce((soma, r) => {
    const cena = porId.get(r.cena_id);
    if (!cena) return soma;
    const oitavos = paginasParaOitavos(cena.paginas);
    if (r.status === 'gravada') return soma + oitavos;
    if (r.status === 'parcial') return soma + (r.oitavos_gravados ?? Math.floor(oitavos / 2));
    return soma;
  }, 0);
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
    paginasPorDia: fechadas.length > 0 && oitavosGravados > 0
      ? oitavosParaPaginas(Math.round(oitavosGravados / fechadas.length))
      : null,
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
      detalhe: `Saíram ${arredondar(r.cenasPorDia!)} cenas por dia${r.paginasPorDia ? ` (${r.paginasPorDia} páginas)` : ''} em ${r.diariasFechadas} ${r.diariasFechadas === 1 ? 'diária' : 'diárias'}. Sobram ${r.cenasRestantes} cenas e ${r.diariasRestantes} ${r.diariasRestantes === 1 ? 'dia marcado' : 'dias marcados'}.`,
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
