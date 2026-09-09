import { useState } from 'react';
import { X, Sparkles, Printer, AlertTriangle, FileText } from 'lucide-react';
import { gerarOrdemDoDia } from '../lib/gemini';
import { AIButton } from './ui/AIButton';
import { AIThinking } from './ui/ia';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import { conferirOD, descreverConferencia, type FatoDaOD, type Conferencia } from '../lib/conferirOD';
import { dataCurta } from '../lib/formato';
import type { Diaria, Projeto, Perfil, Locacao, Cena } from '../types';

interface GeradorODModalProps {
  onClose: () => void;
  /**
   * Chamado quando a OD sai de verdade — a impressão, e não a abertura.
   *
   * É ele que publica a diária e sobe a versão. Fica aqui dentro, e não no
   * botão que abre esta janela, porque abrir para olhar não pode congelar o
   * plano de ninguém.
   */
  aoExportar?: () => void | Promise<void>;
  /** Que número esta exportação vai ter. Só para dizer isso na tela. */
  versao?: number;
  projeto: Projeto;
  diaria: Diaria;
  equipe: Perfil[];
  locacoes: Locacao[];
  cenasGlobais: Cena[];
  /**
   * A Ordem do Dia montada pelo app, com os dados reais da diária.
   *
   * ⚠️ ELA É A FONTE. A IA só rediagrama o que sai daqui — antes, a exportação
   * pedia à IA que INVENTASSE a OD, e o papel saiu para a equipe com cenas e
   * horários que não existem.
   */
  montarHtmlOD: (completo?: boolean, versaoForcada?: number) => string;
}

export function GeradorODModal({
  onClose, aoExportar, versao, projeto, diaria, equipe, locacoes, cenasGlobais, montarHtmlOD,
}: GeradorODModalProps) {
  const [htmlGerado, setHtmlGerado] = useState('');
  const [conferencia, setConferencia] = useState<Conferencia | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  /** A OD verdadeira, montada pelo app. É o que a IA recebe e o que se confere. */
  const odDoApp = () => montarHtmlOD(false, versao);

  /**
   * O que o documento gerado TEM que continuar dizendo.
   *
   * Sai dos dados da diária, e não do texto: comparar texto com texto acharia
   * qualquer coisa. Estes são os fatos que, se sumirem, mandam alguém para o
   * lugar errado — a hora da chamada, quem está escalado, onde é, e que cena
   * se grava.
   */
  const fatos = (): FatoDaOD[] => {
    const lista: FatoDaOD[] = [];

    if (diaria.chamada) lista.push({ tipo: 'horário da chamada', valor: diaria.chamada });

    for (const id of diaria.cena_ids || []) {
      const c = cenasGlobais.find(x => x.id === id);
      if (c) lista.push({ tipo: 'cena', valor: `Cena ${c.numero}` });
    }

    for (const id of diaria.equipe_escalada || []) {
      const p = equipe.find(x => x.id === id);
      if (p) lista.push({ tipo: 'quem está escalado', valor: `${p.nome} ${p.sobrenome || ''}`.trim() });
    }

    for (const id of diaria.locacoes_ids || []) {
      const l = locacoes.find(x => x.id === id);
      if (l) lista.push({ tipo: 'locação', valor: l.nome });
    }

    return lista;
  };

  const handleGerar = async () => {
    setCarregando(true);
    setErro('');
    setConferencia(null);

    try {
      const original = odDoApp();
      const resultado = await gerarOrdemDoDia({
        tituloProjeto: projeto.nome,
        subtitulo: `Diária ${String(diaria.numero).padStart(2, '0')} · ${dataCurta(diaria.data)}${versao && versao > 1 ? ` · v${versao}` : ''}`,
        conteudo: original,
      });

      setHtmlGerado(resultado);
      setConferencia(conferirOD(resultado, fatos(), original));
    } catch (err: any) {
      console.error(err);
      setErro('Erro ao gerar OD: ' + (err.message || err));
    } finally {
      setCarregando(false);
    }
  };

  const imprimir = async (html: string) => {
    const pagina = montarPaginaRelatorio(
      `Ordem do Dia - Diária ${diaria.numero}`,
      html,
      // Se a pessoa editou algo no preview, os campos precisam sair limpos no papel.
      'textarea, input { border: none; background: transparent; font-family: inherit; font-size: inherit; resize: none; overflow: hidden; }'
    );
    if (!imprimirHtml(pagina)) baixarHtml(pagina, `ordem-do-dia-${diaria.numero}${versao ? `-v${versao}` : ''}`);
    await aoExportar?.();
  };

  const problema = conferencia && !conferencia.ok;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', height: '90vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Exportar a Ordem do Dia</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {!htmlGerado ? (
            <div style={{ maxWidth: '420px', margin: '40px auto', textAlign: 'center' }}>
              {/*
                O texto mudou porque a promessa mudou.

                Ele dizia que a IA "vai pegar todos os dados da diária e
                diagramar" — e o código não fazia isso: mandava a IA criar a OD
                do zero. Dizer o que o app faz é parte de o app fazer.
              */}
              <p className="text-secondary" style={{ marginBottom: '24px', lineHeight: 1.6 }}>
                O app monta a Ordem do Dia da <b>Diária {String(diaria.numero).padStart(2, '0')}</b> com
                as cenas, horários, equipe e locações que estão nela. A IA só
                <b> diagrama</b> — ela não escreve o conteúdo, e o resultado é conferido antes de você imprimir.
              </p>

              {/* O aviso não é formalidade: imprimir daqui MUDA O ESTADO da
                  diária. Quem clica achando que só vai tirar um papel precisa
                  saber que, a partir dali, o plano congela e a tela vira
                  registro. */}
              <p className="text-xs text-muted" style={{ marginBottom: '24px', lineHeight: 1.6 }}>
                Ao imprimir, a OD é publicada{versao && versao > 1 ? ` como v${versao}` : ''}: o plano <b>congela</b> e a
                diária passa a registrar o que acontecer. Para mudar o plano depois, volte a
                rascunho e exporte de novo — a versão nova sai numerada.
              </p>

              {erro && <div className="text-danger font-bold text-sm" style={{ marginBottom: '16px' }}>{erro}</div>}

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <AIButton onClick={handleGerar} loading={carregando} loadingText="Diagramando a OD...">
                  Gerar Ordem do Dia
                </AIButton>
              </div>

              {/* Sem IA configurada, sem internet, ou simplesmente porque a
                  pessoa prefere: o documento do app imprime sozinho e é o
                  mesmo conteúdo. Nenhum caminho aqui pode terminar em beco. */}
              <button
                onClick={() => imprimir(odDoApp())}
                className="btn-icon"
                style={{ margin: '18px auto 0', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 16px', border: '1px solid var(--border-light)', fontSize: '13px', width: 'auto' }}
              >
                <FileText size={15} /> Imprimir sem passar pela IA
              </button>

              {carregando && (
                <div style={{ marginTop: '24px', textAlign: 'left' }}>
                  <AIThinking texto="Diagramando a Ordem do Dia que o app montou..." />
                </div>
              )}
            </div>
          ) : (
            <div>
              {/*
                ⚠️ A CONFERÊNCIA APARECE ANTES DO BOTÃO DE IMPRIMIR.

                Foi assim que a falha passou: um "✓ gerada com sucesso" verde em
                cima de um documento inventado. Sucesso, aqui, é o conteúdo ter
                sobrevivido à diagramação — e quando não sobrevive, o caminho
                fácil tem que ser o documento do app, não o da IA.
              */}
              {problema ? (
                <div
                  style={{
                    marginBottom: '16px', padding: '14px', borderRadius: '8px',
                    border: '1px solid var(--color-danger)',
                    backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                  }}
                >
                  <AlertTriangle size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="text-sm font-bold">A diagramação mexeu no conteúdo. Não imprima assim.</div>
                    <div className="text-xs text-secondary" style={{ marginTop: '4px', lineHeight: 1.5 }}>
                      {descreverConferencia(conferencia!)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                      <button onClick={() => imprimir(odDoApp())} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontSize: '13px' }}>
                        <FileText size={14} /> Imprimir o documento do app
                      </button>
                      <button onClick={handleGerar} className="btn-icon" style={{ padding: '8px 14px', border: '1px solid var(--border-light)', fontSize: '13px', width: 'auto' }}>
                        Tentar diagramar de novo
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', gap: '12px', flexWrap: 'wrap' }}>
                  <span className="text-sm font-bold text-success">
                    ✓ Conferido: cenas, horários, equipe e locações batem com a diária.
                  </span>
                  <button onClick={() => imprimir(htmlGerado)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                    <Printer size={16} /> Imprimir / Salvar PDF
                  </button>
                </div>
              )}

              <p className="text-xs text-muted mb-4">
                Você pode revisar o texto abaixo e clicar nele para corrigir antes de imprimir.
              </p>

              {/* Renderiza o HTML retornado pela IA e permite edição com contentEditable para ajustes finais */}
              <div
                contentEditable
                suppressContentEditableWarning
                style={{ backgroundColor: '#fff', color: '#000', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minHeight: '500px' }}
                dangerouslySetInnerHTML={{ __html: htmlGerado }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
