import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../db/db';
import { useParams } from 'react-router-dom';
import { pdfjs, Document, Page } from 'react-pdf';
import { Trash2, Tag, CheckSquare, Plus, ChevronLeft, ChevronRight, FileDown, FileUp, Filter, Globe } from 'lucide-react';
import type { RoteiroTag, Cena } from '../types';
import { adicionarSubtarefasDecupagem } from '../lib/tasks';
import { registrarDocumento, removerDocumentoDeOrigem } from '../lib/documentos';
import { extrairElementosDeCenas } from '../lib/gemini';
import { DEPARTAMENTOS, temaDe, normalizarCategoria, extrairCenas, encontrarTrechoLiteral, escopoPadrao, type CabecalhoCena } from '../lib/decupagem';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import { sincronizarElementos } from '../lib/elementos';
import { pegarVez, liberarVez, marcarProgresso, manterVivo, execucaoAtiva, type Vaga, type ExecucaoAtiva } from '../lib/filaIA';
import { ScriptDropzone } from '../components/ScriptDropzone';
import { AiSetupPanel, type ModoProcessamento } from '../components/AiSetupPanel';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

/**
 * Worker empacotado junto com o app, não baixado do unpkg. O app é
 * offline-first: no set não há internet, e com o worker num CDN o roteiro
 * simplesmente não abria.
 */
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

/**
 * Sem os "standard fonts" o pdf.js não monta as fontes base do PDF (Courier,
 * Helvetica, Times) e substitui por outra. As larguras saem erradas e a camada
 * de texto — invisível, por cima dos glifos — desliza para o lado: você clica
 * no "S" de SALA e a seleção começa no "A". Era a causa do destaque
 * desalinhado e do texto capturado errado.
 *
 * O objeto precisa ser constante: recriá-lo a cada render faz o react-pdf
 * recarregar o documento em laço.
 */
const OPCOES_PDF = {
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
};

/** Letra, número ou hífen/apóstrofo interno — o que conta como "dentro da palavra". */
const CARACTERE_DE_PALAVRA = /[\p{L}\p{N}'’\-]/u;

/**
 * Estende a seleção do usuário até fechar palavras inteiras, e devolve o texto.
 *
 * Por que isto existe: em Courier a 1,2x cada caractere tem ~8px. Um clique que
 * cai depois da metade do "M" faz o navegador começar a seleção no "A", e a
 * marcação era gravada como "ARCOS". Não era erro de cálculo — era a precisão
 * de caractere do navegador aplicada a uma tarefa que é sempre de palavra.
 *
 * A seleção visível também é reposicionada, para o que fica destacado na tela
 * ser exatamente o que vai virar marcação.
 */
function expandirSelecaoParaPalavras(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';

  const cru = sel.toString().replace(/\s+/g, ' ').trim();
  const range = sel.getRangeAt(0);

  // A linha do pdf.js é um span; o texto dela pode estar quebrado em vários nós
  // porque as marcações já existentes injetam <span class="highlight">. Por isso
  // a expansão trabalha na linha inteira, não no nó onde o clique caiu.
  const linha = (range.startContainer.parentElement as HTMLElement | null)
    ?.closest('.react-pdf__Page__textContent > span');
  if (!linha || !linha.contains(range.endContainer)) return cru;

  const nos: Text[] = [];
  const passeio = document.createTreeWalker(linha, NodeFilter.SHOW_TEXT);
  for (let n = passeio.nextNode(); n; n = passeio.nextNode()) nos.push(n as Text);

  /** Converte (nó, deslocamento) para a posição na linha achatada. */
  const posicaoNaLinha = (no: Node, deslocamento: number): number => {
    let total = 0;
    for (const atual of nos) {
      if (atual === no) return total + deslocamento;
      total += atual.data.length;
    }
    return -1;
  };

  const texto = nos.map(n => n.data).join('');
  let inicio = posicaoNaLinha(range.startContainer, range.startOffset);
  let fim = posicaoNaLinha(range.endContainer, range.endOffset);
  if (inicio < 0 || fim < 0 || fim < inicio) return cru;

  while (inicio > 0 && CARACTERE_DE_PALAVRA.test(texto[inicio - 1])) inicio--;
  while (fim < texto.length && CARACTERE_DE_PALAVRA.test(texto[fim])) fim++;

  return texto.slice(inicio, fim).replace(/\s+/g, ' ').trim() || cru;
}

/** O texto vem do PDF e é injetado como HTML — escapar não é opcional. */
function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Aba Roteiro: envio do PDF, processamento por IA e marcação manual. */
interface BreakdownModuleProps {
  /** Página que o stripboard pediu para abrir ao clicar numa tira. */
  paginaAlvo?: number | null;
  onPaginaAtendida?: () => void;
}

export function BreakdownModule({ paginaAlvo, onPaginaAtendida }: BreakdownModuleProps = {}) {
  const { id: projetoId } = useParams<{ id: string }>();

  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfFile, setPdfFile] = useState<string | null>(null);

  const roteiro = useLiveQuery(() => db.roteiro_pdfs.where('projeto_id').equals(projetoId!).first(), [projetoId]);
  const tags = useLiveQuery(() => db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  const [textoSelecionado, setTextoSelecionado] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [filtroDepto, setFiltroDepto] = useState<string | null>(null);

  // Etapa 1: envio e processamento
  const [lendoPdf, setLendoPdf] = useState(false);
  const [paginasTexto, setPaginasTexto] = useState<{ numero: number; texto: string }[] | null>(null);
  const [metaArquivo, setMetaArquivo] = useState<{ nome: string; paginas: number; tamanho: number } | null>(null);
  const [roteiroIdAtual, setRoteiroIdAtual] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState<{ feito: number; total: number } | null>(null);
  const [aviso, setAviso] = useState('');
  /** Preenchido quando outra pessoa está com a vez; libera sozinho ao terminar. */
  const [naFila, setNaFila] = useState<ExecucaoAtiva | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    setPdfFile(roteiro ? roteiro.dados : null);
  }, [roteiro]);

  /**
   * Vindo do stripboard: abre a página da cena clicada.
   *
   * O pedido é consumido logo em seguida, senão o roteiro voltaria para essa
   * página toda vez que a pessoa trocasse de aba.
   */
  useEffect(() => {
    if (!paginaAlvo) return;
    setPageNumber(paginaAlvo);
    onPaginaAtendida?.();
  }, [paginaAlvo]);

  /**
   * Enquanto esperamos a vez, acompanha a análise de quem está na frente.
   *
   * Sem isto a pessoa ficaria olhando um aviso congelado sem saber se ainda
   * está rodando — e apertaria o botão de novo até dar erro.
   */
  useEffect(() => {
    if (!naFila) return;
    const t = setInterval(async () => {
      const ativa = await execucaoAtiva();
      setNaFila(ativa && !ativa.minha ? ativa : null);
    }, 8000);
    return () => clearInterval(t);
  }, [naFila]);

  /** Lê o texto de cada página — base do modo manual e do modo IA. */
  const extrairPaginas = async (b64: string) => {
    const binario = atob(b64.split(',')[1]);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);

    // Mesmas opções da exibição: o texto extraído aqui precisa bater com o que
    // é renderizado na tela, senão o trecho da IA não acha o destaque.
    const pdf = await pdfjs.getDocument({ data: bytes, ...OPCOES_PDF }).promise;
    const paginas: { numero: number; texto: string }[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      paginas.push({ numero: i, texto: content.items.map((it: any) => it.str).join(' ') });
    }
    return paginas;
  };

  const receberArquivo = async (file: File) => {
    setErro('');
    setAviso('');
    setLendoPdf(true);

    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.onerror = () => rej(r.error);
        r.readAsDataURL(file);
      });

      const roteiroId = roteiro ? roteiro.id : crypto.randomUUID();
      if (roteiro) {
        await db.roteiro_pdfs.update(roteiro.id, { nome: file.name, dados: b64, data_upload: Date.now() });
      } else {
        await db.roteiro_pdfs.add({ id: roteiroId, projeto_id: projetoId!, nome: file.name, dados: b64, data_upload: Date.now() });
      }

      await registrarDocumento({
        projetoId: projetoId!, origem: 'roteiro', refId: roteiroId,
        nome: file.name, url: b64, tipo: 'upload', tamanho: file.size,
      });

      const paginas = await extrairPaginas(b64);
      setPaginasTexto(paginas);
      setRoteiroIdAtual(roteiroId);
      setMetaArquivo({ nome: file.name, paginas: paginas.length, tamanho: file.size });
    } catch (err) {
      console.error(err);
      setErro('Não foi possível ler este PDF. Tente outro arquivo.');
    } finally {
      setLendoPdf(false);
    }
  };

  /**
   * Grava as cenas detectadas pelo padrão de cabeçalho.
   *
   * Nada de deduplicar por nome de local: roteiro repete locação de propósito
   * (o mesmo quarto em dias diferentes é cena diferente). Em vez disso,
   * reprocessar o PDF substitui as cenas que vieram dele e preserva as que
   * você criou na mão.
   */
  const gravarCenas = async (lista: CabecalhoCena[]) => {
    const existentes = await db.cenas.where('projeto_id').equals(projetoId!).toArray();
    const antigasDoRoteiro = existentes.filter(c => c.origem_roteiro);
    for (const c of antigasDoRoteiro) await db.cenas.delete(c.id);

    const manuais = existentes.length - antigasDoRoteiro.length;
    let ordem = manuais;

    /** Número da cena → id gravado, para as marcações saberem a que cena pertencem. */
    const idPorNumero = new Map<string, string>();

    for (const c of lista) {
      const id = crypto.randomUUID();
      idPorNumero.set(c.numero, id);
      await db.cenas.add({
        id,
        projeto_id: projetoId!,
        numero: c.numero,
        descricao: c.local,
        ambiente: c.ambiente,
        periodo: c.periodo,
        origem_roteiro: true,
        ordem: ordem++,
      } as Cena);
    }
    return { criadas: lista.length, substituidas: antigasDoRoteiro.length, idPorNumero };
  };

  /**
   * Elementos viram tags — é isso que pinta a marcação sobre o PDF.
   *
   * O trecho da IA quase nunca bate caractere a caractere com o texto extraído
   * (o pdf.js junta os fragmentos com espaços), então procuramos com tolerância
   * a espaço e gravamos o pedaço EXATO da página. Sem isso, quase toda marcação
   * era descartada em silêncio — foi o motivo de o PDF sair sem destaque nenhum.
   */
  const gravarElementos = async (
    elementos: { texto: string; categoria: string; pagina: number; cenaNumero?: string }[],
    paginas: { numero: number; texto: string }[],
    idPorNumero?: Map<string, string>
  ) => {
    const existentes = await db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray();
    const jaTem = new Set(existentes.map(t => t.texto_selecionado.toLowerCase()));
    let criadas = 0;
    let descartadas = 0;

    for (const el of elementos) {
      // Procura primeiro na página da cena; se não achar, varre o documento.
      const ordemBusca = [
        ...paginas.filter(p => p.numero === el.pagina),
        ...paginas.filter(p => p.numero !== el.pagina),
      ];

      let literal: string | null = null;
      let paginaAchada = el.pagina;
      for (const p of ordemBusca) {
        const achado = encontrarTrechoLiteral(p.texto, el.texto);
        if (achado) { literal = achado; paginaAchada = p.numero; break; }
      }

      if (!literal) { descartadas++; continue; }
      if (jaTem.has(literal.toLowerCase())) continue;
      jaTem.add(literal.toLowerCase());

      const tema = temaDe(el.categoria);
      await db.roteiro_tags.add({
        id: crypto.randomUUID(),
        projeto_id: projetoId!,
        roteiro_id: roteiroIdAtual || roteiro?.id || '',
        texto_selecionado: literal,
        categoria: tema.chave,
        cor: tema.border,
        pagina: paginaAchada,
        // A cena de origem vem da análise, não da página: é ela que alimenta
        // "em quais cenas este elemento aparece" e, depois, o DOOD.
        cena_id: el.cenaNumero ? idPorNumero?.get(el.cenaNumero) : undefined,
        global: escopoPadrao(tema.chave),
      } as RoteiroTag);
      criadas++;
    }

    return { criadas, descartadas };
  };

  const processar = async (config: { modo: ModoProcessamento; departamentos: string[]; minucioso: boolean }) => {
    if (!paginasTexto) return;

    if (config.modo === 'MANUAL') {
      setPaginasTexto(null);
      setMetaArquivo(null);
      return;
    }

    const analiseTecnica = config.modo === 'FULL_BREAKDOWN';

    // Uma análise por vez na produção inteira. Quatro pessoas mandando junto
    // são ~120 chamadas simultâneas: estoura a cota e falha para todo mundo.
    let vaga: Vaga = { liberado: true };
    let pararSinal = () => {};

    if (analiseTecnica) {
      vaga = await pegarVez({ projeto: roteiro?.nome || 'Roteiro', total: extrairCenas(paginasTexto).length });
      if (!vaga.liberado) {
        setNaFila(vaga.ocupadaPor ?? null);
        return;
      }
      setNaFila(null);
      pararSinal = manterVivo(vaga.id);
    }

    setProcessando(true);
    setErro('');

    // 1) Cenas: sempre por padrão de cabeçalho. É determinístico, não perde
    //    cena no meio do lote e não corre o risco de a IA despejar a página
    //    inteira no nome da cena.
    setProgresso({ feito: 0, total: 1 });
    const cenasDetectadas = extrairCenas(paginasTexto);
    const { criadas, substituidas, idPorNumero } = await gravarCenas(cenasDetectadas);

    if (!analiseTecnica) {
      setPaginasTexto(null);
      setMetaArquivo(null);
      setProcessando(false);
      setProgresso(null);
      setAviso(`${criadas} cena(s) extraídas do roteiro.` + (substituidas > 0 ? ` (${substituidas} da importação anterior foram substituídas.)` : ''));
      return;
    }

    // 2) Elementos: uma chamada por cena, com o texto daquela cena.
    try {
      const elementos = await extrairElementosDeCenas({
        cenas: cenasDetectadas,
        departamentos: config.departamentos,
        minucioso: config.minucioso,
        onProgresso: (feito, total) => {
          setProgresso({ feito, total });
          marcarProgresso(vaga.id, feito);
        },
      });

      const { criadas: marcadas, descartadas } = await gravarElementos(elementos, paginasTexto, idPorNumero);

      // Toda marcação nova ganha (ou reaproveita) o elemento do inventário.
      await sincronizarElementos(projetoId!);

      setPaginasTexto(null);
      setMetaArquivo(null);
      setAviso(
        `${criadas} cena(s) criadas e ${marcadas} elemento(s) marcados no roteiro` +
        (descartadas > 0 ? ` (${descartadas} descartados por não bater com o texto do PDF).` : '.') +
        ' Revise: a IA sugere, você aprova.'
      );
    } catch (err: any) {
      setPaginasTexto(null);
      setMetaArquivo(null);
      setAviso(`${criadas} cena(s) criadas. A análise técnica falhou: ${err?.message || err}`);
    } finally {
      // A vez precisa ser devolvida mesmo se a análise explodir, senão a fila
      // fica travada até o registro expirar por falta de sinal.
      pararSinal();
      await liberarVez(vaga.id);
      setProcessando(false);
      setProgresso(null);
    }
  };

  /** Remove o PDF, as marcações e o espelho em Documentos. */
  const apagarRoteiro = async () => {
    const quantas = tags.length;
    const aviso = quantas > 0
      ? `Apagar o roteiro e as ${quantas} marcação(ões)? As cenas já criadas continuam.`
      : 'Apagar o roteiro? As cenas já criadas continuam.';
    if (!window.confirm(aviso)) return;

    if (roteiro) {
      await db.roteiro_pdfs.delete(roteiro.id);
      await removerDocumentoDeOrigem(projetoId!, 'roteiro', roteiro.id);
      const tagsProj = await db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray();
      for (const t of tagsProj) await db.roteiro_tags.delete(t.id);
    }
    setPdfFile(null);
    setPaginasTexto(null);
    setMetaArquivo(null);
  };

  // ---- Marcação manual ----

  const handleMouseUp = (e: React.MouseEvent) => {
    const texto = expandirSelecaoParaPalavras();
    if (texto) {
      setTextoSelecionado(texto);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowTagMenu(true);
    } else {
      setShowTagMenu(false);
    }
  };

  const addTag = async (chaveDepto: string) => {
    if (!textoSelecionado) return;
    const tema = temaDe(chaveDepto);
    await db.roteiro_tags.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      roteiro_id: roteiro?.id || '',
      texto_selecionado: textoSelecionado,
      categoria: tema.chave,
      cor: tema.border,
      pagina: pageNumber,
      global: escopoPadrao(tema.chave),
    } as RoteiroTag);
    // Marcação manual também entra no inventário — senão o Elements Manager só
    // conheceria o que veio da IA.
    await sincronizarElementos(projetoId!);
    setShowTagMenu(false);
    window.getSelection()?.removeAllRanges();
  };

  const converterParaTask = async (tag: RoteiroTag) => {
    const tema = temaDe(tag.categoria);
    const adicionados = await adicionarSubtarefasDecupagem(projetoId!, [
      `[${tema.rotulo} | pág ${tag.pagina}] Providenciar: ${tag.texto_selecionado}`,
    ]);
    alert(adicionados > 0
      ? `"${tag.texto_selecionado}" entrou como subtarefa em "Análise Técnica / Decupagem".`
      : 'Esse item já estava na lista da Análise Técnica.');
  };

  const exportarRelatorio = () => {
    if (tags.length === 0) return alert('Nenhum item marcado no roteiro ainda.');

    const blocos = DEPARTAMENTOS.map(d => {
      const itens = tags.filter(t => normalizarCategoria(t.categoria) === d.chave);
      if (itens.length === 0) return '';
      const lis = [...itens].sort((a, b) => a.pagina - b.pagina)
        .map(t => `<li>${t.texto_selecionado} <span class="muted">(pág ${t.pagina})</span></li>`).join('');
      return `<h2><span style="display:inline-block;width:10px;height:10px;background:${d.border};border-radius:50%;margin-right:6px"></span>${d.rotulo} (${itens.length})</h2><ul>${lis}</ul>`;
    }).join('');

    const html = montarPaginaRelatorio('Breakdown do Roteiro', `
      <h1>Breakdown do Roteiro</h1>
      <div class="muted">${roteiro?.nome || ''} · ${tags.length} elemento(s) marcados</div>
      ${blocos}`);

    // Imprime por iframe: `window.open` era barrado pelo bloqueador de pop-up e
    // não abria nada no app instalado — foi o motivo de o botão "não funcionar".
    if (!imprimirHtml(html)) baixarHtml(html, 'breakdown-roteiro');
  };

  /**
   * Destaque sobre o texto do PDF.
   *
   * Usa a classe `.highlight` do próprio pdf.js (a mesma da busca do visualizador).
   * É importante não inventar padding/borda aqui: cada span do text layer recebe
   * um `transform: scaleX()` para casar com os glifos da página, e esse transform
   * distorce qualquer espaçamento próprio — era o motivo do destaque sair torto.
   * A `.highlight` já compensa isso com margin -1px / padding 1px.
   */
  const textRenderer = ({ str }: { str: string }) => {
    if (!str) return str;
    // Tags globais (elenco, figuração, veículos) valem em todas as páginas;
    // as pontuais, só onde foram marcadas.
    const daPagina = tags.filter(t => t.pagina === pageNumber || ehGlobal(t));
    if (daPagina.length === 0) return str;

    // Trechos maiores primeiro, para "LUVAS AMARELAS" ganhar de "LUVAS".
    const alvos = [...daPagina].sort(
      (a, b) => b.texto_selecionado.length - a.texto_selecionado.length
    );

    type Pedaco = { texto: string; tag?: RoteiroTag };
    let pedacos: Pedaco[] = [{ texto: str }];

    // Um span pode conter várias marcações diferentes — quebramos em cascata.
    for (const tag of alvos) {
      const alvo = tag.texto_selecionado;
      if (!alvo) continue;

      const novos: Pedaco[] = [];
      for (const pedaco of pedacos) {
        if (pedaco.tag || !pedaco.texto.includes(alvo)) {
          novos.push(pedaco);
          continue;
        }
        const partes = pedaco.texto.split(alvo);
        partes.forEach((parte, i) => {
          if (parte) novos.push({ texto: parte });
          if (i < partes.length - 1) novos.push({ texto: alvo, tag });
        });
      }
      pedacos = novos;
    }

    if (!pedacos.some(p => p.tag)) return str;

    // O react-pdf v10 injeta o retorno com innerHTML (e sanitiza) — precisa ser
    // uma STRING de HTML. Devolver JSX aqui vira o texto "[object Object]".
    return pedacos.map(pedaco => {
      const texto = escaparHtml(pedaco.texto);
      if (!pedaco.tag) return texto;

      const tema = temaDe(pedaco.tag.categoria);
      const titulo = escaparHtml(`${tema.rotulo}: ${pedaco.tag.texto_selecionado}`);
      return `<span class="highlight" title="${titulo}" style="background-color:${tema.bg};border-radius:3px">${texto}</span>`;
    }).join('');
  };

  /**
   * Tags gravadas antes deste recurso não têm o campo `global`. Em vez de migrar
   * o banco, o padrão do departamento vale como resposta — assim um "MARCOS"
   * antigo já passa a destacar no roteiro inteiro.
   */
  const ehGlobal = (t: RoteiroTag) => t.global ?? escopoPadrao(t.categoria);

  const tagsVisiveis = filtroDepto
    ? tags.filter(t => normalizarCategoria(t.categoria) === filtroDepto)
    : tags;

  const contagemPorDepto = DEPARTAMENTOS.map(d => ({
    ...d,
    total: tags.filter(t => normalizarCategoria(t.categoria) === d.chave).length,
  })).filter(d => d.total > 0);

  // ---- ETAPA 1: sem roteiro, ou roteiro recém-enviado aguardando escolha ----
  if (!pdfFile || paginasTexto) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ScriptDropzone onArquivo={receberArquivo} lendo={lendoPdf} meta={metaArquivo} />

        {erro && <div className="card" style={{ borderColor: 'var(--color-danger)' }}><span className="text-sm text-danger">{erro}</span></div>}

        <AnimatePresence>
          {naFila && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card"
              style={{ borderColor: 'var(--accent)', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <span className="text-sm font-bold">Tem uma análise rodando agora</span>
              <span className="text-sm text-secondary">
                <strong>{naFila.nome}</strong> começou há {Math.round(naFila.desdeMs / 60000) || 1} min
                {naFila.projeto ? ` (${naFila.projeto})` : ''}
                {naFila.total > 0 && ` — cena ${naFila.feito} de ${naFila.total}`}.
              </span>

              {naFila.total > 0 && (
                <div style={{ height: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${Math.round((naFila.feito / naFila.total) * 100)}%` }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #9d4edd, #4cc9f0)' }}
                  />
                </div>
              )}

              <span className="text-xs text-muted">
                É uma de cada vez para não estourar a cota da IA e falhar para os dois.
                Assim que terminar, esta tela libera sozinha.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {paginasTexto && (
            <AiSetupPanel
              totalPaginas={paginasTexto.length}
              processando={processando}
              progresso={progresso}
              onProcessar={processar}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ---- ETAPA 2: workspace do roteiro ----
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>

      <AnimatePresence>
        {aviso && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="card" style={{ borderLeft: '4px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <span className="text-sm" style={{ flex: 1 }}>{aviso}</span>
            <button onClick={() => setAviso('')} className="btn-icon" style={{ padding: '4px' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="text-xs text-muted truncate" style={{ maxWidth: '320px' }}>
          {roteiro?.nome} · selecione um trecho no PDF para marcar
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Trocar = manda outro PDF sem perder as marcações. */}
          <label
            className="btn-chip"
            title="Enviar outra versão do roteiro"
          >
            <FileUp size={14} /> Trocar
            <input type="file" accept="application/pdf" onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) receberArquivo(f);
            }} style={{ display: 'none' }} />
          </label>

          <button
            onClick={apagarRoteiro}
            className="btn-chip is-danger"
            title="Apagar o roteiro e as marcações"
          >
            <Trash2 size={14} /> Apagar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: '600px', flexWrap: 'wrap' }}>

        <div className="card" style={{ flex: 2, minWidth: '320px', padding: '16px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="btn-icon"><ChevronLeft size={20} /></button>
              <span className="text-sm font-bold">Pág {pageNumber} de {numPages || '?'}</span>
              <button disabled={pageNumber >= (numPages || 1)} onClick={() => setPageNumber(p => p + 1)} className="btn-icon"><ChevronRight size={20} /></button>
            </div>
            <div className="text-xs text-muted">{tags.filter(t => t.pagina === pageNumber).length} marcação(ões) aqui</div>
          </div>

          <div
            style={{ flex: 1, overflow: 'auto', backgroundColor: '#e5e5e5', borderRadius: '8px', display: 'flex', justifyContent: 'center', padding: '24px 0' }}
            onMouseUp={handleMouseUp}
          >
            <Document
              file={pdfFile}
              options={OPCOES_PDF}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              loading={<div className="text-muted" style={{ padding: '40px' }}>Processando PDF...</div>}
              error={<div className="text-danger" style={{ padding: '40px' }}>Erro ao ler PDF.</div>}
            >
              <Page
                pageNumber={pageNumber}
                scale={1.2}
                renderTextLayer
                renderAnnotationLayer
                customTextRenderer={textRenderer as any}
                className="shadow-lg"
              />
            </Document>
          </div>

          <AnimatePresence>
            {showTagMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.14 }}
                style={{
                  position: 'fixed', left: menuPos.x + 10, top: menuPos.y + 10,
                  backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.55)', zIndex: 100,
                  border: '1px solid var(--border-color)', width: '290px',
                }}
              >
                <div className="text-xs text-muted mb-2 font-bold uppercase">
                  Marcar "{textoSelecionado.substring(0, 28)}{textoSelecionado.length > 28 ? '…' : ''}"
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  {DEPARTAMENTOS.map(d => (
                    <motion.button
                      key={d.chave}
                      whileHover={{ x: 2 }}
                      onClick={() => addTag(d.chave)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 8px',
                        borderRadius: '6px', border: `1px solid ${d.border}`, backgroundColor: 'transparent',
                        color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: d.border, flexShrink: 0 }} />
                      {d.rotulo}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="card" style={{ flex: 1, minWidth: '270px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={16} /> Itens ({tags.length})
            </h3>
            <button onClick={exportarRelatorio} className="btn-chip">
              <FileDown size={14} /> Relatório
            </button>
          </div>

          {contagemPorDepto.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {filtroDepto && (
                <button
                  onClick={() => setFiltroDepto(null)}
                  className="text-xs"
                  style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Filter size={11} /> limpar
                </button>
              )}
              {contagemPorDepto.map(d => (
                <motion.button
                  key={d.chave}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setFiltroDepto(filtroDepto === d.chave ? null : d.chave)}
                  className="text-xs"
                  style={{
                    padding: '4px 10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700,
                    border: `1px solid ${d.border}`,
                    backgroundColor: filtroDepto === d.chave ? d.bg : 'transparent',
                    color: filtroDepto === d.chave ? '#fff' : d.text,
                  }}
                >
                  {d.rotulo} {d.total}
                </motion.button>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tagsVisiveis.length === 0 ? (
              <div className="text-xs text-muted text-center" style={{ marginTop: '40px' }}>
                {tags.length === 0 ? 'Nenhuma marcação ainda.' : 'Nada neste departamento.'}
              </div>
            ) : (
              [...tagsVisiveis].sort((a, b) => a.pagina - b.pagina).map((tag, i) => {
                const tema = temaDe(tag.categoria);
                return (
                  <motion.div
                    key={tag.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    style={{
                      display: 'flex', flexDirection: 'column', padding: '12px',
                      backgroundColor: 'var(--bg-primary)', borderLeft: `4px solid ${tema.border}`,
                      borderRadius: '8px', gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <button
                        onClick={() => setPageNumber(tag.pagina)}
                        className="font-bold text-sm"
                        style={{ background: 'none', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                        title="Ir para a página"
                      >
                        {tag.texto_selecionado}
                      </button>
                      <button onClick={() => db.roteiro_tags.delete(tag.id)} className="btn-icon text-muted" style={{ padding: '4px', border: 'none', background: 'transparent' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-xs" style={{ color: tema.text }}>
                        {tema.rotulo}{' '}
                        <span className="text-muted">
                          · {ehGlobal(tag) ? 'todas as páginas' : `pág ${tag.pagina}`}
                        </span>
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={() => db.roteiro_tags.update(tag.id, { global: !ehGlobal(tag) })}
                          className="btn-icon"
                          style={{
                            backgroundColor: ehGlobal(tag) ? tema.bg : 'var(--bg-surface)',
                            padding: '4px 8px', border: '1px solid var(--border-light)',
                          }}
                          title={ehGlobal(tag)
                            ? 'Marcando em todas as páginas — clique para marcar só nesta'
                            : 'Marcando só nesta página — clique para marcar em todas'}
                        >
                          <Globe size={12} className={ehGlobal(tag) ? '' : 'text-muted'} />
                        </button>
                        <button onClick={() => converterParaTask(tag)} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 8px', gap: '4px', border: '1px solid var(--border-light)' }} title="Virar subtarefa">
                          <Plus size={12} /> <CheckSquare size={12} className="text-accent" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
