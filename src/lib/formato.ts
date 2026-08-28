/**
 * Como o app escreve número e data. Formato brasileiro, em um lugar só.
 *
 * POR QUE CENTRALIZAR
 * Cada tela resolvia isso do seu jeito, e o resultado era um app bilíngue:
 * trinta e sete lugares escreviam `R$ 1234.56` — ponto decimal e sem separador
 * de milhar, que é a notação inglesa — enquanto o campo de digitar despesa já
 * aceitava e mostrava `R$ 1.234,56`. Dava para teclar no formato certo e ver o
 * errado na linha seguinte.
 *
 * ⚠️ A ARMADILHA DAS DATAS "YYYY-MM-DD"
 *
 * `new Date('2026-08-28')` NÃO é 28 de agosto no seu fuso. O padrão manda
 * interpretar a data sem hora como UTC, então isso vira meia-noite em Londres —
 * e às 21h do dia 27 no Brasil. Escrever `toLocaleDateString('pt-BR')` em cima
 * disso mostra **27/08**.
 *
 * O erro não aparece em teste feito de dia na Europa, não aparece se o
 * desenvolvedor estiver em UTC, e some quando alguém "conserta" somando um dia
 * — o que quebra os fusos positivos. Duas telas do app já haviam topado com ele
 * e resolvido na unha, com `+ 'T12:00'`; as outras não sabiam.
 *
 * Aqui a string é quebrada em ano/mês/dia e montada como data LOCAL. Meio-dia,
 * e não meia-noite: com meia-noite, um fuso de uma hora para trás já joga a
 * data para o dia anterior de novo.
 */

/** O que estas funções aceitam: timestamp, `YYYY-MM-DD`, ou um Date pronto. */
export type Momento = number | string | Date;

/**
 * Converte para `Date` sem o desvio de fuso das datas sem hora.
 *
 * Devolve `null` para entrada vazia ou inválida — a tela decide o que mostrar
 * no lugar, e é melhor que um "Invalid Date" no meio da Ordem do Dia.
 */
export function paraData(v?: Momento | null): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') return isNaN(v) ? null : new Date(v);

  // `YYYY-MM-DD` puro: monta como data local, ao meio-dia.
  const so = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (so) {
    return new Date(Number(so[1]), Number(so[2]) - 1, Number(so[3]), 12, 0, 0);
  }

  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** R$ 1.234,56 */
export function dinheiro(valor?: number | null): string {
  const v = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** 1.234,56 — sem o "R$", para quando a tela já tem o símbolo do lado. */
export function numero(valor?: number | null, casas = 2): string {
  const v = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** 28/08/26 — a forma curta, para linha de lista. */
export function dataCurta(v?: Momento | null, vazio = '—'): string {
  const d = paraData(v);
  if (!d) return vazio;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** 28/08/2026 — o ano inteiro, para documento e cabeçalho. */
export function data(v?: Momento | null, vazio = '—'): string {
  const d = paraData(v);
  if (!d) return vazio;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 28/08/2026 14:30 */
export function dataHora(v?: Momento | null, vazio = '—'): string {
  const d = paraData(v);
  if (!d) return vazio;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    // A vírgula entre data e hora vem do `Intl` e sai daqui: em rodapé e linha
    // de lista ela só ocupa espaço, e o formato fica previsível para quem lê o
    // código esperando "28/08/2026 14:30".
  }).replace(',', '');
}

/** seg, 28/08 — para calendário e faixa de dias. */
export function diaDaSemana(v?: Momento | null, vazio = '—'): string {
  const d = paraData(v);
  if (!d) return vazio;
  const dia = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return `${dia}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
}
