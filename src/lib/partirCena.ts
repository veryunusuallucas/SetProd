import type { ItemDoDia, Plano } from '../types';
import { minutosDe } from './stripboard';

/**
 * Partir uma cena no meio do dia — o lanche entre o plano C e o plano D.
 *
 * DE ONDE VEIO
 * Um AD, gravando documentário: *"a gente vai gravar entrevista com Rogério,
 * depois lanchar, depois voltar. não consigo fazer isso no stripboard"*. E o
 * Lucas afinou o pedido: a unidade que a produção interrompe não é a cena, é o
 * PLANO. *"antes do almoço vai ser gravado a cena 5 e os planos A, B, C, mas
 * entre o C e o D vai ser o almoço"*.
 *
 * ⚠️ A CENA CONTINUA SENDO UMA SÓ.
 *
 * Isto NÃO cria 5A e 5B na decupagem. A cena 5 permanece uma cena, com uma
 * contagem de páginas, uma lista de planos e um registro do que foi gravado —
 * porque é isso que ela é. O que se parte é a AGENDA: a cena aparece duas vezes
 * na linha do dia, e cada aparição diz quais planos entram nela.
 *
 * A alternativa era criar cenas 5A e 5B de verdade. Ela resolve o mesmo caso e
 * cobra caro por isso: a decupagem passa a ter duas cenas onde o roteiro tem
 * uma, a conta de páginas precisa ser rachada no chute, e a próxima análise do
 * roteiro — que reconcilia pelo NÚMERO da cena — não saberia o que fazer com
 * uma "5A" que o PDF não tem.
 */

/** Um trecho da cena dentro do dia. */
export interface TrechoDeCena {
  item: ItemDoDia;
}

/**
 * Como o trecho se chama na tira: "planos 1–3", "planos 2, 5", "5A".
 *
 * A faixa contígua vira intervalo, e o resto vira lista. É a diferença entre
 * "planos 1–6" e "planos 1, 2, 3, 4, 5, 6" numa tira de 250 pixels.
 */
export function rotuloDoTrecho(item: ItemDoDia, planosDaCena: Plano[]): string | null {
  if (item.parte) return item.parte;
  if (!item.planos_ids?.length) return null;

  const numeros = planosDaCena
    .filter(p => item.planos_ids!.includes(p.id))
    .map(p => p.numero);
  if (numeros.length === 0) return null;
  if (numeros.length === 1) return `plano ${numeros[0]}`;

  /*
    Contíguos NA ORDEM DE FILMAGEM, e não pelo número.

    Os planos já chegam ordenados por `ordenarPlanos`, e é essa ordem que a
    equipe segue no set. Testar se "1,2,3" são consecutivos aritmeticamente
    quebraria em 3, 3A, 4 — que é uma faixa contínua com números que não somam.
  */
  const posicoes = planosDaCena
    .map((p, i) => (item.planos_ids!.includes(p.id) ? i : -1))
    .filter(i => i >= 0);
  const seguidos = posicoes.every((pos, i) => i === 0 || pos === posicoes[i - 1] + 1);

  return seguidos
    ? `planos ${numeros[0]}–${numeros[numeros.length - 1]}`
    : `planos ${numeros.join(', ')}`;
}

/**
 * Divide um item de cena em dois, no ponto escolhido.
 *
 * `corteApos` é o índice do último plano que fica no PRIMEIRO trecho. Sem
 * planos, a cena é cortada ao meio e os trechos viram A e B.
 *
 * ⚠️ A DURAÇÃO É REPARTIDA, e isso não é enfeite. `duracaoDoItem` cai na
 * estimativa da cena quando o item não tem duração própria — então dois trechos
 * sem duração fariam o dia inteiro contar a cena DUAS VEZES, empurrando o wrap
 * previsto horas para a frente. Ela é repartida na proporção dos planos, porque
 * três planos de seis é meia cena; sem planos, meio a meio.
 */
export function partirItemDeCena(
  item: ItemDoDia,
  planosDaCena: Plano[],
  corteApos: number,
  duracaoAtual: number
): [ItemDoDia, ItemDoDia] {
  const comPlanos = planosDaCena.length > 0;

  const idsPrimeiro = comPlanos ? planosDaCena.slice(0, corteApos + 1).map(p => p.id) : undefined;
  const idsSegundo = comPlanos ? planosDaCena.slice(corteApos + 1).map(p => p.id) : undefined;

  const fracao = comPlanos && planosDaCena.length > 0
    ? (corteApos + 1) / planosDaCena.length
    : 0.5;

  const primeiro: ItemDoDia = {
    ...item,
    ...(comPlanos ? { planos_ids: idsPrimeiro } : { parte: 'A' }),
    duracao_min: Math.max(5, Math.round(duracaoAtual * fracao)),
  };

  const segundo: ItemDoDia = {
    // Id próprio: dois itens da mesma cena não podem dividir identidade, ou a
    // linha não sabe qual deles arrastar.
    id: crypto.randomUUID(),
    tipo: 'cena',
    cena_id: item.cena_id,
    ...(comPlanos ? { planos_ids: idsSegundo } : { parte: 'B' }),
    duracao_min: Math.max(5, duracaoAtual - Math.max(5, Math.round(duracaoAtual * fracao))),
  };

  return [primeiro, segundo];
}

/**
 * Junta de volta todos os trechos de uma cena, no lugar do primeiro.
 *
 * A duração volta a ser a soma do que os trechos tinham — e não a estimativa da
 * cena. Quem partiu pode ter ajustado o tempo de cada metade, e devolver a
 * estimativa original apagaria esse ajuste sem avisar.
 */
export function juntarTrechos(linha: ItemDoDia[], cenaId: string): ItemDoDia[] {
  const trechos = linha.filter(i => i.tipo === 'cena' && i.cena_id === cenaId);
  if (trechos.length < 2) return linha;

  const soma = trechos.reduce((s, i) => s + (i.duracao_min ?? 0), 0);
  let jaPos = false;

  return linha.flatMap(i => {
    if (i.tipo !== 'cena' || i.cena_id !== cenaId) return [i];
    if (jaPos) return [];
    jaPos = true;
    const { planos_ids, parte, ...resto } = i;
    void planos_ids; void parte;
    return [{ ...resto, duracao_min: soma || undefined }];
  });
}

/** Quantos trechos desta cena existem no dia. 1 = cena inteira, como sempre. */
export function trechosDaCena(linha: ItemDoDia[], cenaId?: string): number {
  if (!cenaId) return 0;
  return linha.filter(i => i.tipo === 'cena' && i.cena_id === cenaId).length;
}

/** A duração que um trecho deve herdar quando a cena ainda não foi partida. */
export function duracaoInicial(item: ItemDoDia, estimativa?: string): number {
  if (item.duracao_min !== undefined) return item.duracao_min;
  return minutosDe(estimativa) || 60;
}
