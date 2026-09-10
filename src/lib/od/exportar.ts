/**
 * Gerar, guardar e entregar a Ordem do Dia.
 *
 * ⚠️ O ARQUIVO É GUARDADO ANTES DE SER ENTREGUE, e não depois.
 *
 * O pedido que originou isto: *"depois que publicada, poder baixar o arquivo que
 * ele fez; se não vou ter que clicar para exportar de novo"*. Reexportar não é
 * só trabalho repetido — cada exportação SOBE A VERSÃO da diária, então quem só
 * queria uma segunda cópia do mesmo papel acabava criando uma v3 que ninguém
 * pediu, e a equipe passava a receber avisos de mudança que não houve.
 *
 * Guardando na hora, a segunda cópia sai de Documentos e não mexe em nada.
 */
import { guardarArquivo, resolverArquivo } from '../arquivos';
import { registrarDocumento } from '../documentos';
import { coletarOD, type OpcoesColeta } from './coletar';
import { montarOD } from './montar';
import { paraHtml, paraTexto } from './html';
import type { FatoDaOD } from '../conferirOD';
import type { DocumentoOD } from './tipos';

export interface ODPronta {
  doc: DocumentoOD;
  /** `ordem-do-dia-03-v2.pdf` */
  nome: string;
  html: string;
  texto: string;
  projetoId: string;
  numeroDiaria: number;
  versao: number;
  /**
   * O que o documento TEM que continuar dizendo depois de passar pela IA.
   *
   * Só existe para o caminho opcional da diagramação. O PDF mecânico não passa
   * por conferência nenhuma — não há por quê: ele é a estrutura desenhada, e
   * ninguém entre a estrutura e o papel tem chance de mudar uma palavra.
   */
  fatos: FatoDaOD[];
}

/** Monta a OD e devolve as três formas dela. Não gera PDF: isso custa caro. */
export async function prepararOD(diariaId: string, opcoes: OpcoesColeta = {}): Promise<ODPronta | null> {
  const entrada = await coletarOD(diariaId, opcoes);
  if (!entrada) return null;

  const doc = montarOD(entrada);
  const versao = doc.cabecalho.versao || 1;
  const numero = String(entrada.diaria.numero).padStart(2, '0');

  const fatos: FatoDaOD[] = [];
  if (entrada.diaria.chamada) fatos.push({ tipo: 'horário da chamada', valor: entrada.diaria.chamada });
  for (const id of entrada.diaria.cena_ids || []) {
    const c = entrada.cenas.find(x => x.id === id);
    if (c) fatos.push({ tipo: 'cena', valor: `Cena ${c.numero}` });
  }
  for (const id of entrada.diaria.equipe_escalada || []) {
    const p = entrada.perfis.find(x => x.id === id);
    if (p) fatos.push({ tipo: 'quem está escalado', valor: `${p.nome} ${p.sobrenome || ''}`.trim() });
  }
  for (const id of entrada.diaria.locacoes_ids || []) {
    const l = entrada.locacoes.find(x => x.id === id);
    if (l) fatos.push({ tipo: 'locação', valor: l.nome });
  }

  return {
    doc,
    nome: `ordem-do-dia-${numero}${versao > 1 ? `-v${versao}` : ''}.pdf`,
    html: paraHtml(doc),
    texto: paraTexto(doc),
    projetoId: entrada.projeto.id,
    numeroDiaria: entrada.diaria.numero,
    versao,
    fatos,
  };
}

/**
 * O PDF, como arquivo.
 *
 * O renderizador só é carregado aqui dentro: são ~200 KB que nenhuma tela do
 * app precisa ter até alguém clicar em exportar.
 */
export async function gerarPdf(doc: DocumentoOD): Promise<Blob> {
  const { paraPdf } = await import('./pdf');
  return paraPdf(doc);
}

/**
 * Guarda o papel em Documentos → Ordens do Dia.
 *
 * Uma entrada por VERSÃO (`ref_id` inclui o número), e não uma por diária: a v1
 * é o papel que a equipe recebeu e a v2 é outro papel, que circulou depois.
 * Sobrescrever a primeira apagaria a única prova do que foi distribuído antes
 * da mudança — que é justamente o que se vai procurar quando alguém aparecer no
 * set no horário errado.
 */
export async function arquivarOD(params: {
  projetoId: string;
  diariaId: string;
  numeroDiaria: number;
  versao: number;
  blob: Blob;
  nomeArquivo: string;
}): Promise<void> {
  const { projetoId, diariaId, numeroDiaria, versao, blob, nomeArquivo } = params;

  const referencia = await guardarArquivo(projetoId, blob, nomeArquivo, 'application/pdf');

  await registrarDocumento({
    projetoId,
    origem: 'od',
    refId: `${diariaId}:v${versao}`,
    nome: `Ordem do Dia — Diária ${String(numeroDiaria).padStart(2, '0')}${versao > 1 ? ` (v${versao})` : ''}`,
    url: referencia,
    tipo: 'upload',
    tamanho: blob.size,
  });
}

/** Entrega o arquivo para a pessoa. Sem pop-up: é uma âncora e um clique. */
export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Abre o PDF numa aba para conferir/imprimir.
 *
 * Devolve `false` quando o navegador bloqueou — aí quem chamou baixa o arquivo,
 * que é o mesmo resultado sem depender de pop-up.
 */
export function abrir(blob: Blob): boolean {
  const url = URL.createObjectURL(blob);
  const janela = window.open(url, '_blank');
  if (!janela) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** O endereço de uma OD já arquivada, para reabrir sem gerar de novo. */
export async function enderecoDoArquivo(url?: string): Promise<string | null> {
  return resolverArquivo(url);
}
