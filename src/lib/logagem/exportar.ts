import { db } from '../../db/db';
import { guardarArquivo, resolverArquivo } from '../arquivos';
import { registrarDocumento } from '../documentos';
import { data as dataLegivel, dataHora } from '../formato';
import { membrosDoProjeto } from '../membros';
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

export const nomeDoRelatorio = (tipo: TipoDeRelatorio | 'csv', dados: DadosDoRelatorio) =>
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
