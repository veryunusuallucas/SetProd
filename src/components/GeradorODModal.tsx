import { useEffect, useState } from 'react';
import { X, Printer, AlertTriangle, FileText, Download, Sparkles, FolderOpen, Loader } from 'lucide-react';
import { gerarOrdemDoDia } from '../lib/gemini';
import { AIThinking } from './ui/ia';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import { conferirOD, descreverConferencia, type Conferencia } from '../lib/conferirOD';
import { prepararOD, gerarPdf, arquivarOD, baixar, abrir, type ODPronta } from '../lib/od/exportar';
import type { ClimaPorLocal } from '../lib/clima';
import { agruparClimasIguais } from '../lib/clima';

/**
 * Exportar a Ordem do Dia.
 *
 * ⚠️ O CAMINHO PRINCIPAL NÃO PASSA POR INTELIGÊNCIA ARTIFICIAL NENHUMA.
 *
 * O app monta a OD a partir do que está gravado (`lib/od/montar.ts`) e desenha
 * o PDF ele mesmo (`lib/od/pdf.tsx`). Não existe ninguém entre a estrutura e o
 * papel com chance de mudar uma palavra — e por isso não existe conferência
 * neste caminho: não há o que conferir.
 *
 * A diagramação por IA continua aqui, ao lado, para quem quiser outro visual.
 * Ela recebe a OD pronta, tem ordem de não mexer no conteúdo, e o resultado
 * passa pela barreira da v4.9.0 antes de poder ser impresso. É opcional em
 * todos os sentidos: nada no app depende dela.
 */

type Etapa = 'previa' | 'gerando' | 'pronto';

interface GeradorODModalProps {
  onClose: () => void;
  /**
   * Chamado quando a OD sai de verdade — a exportação, e não a abertura.
   *
   * É ele que publica a diária e sobe a versão. Fica aqui dentro, e não no
   * botão que abre esta janela, porque abrir para olhar não pode congelar o
   * plano de ninguém.
   */
  aoExportar?: () => void | Promise<void>;
  /** Que número esta exportação vai ter. */
  versao?: number;
  diariaId: string;
  numeroDiaria: number;
  /** A previsão que a tela já buscou — para não bater na API de novo. */
  climas?: ClimaPorLocal[];
  /** Onde ir ver o arquivo depois de guardado. */
  aoAbrirDocumentos?: () => void;
}

export function GeradorODModal({
  onClose, aoExportar, versao, diariaId, numeroDiaria, climas, aoAbrirDocumentos,
}: GeradorODModalProps) {
  const [od, setOd] = useState<ODPronta | null>(null);
  const [etapa, setEtapa] = useState<Etapa>('previa');
  const [erro, setErro] = useState('');
  const [arquivo, setArquivo] = useState<{ blob: Blob; nome: string } | null>(null);

  // ---- o caminho opcional da IA ----
  const [htmlIA, setHtmlIA] = useState('');
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [diagramando, setDiagramando] = useState(false);

  useEffect(() => {
    let vivo = true;
    prepararOD(diariaId, { clima: agruparClimasIguais(climas || []), versao })
      .then(r => { if (vivo) { if (r) setOd(r); else setErro('Não consegui ler esta diária.'); } })
      .catch(e => { if (vivo) setErro(String(e?.message || e)); });
    return () => { vivo = false; };
  }, [diariaId, versao, climas]);

  /**
   * Gera o PDF, GUARDA e entrega.
   *
   * A ordem importa: guardar vem antes de entregar. Se o download falhar (ou a
   * pessoa fechar sem salvar), o arquivo continua em Documentos — e é isso que
   * torna desnecessário exportar de novo, que é o que sobe a versão da diária.
   */
  const exportar = async () => {
    if (!od) return;
    setEtapa('gerando');
    setErro('');
    try {
      const blob = await gerarPdf(od.doc);
      await arquivarOD({
        projetoId: od.projetoId,
        diariaId,
        numeroDiaria: od.numeroDiaria,
        versao: od.versao,
        blob,
        nomeArquivo: od.nome,
      });
      setArquivo({ blob, nome: od.nome });
      if (!abrir(blob)) baixar(blob, od.nome);
      await aoExportar?.();
      setEtapa('pronto');
    } catch (e: any) {
      console.error(e);
      setErro('Não consegui gerar o PDF: ' + (e?.message || e));
      setEtapa('previa');
    }
  };

  const diagramar = async () => {
    if (!od) return;
    setDiagramando(true);
    setErro('');
    setConferencia(null);
    try {
      const resultado = await gerarOrdemDoDia({
        tituloProjeto: od.doc.cabecalho.producao,
        subtitulo: `${od.doc.cabecalho.diaria} · ${od.doc.cabecalho.data}`,
        conteudo: od.html,
      });
      setHtmlIA(resultado);
      setConferencia(conferirOD(resultado, od.fatos, od.html));
    } catch (e: any) {
      console.error(e);
      setErro('A IA não respondeu: ' + (e?.message || e));
    } finally {
      setDiagramando(false);
    }
  };

  /** A versão da IA é HTML, então ela sai pela impressora do navegador. */
  const imprimirDaIA = async () => {
    if (!od) return;
    const pagina = montarPaginaRelatorio(
      `Ordem do Dia - Diária ${numeroDiaria}`,
      htmlIA,
      '@page { size: A4 landscape; margin: 12mm } textarea, input { border: none; background: transparent; font: inherit; resize: none }'
    );
    if (!imprimirHtml(pagina)) baixarHtml(pagina, `ordem-do-dia-${numeroDiaria}`);
    await aoExportar?.();
    setEtapa('pronto');
  };

  const problema = conferencia && !conferencia.ok;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '1040px', height: '92vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Ordem do Dia — Diária {String(numeroDiaria).padStart(2, '0')}</h2>
            <div className="text-xs text-muted">
              Montada pelo app com os dados desta diária. {versao && versao > 1 ? `Vai sair como v${versao}.` : 'Confira antes de exportar.'}
            </div>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Fechar"><X size={20} /></button>
        </div>

        {/* ---- A PRÉVIA É O DOCUMENTO, e não uma amostra dele ----
            É o mesmo conteúdo que vai para o PDF, montado pela mesma função.
            A tela antiga mostrava um botão e uma promessa; o que saía na
            impressora só se descobria depois de imprimir. */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-primary)' }}>
          {erro && (
            <div className="text-danger font-bold text-sm" style={{ marginBottom: '14px' }}>{erro}</div>
          )}

          {!od && !erro && (
            <div className="text-muted text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '40px' }}>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Montando a Ordem do Dia...
            </div>
          )}

          {od && (
            <>
              {problema && (
                <div style={{ marginBottom: '14px', padding: '14px', borderRadius: '8px', border: '1px solid var(--color-danger)', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-bold">A diagramação mexeu no conteúdo. Não imprima assim.</div>
                    <div className="text-xs text-secondary" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                      {descreverConferencia(conferencia!)}
                    </div>
                    <button
                      onClick={() => { setHtmlIA(''); setConferencia(null); }}
                      className="btn-icon"
                      style={{ marginTop: '10px', padding: '7px 12px', border: '1px solid var(--border-light)', fontSize: '12px', width: 'auto' }}
                    >
                      Voltar para o documento do app
                    </button>
                  </div>
                </div>
              )}

              {htmlIA && !problema && (
                <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="text-sm font-bold text-success" style={{ marginRight: 'auto' }}>
                    ✓ Conferido: cenas, horários, equipe e locações continuam no papel.
                  </span>
                  <button onClick={() => { setHtmlIA(''); setConferencia(null); }} className="btn-icon" style={{ padding: '7px 12px', border: '1px solid var(--border-light)', fontSize: '12px', width: 'auto' }}>
                    Voltar para o do app
                  </button>
                  <button onClick={imprimirDaIA} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontSize: '13px' }}>
                    <Printer size={14} /> Imprimir esta versão
                  </button>
                </div>
              )}

              <div
                style={{ backgroundColor: '#fff', color: '#111', padding: '28px', borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}
                dangerouslySetInnerHTML={{ __html: htmlIA || od.html }}
              />
            </>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {etapa === 'pronto' && arquivo ? (
            <>
              {/* ⚠️ ESTE É O PEDIDO QUE ORIGINOU A MUDANÇA.
                  Depois de exportado, o arquivo é do app — dá para baixar de
                  novo daqui e de Documentos, sem reexportar. Reexportar sobe a
                  versão da diária, e uma v3 que ninguém pediu faz a equipe
                  receber aviso de mudança que não houve. */}
              <div className="text-sm" style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FolderOpen size={15} style={{ color: 'var(--color-success)' }} />
                <span>Guardado em <b>Documentos → Ordens do Dia</b>. Não precisa exportar de novo para ter outra cópia.</span>
              </div>
              {aoAbrirDocumentos && (
                <button onClick={aoAbrirDocumentos} className="btn-icon" style={{ padding: '9px 14px', border: '1px solid var(--border-light)', fontSize: '13px', width: 'auto' }}>
                  Ver em Documentos
                </button>
              )}
              <button onClick={() => baixar(arquivo.blob, arquivo.nome)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px' }}>
                <Download size={16} /> Baixar de novo
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-muted" style={{ marginRight: 'auto', maxWidth: '440px', lineHeight: 1.5 }}>
                Ao exportar, a OD é publicada{versao && versao > 1 ? ` como v${versao}` : ''}: o plano <b>congela</b> e a
                diária passa a registrar o que acontecer.
              </div>

              {/* A IA fica aqui: pequena, secundária e opcional. Ela não é mais
                  o caminho para o papel sair — é um visual alternativo. */}
              <button
                onClick={diagramar}
                disabled={!od || diagramando}
                className="btn-icon"
                style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 14px', border: '1px solid var(--border-light)', fontSize: '13px', width: 'auto', opacity: !od || diagramando ? 0.6 : 1 }}
              >
                <Sparkles size={14} /> {diagramando ? 'Diagramando...' : 'Diagramar com IA'}
              </button>

              <button
                onClick={exportar}
                disabled={!od || etapa === 'gerando'}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', opacity: !od || etapa === 'gerando' ? 0.6 : 1 }}
              >
                <FileText size={16} /> {etapa === 'gerando' ? 'Gerando o PDF...' : 'Exportar em PDF'}
              </button>
            </>
          )}
        </div>

        {diagramando && (
          <div style={{ padding: '0 20px 14px' }}>
            <AIThinking texto="Diagramando a Ordem do Dia que o app montou..." />
          </div>
        )}
      </div>
    </div>
  );
}
