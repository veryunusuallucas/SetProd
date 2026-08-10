import { db } from '../db/db';
import type { ArquivoLocal } from '../types';

/**
 * Backup completo de uma produção — e a volta dele.
 *
 * A spec (§3) pede "export em JSON para fora do Supabase". Mas exportar sem
 * conseguir voltar não é backup, é um arquivo: no dia do problema, ninguém quer
 * um JSON bonito, quer a produção de volta. Por isso este arquivo faz os dois.
 *
 * O que ele NÃO é: sincronização. Backup é a apólice para quando algo deu
 * errado — o Supabase sumiu, alguém apagou o projeto, uma restauração precisa
 * voltar no tempo. Ver §3.3 do plano.
 */

/** Sobe quando o formato do arquivo mudar de um jeito que quebre a leitura. */
export const FORMATO = 1;

/**
 * Tudo que pertence a uma produção.
 *
 * É uma lista à parte, e não a das tabelas sincronizadas, porque backup e sync
 * têm alcances diferentes de propósito: `notificacoes` e `pesquisas` não viajam
 * entre equipes, mas fazem parte da produção e têm que voltar numa restauração.
 */
const TABELAS_DO_PROJETO = [
  'departamentos', 'perfis', 'despesas', 'acertos', 'aportes', 'configuracoes',
  'locacoes', 'diarias', 'diaria_tasks', 'tasks', 'notificacoes',
  'cenas', 'planos', 'roteiro_pdfs', 'roteiro_tags', 'elementos', 'stripboard_itens',
  'pastas', 'documentos', 'veiculos', 'motoristas',
  'pesquisas', 'respostas_pesquisa', 'logs',
] as const;

export interface AnexoNoBackup {
  caminho: string;
  nome: string;
  tipo: string;
  tamanho: number;
  base64: string;
}

export interface Backup {
  formato: number;
  app: 'SetProd';
  criado_em: string;
  projeto_id: string;
  nome_projeto: string;
  projeto: unknown;
  tabelas: Record<string, unknown[]>;
  anexos: AnexoNoBackup[];
}

// ---------------------------------------------------------------------------
// Montar
// ---------------------------------------------------------------------------

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const url = String(leitor.result);
      resolve(url.slice(url.indexOf(',') + 1)); // tira o "data:...;base64,"
    };
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

function base64ParaBlob(base64: string, tipo: string): Blob {
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/**
 * Quanto o backup vai pesar, antes de montá-lo.
 *
 * Serve para a tela avisar: com o roteiro dentro, o arquivo passa fácil de
 * 50 MB, e descobrir isso só quando o navegador engasga é frustrante.
 */
export async function pesoDoBackup(projetoId: string) {
  let dados = 0;
  for (const tabela of TABELAS_DO_PROJETO) {
    const linhas = await db.table(tabela).where('projeto_id').equals(projetoId).toArray().catch(() => []);
    for (const l of linhas) dados += JSON.stringify(l).length;
  }
  const arquivos = await db.arquivos.where('projeto_id').equals(projetoId).toArray().catch(() => []);
  // base64 infla ~33%: o número precisa refletir o arquivo final, não o original.
  const anexos = Math.round(arquivos.reduce((s, a) => s + (a.tamanho || 0), 0) * 1.34);
  return { dados, anexos, total: dados + anexos, quantidadeDeAnexos: arquivos.length };
}

export async function montarBackup(
  projetoId: string,
  opcoes: { incluirAnexos?: boolean } = {}
): Promise<Backup> {
  const projeto = await db.projetos.get(projetoId);
  if (!projeto) throw new Error('Produção não encontrada neste aparelho.');

  const tabelas: Record<string, unknown[]> = {};
  for (const tabela of TABELAS_DO_PROJETO) {
    tabelas[tabela] = await db.table(tabela).where('projeto_id').equals(projetoId).toArray().catch(() => []);
  }

  const anexos: AnexoNoBackup[] = [];
  if (opcoes.incluirAnexos !== false) {
    const arquivos = await db.arquivos.where('projeto_id').equals(projetoId).toArray().catch(() => []);
    for (const a of arquivos as ArquivoLocal[]) {
      anexos.push({
        caminho: a.caminho, nome: a.nome, tipo: a.tipo, tamanho: a.tamanho,
        base64: await blobParaBase64(a.blob),
      });
    }
  }

  return {
    formato: FORMATO,
    app: 'SetProd',
    criado_em: new Date().toISOString(),
    projeto_id: projetoId,
    nome_projeto: projeto.nome,
    projeto,
    tabelas,
    anexos,
  };
}

// ---------------------------------------------------------------------------
// Ler e restaurar
// ---------------------------------------------------------------------------

export function lerBackup(texto: string): Backup {
  let dados: any;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new Error('Este arquivo não é um backup do SetProd (não é um JSON válido).');
  }

  if (dados?.app !== 'SetProd' || !dados?.projeto_id || !dados?.tabelas) {
    throw new Error('Este arquivo não parece um backup do SetProd.');
  }
  if (typeof dados.formato === 'number' && dados.formato > FORMATO) {
    throw new Error('Este backup foi feito numa versão mais nova do app. Atualize antes de restaurar.');
  }

  return dados as Backup;
}

export interface ResultadoRestauracao {
  linhas: number;
  anexos: number;
  substituiu: boolean;
}

/**
 * Devolve a produção ao aparelho.
 *
 * Mantém os ids originais, e isso é decisão, não preguiça: as linhas se
 * referenciam por id em todo canto (a marcação aponta para a cena, a tarefa
 * aponta para a diária, o elemento aponta para a marcação). Gerar ids novos
 * exigiria reescrever esses vínculos um a um, e um vínculo perdido no meio é
 * pior que não ter restaurado.
 *
 * A consequência é que restaurar por cima de uma produção viva SOBRESCREVE — e
 * como o carimbo de hora nasce agora, o conteúdo restaurado vence o do servidor
 * e chega na outra equipe. Por isso `substituir` é explícito.
 */
export async function restaurarBackup(
  backup: Backup,
  opcoes: { substituir?: boolean } = {}
): Promise<ResultadoRestauracao> {
  const jaExiste = Boolean(await db.projetos.get(backup.projeto_id));
  if (jaExiste && !opcoes.substituir) {
    throw new Error(
      `A produção "${backup.nome_projeto}" já existe neste aparelho. ` +
      'Restaurar por cima substitui o que está lá — confirme se é isso que você quer.'
    );
  }

  let linhas = 0;

  await db.projetos.put(backup.projeto as any);
  linhas++;

  for (const [tabela, registros] of Object.entries(backup.tabelas)) {
    if (!Array.isArray(registros) || !registros.length) continue;
    // Ignora nome de tabela que este app não conhece: um backup de versão
    // futura não pode escrever em lugar nenhum sem passar por aqui.
    if (!(TABELAS_DO_PROJETO as readonly string[]).includes(tabela)) continue;

    await db.table(tabela).bulkPut(registros as any[]);
    linhas += registros.length;
  }

  // Os anexos voltam como "ainda não enviados": o arquivo pode ter sumido do
  // Storage justamente por isso ser uma restauração. Marcados assim, sobem de
  // novo na próxima sincronização.
  let anexos = 0;
  for (const a of backup.anexos || []) {
    await db.arquivos.put({
      caminho: a.caminho,
      projeto_id: backup.projeto_id,
      nome: a.nome,
      tipo: a.tipo,
      tamanho: a.tamanho,
      blob: base64ParaBlob(a.base64, a.tipo),
      enviado: false,
      criado_em: Date.now(),
    });
    anexos++;
  }

  return { linhas, anexos, substituiu: jaExiste };
}

/** Nome do arquivo: com a data, porque backup sem data não serve para escolher. */
export function nomeDoArquivo(nomeProjeto: string): string {
  const dia = new Date().toISOString().slice(0, 10);
  const limpo = nomeProjeto.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^\w-]+/g, '_');
  return `setprod_${limpo}_${dia}.json`;
}
