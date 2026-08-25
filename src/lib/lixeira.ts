import { db, TABELAS_SINCRONIZADAS } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import { participacaoLocal, participacoesLocais, purgarProjetoNoServidor } from './membros';
import { apagarAnexosDoProjeto } from './arquivos';
import { apagarPesquisaPublica } from './pesquisas';
import { reiniciarCursor, cursorDe } from './sincronizacao';
import type { Projeto } from '../types';

/**
 * A lixeira das produções.
 *
 * Apagar era definitivo, imediato e valia para as duas equipes: um clique
 * derrubava o espelho, os anexos, as participações e os links de pesquisa, sem
 * volta. Numa produção compartilhada isso é um botão de autodestruição comum.
 *
 * Agora há dois passos separados:
 *   mandar para a lixeira — reversível, qualquer membro, some da lista
 *   destruir              — irreversível, só quem criou (ou o admin)
 *
 * A marca vive no próprio registro do projeto, que já viaja pelo espelho: as
 * duas equipes veem a mesma lixeira sem tabela nova e sem SQL a mais.
 */

export const RETENCAO_DIAS = 7;
const RETENCAO_MS = RETENCAO_DIAS * 24 * 60 * 60 * 1000;

export const estaNaLixeira = (p: Projeto) => Boolean(p.lixeira_em);

/** Dias que faltam até sumir. Zero significa "já passou do prazo". */
export function diasRestantes(p: Projeto): number {
  if (!p.lixeira_em) return RETENCAO_DIAS;
  const restante = p.lixeira_em + RETENCAO_MS - Date.now();
  return Math.max(0, Math.ceil(restante / (24 * 60 * 60 * 1000)));
}

export async function mandarParaLixeira(projetoId: string): Promise<void> {
  const { data: sessao } = await supabase.auth.getSession().catch(() => ({ data: null } as any));
  await db.projetos.update(projetoId, {
    lixeira_em: Date.now(),
    lixeira_por: sessao?.session?.user?.id,
  });
}

export async function restaurarDaLixeira(projetoId: string): Promise<void> {
  // `undefined` não apaga o campo no Dexie update — só ignora. Gravar o objeto
  // inteiro sem as chaves é o que realmente tira a produção da lixeira, e é
  // isso que precisa viajar para a outra equipe.
  const projeto = await db.projetos.get(projetoId);
  if (!projeto) return;

  const { lixeira_em, lixeira_por, ...limpo } = projeto;
  void lixeira_em; void lixeira_por;
  await db.projetos.put(limpo as Projeto);
}

/** Posso destruir esta produção de vez? */
export async function podeDestruir(projetoId: string): Promise<boolean> {
  if (!supabaseConfigurado) return true; // sem servidor, o dado é só seu
  if (participacaoLocal(projetoId)?.papel === 'dono') return true;

  try {
    const { data } = await supabase.rpc('pode_destruir', { p_projeto: projetoId });
    return Boolean(data);
  } catch {
    return false;
  }
}

/**
 * Apaga a produção deste aparelho — e só dele.
 *
 * Existe separado porque nem todo mundo pode destruir no servidor, mas todo
 * mundo precisa parar de carregar uma produção morta. Sem isto, a Equipe B
 * ficaria com uma cópia fantasma para sempre: o `puxar` traz linhas, nunca a
 * ausência delas, então uma produção destruída pelo dono jamais sumiria sozinha
 * do aparelho de quem não a destruiu.
 */
export async function apagarSomenteLocal(projetoId: string): Promise<void> {
  for (const tabela of TABELAS_SINCRONIZADAS) {
    if (tabela === 'projetos') continue;
    await db.table(tabela).where('projeto_id').equals(projetoId).delete().catch(() => {});
  }
  for (const extra of ['notificacoes', 'pesquisas', 'respostas_pesquisa'] as const) {
    await db.table(extra).where('projeto_id').equals(projetoId).delete().catch(() => {});
  }
  await db.arquivos.where('projeto_id').equals(projetoId).delete().catch(() => {});
  await db.configuracoes.delete(projetoId).catch(() => {});
  await db.projetos.delete(projetoId);

  // A caixa de saída também: pendência de uma produção que já não existe aqui
  // só voltaria como erro na próxima sincronização.
  await new Promise(r => setTimeout(r, 300));
  await db.sync_queue.where('projeto_id').equals(projetoId).delete().catch(() => {});
  reiniciarCursor(projetoId);
  localStorage.removeItem(`setprod_anexos_migrados_${projetoId}`);
}

/**
 * Destrói de vez: servidor e aparelho.
 *
 * A ordem importa. Os anexos e as pesquisas saem ANTES da participação, porque
 * é a participação que dá permissão para apagá-los — purgar primeiro tiraria a
 * chave da própria mão e deixaria o arquivo no Storage para sempre.
 */
export async function destruirProducao(projetoId: string): Promise<void> {
  const pesquisas = await db.pesquisas.where('projeto_id').equals(projetoId).toArray();
  for (const p of pesquisas) {
    await apagarPesquisaPublica(p.id).catch(e =>
      console.warn('[SetProd] Link da pesquisa continua ativo:', p.titulo, e?.message)
    );
  }

  await apagarAnexosDoProjeto(projetoId).catch(e =>
    console.warn('[SetProd] Anexos não foram apagados do servidor:', e?.message)
  );

  await purgarProjetoNoServidor(projetoId);
  await apagarSomenteLocal(projetoId);
}

/**
 * Tira do aparelho as produções que outra pessoa destruiu no servidor.
 *
 * O PROBLEMA QUE ELA RESOLVE
 * `puxar` traz linhas; nunca traz a ausência delas. Quando o dono destrói uma
 * produção, o `purgar_projeto` apaga o espelho, os anexos e as participações —
 * e a outra equipe fica com a cópia inteira no IndexedDB, para sempre. Ela
 * aparece na lixeira dizendo "some em 7 dias" e nunca some, porque não há nada
 * chegando que diga que ela morreu.
 *
 * COMO DESCOBRIR SEM TABELA NOVA
 * `projeto_livre_para_fundar` já responde exatamente a pergunta certa: "este
 * projeto está sem nenhum membro E sem nenhuma linha no espelho?". É o estado
 * em que um projeto fica depois de purgado.
 *
 * OS DOIS CASOS QUE PARECEM IGUAIS E NÃO SÃO
 * Perder a participação pode significar duas coisas, e elas pedem respostas
 * opostas:
 *
 *   · a produção foi destruída  → a cópia local não serve para nada, apaga
 *   · eu fui removido dela      → a produção continua viva com as outras
 *                                 pessoas, e apagar a minha cópia seria apagar
 *                                 trabalho que ainda existe
 *
 * A função separa os dois: só apaga quando o servidor confirma que não sobrou
 * nada lá. Remover alguém continua NÃO apagando a cópia dessa pessoa, que é a
 * decisão registrada na Etapa 5 do ROADMAP.
 *
 * A TRAVA CONTRA APAGAR O QUE É SÓ SEU
 * Uma produção que nunca subiu para o servidor também responde "livre para
 * fundar" — não há membro nem linha lá, porque ela nunca chegou lá. Apagá-la
 * seria destruir o trabalho de quem usa o app offline. Por isso a checagem só
 * vale para quem TEM CURSOR: cursor é a prova de que aquele projeto já foi lido
 * do servidor pelo menos uma vez.
 */
export async function limparProducoesDestruidas(): Promise<string[]> {
  if (!supabaseConfigurado || !navigator.onLine) return [];

  const meus = new Set(participacoesLocais().map(p => p.projeto_id));
  const projetos = await db.projetos.toArray();
  const sumidas: string[] = [];

  for (const p of projetos) {
    // Ainda sou membro: está viva e é minha.
    if (meus.has(p.id)) continue;
    // Nunca veio do servidor: é só deste aparelho, não se mexe.
    if (!cursorDe(p.id)) continue;

    try {
      const { data, error } = await supabase.rpc('projeto_livre_para_fundar', { p_projeto: p.id });
      if (error) continue;
      if (!data) continue; // ainda existe lá — fui removido, não destruíram

      await apagarSomenteLocal(p.id);
      sumidas.push(p.nome);
      console.info('[SetProd] Produção destruída por outra equipe, removida daqui:', p.nome);
    } catch {
      // Sem rede ou servidor fora: não é hora de apagar nada.
    }
  }

  return sumidas;
}

/**
 * Passa a lixeira em revista e limpa o que venceu.
 *
 * Roda quando alguém abre o app — o app não tem relógio próprio no servidor.
 * Então "some em cerca de uma semana" é a promessa honesta; uma produção pode
 * ficar mais tempo se ninguém entrar no app nesse período.
 *
 * Quem não pode destruir ainda assim apaga a própria cópia: o prazo venceu para
 * todo mundo, e carregar uma produção morta não ajuda ninguém.
 */
export async function varrerLixeira(): Promise<string[]> {
  const projetos = await db.projetos.toArray();
  const vencidas = projetos.filter(p => p.lixeira_em && Date.now() - p.lixeira_em >= RETENCAO_MS);

  const removidas: string[] = [];
  for (const p of vencidas) {
    try {
      if (await podeDestruir(p.id)) await destruirProducao(p.id);
      else await apagarSomenteLocal(p.id);
      removidas.push(p.nome);
    } catch (e) {
      console.warn('[SetProd] Não consegui limpar a lixeira de', p.nome, e);
    }
  }
  return removidas;
}
