import { db, TABELAS_SINCRONIZADAS } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import { participacaoLocal, purgarProjetoNoServidor } from './membros';
import { apagarAnexosDoProjeto } from './arquivos';
import { apagarPesquisaPublica } from './pesquisas';
import { reiniciarCursor } from './sincronizacao';
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
