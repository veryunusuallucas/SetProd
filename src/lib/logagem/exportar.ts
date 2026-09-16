import { db } from '../../db/db';
import { guardarArquivo, resolverArquivo } from '../arquivos';
import { registrarDocumento } from '../documentos';
import { data as dataLegivel, dataHora } from '../formato';
import { membrosDoProjeto } from '../membros';
import { criarHd, marcarBackup } from './backup';
import { blobDoDataUrl, montarCopia, type CopiaLida, type PlanoDeRestauracao } from './copia';
import { garantirEstado, idDoEstado, mudarEstado } from './estado';
import type { BackupDeCartao, ChecksumDeCartao, Diaria, HdDeBackup, Projeto, Take } from '../../types';
import {
  TITULO_DO_RELATORIO, equipeDoReport, linhasDoComprovante, nomeDeQuemLogou, nomeDoArquivo, ordenarTakes, paraCsv,
  type EquipeDoReport, type OpcoesDoReport, type TipoDeRelatorio,
} from './relatorio';

/**
 * Juntar, gerar, guardar e entregar os relatórios da Logagem.
 *
 * Segue a OD (`lib/od/exportar.ts`): quem faz o arquivo é o app, e o arquivo é
 * GUARDADO em Documentos antes de ser entregue — a segunda cópia sai de lá,
 * sem gerar de novo.
 */

export interface DadosDoRelatorio {
  projeto: Projeto;
  diaria: Diaria;
  takes: Take[];
  hds: HdDeBackup[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  equipe: EquipeDoReport;
  /** Endereço que o renderizador abre. */
  logo?: string;
  /** id do take → endereço da foto. Só os que se conseguiu abrir. */
  fotos: Record<string, string>;
  /** id do take → nome de quem logou. */
  quemLogou: Record<string, string>;
  /** id do comprovante → conteúdo, já cortado no teto. */
  comprovantes: Record<string, { linhas: string[]; cortadas: number }>;
  geradoEm: number;
}

export async function coletarRelatorio(
  diariaId: string,
  precisa: { fotos: boolean; comprovantes: boolean },
): Promise<DadosDoRelatorio | null> {
  const diaria = await db.diarias.get(diariaId);
  if (!diaria) return null;
  const projeto = await db.projetos.get(diaria.projeto_id);
  if (!projeto) return null;

  const [takes, hds, backups, checksums, perfis] = await Promise.all([
    db.log_takes.where('diaria_id').equals(diariaId).toArray(),
    db.log_hds.where('projeto_id').equals(projeto.id).toArray(),
    db.log_backups.where('diaria_id').equals(diariaId).toArray(),
    db.log_checksums.where('diaria_id').equals(diariaId).toArray(),
    db.perfis.where('projeto_id').equals(projeto.id).toArray(),
  ]);

  // A lista de membros vem do servidor. Sem rede, fica só a ficha — e quem
  // logou sem ficha sai sem nome, em vez de travar a exportação no set.
  let membros: Awaited<ReturnType<typeof membrosDoProjeto>> = [];
  const temQuemSemFicha = takes.some(t => t.logado_por && !perfis.some(p => p.id === t.logado_por));
  if (temQuemSemFicha && navigator.onLine) {
    try { membros = await membrosDoProjeto(projeto.id); } catch { membros = []; }
  }

  const quemLogou: Record<string, string> = {};
  for (const t of takes) {
    const nome = nomeDeQuemLogou(t.logado_por, perfis, membros);
    if (nome) quemLogou[t.id] = nome;
  }

  const fotos: Record<string, string> = {};
  if (precisa.fotos) {
    await Promise.all(takes.filter(t => t.foto).map(async t => {
      const url = await resolverArquivo(t.foto);
      if (url) fotos[t.id] = url;
    }));
  }

  const comprovantes: DadosDoRelatorio['comprovantes'] = {};
  if (precisa.comprovantes) {
    await Promise.all(checksums.filter(c => c.arquivo).map(async c => {
      try {
        const url = await resolverArquivo(c.arquivo);
        if (!url) return;
        const texto = await (await fetch(url)).text();
        comprovantes[c.id] = linhasDoComprovante(texto);
      } catch { /* sem o arquivo, o PDF mostra só o hash — que é a prova */ }
    }));
  }

  return {
    projeto,
    diaria,
    takes: ordenarTakes(takes),
    hds: [...hds].sort((a, b) => a.ordem - b.ordem),
    backups,
    checksums,
    equipe: equipeDoReport(projeto),
    logo: (await resolverArquivo(projeto.logo_od)) || undefined,
    fotos,
    quemLogou,
    comprovantes,
    geradoEm: Date.now(),
  };
}

export const numeroDaDiaria = (d: Pick<Diaria, 'numero'>) => String(d.numero).padStart(2, '0');

/** "Diária 03 · 16/09/2026" */
export const diariaLegivel = (d: Pick<Diaria, 'numero' | 'data'>) =>
  `Diária ${numeroDaDiaria(d)}${d.data ? ` · ${dataLegivel(d.data)}` : ''}`;

export async function gerarPdfDaLogagem(tipo: TipoDeRelatorio, dados: DadosDoRelatorio, opcoes: OpcoesDoReport): Promise<Blob> {
  // ~200 KB de renderizador que nenhuma tela precisa ter até alguém exportar.
  const { relatorioEmPdf } = await import('./pdf');
  return relatorioEmPdf(tipo, dados, opcoes);
}

export function csvDaLogagem(dados: DadosDoRelatorio): Blob {
  const texto = paraCsv(dados.takes, {
    diaria: numeroDaDiaria(dados.diaria),
    projeto: dados.projeto.nome,
    equipe: dados.equipe,
  });
  return new Blob([texto], { type: 'text/csv;charset=utf-8' });
}

export const nomeDoRelatorio = (tipo: TipoDeRelatorio | 'csv' | 'json', dados: DadosDoRelatorio) =>
  nomeDoArquivo(tipo, dados.projeto.nome, dados.diaria.numero);

/**
 * Guarda em Documentos → Camera Reports.
 *
 * UMA ENTRADA POR EXPORTAÇÃO (`ref_id` com o instante), e não uma por diária.
 * O report da Diária 03 exportado às 19h e o exportado às 23h, depois do
 * ingest, são papéis diferentes: o primeiro pode já ter ido para a montagem, e
 * sobrescrevê-lo apagaria a prova do que foi entregue.
 */
export async function arquivarRelatorio(params: {
  tipo: TipoDeRelatorio | 'csv';
  dados: DadosDoRelatorio;
  blob: Blob;
  nomeArquivo: string;
}): Promise<void> {
  const { tipo, dados, blob, nomeArquivo } = params;
  const mime = tipo === 'csv' ? 'text/csv' : 'application/pdf';
  const referencia = await guardarArquivo(dados.projeto.id, blob, nomeArquivo, mime);
  const titulo = tipo === 'csv' ? 'Camera Log (CSV)' : TITULO_DO_RELATORIO[tipo];

  await registrarDocumento({
    projetoId: dados.projeto.id,
    origem: 'camera_report',
    refId: `${dados.diaria.id}:${tipo}:${dados.geradoEm}`,
    nome: `${titulo} — Diária ${numeroDaDiaria(dados.diaria)} (${dataHora(dados.geradoEm)})`,
    url: referencia,
    tipo: 'upload',
    tamanho: blob.size,
  });
}

/* ───────────────────────── Cópia em JSON ───────────────────────── */

const paraDataUrl = (blob: Blob) => new Promise<string>((ok, erro) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(String(leitor.result));
  leitor.onerror = () => erro(leitor.error);
  leitor.readAsDataURL(blob);
});

async function blobDoArquivo(referencia?: string): Promise<Blob | null> {
  const url = await resolverArquivo(referencia);
  if (!url) return null;
  try { return await (await fetch(url)).blob(); } catch { return null; }
}

/**
 * A cópia inteira da diária, com as fotos e o texto dos comprovantes DENTRO.
 *
 * O que não se conseguiu abrir (foto que nunca baixou neste aparelho, sem
 * rede) fica de fora e é contado — o `_meta.fotos` diz quantas vieram.
 */
export async function copiaDaLogagem(dados: DadosDoRelatorio, versaoDoApp: string): Promise<{ blob: Blob; faltaram: number }> {
  const [estado, kits] = await Promise.all([
    db.log_estado.get(idDoEstado(dados.diaria.id)),
    db.log_kits.where('projeto_id').equals(dados.projeto.id).toArray(),
  ]);

  const fotos: Record<string, string> = {};
  let faltaram = 0;
  const referencias = [...new Set(dados.takes.map(t => t.foto).filter((f): f is string => Boolean(f)))];
  await Promise.all(referencias.map(async ref => {
    const blob = await blobDoArquivo(ref);
    if (blob) fotos[ref] = await paraDataUrl(blob);
    else faltaram++;
  }));

  const conteudos: Record<string, string> = {};
  await Promise.all(dados.checksums.filter(c => c.arquivo).map(async c => {
    const blob = await blobDoArquivo(c.arquivo);
    if (blob) conteudos[c.id] = await blob.text();
  }));

  const agora = new Date(dados.geradoEm);
  const copia = montarCopia({
    projeto: { id: dados.projeto.id, nome: dados.projeto.nome },
    diaria: { id: dados.diaria.id, numero: dados.diaria.numero, data: dados.diaria.data },
    estado,
    takes: dados.takes,
    kits,
    hds: dados.hds,
    backups: dados.backups,
    checksums: dados.checksums,
    equipe: dados.equipe,
    conteudos,
    fotos,
    versaoDoApp,
    agora,
    agoraLegivel: dataHora(agora.getTime()),
  });
  return { blob: new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }), faltaram };
}

/** O que a diária tem hoje, para comparar com a cópia. */
export async function situacaoParaRestaurar(projetoId: string, diariaId: string) {
  const [takes, kits, hds, backups, checksums, estado] = await Promise.all([
    db.log_takes.where('diaria_id').equals(diariaId).toArray(),
    db.log_kits.where('projeto_id').equals(projetoId).toArray(),
    db.log_hds.where('projeto_id').equals(projetoId).toArray(),
    db.log_backups.where('diaria_id').equals(diariaId).toArray(),
    db.log_checksums.where('diaria_id').equals(diariaId).toArray(),
    db.log_estado.get(idDoEstado(diariaId)),
  ]);
  return { takes, kits, hds, backups, checksums, temEstado: Boolean(estado) };
}

/**
 * Aplica o plano: só acrescenta, sempre com ids novos.
 *
 * Ids novos porque a cópia pode ser de OUTRA diária (ou de outra produção):
 * gravar com o id de lá moveria o take de lá para cá, em vez de copiá-lo.
 */
export async function restaurarCopia(
  copia: CopiaLida,
  plano: PlanoDeRestauracao,
  ctx: { projetoId: string; diariaId: string; departamentoId?: string; quem?: string },
): Promise<void> {
  const { projetoId, diariaId, departamentoId, quem } = ctx;
  const agora = Date.now();
  const mesmaProducao = copia.projetoId === projetoId;

  // HDs primeiro: as marcações apontam para eles pelo nome.
  const hdsAtuais = await db.log_hds.where('projeto_id').equals(projetoId).toArray();
  let ordem = hdsAtuais.reduce((m, h) => Math.max(m, h.ordem), 0);
  for (const h of plano.hdsNovos) hdsAtuais.push(await criarHd(projetoId, h.nome, ++ordem, departamentoId));
  for (const b of plano.backupsNovos) {
    const hd = hdsAtuais.find(h => h.nome.trim().toLowerCase() === b.hd.trim().toLowerCase());
    if (hd) await marcarBackup({ projetoId, diariaId, cartao: b.cartao, hdId: hd.id, quem, departamentoId });
  }

  for (const k of plano.kitsNovos) {
    await db.log_kits.add({
      ...k,
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      departamento_id: departamentoId,
      criado_em: k.criado_em || agora,
      cameras: k.cameras?.map(c => ({ ...c })),
      lentes: k.lentes?.map(l => ({ ...l, id: crypto.randomUUID() })),
    });
  }

  for (const c of plano.comprovantesNovos) {
    const { conteudo, ...resto } = c;
    const arquivo = conteudo
      ? await guardarArquivo(projetoId, new Blob([conteudo], { type: 'text/plain' }), c.nome_arquivo, 'text/plain')
      : undefined;
    await db.log_checksums.add({
      ...resto,
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      diaria_id: diariaId,
      departamento_id: departamentoId,
      arquivo,
      anexado_em: c.anexado_em || agora,
      anexado_por: c.anexado_por || quem,
    });
  }

  // Os takes da cópia entram DEPOIS dos que já estão, na ordem em que foram rodados.
  const ultima = (await db.log_takes.where('diaria_id').equals(diariaId).toArray())
    .reduce((m, t) => Math.max(m, t.ordem ?? 0), 0);
  let passo = 0;
  for (const t of plano.takesNovos) {
    const dataUrl = copia.fotos[t.id];
    const blob = dataUrl ? blobDoDataUrl(dataUrl) : null;
    const foto = blob
      ? await guardarArquivo(projetoId, blob, `referencia-${t.arquivo || t.id}.jpg`, blob.type || 'image/jpeg')
      : undefined;
    await db.log_takes.add({
      ...t,
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      diaria_id: diariaId,
      departamento_id: departamentoId,
      // A ligação com a decupagem só vale dentro da mesma produção.
      cena_id: mesmaProducao ? t.cena_id : undefined,
      plano_id: mesmaProducao ? t.plano_id : undefined,
      ordem: ultima + ++passo,
      foto,
      logado_por: t.logado_por || quem,
      criado_em: t.criado_em || agora,
    });
  }

  if (plano.estado) {
    await garantirEstado(projetoId, diariaId, departamentoId);
    // Tudo o que aponta para outro registro (kit, lente, plano, foto) fica de fora:
    // os ids de lá não existem aqui.
    const {
      id: _id, projeto_id: _p, diaria_id: _d, departamento_id: _dep, cena_id: _c, plano_id: _pl,
      kit_camera_id: _kc, kit_lente_id: _kl, lente_ref: _lr, foto: _f, atualizado_em: _a, ...resto
    } = plano.estado;
    await mudarEstado(diariaId, resto);
  }
}
