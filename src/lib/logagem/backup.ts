import { db } from '../../db/db';
import type { BackupDeCartao, ChecksumDeCartao, HdDeBackup, Take } from '../../types';

/**
 * Backup: o que protege o material de verdade.
 *
 * O resto da Logagem é boletim — se falhar, alguém digita de novo. Esta parte
 * responde a uma pergunta que não tem segunda chance: **este cartão pode ser
 * formatado?** Formatar um cartão que ainda não tem cópia é o único erro do set
 * que nenhum trabalho depois conserta.
 *
 * Por isso a regra é conservadora: um cartão só fica **Safe to Format** com
 * cópia em TODOS os HDs cadastrados **e** com o comprovante de verificação
 * anexado. Menos que isso é "não liberado", mesmo que pareça pronto.
 */

/* ───────────────────────── Estimativa de tamanho ───────────────────────── */

/**
 * Megabits por segundo de cada codec, a tabela do Lumavi (`BITRATE_MBPS`).
 *
 * É estimativa, e a tela diz isso com o "~". Serve para saber se o cartão tem
 * 30 GB ou 300 GB — ou seja, se cabe no HD que está na mesa.
 */
/*
  XAVC S-I medido na Diária 1 da Canção (13/10/2026, tamanhos do .mhl): 240 Mbps
  a 23,98 e ~295 a 59,94. Os 600 de antes eram o 4K 60p da tabela da Sony e
  davam 270 GB para um cartão de 107. Quando o ingest leu o arquivo, nem se
  estima: vale o tamanho real (`xml.bytes`).
*/
export const BITRATES: { teste: RegExp; mbps: number; acimaDe30?: number }[] = [
  { teste: /xavc.*s-?i|h422ip|intra/i, mbps: 240, acimaDe30: 300 },
  { teste: /xavc.*hs/i, mbps: 280 },
  { teste: /xavc.*s\b|h420/i, mbps: 200 },
  { teste: /prores.*4444/i, mbps: 1650 },
  { teste: /prores.*422.*hq/i, mbps: 880 },
  { teste: /prores/i, mbps: 590 },
  { teste: /raw/i, mbps: 1800 },
  { teste: /.*/, mbps: 300 },
];

/**
 * Quanto durou o take.
 *
 * Do XML, quando o ingest já passou por ali (é o único lugar que sabe de
 * verdade). Sem XML, **15 segundos**, como o Lumavi assume: um número errado
 * mas honesto, que mantém a ordem de grandeza da estimativa.
 */
export function segundosDoTake(take: Take): number {
  if (take.xml?.segundos) return take.xml.segundos;
  const duracao = String(take.xml?.duracao || '').trim();
  if (/^\d+$/.test(duracao)) return Number(duracao) / (parseFloat(take.fps || '24') || 24);
  const minutos = duracao.match(/(\d+)m/);
  const segundos = duracao.match(/(\d+)s/);
  if (minutos || segundos) return (minutos ? Number(minutos[1]) * 60 : 0) + (segundos ? Number(segundos[1]) : 0);
  return 15;
}

export function tamanhoDoTakeMB(take: Take): number {
  if (take.xml?.bytes) return take.xml.bytes / 2 ** 20;
  const codec = take.codec || '';
  // A última linha da tabela casa com tudo: sempre há faixa.
  const faixa = BITRATES.find(b => b.teste.test(codec)) ?? BITRATES[BITRATES.length - 1];
  const mbps = faixa.acimaDe30 && (parseFloat(take.fps || '') || 24) > 30 ? faixa.acimaDe30 : faixa.mbps;
  return (mbps * segundosDoTake(take)) / 8;
}

export function estimativaDoCartaoGB(takes: Take[], cartao: string): number {
  const mb = takes
    .filter(t => String(t.cartao).trim() === String(cartao).trim())
    .reduce((soma, t) => soma + tamanhoDoTakeMB(t), 0);
  return mb / 1024;
}

/* ───────────────────────── Cartões e status ───────────────────────── */

/**
 * Os cartões que esta diária conhece.
 *
 * Saem dos takes, das marcações de HD, dos comprovantes e do cartão que está na
 * câmera agora. Não há tabela de cartões: um cartão existe porque alguém gravou
 * nele, marcou um HD ou colocou ele na câmera (PLANO-logagem §4).
 */
export function cartoesConhecidos(dados: {
  takes: Take[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  cartaoAtual?: string;
}): string[] {
  const todos = new Set<string>();
  const juntar = (v?: string) => { const s = String(v || '').trim(); if (s) todos.add(s); };

  dados.takes.forEach(t => juntar(t.cartao));
  dados.backups.forEach(b => juntar(b.cartao));
  dados.checksums.forEach(c => juntar(c.cartao));
  juntar(dados.cartaoAtual);

  return [...todos].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
}

export const cartaoTemTakes = (takes: Take[], cartao: string) =>
  takes.some(t => String(t.cartao).trim() === String(cartao).trim());

/** Cópia em TODOS os HDs cadastrados — e precisa haver pelo menos um. */
export function backupsCompletos(hds: HdDeBackup[], backups: BackupDeCartao[], cartao: string): boolean {
  if (hds.length === 0) return false;
  return hds.every(h => backups.some(b => b.hd_id === h.id && String(b.cartao).trim() === String(cartao).trim()));
}

export const temChecksum = (checksums: ChecksumDeCartao[], cartao: string) =>
  checksums.some(c => String(c.cartao).trim() === String(cartao).trim());

/** **Safe to Format**: todos os HDs marcados E comprovante anexado. */
export function cartaoSeguro(dados: {
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  cartao: string;
}): boolean {
  return backupsCompletos(dados.hds, dados.backups, dados.cartao) && temChecksum(dados.checksums, dados.cartao);
}

/**
 * O que falta para este cartão poder ser formatado, em palavras.
 *
 * "Não liberado" sozinho manda a pessoa procurar o motivo numa matriz de
 * checkboxes. Dizer o que falta é a diferença entre um aviso e uma instrução.
 */
/** 'A', 'A e B', 'A, B e C' */
const listaNatural = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join('') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;

export function oQueFalta(dados: {
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  cartao: string;
}): string[] {
  const faltas: string[] = [];
  if (dados.hds.length === 0) {
    faltas.push('cadastrar pelo menos um HD');
  } else {
    const semCopia = dados.hds.filter(
      h => !dados.backups.some(b => b.hd_id === h.id && String(b.cartao).trim() === String(dados.cartao).trim())
    );
    if (semCopia.length) faltas.push(`copiar para ${listaNatural(semCopia.map(h => h.nome))}`);
  }
  if (!temChecksum(dados.checksums, dados.cartao)) faltas.push('anexar o comprovante de verificação');
  return faltas;
}

/* ───────────────────────── Comprovante (checksum) ───────────────────────── */

/**
 * De qual cartão é este comprovante? (`detectarCartao`)
 *
 * Um só cartão conhecido: é ele. Senão procura o número no **nome do arquivo**
 * e depois no **começo do conteúdo**, casando o cartão isolado entre
 * não-dígitos e ignorando zeros à esquerda — "001" acha "Reel001" e "A001C012".
 * Não achou: quem escolhe é a pessoa, no seletor.
 */
/**
 * Os OUTROS cartões cujos clipes aparecem num comprovante.
 *
 * Um md5sums lista cada arquivo do cartão. Se o comprovante anexado no 001
 * traz o A002C003 e o A004C010, que o boletim diz serem dos cartões 002 e 004,
 * é sinal de que foi um cartão físico só (Diária 1 da Canção, 13/10/2026: o
 * A00X do nome seguia a cena, e o ingest antigo leu isso como cartão).
 */
export function outrosCartoesNoComprovante(texto: string, cartao: string, takes: Pick<Take, 'arquivo' | 'cartao'>[]): string[] {
  const corpo = String(texto || '').toUpperCase();
  const achados = new Set<string>();
  for (const t of takes) {
    const dele = String(t.cartao ?? '').trim();
    const nome = String(t.arquivo ?? '').trim().toUpperCase();
    if (!dele || dele === cartao || nome.length < 4) continue;
    if (corpo.includes(nome)) achados.add(dele);
  }
  return [...achados].sort();
}

export function detectarCartao(nomeArquivo: string, texto: string, cartoes: string[]): string | null {
  if (cartoes.length === 1) return cartoes[0];

  const casa = (cartao: string, onde: string) => {
    /*
      Os zeros à esquerda somem dos DOIS lados.

      O Lumavi só tolerava zeros sobrando no texto ("12" achava "0012"). Mas o
      caso comum no set é o contrário: o cartão está como "012" no app e o
      DaVinci escreveu "CARD_12". Ignorar o zero nos dois lados acha os dois, e
      a borda de não-dígitos continua impedindo que "001" case dentro de "1001".
    */
    const semZeros = /^\d+$/.test(cartao.trim()) ? cartao.trim().replace(/^0+(?=\d)/, '') : cartao.trim();
    const limpo = semZeros.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^0-9])0*' + limpo + '([^0-9]|$)', 'i').test(onde);
  };

  const peloNome = cartoes.find(c => casa(c, String(nomeArquivo || '')));
  if (peloNome) return peloNome;

  // Só o começo: um MHL de cartão cheio tem megabytes, e o cabeçalho já traz o
  // nome do volume.
  const comeco = String(texto || '').slice(0, 20000);
  return cartoes.find(c => casa(c, comeco)) || null;
}

/** Impressão digital síncrona, para quando o `crypto.subtle` não existe. */
export function fnv1a(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}

/**
 * O digest do comprovante: SHA-256 quando dá, FNV-1a quando não dá.
 *
 * `crypto.subtle` só existe em contexto seguro. Quem abre o app pelo IP da rede
 * local — o notebook do DIT servindo para o celular do 2º AC — fica sem ele. É
 * melhor um comprovante com impressão digital fraca do que nenhum comprovante:
 * o que se quer aqui é detectar que o arquivo MUDOU, não resistir a um ataque.
 */
export async function digestDoTexto(texto: string): Promise<{ algoritmo: 'SHA-256' | 'FNV-1a'; digest: string }> {
  try {
    if (globalThis.isSecureContext && globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(texto);
      const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
      return { algoritmo: 'SHA-256', digest: hex };
    }
  } catch { /* cai no de baixo */ }
  return { algoritmo: 'FNV-1a', digest: fnv1a(texto) };
}

/* ───────────────────────── Banco ───────────────────────── */

export const hdsDoProjeto = (projetoId: string) =>
  db.log_hds.where('projeto_id').equals(projetoId).toArray();

export async function criarHd(projetoId: string, nome: string, ordem: number, departamentoId?: string) {
  const hd: HdDeBackup = {
    id: crypto.randomUUID(),
    projeto_id: projetoId,
    departamento_id: departamentoId,
    nome,
    ordem,
    criado_em: Date.now(),
  };
  await db.log_hds.add(hd);
  return hd;
}

/**
 * Tirar um HD tira também as marcações dele.
 *
 * Deixá-las faria um cartão parecer copiado para um HD que não existe mais — e
 * "Safe to Format" por causa de um HD apagado é exatamente o erro que este
 * módulo existe para impedir.
 */
export async function apagarHd(id: string) {
  const marcacoes = await db.log_backups.where('hd_id').equals(id).toArray().catch(() => []);
  await Promise.all(marcacoes.map(m => db.log_backups.delete(m.id)));
  await db.log_hds.delete(id);
}

export async function marcarBackup(dados: {
  projetoId: string;
  diariaId: string;
  cartao: string;
  hdId: string;
  quem?: string;
  departamentoId?: string;
}) {
  const linha: BackupDeCartao = {
    /*
      O id é DERIVADO de diária + cartão + HD, e não sorteado.

      Dois aparelhos marcando o mesmo HD do mesmo cartão (o DIT no notebook e o
      2º AC no celular, offline) criariam duas linhas com id sorteado, e a
      matriz mostraria a mesma marcação duas vezes. Com o id derivado, o sync
      trata as duas criações como o mesmo registro.
    */
    id: `logbkp-${dados.diariaId}-${dados.cartao}-${dados.hdId}`,
    projeto_id: dados.projetoId,
    diaria_id: dados.diariaId,
    departamento_id: dados.departamentoId,
    cartao: String(dados.cartao).trim(),
    hd_id: dados.hdId,
    marcado_em: Date.now(),
    marcado_por: dados.quem,
  };
  await db.log_backups.put(linha);
  return linha;
}

export const desmarcarBackup = (id: string) => db.log_backups.delete(id);

export async function anexarChecksum(dados: {
  projetoId: string;
  diariaId: string;
  cartao: string;
  nomeArquivo: string;
  texto: string;
  arquivo?: string;
  quem?: string;
  departamentoId?: string;
}) {
  const { algoritmo, digest } = await digestDoTexto(dados.texto);
  const comprovante: ChecksumDeCartao = {
    id: crypto.randomUUID(),
    projeto_id: dados.projetoId,
    diaria_id: dados.diariaId,
    departamento_id: dados.departamentoId,
    cartao: String(dados.cartao).trim(),
    nome_arquivo: dados.nomeArquivo,
    algoritmo,
    digest,
    bytes: new TextEncoder().encode(dados.texto).length,
    linhas: dados.texto.split(/\r?\n/).filter(l => l.trim()).length,
    arquivo: dados.arquivo,
    anexado_em: Date.now(),
    anexado_por: dados.quem,
  };
  await db.log_checksums.add(comprovante);
  return comprovante;
}

export const apagarChecksum = (id: string) => db.log_checksums.delete(id);

/**
 * Juntar cartões que são o mesmo cartão físico (Lucas, 12/10/2026).
 *
 * Na Diária 1 da Canção de Outono foi um cartão só, mas o ingest leu o A002,
 * o A004 e o A008 do nome dos clipes como cartões — e o Backup passou a pedir
 * cópia de quatro. Juntar leva os takes, as marcações de cópia e os
 * comprovantes para o cartão que fica. Marcação repetida (o mesmo HD marcado
 * nos dois) vira uma só.
 */
export async function juntarCartoes(diariaId: string, de: string[], para: string) {
  const sai = new Set(de.map(c => c.trim()).filter(c => c && c !== para.trim()));
  if (!sai.size) return;
  await db.transaction('rw', [db.log_takes, db.log_backups, db.log_checksums, db.log_estado], async () => {
    // O cartão na câmera também: senão ele continuaria aparecendo como um cartão à parte.
    const estado = await db.log_estado.where('diaria_id').equals(diariaId).first();
    if (estado && sai.has(String(estado.cartao ?? '').trim())) await db.log_estado.update(estado.id, { cartao: para });
    const [takes, backups, checksums] = await Promise.all([
      db.log_takes.where('diaria_id').equals(diariaId).toArray(),
      db.log_backups.where('diaria_id').equals(diariaId).toArray(),
      db.log_checksums.where('diaria_id').equals(diariaId).toArray(),
    ]);
    for (const t of takes) if (sai.has(String(t.cartao ?? '').trim())) await db.log_takes.update(t.id, { cartao: para });
    const hdsDoQueFica = new Set(backups.filter(b => b.cartao.trim() === para.trim()).map(b => b.hd_id));
    for (const b of backups) {
      if (!sai.has(b.cartao.trim())) continue;
      if (hdsDoQueFica.has(b.hd_id)) await db.log_backups.delete(b.id);
      else { await db.log_backups.update(b.id, { cartao: para }); hdsDoQueFica.add(b.hd_id); }
    }
    for (const c of checksums) if (sai.has(c.cartao.trim())) await db.log_checksums.update(c.id, { cartao: para });
  });
}

/* ───────────────────────── Conferência ───────────────────────── */

export interface ConferenciaDoCartao {
  /** Quantos vídeos o comprovante lista. */
  clipes: number;
  /** Takes do boletim que o comprovante NÃO tem: logados sem arquivo no cartão. */
  faltam: string[];
  /** Vídeos do comprovante sem take no boletim: gravados e nunca logados. */
  sobram: string[];
  /** Takes que o ingest ainda não conferiu com o arquivo da câmera. */
  semIngest: string[];
}

/**
 * Cruza o comprovante com o boletim e com o ingest (Lucas, 13/10/2026: "ele
 * comprovou certinho?").
 *
 * O comprovante prova que a CÓPIA bate com o cartão. Esta conta prova a outra
 * metade: que o que está no cartão é o que o boletim diz — nenhum take logado
 * sem arquivo, nenhum arquivo sem take, e cada take já visto pelo ingest.
 * Lê só os nomes dos vídeos (.mp4, .mov, .mxf…), em qualquer formato de
 * comprovante (.mhl, md5sums).
 */
export function conferirComprovante(texto: string, takes: Pick<Take, 'arquivo' | 'xml'>[]): ConferenciaDoCartao {
  const nomes = [...new Set(
    [...String(texto || '').matchAll(/([A-Za-z0-9_-]+)\.(mp4|mov|mxf|braw|r3d|crm|mts)\b/gi)].map(m => m[1].toUpperCase()),
  )];
  // O mesmo casamento do ingest: A003C030 acha A003C030_260912SL.
  const casa = (arquivo: string, nome: string) => {
    const a = arquivo.trim().toUpperCase();
    return Boolean(a) && (nome === a || nome.startsWith(a + '_') || a.startsWith(nome));
  };
  const comArquivo = takes.filter(t => String(t.arquivo || '').trim());
  return {
    clipes: nomes.length,
    faltam: comArquivo.filter(t => !nomes.some(n => casa(t.arquivo, n))).map(t => t.arquivo).sort(),
    sobram: nomes.filter(n => !comArquivo.some(t => casa(t.arquivo, n))).sort(),
    semIngest: comArquivo.filter(t => !t.xml?.criadoEm && !t.xml?.segundos).map(t => t.arquivo).sort(),
  };
}
