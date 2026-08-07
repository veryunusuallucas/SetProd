import { db } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import type { ArquivoLocal } from '../types';

/**
 * Anexos: roteiro em PDF, storyboard, referências da Ordem do Dia, documentos.
 *
 * TRÊS LUGARES, TRÊS PAPÉIS
 *   Storage  — onde o arquivo mora, para as duas equipes alcançarem.
 *   IndexedDB — cópia no aparelho, para abrir sem sinal (é set, não escritório).
 *   A linha  — guarda só o caminho, nunca o conteúdo.
 *
 * COMO A LINHA APONTA PARA O ARQUIVO
 * Os campos que hoje guardam o arquivo (`RoteiroPDF.dados`, `AnexoOD.dados`,
 * `Documento.url`, `Plano.anexos[]`) continuam sendo texto. Só que agora o
 * texto pode ser uma de três coisas:
 *
 *   `arquivo:<caminho>`  → mora no Storage, com cópia local
 *   `data:...`           → base64 antigo, de antes desta mudança
 *   `https://...`        → link do Drive, que nunca foi arquivo nosso
 *
 * Escolhi o prefixo em vez de criar campos novos porque os quatro lugares já
 * tratam esses campos como "uma string que dá para abrir". Um resolvedor só, no
 * meio do caminho, cobre os quatro — e o base64 antigo continua funcionando sem
 * migração forçada.
 */

export const BUCKET = 'anexos';
const PREFIXO = 'arquivo:';

/** Limite por arquivo. O Storage aguenta mais; quem não aguenta é o aparelho. */
export const LIMITE_BYTES = 50 * 1024 * 1024;

export const ehReferenciaDeArquivo = (valor?: string | null): boolean =>
  Boolean(valor?.startsWith(PREFIXO));

export const caminhoDe = (valor: string): string => valor.slice(PREFIXO.length);
export const referenciaPara = (caminho: string): string => `${PREFIXO}${caminho}`;

/**
 * Endereços de objeto criados nesta sessão.
 *
 * Guardados porque `URL.createObjectURL` gera um endereço novo a cada chamada:
 * sem o mapa, reabrir o mesmo roteiro dez vezes deixaria dez cópias do PDF na
 * memória da aba, e o `<img>` piscaria a cada redesenho por trocar de src.
 */
const enderecos = new Map<string, string>();

function enderecoDe(caminho: string, blob: Blob): string {
  const existente = enderecos.get(caminho);
  if (existente) return existente;
  const novo = URL.createObjectURL(blob);
  enderecos.set(caminho, novo);
  return novo;
}

/** Tira acento e espaço do nome: o Storage recusa vários caracteres na chave. */
function nomeSeguro(nome: string): string {
  return nome
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-80);
}

// ---------------------------------------------------------------------------
// Guardar
// ---------------------------------------------------------------------------

/**
 * Guarda um arquivo e devolve a referência para gravar na linha.
 *
 * A cópia local entra ANTES do envio, e o envio pode falhar sem prejuízo: o
 * arquivo já está no aparelho e `enviado: false` marca que falta subir. Assim
 * anexar um roteiro no set, sem sinal, funciona — e ele sobe sozinho depois.
 */
export async function guardarArquivo(
  projetoId: string,
  arquivo: Blob,
  nome: string,
  tipo?: string
): Promise<string> {
  if (arquivo.size > LIMITE_BYTES) {
    throw new Error(`Arquivo muito grande (máx ${Math.round(LIMITE_BYTES / 1024 / 1024)}MB).`);
  }

  const caminho = `${projetoId}/${crypto.randomUUID()}-${nomeSeguro(nome)}`;
  const registro: ArquivoLocal = {
    caminho,
    projeto_id: projetoId,
    nome,
    tipo: tipo || arquivo.type || 'application/octet-stream',
    tamanho: arquivo.size,
    blob: arquivo,
    enviado: false,
    criado_em: Date.now(),
  };

  await db.arquivos.put(registro);
  void enviarPendentes(projetoId);

  return referenciaPara(caminho);
}

/** Sobe o que ainda não subiu. Chamado depois de guardar e a cada sincronização. */
export async function enviarPendentes(projetoId: string): Promise<number> {
  if (!supabaseConfigurado || !navigator.onLine) return 0;

  const pendentes = await db.arquivos
    .where('projeto_id').equals(projetoId)
    .filter(a => !a.enviado)
    .toArray();

  let enviados = 0;
  for (const a of pendentes) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(a.caminho, a.blob, { contentType: a.tipo, upsert: true });

    if (error) {
      console.warn('[SetProd] Anexo não subiu (fica para a próxima):', a.nome, error.message);
      continue;
    }
    await db.arquivos.update(a.caminho, { enviado: true });
    enviados++;
  }
  return enviados;
}

// ---------------------------------------------------------------------------
// Abrir
// ---------------------------------------------------------------------------

/**
 * Transforma o que está gravado na linha em algo que o navegador abre.
 *
 * Ordem: cópia local primeiro (instantânea e funciona sem sinal), Storage
 * depois. Link e base64 antigo passam direto.
 */
export async function resolverArquivo(valor?: string | null): Promise<string | null> {
  if (!valor) return null;
  if (!ehReferenciaDeArquivo(valor)) return valor; // data: ou https:

  const caminho = caminhoDe(valor);

  const local = await db.arquivos.get(caminho);
  if (local) return enderecoDe(caminho, local.blob);

  if (!supabaseConfigurado || !navigator.onLine) return null;

  const { data, error } = await supabase.storage.from(BUCKET).download(caminho);
  if (error || !data) {
    console.warn('[SetProd] Não consegui baixar o anexo:', caminho, error?.message);
    return null;
  }

  // Guarda ao baixar: a segunda abertura já não depende de rede — e é assim que
  // o aparelho da outra equipe fica pronto para o set.
  const projetoId = caminho.split('/')[0];
  await db.arquivos.put({
    caminho, projeto_id: projetoId,
    nome: caminho.split('/').pop() || 'arquivo',
    tipo: data.type || 'application/octet-stream',
    tamanho: data.size, blob: data, enviado: true, criado_em: Date.now(),
  });

  return enderecoDe(caminho, data);
}

/** Baixa para o aparelho tudo o que este projeto tem, sem abrir nada. */
export async function baixarAnexosDoProjeto(projetoId: string): Promise<number> {
  if (!supabaseConfigurado || !navigator.onLine) return 0;

  const { data: lista, error } = await supabase.storage.from(BUCKET).list(projetoId, { limit: 500 });
  if (error || !lista) return 0;

  let baixados = 0;
  for (const item of lista) {
    const caminho = `${projetoId}/${item.name}`;
    if (await db.arquivos.get(caminho)) continue;
    if (await resolverArquivo(referenciaPara(caminho))) baixados++;
  }
  return baixados;
}

// ---------------------------------------------------------------------------
// Apagar
// ---------------------------------------------------------------------------

export async function apagarArquivo(valor?: string | null): Promise<void> {
  if (!ehReferenciaDeArquivo(valor)) return;
  const caminho = caminhoDe(valor!);

  const endereco = enderecos.get(caminho);
  if (endereco) {
    URL.revokeObjectURL(endereco);
    enderecos.delete(caminho);
  }

  await db.arquivos.delete(caminho);
  if (supabaseConfigurado) {
    await supabase.storage.from(BUCKET).remove([caminho]).catch(() => {});
  }
}

/** Limpa os anexos do projeto inteiro — usado ao apagar a produção de vez. */
export async function apagarAnexosDoProjeto(projetoId: string): Promise<void> {
  const locais = await db.arquivos.where('projeto_id').equals(projetoId).toArray();
  for (const a of locais) {
    const endereco = enderecos.get(a.caminho);
    if (endereco) { URL.revokeObjectURL(endereco); enderecos.delete(a.caminho); }
  }
  await db.arquivos.where('projeto_id').equals(projetoId).delete();

  if (!supabaseConfigurado || !navigator.onLine) return;
  const { data: lista } = await supabase.storage.from(BUCKET).list(projetoId, { limit: 1000 });
  if (lista?.length) {
    await supabase.storage.from(BUCKET).remove(lista.map(i => `${projetoId}/${i.name}`));
  }
}

// ---------------------------------------------------------------------------
// Trazer o que já existe em base64 para o novo mundo
// ---------------------------------------------------------------------------

function dataUrlParaBlob(dataUrl: string): { blob: Blob; tipo: string } | null {
  const casa = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!casa) return null;

  const tipo = casa[1] || 'application/octet-stream';
  try {
    if (casa[2]) {
      const bruto = atob(casa[3]);
      const bytes = new Uint8Array(bruto.length);
      for (let i = 0; i < bruto.length; i++) bytes[i] = bruto.charCodeAt(i);
      return { blob: new Blob([bytes], { type: tipo }), tipo };
    }
    return { blob: new Blob([decodeURIComponent(casa[3])], { type: tipo }), tipo };
  } catch {
    return null;
  }
}

/**
 * Converte um base64 antigo em arquivo de verdade.
 *
 * Devolve a referência nova, ou o próprio valor quando não há o que converter
 * (link, ou já convertido). Quem chama grava o retorno de volta na linha.
 */
export async function migrarValor(
  projetoId: string,
  valor: string | undefined | null,
  nome: string
): Promise<string | null | undefined> {
  if (!valor || !valor.startsWith('data:')) return valor;

  const convertido = dataUrlParaBlob(valor);
  if (!convertido) return valor;

  return guardarArquivo(projetoId, convertido.blob, nome, convertido.tipo);
}
