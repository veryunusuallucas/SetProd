import type { Cena } from '../types';
import type { CabecalhoCena } from './decupagem';

/**
 * O que fazer com as cenas quando um roteiro novo é analisado.
 *
 * ⚠️ ANTES ISTO ERA "APAGA TUDO E CRIA DE NOVO".
 *
 * Reprocessar o PDF apagava todas as cenas vindas do roteiro e criava outras,
 * com ids novos. Três coisas morriam juntas, sem aviso:
 *
 *   · a ordem do stripboard e as quebras de diária, refeitas do zero;
 *   · a estimativa, o elenco marcado e a locação de cada cena;
 *   · o vínculo das diárias, que apontam para a cena pelo id — uma diária
 *     montada continuava lá, vazia, apontando para cenas que não existiam mais.
 *
 * E é o caso mais comum de todos: roteiro de produção vira v2, v3, v4. Trocar a
 * versão não pode custar o trabalho de montagem do dia.
 *
 * A CHAVE É O NÚMERO DA CENA, e não o id nem o texto.
 *
 * É o que a equipe usa para falar ("a 7B de amanhã"), é o que sobrevive a uma
 * revisão de diálogo, e é o que o roteirista mantém de propósito quando insere
 * cena nova com sufixo de letra em vez de renumerar o roteiro inteiro. Comparar
 * pelo cabeçalho quebraria em qualquer troca de locação; pelo corpo, em
 * qualquer reescrita.
 */

/** "7 a" e "7A" são a mesma cena escrita de dois jeitos. */
function chave(numero: string): string {
  return numero.replace(/\s+/g, '').toUpperCase();
}

export interface PlanoDeCenas {
  /** Já existiam e continuam no roteiro: mesmo id, dados atualizados. */
  atualizadas: { cena: Cena; campos: Partial<Cena> }[];
  /** Não existiam: entram no fim da ordem. */
  criadas: CabecalhoCena[];
  /** Estavam no stripboard e sumiram do roteiro novo. */
  sairam: Cena[];
  /** Estavam marcadas como fora e voltaram a aparecer. */
  voltaram: Cena[];
}

/**
 * Compara o que está gravado com o que o roteiro novo traz.
 *
 * Só olha as cenas que vieram de roteiro. Cena criada à mão no app não pertence
 * a nenhum PDF e não pode ser mexida por uma reanálise — quem a escreveu sabe
 * por que ela está lá.
 */
export function reconciliarCenas(
  existentes: Cena[],
  detectadas: CabecalhoCena[],
  roteiroId: string
): PlanoDeCenas {
  const doRoteiro = existentes.filter(c => c.origem_roteiro);
  const porNumero = new Map(doRoteiro.map(c => [chave(c.numero), c]));

  const plano: PlanoDeCenas = { atualizadas: [], criadas: [], sairam: [], voltaram: [] };
  const vistas = new Set<string>();

  for (const nova of detectadas) {
    const k = chave(nova.numero);
    vistas.add(k);
    const antiga = porNumero.get(k);

    if (!antiga) { plano.criadas.push(nova); continue; }

    /*
      O que a nova versão manda, e o que ela não encosta.

      Manda no que é do ROTEIRO: cabeçalho, local, interno/externo, período e o
      texto da cena. Não encosta no que é da PRODUÇÃO — ordem no stripboard,
      estimativa de duração, elenco escalado, locação escolhida —, porque isso
      não estava no PDF e não é o PDF que decide.
    */
    const campos: Partial<Cena> = {
      descricao: nova.local,
      ambiente: nova.ambiente,
      periodo: nova.periodo,
      corpo: nova.corpo.slice(0, 4000),
      roteiro_id: roteiroId,
    };
    if (antiga.fora_do_roteiro) {
      campos.fora_do_roteiro = false;
      plano.voltaram.push(antiga);
    }
    plano.atualizadas.push({ cena: antiga, campos });
  }

  /*
    As que sumiram NÃO são apagadas.

    Roteirista corta cena e volta atrás na versão seguinte, e a cena cortada
    pode já ter sido gravada — apagá-la levaria junto o registro do que foi
    feito no set. Ela sai da ordem de filmagem e fica numa lista à parte, com o
    aviso; se voltar ao roteiro, volta com tudo o que tinha.
  */
  for (const antiga of doRoteiro) {
    if (vistas.has(chave(antiga.numero))) continue;
    if (antiga.fora_do_roteiro) continue; // já estava fora
    plano.sairam.push(antiga);
  }

  return plano;
}

/**
 * O quanto o roteiro novo se parece com o que já está gravado — de 0 a 1.
 *
 * Serve para o app SUGERIR se aquilo é uma versão nova ou outro roteiro, em vez
 * de a pessoa ter que decidir no escuro. É sugestão, nunca decisão: um roteiro
 * pode ser renumerado do zero e continuar sendo o mesmo filme.
 */
export function semelhanca(existentes: Cena[], detectadas: CabecalhoCena[]): {
  fracao: number;
  batem: number;
  total: number;
} {
  const doRoteiro = existentes.filter(c => c.origem_roteiro);
  const total = detectadas.length;
  if (!doRoteiro.length || !total) return { fracao: 0, batem: 0, total };

  const numeros = new Set(doRoteiro.map(c => chave(c.numero)));
  const batem = detectadas.filter(d => numeros.has(chave(d.numero))).length;

  return { fracao: batem / total, batem, total };
}

/**
 * Acima disto, o app já vem com "é uma versão nova" marcado.
 *
 * Meio a meio é o ponto onde chutar deixa de ajudar: com metade das cenas
 * batendo, tanto faz ser uma revisão pesada ou outro roteiro que reaproveita a
 * numeração, e aí quem sabe é quem está olhando.
 */
export const LIMITE_MESMA_HISTORIA = 0.5;
