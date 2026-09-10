/**
 * Junta do banco tudo o que a Ordem do Dia precisa.
 *
 * A separação com `montar.ts` é de propósito: lá não há `db`, então dá para
 * conferir o documento inteiro sem navegador — e a montagem não pode "descobrir"
 * um dado no meio do caminho, o que era exatamente o hábito da exportação
 * antiga.
 */
import { db } from '../../db/db';
import type { Cena, Diaria, ItemDoDia, Plano } from '../../types';
import type { ClimaDia } from '../clima';
import { montarLinhaDoDia } from '../linhaDoDia';
import { resolverArquivo } from '../arquivos';
import { normalizarCategoria } from '../decupagem';
import type { DiaVizinho, EntradaOD } from './montar';

export interface OpcoesColeta {
  /** A previsão já agrupada pela tela — evita bater na API de novo. */
  clima?: { locais: string[]; clima: ClimaDia }[];
  /** Sobrepõe `versao_od` quando a diária acabou de subir de versão. */
  versao?: number;
}

export async function coletarOD(diariaId: string, opcoes: OpcoesColeta = {}): Promise<EntradaOD | null> {
  const diaria = await db.diarias.get(diariaId);
  if (!diaria) return null;

  const projetoId = diaria.projeto_id;
  const projeto = await db.projetos.get(projetoId);
  if (!projeto) return null;

  const [cenas, planos, locacoes, perfis, departamentos, elementos, tags, tasks, diarias] =
    await Promise.all([
      db.cenas.where('projeto_id').equals(projetoId).toArray(),
      db.planos.where('projeto_id').equals(projetoId).toArray(),
      db.locacoes.where('projeto_id').equals(projetoId).toArray(),
      db.perfis.where('projeto_id').equals(projetoId).toArray(),
      db.departamentos.where('projeto_id').equals(projetoId).toArray(),
      db.elementos.where('projeto_id').equals(projetoId).toArray(),
      db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(),
      db.diaria_tasks.where('diaria_id').equals(diariaId).toArray(),
      db.diarias.where('projeto_id').equals(projetoId).toArray(),
    ]);

  const planosPorCena = new Map<string, Plano[]>();
  for (const p of planos) {
    if (!planosPorCena.has(p.cena_id)) planosPorCena.set(p.cena_id, []);
    planosPorCena.get(p.cena_id)!.push(p);
  }
  for (const lista of planosPorCena.values()) {
    lista.sort((a, b) => a.numero.localeCompare(b.numero, 'pt-BR', { numeric: true }));
  }

  const personagens = elementos
    .filter(el => normalizarCategoria(el.categoria) === 'ELENCO')
    .sort((a, b) => (a.cast_id ?? 999) - (b.cast_id ?? 999));

  /*
    Em que cenas cada personagem aparece.

    Sai das MARCAÇÕES do roteiro (`roteiro_tags`), que são por ocorrência, e não
    de um campo na cena: é a marcação que sabe que "Renata" e "sua mulher" são a
    mesma pessoa, porque as duas apontam para o mesmo `Elemento`.
  */
  const cenasPorPersonagem = new Map<string, Set<string>>();
  for (const t of tags) {
    if (!t.elemento_id || !t.cena_id) continue;
    if (!cenasPorPersonagem.has(t.elemento_id)) cenasPorPersonagem.set(t.elemento_id, new Set());
    cenasPorPersonagem.get(t.elemento_id)!.add(t.cena_id);
  }
  /*
    Cena marcada à mão, sem roteiro: `Cena.elenco_ids` aponta para PERFIS.
    Quando o perfil é o intérprete de um personagem, a cena entra por ele
    também — senão a coluna de elenco fica vazia em produção que nunca importou
    roteiro, que é a maioria das pequenas.
  */
  const personagemDoPerfil = new Map<string, string>();
  for (const p of personagens) if (p.perfil_id) personagemDoPerfil.set(p.perfil_id, p.id);
  for (const c of cenas) {
    for (const perfilId of c.elenco_ids || []) {
      const elId = personagemDoPerfil.get(perfilId);
      if (!elId) continue;
      if (!cenasPorPersonagem.has(elId)) cenasPorPersonagem.set(elId, new Set());
      cenasPorPersonagem.get(elId)!.add(c.id);
    }
  }

  return {
    projeto,
    diaria,
    itens: montarLinhaDoDia(diaria),
    cenas,
    planosPorCena,
    locacoes,
    perfis,
    departamentos,
    personagens,
    cenasPorPersonagem,
    clima: opcoes.clima || [],
    tasks,
    proximo: proximoDia(diarias, diaria.data, cenas),
    logo: (await resolverArquivo(projeto.logo_od)) || undefined,
    versao: opcoes.versao,
  };
}

/**
 * O dia seguinte de FILMAGEM — o próximo na data, e não o número seguinte.
 *
 * Depois da v4.9.0 os dois coincidem (a renumeração é por data), mas continuam
 * sendo perguntas diferentes: uma diária criada fora de ordem e ainda não
 * renumerada apontaria para o dia errado, e este bloco existe justamente para
 * quem se prepara na véspera.
 */
function proximoDia(todas: Diaria[], hoje: string, cenas: Cena[]): DiaVizinho | undefined {
  const seguinte = todas
    .filter(d => d.data > hoje)
    .sort((a, b) => a.data.localeCompare(b.data))[0];
  if (!seguinte) return undefined;

  const itens = montarLinhaDoDia(seguinte);
  const lista = itens
    .filter(i => i.tipo === 'cena' && i.cena_id)
    .map(i => ({ cena: cenas.find(c => c.id === i.cena_id), item: i }))
    .filter((x): x is { cena: Cena; item: ItemDoDia } => Boolean(x.cena));

  return { numero: seguinte.numero, data: seguinte.data, cenas: lista };
}
