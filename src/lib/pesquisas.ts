/**
 * Pesquisas para a equipe.
 *
 * Reaproveita o caminho que já existe para o cadastro: a definição vai para uma
 * tabela pública no Supabase, quem responde não precisa estar logado, e o app
 * puxa as respostas para o banco local.
 *
 * Por que tabela dedicada e não a `pesquisas` local: quem abre o link está no
 * navegador dele, sem login e sem IndexedDB do projeto. E expor as tabelas do
 * app ao público vazaria orçamento, PIX e ficha da equipe.
 */
import { db } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import type { Pesquisa, Pergunta, RespostaPesquisa } from '../types';

export const TABELA_PESQUISA = 'pesquisas_publicas';
export const TABELA_RESPOSTA = 'respostas_pesquisa';

function ehTabelaAusente(erro: any) {
  return erro?.code === 'PGRST205' || /schema cache|does not exist/i.test(erro?.message || '');
}

/** Publica (ou republica) a pesquisa para o link funcionar. */
export async function publicarPesquisa(pesquisa: Pesquisa): Promise<void> {
  if (!supabaseConfigurado) throw new Error('Supabase não está configurado neste ambiente.');

  const projeto = await db.projetos.get(pesquisa.projeto_id);

  const { error } = await supabase.from(TABELA_PESQUISA).upsert(
    {
      id: pesquisa.id,
      projeto_id: pesquisa.projeto_id,
      nome_projeto: projeto?.nome || '',
      titulo: pesquisa.titulo,
      descricao: pesquisa.descricao || '',
      perguntas: pesquisa.perguntas,
      aberta: pesquisa.aberta,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (!error) return;
  console.error('[SetProd] Falha ao publicar a pesquisa:', error);
  if (ehTabelaAusente(error)) {
    throw new Error(`a tabela "${TABELA_PESQUISA}" não existe no Supabase (rode o SQL da documentação).`);
  }
  throw new Error(error.message || 'não foi possível publicar no Supabase.');
}

/** Lê a pesquisa publicada — usado pela tela pública, sem login. */
export async function lerPesquisaPublica(id: string) {
  const { data, error } = await supabase
    .from(TABELA_PESQUISA)
    .select('id, projeto_id, nome_projeto, titulo, descricao, perguntas, aberta')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (ehTabelaAusente(error)) return null;
    throw error;
  }
  return data as null | {
    id: string; projeto_id: string; nome_projeto: string;
    titulo: string; descricao: string; perguntas: Pergunta[]; aberta: boolean;
  };
}

/** Envia uma resposta pelo link público. */
export async function enviarResposta(params: {
  pesquisaId: string;
  projetoId: string;
  nome?: string;
  respostas: Record<string, string | string[]>;
}): Promise<void> {
  const { error } = await supabase.from(TABELA_RESPOSTA).insert({
    id: crypto.randomUUID(),
    pesquisa_id: params.pesquisaId,
    projeto_id: params.projetoId,
    nome: params.nome || null,
    respostas: params.respostas,
    criado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message || 'não foi possível enviar a resposta.');
}

/**
 * Traz para o banco local as respostas que chegaram pelo link.
 *
 * Devolve quantas são novas, para a tela poder dizer "3 respostas novas" em vez
 * de só recarregar em silêncio.
 */
export async function puxarRespostas(projetoId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;

  const { data, error } = await supabase
    .from(TABELA_RESPOSTA)
    .select('*')
    .eq('projeto_id', projetoId);

  if (error) {
    if (ehTabelaAusente(error)) return 0;
    throw error;
  }
  if (!data?.length) return 0;

  const existentes = new Set(
    (await db.respostas_pesquisa.where('projeto_id').equals(projetoId).toArray()).map(r => r.id)
  );

  const novas: RespostaPesquisa[] = data
    .filter(r => !existentes.has(r.id))
    .map(r => ({
      id: r.id,
      pesquisa_id: r.pesquisa_id,
      projeto_id: r.projeto_id,
      nome: r.nome || undefined,
      respostas: r.respostas || {},
      data: new Date(r.criado_em).getTime(),
    }));

  if (novas.length) await db.respostas_pesquisa.bulkPut(novas);
  return novas.length;
}

// ---- Apuração ----

export interface ContagemOpcao {
  opcao: string;
  votos: number;
  pct: number;
}

export interface ApuracaoPergunta {
  pergunta: Pergunta;
  totalRespostas: number;
  /** Escolha única/múltipla e sim/não: contagem por opção, da maior para a menor. */
  contagens?: ContagemOpcao[];
  /** Texto livre: as respostas, na ordem em que chegaram. */
  textos?: { nome?: string; valor: string }[];
  /** Mais de uma opção no topo com o mesmo número de votos. */
  empate?: boolean;
}

/** Apura uma pesquisa inteira: cada pergunta com o resultado do seu tipo. */
export function apurar(pesquisa: Pesquisa, respostas: RespostaPesquisa[]): ApuracaoPergunta[] {
  return pesquisa.perguntas.map(p => {
    const valores = respostas
      .map(r => ({ nome: r.nome, valor: r.respostas[p.id] }))
      .filter(v => v.valor !== undefined && v.valor !== '' &&
        !(Array.isArray(v.valor) && v.valor.length === 0));

    if (p.tipo === 'texto') {
      return {
        pergunta: p,
        totalRespostas: valores.length,
        textos: valores.map(v => ({ nome: v.nome, valor: String(v.valor) })),
      };
    }

    const opcoes = p.tipo === 'sim_nao' ? ['Sim', 'Não'] : (p.opcoes || []);
    const contagem = new Map<string, number>(opcoes.map(o => [o, 0]));

    for (const v of valores) {
      const marcadas = Array.isArray(v.valor) ? v.valor : [String(v.valor)];
      for (const m of marcadas) {
        // Opção escrita fora da lista (pesquisa editada depois) ainda conta.
        contagem.set(m, (contagem.get(m) ?? 0) + 1);
      }
    }

    // O total é de pessoas, não de marcações: na múltipla escolha uma pessoa
    // pode marcar três opções, e a porcentagem tem que continuar legível.
    const totalPessoas = valores.length || 1;
    const contagens = [...contagem.entries()]
      .map(([opcao, votos]) => ({ opcao, votos, pct: Math.round((votos / totalPessoas) * 100) }))
      .sort((a, b) => b.votos - a.votos);

    const topo = contagens[0]?.votos ?? 0;
    const empate = topo > 0 && contagens.filter(c => c.votos === topo).length > 1;

    return { pergunta: p, totalRespostas: valores.length, contagens, empate };
  });
}

/** Resumo em texto puro da apuração — é o que vai para a IA. */
export function resumirParaIA(pesquisa: Pesquisa, apuracao: ApuracaoPergunta[]): string {
  const linhas: string[] = [`Pesquisa: ${pesquisa.titulo}`];
  if (pesquisa.descricao) linhas.push(pesquisa.descricao);

  for (const a of apuracao) {
    linhas.push('', `Pergunta: ${a.pergunta.texto} (${a.totalRespostas} resposta(s))`);
    if (a.contagens) {
      for (const c of a.contagens) linhas.push(`  - ${c.opcao}: ${c.votos} voto(s)`);
      if (a.empate) linhas.push('  (há empate no topo)');
    }
    if (a.textos) {
      for (const t of a.textos.slice(0, 40)) linhas.push(`  - ${t.nome ? t.nome + ': ' : ''}${t.valor}`);
    }
  }
  return linhas.join('\n');
}

/** A pesquisa mudou o suficiente para valer uma nova recomendação da IA? */
export function recomendacaoDesatualizada(pesquisa: Pesquisa, totalRespostas: number): boolean {
  if (!pesquisa.recomendacao) return true;
  return (pesquisa.recomendacao_respostas ?? 0) !== totalRespostas;
}
