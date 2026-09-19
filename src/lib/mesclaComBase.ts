/**
 * Mesclar com a base — a diferença entre "mudou" e "discorda".
 *
 * O PROBLEMA (PLANO-conflitos-sync, passos 4 e 5)
 * Com duas versões na mão, tudo que difere parece briga. Uma pessoa mexeu no
 * transporte, a outra nos horários: nenhum campo se cruza, e mesmo assim um dos
 * dois trabalhos sumia. Comparar as duas não distingue "o outro mudou isto" de
 * "nós dois mudamos isto".
 *
 * A terceira versão resolve. A BASE é o registro como veio do servidor da última
 * vez, antes de qualquer um editar. É o mesmo princípio do `git merge`:
 *
 *   base "18h" · local "18h" · remoto "19h"  → só o remoto mudou → 19h
 *   base "18h" · local "20h" · remoto "18h"  → só o local mudou  → 20h
 *   base "18h" · local "20h" · remoto "19h"  → os dois mudaram   → DISPUTA
 *
 * Sem a base, os dois primeiros casos são indistinguíveis do terceiro — e o app
 * perguntaria em coisa que não é conflito. Perguntar demais é como não perguntar:
 * a pessoa clica no automático.
 */

type Registro = Record<string, unknown>;

/**
 * Campos que MUDAM sozinhos e nunca são disputa.
 * Carimbo não é conteúdo; incluí-lo faria toda mescla virar briga.
 */
const IGNORAR = new Set(['atualizado_em', 'criado_em', 'escala_carimbos']);

/**
 * Listas em que a ORDEM ou a soma significam — não dá para unir.
 *
 * `pagadores` e `devedores` carregam dinheiro repartido: unir duas versões
 * somaria valores que ninguém lançou. Vão para disputa, como qualquer campo.
 */
const SEM_UNIAO = new Set(['pagadores', 'devedores', 'planos', 'ordem', 'takes']);

/**
 * DINHEIRO NÃO SE MESCLA SOZINHO (PLANO-conflitos-sync, §5).
 *
 * Nestes campos, qualquer diferença entre os dois lados vira pergunta — mesmo
 * quando a base diz que só um lado mexeu. A regra é mais dura de propósito: em
 * dinheiro, um erro silencioso não destrói a confiança naquele número, destrói
 * a confiança em TODOS os números do app.
 */
const DINHEIRO = new Set([
  'valor', 'valor_total', 'valor_ideal', 'limite_gasto', 'valor_diaria',
  'orcamento_departamento', 'pagadores', 'devedores', 'aportes',
]);

/** Onde a regra do dinheiro vale. Fora daqui, um campo "valor" é só um número. */
const TABELAS_DE_DINHEIRO = new Set(['despesas', 'aportes', 'acertos', 'projetos', 'configuracoes']);

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Lista de texto (ids, tags) — o único formato que dá para unir com segurança. */
function ehListaDeTexto(v: unknown): v is string[] {
  return Array.isArray(v) && v.every(x => typeof x === 'string');
}

/**
 * Une duas listas usando a base para saber o que foi TIRADO de propósito.
 *
 * União sozinha não sabe remover: se A tirou alguém da escala e B não mexeu, a
 * união traz a pessoa de volta — e o trabalho de A desaparece parecendo bug. Com
 * a base dá para separar "nunca esteve aqui" de "foi removido".
 */
function unirListas(base: string[], local: string[], remoto: string[]): string[] {
  const naBase = new Set(base);
  const tirados = new Set([
    ...base.filter(x => !local.includes(x)),
    ...base.filter(x => !remoto.includes(x)),
  ]);

  const saida: string[] = [];
  for (const x of [...base, ...local, ...remoto]) {
    if (saida.includes(x)) continue;
    if (tirados.has(x)) continue;
    // Entrou depois da base num dos lados, ou já estava e ninguém tirou.
    if (naBase.has(x) || local.includes(x) || remoto.includes(x)) saida.push(x);
  }
  return saida;
}

export interface Mescla {
  /** O registro resultante. Com disputa, é a versão do servidor. */
  resultado: Registro;
  /** Campos em que os dois lados mexeram e discordam. Vazio = mesclou sozinho. */
  disputa: string[];
  /** Campos em que a nossa alteração foi preservada — para o aviso discreto. */
  meusCamposMantidos: string[];
}

/**
 * Mescla campo a campo. Sem base, tudo que difere é disputa — é o comportamento
 * honesto: sem a terceira versão não dá para saber quem mudou o quê.
 */
export function mesclarComBase(
  base: Registro | null | undefined,
  local: Registro,
  remoto: Registro,
  /** A tabela, só para a regra do dinheiro saber onde vale. */
  tabela?: string,
): Mescla {
  const resultado: Registro = { ...remoto };
  const disputa: string[] = [];
  const meusCamposMantidos: string[] = [];

  const campos = new Set([...Object.keys(local), ...Object.keys(remoto), ...Object.keys(base || {})]);

  for (const campo of campos) {
    if (IGNORAR.has(campo)) continue;

    const b = base?.[campo];
    const l = local[campo];
    const r = remoto[campo];

    if (igual(l, r)) continue;

    // Dinheiro: diferiu, pergunta. Sem exceção e sem esperteza.
    if (tabela && TABELAS_DE_DINHEIRO.has(tabela) && DINHEIRO.has(campo)) {
      disputa.push(campo);
      continue;
    }

    const mudouLocal = !base || !igual(l, b);
    const mudouRemoto = !base || !igual(r, b);

    if (mudouLocal && !mudouRemoto) {
      resultado[campo] = l;
      meusCamposMantidos.push(campo);
      continue;
    }
    if (!mudouLocal && mudouRemoto) continue; // já está no resultado

    // Os dois mexeram. Lista de texto ainda tem salvação: unir não perde nada
    // de ninguém, e a base diz quem foi tirado de propósito.
    if (base && !SEM_UNIAO.has(campo) && ehListaDeTexto(l) && ehListaDeTexto(r) && (ehListaDeTexto(b) || b === undefined)) {
      const unido = unirListas((b as string[]) || [], l, r);
      resultado[campo] = unido;
      if (!igual(unido, r)) meusCamposMantidos.push(campo);
      continue;
    }

    disputa.push(campo);
  }

  if (disputa.length) return { resultado: { ...remoto }, disputa, meusCamposMantidos: [] };
  return { resultado, disputa, meusCamposMantidos };
}
