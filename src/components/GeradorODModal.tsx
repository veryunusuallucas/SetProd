import { useState } from 'react';
import { X, Sparkles, Printer } from 'lucide-react';
import { gerarOrdemDoDia } from '../lib/gemini';
import { AIButton } from './ui/AIButton';
import { AIThinking } from './ui/ia';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import type { Diaria, Projeto, Perfil, Locacao, Departamento, Cena } from '../types';

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
  departamentos: Departamento[];
  cenasGlobais: Cena[];
}

export function GeradorODModal({ onClose, aoExportar, versao, projeto, diaria, equipe, locacoes, departamentos, cenasGlobais }: GeradorODModalProps) {
  const [htmlGerado, setHtmlGerado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const handleGerar = async () => {
    setCarregando(true);
    setErro('');

    try {
      const resultado = await gerarOrdemDoDia(projeto, diaria, equipe, locacoes, departamentos, cenasGlobais);
      setHtmlGerado(resultado);
    } catch (err: any) {
      console.error(err);
      setErro('Erro ao gerar OD: ' + (err.message || err));
    } finally {
      setCarregando(false);
    }
  };

  const handleImprimir = async () => {
    const html = montarPaginaRelatorio(
      `Ordem do Dia - Diária ${diaria.numero}`,
      htmlGerado,
      // Se a pessoa editou algo no preview, os campos precisam sair limpos no papel.
      'textarea, input { border: none; background: transparent; font-family: inherit; font-size: inherit; resize: none; overflow: hidden; }'
    );
    if (!imprimirHtml(html)) baixarHtml(html, `ordem-do-dia-${diaria.numero}${versao ? `-v${versao}` : ''}`);
    await aoExportar?.();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', height: '90vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Gerador de OD com IA</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {!htmlGerado ? (
            <div style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
              <p className="text-secondary" style={{ marginBottom: '24px' }}>
                A Inteligência Artificial vai pegar todos os dados da <b>Diária {diaria.numero}</b> (Cenas, Equipe, Locações, Clima) e diagramar em um formato profissional para impressão.
              </p>

              {/* O aviso não é formalidade: imprimir daqui MUDA O ESTADO da
                  diária. Quem clica achando que só vai tirar um papel precisa
                  saber que, a partir dali, o plano congela e a tela vira
                  registro — descobrir isso depois, com o cronograma que não
                  deixa mais editar, é a pior forma de aprender. */}
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

              {/* A OD é a chamada de IA mais demorada do app: sem sinal de vida
                  aqui, a pessoa acha que travou e clica de novo. */}
              {carregando && (
                <div style={{ marginTop: '24px', textAlign: 'left' }}>
                  <AIThinking texto="Lendo cenas, equipe, locações e clima da diária..." />
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px' }}>
                <span className="text-sm font-bold text-success">✓ Ordem do Dia gerada com sucesso!</span>
                <button onClick={handleImprimir} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}>
                  <Printer size={16} /> Imprimir / Salvar PDF
                </button>
              </div>
              <p className="text-xs text-muted mb-4">Você pode revisar o texto abaixo. Se precisar, clique diretamente no texto (como a Sinopse ou Observações) para editar antes de imprimir.</p>
              
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
