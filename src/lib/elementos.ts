/**
 * Inventário de elementos do breakdown.
 *
 * O modelo tem duas camadas de propósito:
 *  - `RoteiroTag` é uma OCORRÊNCIA: este trecho, nesta página do PDF.
 *  - `Elemento` é a COISA: a Renata, a arma do Marcos, a chuva.
 *
 * O roteiro chama a mesma pessoa de "Renata" e de "sua mulher". Enquanto só
 * existiam ocorrências, isso virava dois itens na lista de elenco e duas
 * contagens de diária. Com o elemento no meio, os dois nomes apontam para a
 * mesma entidade — é o "merge" que o mercado espera.
 */
import { db } from '../db/db';
import type { Elemento, RoteiroTag } from '../types';
import { normalizarCategoria } from './decupagem';

/** Forma comparável de um nome: sem acento, sem caixa, sem pontuação. */
export function chaveNome(nome: string): string {
  return nome
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Garante que toda marcação tenha um elemento por trás, criando os que faltam.
 *
 * É idempotente de propósito: roda ao abrir a decupagem e depois de cada
 * análise da IA, sem duplicar nada. Marcações antigas (gravadas antes deste
 * recurso) são adotadas na primeira execução.
 */
export async function sincronizarElementos(projetoId: string): Promise<number> {
  // Tudo numa transação de escrita: o React chama isto duas vezes em
  // desenvolvimento (StrictMode) e as duas execuções liam o banco antes de
  // qualquer uma gravar, criando dois "Renata". O IndexedDB serializa
  // transações rw sobre as mesmas tabelas, então a segunda já vê a primeira.
  return db.transaction('rw', db.elementos, db.roteiro_tags, async () => {
    return sincronizarDentroDaTransacao(projetoId);
  });
}

async function sincronizarDentroDaTransacao(projetoId: string): Promise<number> {
  const [tags, existentes] = await Promise.all([
    db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(),
    db.elementos.where('projeto_id').equals(projetoId).toArray(),
  ]);

  /** Índice por categoria + nome, incluindo os aliases já mesclados. */
  const porChave = new Map<string, Elemento>();
  /** Duplicatas de execuções antigas: o primeiro fica, os outros somem. */
  const duplicados: { manter: string; remover: string }[] = [];

  for (const el of existentes) {
    const chave = `${el.categoria}|${chaveNome(el.nome)}`;
    const jaExiste = porChave.get(chave);
    if (jaExiste) {
      duplicados.push({ manter: jaExiste.id, remover: el.id });
      continue;
    }
    porChave.set(chave, el);
    for (const a of el.aliases || []) porChave.set(`${el.categoria}|${chaveNome(a)}`, el);
  }

  if (duplicados.length) {
    const mapaRemocao = new Map(duplicados.map(d => [d.remover, d.manter]));
    for (const t of tags) {
      const destino = t.elemento_id ? mapaRemocao.get(t.elemento_id) : undefined;
      if (destino) await db.roteiro_tags.update(t.id, { elemento_id: destino });
    }
    await db.elementos.bulkDelete(duplicados.map(d => d.remover));
  }

  const novos: Elemento[] = [];
  const vinculos: { id: string; elemento_id: string }[] = [];

  for (const tag of tags) {
    const categoria = normalizarCategoria(tag.categoria);
    const chave = `${categoria}|${chaveNome(tag.texto_selecionado)}`;

    let alvo = porChave.get(chave);
    if (!alvo) {
      alvo = {
        id: crypto.randomUUID(),
        projeto_id: projetoId,
        nome: tag.texto_selecionado.trim(),
        categoria,
      };
      porChave.set(chave, alvo);
      novos.push(alvo);
    }

    if (tag.elemento_id !== alvo.id) vinculos.push({ id: tag.id, elemento_id: alvo.id });
  }

  if (novos.length) await db.elementos.bulkAdd(novos);
  for (const v of vinculos) await db.roteiro_tags.update(v.id, { elemento_id: v.elemento_id });

  // Elemento sem nenhuma ocorrência é resto de marcação apagada. Deixá-lo no
  // inventário faz a lista de elenco mostrar gente que não está mais no
  // roteiro — e queima um Cast ID à toa.
  const usados = new Set<string>();
  for (const t of tags) {
    const categoria = normalizarCategoria(t.categoria);
    const alvo = porChave.get(`${categoria}|${chaveNome(t.texto_selecionado)}`);
    if (alvo) usados.add(alvo.id);
  }
  const orfaos = [...porChave.values()]
    .filter((el, i, arr) => arr.findIndex(o => o.id === el.id) === i)
    .filter(el => !usados.has(el.id) && !el.notas && !(el.imagens?.length));

  if (orfaos.length) await db.elementos.bulkDelete(orfaos.map(o => o.id));

  await atribuirCastIds(projetoId);
  return novos.length;
}

/**
 * Numera o elenco por ordem de entrada no roteiro (Cast ID).
 *
 * A ordem é a da primeira página em que o personagem aparece — é assim que a
 * produção lê a lista, e é o que faz o número significar alguma coisa. Quem já
 * tem número mantém: renumerar a cada análise bagunçaria relatórios impressos.
 */
export async function atribuirCastIds(projetoId: string): Promise<void> {
  const elenco = (await db.elementos.where('projeto_id').equals(projetoId).toArray())
    .filter(e => e.categoria === 'ELENCO');
  if (elenco.length === 0) return;

  const semNumero = elenco.filter(e => e.cast_id === undefined);
  if (semNumero.length === 0) return;

  const tags = await db.roteiro_tags.where('projeto_id').equals(projetoId).toArray();
  const primeiraPagina = new Map<string, number>();
  for (const t of tags) {
    if (!t.elemento_id) continue;
    const atual = primeiraPagina.get(t.elemento_id);
    if (atual === undefined || t.pagina < atual) primeiraPagina.set(t.elemento_id, t.pagina);
  }

  let proximo = Math.max(0, ...elenco.map(e => e.cast_id ?? 0)) + 1;
  const ordenados = [...semNumero].sort(
    (a, b) => (primeiraPagina.get(a.id) ?? 9999) - (primeiraPagina.get(b.id) ?? 9999)
  );

  for (const el of ordenados) {
    await db.elementos.update(el.id, { cast_id: proximo++ });
  }
}

/**
 * Junta vários elementos num só. O `principalId` fica; os outros viram aliases
 * e suas ocorrências passam a apontar para ele.
 */
export async function mesclarElementos(principalId: string, outrosIds: string[]): Promise<void> {
  const principal = await db.elementos.get(principalId);
  if (!principal) return;

  const outros = (await db.elementos.bulkGet(outrosIds)).filter(Boolean) as Elemento[];
  if (outros.length === 0) return;

  const aliases = new Set(principal.aliases || []);
  for (const o of outros) {
    aliases.add(o.nome);
    for (const a of o.aliases || []) aliases.add(a);
  }
  // O nome canônico não pode constar como apelido de si mesmo.
  aliases.delete(principal.nome);

  const tags = await db.roteiro_tags.where('projeto_id').equals(principal.projeto_id).toArray();
  const mover = tags.filter(t => t.elemento_id && outrosIds.includes(t.elemento_id));

  await db.transaction('rw', db.elementos, db.roteiro_tags, async () => {
    for (const t of mover) await db.roteiro_tags.update(t.id, { elemento_id: principalId });
    await db.elementos.update(principalId, {
      aliases: [...aliases],
      // Se o principal ainda não tinha número, herda o menor dos mesclados.
      cast_id: principal.cast_id ?? outros.map(o => o.cast_id).filter((n): n is number => n !== undefined).sort((a, b) => a - b)[0],
    });
    await db.elementos.bulkDelete(outros.map(o => o.id));
  });
}

/** Desfaz um alias: ele volta a ser um elemento próprio, com suas ocorrências. */
export async function separarAlias(elementoId: string, alias: string): Promise<void> {
  const principal = await db.elementos.get(elementoId);
  if (!principal) return;

  const novo: Elemento = {
    id: crypto.randomUUID(),
    projeto_id: principal.projeto_id,
    nome: alias,
    categoria: principal.categoria,
  };

  const tags = await db.roteiro_tags.where('elemento_id').equals(elementoId).toArray();
  const doAlias = tags.filter(t => chaveNome(t.texto_selecionado) === chaveNome(alias));

  await db.transaction('rw', db.elementos, db.roteiro_tags, async () => {
    await db.elementos.add(novo);
    for (const t of doAlias) await db.roteiro_tags.update(t.id, { elemento_id: novo.id });
    await db.elementos.update(elementoId, {
      aliases: (principal.aliases || []).filter(a => a !== alias),
    });
  });
}

// ---- Sugestão de merge ----

export interface SugestaoMerge {
  principal: Elemento;
  candidato: Elemento;
  motivo: string;
}

/** Termos que descrevem uma pessoa sem nomeá-la — os suspeitos de sempre. */
const REFERENCIAS_INDIRETAS = [
  'sua ', 'seu ', 'a esposa', 'o marido', 'a mulher', 'o homem', 'a moça',
  'o rapaz', 'a mãe', 'o pai', 'a filha', 'o filho', 'o detetive', 'a secretária',
];

/**
 * Aponta pares que provavelmente são a mesma coisa, sem precisar de IA.
 *
 * Dois sinais bastam para a maioria dos casos reais:
 *  - um nome é pedaço do outro ("Marcos" dentro de "Marcos Silva");
 *  - um dos dois é uma referência indireta ("sua mulher") e os dois aparecem
 *    na mesma página — que é como o roteiro apresenta o personagem.
 *
 * A decisão continua sendo humana: isto só monta a pergunta.
 */
export function sugerirMerges(elementos: Elemento[], tags: RoteiroTag[]): SugestaoMerge[] {
  const paginasDe = new Map<string, Set<number>>();
  for (const t of tags) {
    if (!t.elemento_id) continue;
    if (!paginasDe.has(t.elemento_id)) paginasDe.set(t.elemento_id, new Set());
    paginasDe.get(t.elemento_id)!.add(t.pagina);
  }

  const ehIndireta = (nome: string) => {
    const n = chaveNome(nome);
    return REFERENCIAS_INDIRETAS.some(r => n.startsWith(chaveNome(r)));
  };

  const sugestoes: SugestaoMerge[] = [];

  for (let i = 0; i < elementos.length; i++) {
    for (let j = i + 1; j < elementos.length; j++) {
      const a = elementos[i], b = elementos[j];
      if (a.categoria !== b.categoria) continue;

      const ka = chaveNome(a.nome), kb = chaveNome(b.nome);
      if (!ka || !kb) continue;

      if (ka !== kb && (ka.includes(kb) || kb.includes(ka))) {
        // O nome mais completo vira o canônico.
        const [principal, candidato] = ka.length >= kb.length ? [a, b] : [b, a];
        sugestoes.push({ principal, candidato, motivo: 'um nome contém o outro' });
        continue;
      }

      const aIndireta = ehIndireta(a.nome), bIndireta = ehIndireta(b.nome);
      if (aIndireta === bIndireta) continue;

      const pa = paginasDe.get(a.id) || new Set();
      const pb = paginasDe.get(b.id) || new Set();
      const juntos = [...pa].some(p => pb.has(p));
      if (!juntos) continue;

      const [principal, candidato] = aIndireta ? [b, a] : [a, b];
      sugestoes.push({
        principal,
        candidato,
        motivo: `"${candidato.nome}" aparece na mesma página que "${principal.nome}"`,
      });
    }
  }

  return sugestoes;
}
