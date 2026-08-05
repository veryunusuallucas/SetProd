import { db } from '../db/db';
import type { Documento, OrigemDocumento, Pasta } from '../types';

/**
 * Índice central (v4 §3.3): documentos nascem em outros lugares do app (o comprovante
 * de uma despesa, o anexo de uma diária, o roteiro) e se refletem automaticamente na
 * página Documentos, organizados em pastas por origem.
 */

const PASTAS_POR_ORIGEM: Record<OrigemDocumento, { nome: string; cor: string }> = {
  manual: { nome: 'Geral', cor: '#4cc9f0' },
  roteiro: { nome: 'Roteiros', cor: '#ff6b6b' },
  comprovante: { nome: 'NFs e Comprovantes', cor: '#1dd1a1' },
  diaria: { nome: 'Diárias', cor: '#fca311' },
  storyboard: { nome: 'Storyboard', cor: '#9d4edd' },
};

/**
 * Devolve (criando se preciso) a pasta padrão de uma origem.
 */
export async function garantirPasta(projetoId: string, origem: OrigemDocumento): Promise<Pasta> {
  const { nome, cor } = PASTAS_POR_ORIGEM[origem];
  const existente = await db.pastas
    .where('projeto_id')
    .equals(projetoId)
    .filter(p => p.nome.toLowerCase() === nome.toLowerCase())
    .first();
  if (existente) return existente;

  const nova: Pasta = { id: crypto.randomUUID(), projeto_id: projetoId, nome, cor, data_criacao: Date.now() };
  await db.pastas.add(nova);
  return nova;
}

/**
 * Registra (ou atualiza) um documento vindo de outro módulo. É idempotente por
 * origem + ref_id: reanexar o comprovante da mesma despesa substitui o anterior
 * em vez de duplicar.
 */
export async function registrarDocumento(params: {
  projetoId: string;
  origem: OrigemDocumento;
  refId: string;
  nome: string;
  url: string;
  tipo?: 'link' | 'upload';
  tamanho?: number;
  previewUrl?: string;
}): Promise<Documento> {
  const { projetoId, origem, refId, nome, url } = params;
  const pasta = await garantirPasta(projetoId, origem);

  const anterior = await db.documentos
    .where('projeto_id')
    .equals(projetoId)
    .filter(d => d.origem === origem && d.ref_id === refId)
    .first();

  const doc: Documento = {
    id: anterior?.id || crypto.randomUUID(),
    projeto_id: projetoId,
    pasta_id: pasta.id,
    nome,
    tipo: params.tipo || (url.startsWith('data:') ? 'upload' : 'link'),
    url,
    preview_url: params.previewUrl,
    tamanho: params.tamanho,
    data_criacao: anterior?.data_criacao || Date.now(),
    origem,
    ref_id: refId,
  };

  await db.documentos.put(doc);
  return doc;
}

/**
 * Remove o documento espelhado quando a entidade de origem perde o anexo.
 */
export async function removerDocumentoDeOrigem(projetoId: string, origem: OrigemDocumento, refId: string) {
  const docs = await db.documentos
    .where('projeto_id')
    .equals(projetoId)
    .filter(d => d.origem === origem && d.ref_id === refId)
    .toArray();
  for (const d of docs) await db.documentos.delete(d.id);
}

/**
 * Descreve o que será apagado junto, para o aviso de confirmação.
 * Documento espelhado não é cópia: apagar aqui tem que apagar o original,
 * senão o arquivo "volta" e a pessoa acha que a exclusão não funcionou.
 */
export function descreverOrigem(doc: Documento): string | null {
  switch (doc.origem) {
    case 'roteiro': return 'o roteiro e todas as marcações feitas nele';
    case 'comprovante': return 'o comprovante anexado à despesa';
    case 'diaria': return 'o anexo da diária';
    case 'storyboard': return 'a referência de storyboard da cena';
    default: return null;
  }
}

/**
 * Apaga a entidade que originou o documento. Devolve true se mexeu em algo.
 */
export async function apagarOrigemDoDocumento(doc: Documento): Promise<boolean> {
  if (!doc.origem || doc.origem === 'manual' || !doc.ref_id) return false;

  if (doc.origem === 'roteiro') {
    await db.roteiro_pdfs.delete(doc.ref_id);
    const tags = await db.roteiro_tags.where('projeto_id').equals(doc.projeto_id).toArray();
    for (const t of tags) await db.roteiro_tags.delete(t.id);
    return true;
  }

  if (doc.origem === 'comprovante') {
    const despesa = await db.despesas.get(doc.ref_id);
    if (despesa) await db.despesas.update(doc.ref_id, { comprovante: undefined });
    return !!despesa;
  }

  if (doc.origem === 'diaria') {
    // ref_id é o id do anexo; procuramos a diária que o contém.
    const diarias = await db.diarias.where('projeto_id').equals(doc.projeto_id).toArray();
    const dona = diarias.find(d => (d.anexos || []).some(a => a.id === doc.ref_id));
    if (!dona) return false;
    await db.diarias.update(dona.id, {
      anexos: (dona.anexos || []).filter(a => a.id !== doc.ref_id),
    });
    return true;
  }

  if (doc.origem === 'storyboard') {
    // ref_id no formato "<cena_id>:<índice>"
    const [cenaId, indiceTexto] = doc.ref_id.split(':');
    const cena = await db.cenas.get(cenaId);
    if (!cena) return false;
    const indice = Number(indiceTexto);
    await db.cenas.update(cenaId, {
      anexos: (cena.anexos || []).filter((_, i) => i !== indice),
    });
    return true;
  }

  return false;
}

// ---- Links do Google Drive (v4 §3.2) ----

export interface InfoLink {
  nome: string;
  previewUrl?: string;
  fileId?: string;
}

/**
 * Extrai o ID de um link do Drive nos formatos usuais
 * (/file/d/<id>/, /folders/<id>, ?id=<id>, /document/d/<id>).
 */
export function extrairIdDrive(url: string): string | null {
  const padroes = [
    /\/file\/d\/([a-zA-Z0-9_-]{10,})/,
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of padroes) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

/**
 * Melhor esforço, sem API e sem login (§3.2): tenta deduzir um nome legível e uma
 * miniatura a partir do próprio link. O resultado é sempre editável pelo usuário —
 * se nada for reconhecido, devolve um nome derivado do domínio/caminho.
 */
export function inspecionarLink(url: string): InfoLink {
  const limpo = url.trim();
  const fileId = extrairIdDrive(limpo);

  if (fileId) {
    let nome = 'Arquivo do Drive';
    if (/\/folders\//.test(limpo)) nome = 'Pasta do Drive';
    else if (/\/document\/d\//.test(limpo)) nome = 'Documento Google Docs';
    else if (/\/spreadsheets\/d\//.test(limpo)) nome = 'Planilha Google Sheets';
    else if (/\/presentation\/d\//.test(limpo)) nome = 'Apresentação Google Slides';

    return {
      nome,
      fileId,
      // Miniatura pública do Drive: só carrega se o arquivo estiver compartilhado.
      previewUrl: /\/folders\//.test(limpo) ? undefined : `https://drive.google.com/thumbnail?id=${fileId}&sz=w320`,
    };
  }

  try {
    const u = new URL(limpo.startsWith('http') ? limpo : `https://${limpo}`);
    const ultimoSegmento = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return { nome: ultimoSegmento || u.hostname };
  } catch {
    return { nome: 'Novo Documento (Link)' };
  }
}

/**
 * Lê um arquivo local como data URL (mantém tudo offline, sem gastar Storage).
 */
export function lerArquivoComoDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const LIMITE_UPLOAD_BYTES = 5 * 1024 * 1024;

export function formatarTamanho(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
