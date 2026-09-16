import type { EstadoDaLogagem } from '../../types';
import {
  descreverFalta, emHora, emMinutos, ROTULO_TIPO,
  type Atraso, type DiaCalculado, type ItemCalculado,
} from '../linhaDoDia';
import type { PlanoDoDia } from './decupagem';

/**
 * "O dia" visto de dentro da Logagem: o que está rodando e o que vem depois.
 *
 * Pedido de quem opera câmera (16/09/2026): *"eu olho mais qual é a próxima
 * cena/plano e quando temos as pausas e o prep time, para me preparar"*. A
 * Linha do Dia já sabe responder — e já desloca o plano pelo atraso real
 * (`proximoDoDia`). Aqui só se escolhe o que cabe numa faixa.
 */

export interface ItemAFrente {
  id: string;
  tipo: ItemCalculado['item']['tipo'];
  rotulo: string;
  /** "INT · DIA · Sala" para cena; vazio para o resto. */
  detalhe: string;
  /** Horário previsto, já com o atraso do dia. */
  previsto: string;
  /** Minutos até lá (negativo = já devia ter começado). Só no primeiro. */
  faltam?: number;
}

export function rotuloDoItem(c: ItemCalculado): string {
  if (c.cena) return `Cena ${c.cena.numero}${c.item.parte || ''}`;
  return c.item.titulo?.trim() || ROTULO_TIPO[c.item.tipo];
}

function detalheDoItem(c: ItemCalculado): string {
  if (!c.cena) return c.item.titulo?.trim() && c.item.titulo.trim() !== ROTULO_TIPO[c.item.tipo] ? ROTULO_TIPO[c.item.tipo] : '';
  return [c.cena.ambiente?.toUpperCase(), c.cena.periodo === 'noite' ? 'NOITE' : c.cena.periodo ? 'DIA' : ''].filter(Boolean).join(' · ');
}

/** O último item marcado como começado: é o que está rodando agora. */
export function itemDeAgora(dia: DiaCalculado): ItemCalculado | null {
  let achado: ItemCalculado | null = null;
  for (const c of dia.itens) if (emMinutos(c.item.hora_real) !== null) achado = c;
  return achado;
}

/**
 * Os próximos `quantos` itens do dia, depois do que está rodando.
 *
 * Sem nada marcado, o dia ainda não começou: a lista começa do primeiro item.
 * Notas e marcos sem duração entram — "chegada do elenco" é exatamente o tipo
 * de coisa que a câmera quer saber.
 */
export function itensAFrente(dia: DiaCalculado, atraso: Atraso, agoraMin: number | null, quantos = 3): ItemAFrente[] {
  const agora = itemDeAgora(dia);
  const inicio = agora ? dia.itens.indexOf(agora) + 1 : 0;
  return dia.itens
    .slice(inicio)
    .filter(c => c.item.tipo !== 'nota')
    .slice(0, quantos)
    .map((c, i) => {
      const alvo = c.inicio + atraso.minutos;
      let faltam: number | undefined;
      if (i === 0 && agoraMin !== null) {
        faltam = alvo - agoraMin;
        /*
          Só a virada para a frente: o dia calculado não volta a zero depois da
          meia-noite (00:30 do dia seguinte é 1470), então "muito à frente" é o
          relógio que já virou. "Muito atrás" é só atraso — somar um dia ali
          transformava a refeição de 07:00, ainda sem marcar às 19:00, em
          "em 11h58".
        */
        if (faltam > 720) faltam -= 1440;
        // Ninguém marcou nada: não há como saber o atraso, e "atrasou 12h" num
        // dia só não marcado seria alarme falso. Fica o horário, sem contagem.
        if (atraso.marcados === 0 && faltam < 0) faltam = undefined;
      }
      return {
        id: c.item.id,
        tipo: c.item.tipo,
        rotulo: rotuloDoItem(c),
        detalhe: detalheDoItem(c),
        previsto: emHora(alvo),
        faltam,
      };
    });
}

/** "em 12min", "agora", "atrasou 8min" — a frase curta da faixa. */
export function quandoFalta(minutos: number): string {
  if (minutos < 0) return `atrasou ${descreverFalta(minutos).replace('há ', '')}`;
  return descreverFalta(minutos);
}

/**
 * O próximo plano a rodar, pela decupagem.
 *
 * É o primeiro plano SEM TAKE depois do que está na claquete; se a claquete não
 * veio da decupagem, o primeiro sem take do dia. Plano que já teve take não é
 * "o próximo" — é um que se volta a rodar, e isso a pessoa decide olhando a
 * lista.
 */
export function proximoPlano(lista: PlanoDoDia[], estado: Pick<EstadoDaLogagem, 'plano_id'>): PlanoDoDia | null {
  const aqui = estado.plano_id ? lista.findIndex(i => i.plano.id === estado.plano_id) : -1;
  const depois = lista.slice(aqui + 1).find(i => i.takes === 0);
  if (depois) return depois;
  return lista.find(i => i.takes === 0 && i.plano.id !== estado.plano_id) ?? null;
}
