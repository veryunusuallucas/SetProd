import Dexie from 'dexie';
import { db, marcarTransacaoComoRemota } from '../db/db';
import { supabaseConfigurado } from './supabase';
import { participacoesLocais } from './membros';
import { empurrar } from './sincronizacao';
import { esquecerConta } from './conta';

/**
 * Apagar o que ficou neste navegador quando a conta vai embora.
 *
 * O motivo é banal e acontece toda semana numa produção: o notebook é
 * compartilhado. Alguém sai do app, a próxima pessoa abre o navegador e a
 * produção inteira está ali — offline, sem login, sem pedir nada. Como o app é
 * offline-first, os dados estão mesmo no IndexedDB; não adianta esconder na
 * tela, porque qualquer um abre o DevTools e lê. Apagar é a única proteção real.
 *
 * O contrapeso é que apagar é definitivo. Por isso nada aqui limpa sem antes
 * perguntar o que ainda não está a salvo no servidor — ver `conferirAntesDeSair`.
 */

/** Prefixos de `localStorage` que pertencem a uma sessão de trabalho. */
const PREFIXOS = ['setprod_', 'diaria_atual_'];

/** Chaves soltas do modo de simulação, sem prefixo próprio. */
const CHAVES_SOLTAS = ['mock_papel', 'mock_perfil_id'];

export interface Retencao {
  /** Alterações na caixa de saída que ainda não chegaram ao servidor. */
  pendentes: number;
  /** Produções que existem só aqui — o servidor não tem participação delas. */
  producoesSoLocais: string[];
}

/** Há algo que se perde se limpar agora? */
export function haRisco(r: Retencao): boolean {
  return r.pendentes > 0 || r.producoesSoLocais.length > 0;
}

/**
 * O que se perde se limpar agora.
 *
 * As duas perguntas são diferentes e as duas doem:
 *
 * - **Pendentes** é trabalho feito sem sinal que ainda não subiu. Some para
 *   sempre, porque quem poderia enviá-lo é a sessão que está indo embora.
 * - **Produções só locais** é pior e mais fácil de ignorar: um projeto cujo
 *   registro de fundador falhou (criado sem internet, servidor fora) nunca
 *   chegou ao espelho. Ele não volta com um novo login — não há de onde voltar.
 *   A checagem é offline de propósito: usa a cópia local das participações,
 *   porque na hora de sair pode não haver rede.
 */
export async function conferirAntesDeSair(): Promise<Retencao> {
  const pendentes = await db.sync_queue.count().catch(() => 0);

  const comParticipacao = new Set(participacoesLocais().map(p => p.projeto_id));
  const projetos = await db.projetos.toArray().catch(() => []);
  const producoesSoLocais = projetos
    .filter(p => !comParticipacao.has(p.id))
    .map(p => p.nome || p.id);

  return { pendentes, producoesSoLocais };
}

/**
 * O aviso, em português de gente.
 *
 * Diz o que se perde e o que fazer para não perder — um aviso que só assusta,
 * sem saída, faz a pessoa clicar em "sim" no susto e perder o trabalho mesmo
 * assim.
 */
export function avisoDeSaida(r: Retencao): string {
  const partes: string[] = [];

  if (r.pendentes > 0) {
    partes.push(
      r.pendentes === 1
        ? '• 1 alteração ainda não chegou ao servidor.'
        : `• ${r.pendentes} alterações ainda não chegaram ao servidor.`
    );
  }

  if (r.producoesSoLocais.length > 0) {
    partes.push(
      `• Estas produções existem só neste aparelho: ${r.producoesSoLocais.join(', ')}.`
    );
  }

  return [
    'Sair apaga os dados deste navegador — é o que impede a próxima pessoa a usar este aparelho de abrir a produção sem login.',
    '',
    'Só que ainda há coisa que não está a salvo no servidor:',
    ...partes,
    '',
    'Isso não volta com um novo login. Se puder, conecte-se à internet e espere o rodapé dizer "Salvo" antes de sair.',
    '',
    'Sair mesmo assim?',
  ].join('\n');
}

/**
 * Última tentativa de salvar o que dá, antes de apagar.
 *
 * Melhor esforço: se não houver rede ou o servidor recusar, segue em frente e
 * quem chamou decide o que fazer com o que sobrou. Nunca lança — falhar aqui
 * não pode impedir alguém de sair da própria conta.
 */
export async function tentarSubirTudo(): Promise<void> {
  if (!supabaseConfigurado || !navigator.onLine) return;

  // Sai da própria fila, não da lista de projetos: uma pendência pode ser de
  // uma produção que já saiu daqui, e é justamente essa que ninguém veria.
  const fila = await db.sync_queue.toArray().catch(() => []);
  for (const projetoId of new Set(fila.map(p => p.projeto_id))) {
    try {
      await empurrar(projetoId);
    } catch (e) {
      console.warn('[SetProd] Não consegui subir as pendências de', projetoId, e);
    }
  }
}

/**
 * Apaga o banco local e todo o rastro da sessão.
 *
 * ⚠️ A transação é marcada como remota, e isso NÃO é detalhe: `Table.clear()`
 * dispara o hook `deleting` de cada linha, e cada hook enfileiraria uma lápide.
 * Sem a marca, sair da conta mandaria ao servidor a ordem de apagar todas as
 * produções — para todas as equipes, não só para este navegador. A marca é o
 * que diz "isto é faxina daqui, não é uma exclusão que deva viajar".
 */
export async function limparDadosLocais(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    marcarTransacaoComoRemota();
    for (const tabela of db.tables) await tabela.clear();
  });

  for (const chave of Object.keys(localStorage)) {
    if (PREFIXOS.some(p => chave.startsWith(p)) || CHAVES_SOLTAS.includes(chave)) {
      localStorage.removeItem(chave);
    }
  }

  // Depois da limpeza, nunca antes: é o registro de que este navegador está
  // vazio, e a próxima conta a entrar conta com isso.
  esquecerConta();
}

/**
 * O IndexedDB do Dexie some por inteiro.
 *
 * Reservado para o caso em que `clear()` não serve — banco corrompido, ou versão
 * de schema que não abre. Deixa o app precisando de recarga, então não é o
 * caminho normal de logout.
 */
export async function destruirBancoLocal(): Promise<void> {
  db.close();
  await Dexie.delete(db.name);
}
