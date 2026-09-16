import type { Cena, Diaria, EstadoDaLogagem, KitDeLogagem, Plano, Take } from '../../types';
import { montarLinhaDoDia } from '../linhaDoDia';
import { indiceDoPlano, planoDoIndice } from './claquete';
import { aberturaQueCabe, aberturasDaLente } from './kits';

/**
 * Da decupagem para a claquete (PLANO-logagem §7.1).
 *
 * A decupagem já diz, para cada cena escalada, os planos que vão ser rodados:
 * número, lente, descrição. Preencher a claquete à mão com isso é redigitar o
 * que o app já sabe — e redigitar é onde o "cena 14" vira "cena 41".
 */

export interface PlanoDoDia {
  cena: Cena;
  plano: Plano;
  /** Como o plano vai aparecer na claquete (pode virar letra). */
  naClaquete: string;
  /** Quantos takes já foram logados para este setup nesta diária. */
  takes: number;
}

/**
 * O plano da decupagem como ele entra na claquete.
 *
 * Decupagem costuma numerar planos (1, 2, 3); claquete em modo letras usa
 * A, B, C. Com o modo letras ligado, o plano 2 vira B — o mesmo lugar na
 * sequência, no alfabeto de claquete. O que já vem em letras fica como está.
 */
export function planoNaClaquete(numero: string, letras: boolean): string {
  const limpo = String(numero ?? '').trim();
  if (!letras) return limpo;
  if (/^\d+$/.test(limpo)) return planoDoIndice(Number(limpo)) || limpo;
  return indiceDoPlano(limpo) ? limpo.toUpperCase() : limpo;
}

const numerico = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true });

/**
 * Os planos da diária, na ordem em que o dia vai acontecer.
 *
 * A ordem das cenas é a da linha do dia (a mesma da Ordem do Dia), e dentro de
 * cada cena a ordem da numeração dos planos. Cena escalada sem plano nenhum
 * não aparece: não há o que preencher.
 */
export function planosDaDiaria(dados: {
  diaria: Diaria;
  cenas: Cena[];
  planos: Plano[];
  takes: Take[];
  letras: boolean;
}): PlanoDoDia[] {
  const ordemDasCenas = montarLinhaDoDia(dados.diaria)
    .filter(i => i.tipo === 'cena' && i.cena_id)
    .map(i => i.cena_id as string);
  const escaladas = ordemDasCenas.length ? ordemDasCenas : dados.diaria.cena_ids || [];

  const lista: PlanoDoDia[] = [];
  for (const cenaId of escaladas) {
    const cena = dados.cenas.find(c => c.id === cenaId);
    if (!cena) continue;
    const daCena = dados.planos.filter(p => p.cena_id === cenaId).sort((a, b) => numerico(a.numero, b.numero));
    for (const plano of daCena) {
      const naClaquete = planoNaClaquete(plano.numero, dados.letras);
      const takes = dados.takes.filter(t =>
        t.plano_id === plano.id ||
        (String(t.cena).trim().toUpperCase() === String(cena.numero).trim().toUpperCase() &&
          String(t.plano).trim().toUpperCase() === naClaquete.toUpperCase())
      ).length;
      lista.push({ cena, plano, naClaquete, takes });
    }
  }
  return lista;
}

/**
 * O que muda no estado ao escolher um plano da decupagem.
 *
 * - cena e plano da decupagem; take volta para 1 (é setup novo — a mesma
 *   cascata de trocar a cena à mão);
 * - ambiente e luz da cena (INT/EXT, DIA/NOITE);
 * - a lente do plano: casada com o kit quando der, para a abertura já vir
 *   filtrada; senão, como texto;
 * - a descrição do plano no começo da observação, que é onde quem loga vai
 *   querer lê-la;
 * - os ids de cena e plano, para o take saber de onde veio.
 */
export function claqueteDoPlano(
  item: PlanoDoDia,
  estado: Pick<EstadoDaLogagem, 'abertura' | 'obs'>,
  kitDeLentes?: KitDeLogagem
): Partial<EstadoDaLogagem> {
  const { cena, plano } = item;
  const mudanca: Partial<EstadoDaLogagem> = {
    cena: String(cena.numero).trim(),
    plano: item.naClaquete,
    take: 1,
    cena_id: cena.id,
    plano_id: plano.id,
  };

  if (cena.ambiente) mudanca.ambiente = cena.ambiente === 'ext' ? 'EXT' : 'INT';
  if (cena.periodo) mudanca.luz = cena.periodo === 'noite' ? 'NOITE' : 'DIA';

  if (plano.lente?.trim()) {
    const lente = acharLente(kitDeLentes, plano.lente);
    if (lente) {
      mudanca.lente_ref = lente.id;
      mudanca.lente = `${lente.nome}${lente.focal ? ` ${lente.focal}` : ''}`.trim();
      mudanca.abertura = aberturaQueCabe(estado.abertura, aberturasDaLente(lente));
    } else {
      mudanca.lente_ref = '';
      mudanca.lente = plano.lente.trim();
    }
  }

  const descricao = String(plano.descricao ?? '').trim();
  if (descricao) {
    const atual = String(estado.obs ?? '').trim();
    // Não empilha a mesma descrição duas vezes se a pessoa escolher o plano de novo.
    mudanca.obs = atual.startsWith(descricao) ? atual : [descricao, atual].filter(Boolean).join(' — ');
  }

  return mudanca;
}

/**
 * A lente do kit que corresponde ao que a decupagem escreveu.
 *
 * A decupagem escreve "35mm" ou "Helios 58"; o kit tem nome e focal separados.
 * Casa pelo nome inteiro, depois pela focal (só os números, "35mm" = "35 mm").
 */
export function acharLente(kit: KitDeLogagem | undefined, escrito: string) {
  const lentes = kit?.lentes ?? [];
  const alvo = escrito.trim().toLowerCase();
  if (!alvo) return undefined;

  const porNome =
    lentes.find(l => `${l.nome} ${l.focal ?? ''}`.trim().toLowerCase() === alvo) ??
    lentes.find(l => l.nome.trim().toLowerCase() === alvo);
  if (porNome) return porNome;

  // Só pela focal quando a decupagem escreveu SÓ a focal ("35mm", "35 mm").
  // "Helios 58" não pode casar com qualquer 58mm do kit.
  const focal = alvo.match(/^(\d+(?:[.,]\d+)?)\s*mm$/)?.[1];
  if (!focal) return undefined;
  return lentes.find(l => (String(l.focal ?? '').match(/\d+(?:[.,]\d+)?/) || [])[0] === focal);
}
