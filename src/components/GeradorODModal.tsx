import { useState, useEffect } from 'react';
import { X, Sparkles, Printer } from 'lucide-react';
import { gerarOrdemDoDia } from '../lib/gemini';
import { db } from '../db/db';
import type { Diaria, Projeto, Perfil, Locacao, Departamento, Cena } from '../types';

interface GeradorODModalProps {
  onClose: () => void;
  projeto: Projeto;
  diaria: Diaria;
  equipe: Perfil[];
  locacoes: Locacao[];
  departamentos: Departamento[];
  cenasGlobais: Cena[];
}

export function GeradorODModal({ onClose, projeto, diaria, equipe, locacoes, departamentos, cenasGlobais }: GeradorODModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [htmlGerado, setHtmlGerado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    db.configuracoes.get('global_config').then(conf => {
      if (conf?.gemini_api_key) {
        setApiKey(conf.gemini_api_key);
      }
    });
  }, []);

  const handleGerar = async () => {
    if (!apiKey) {
      setErro('Por favor, insira a chave da API do Gemini.');
      return;
    }
    
    const conf = await db.configuracoes.get('global_config');
    await db.configuracoes.put({
      id: 'global_config',
      projeto_id: 'global',
      template_cobranca: conf?.template_cobranca || '',
      template_pagamento: conf?.template_pagamento || '',
      template_geral: conf?.template_geral || '',
      gemini_api_key: apiKey
    });

    setCarregando(true);
    setErro('');

    try {
      const resultado = await gerarOrdemDoDia(apiKey, projeto, diaria, equipe, locacoes, departamentos, cenasGlobais);
      setHtmlGerado(resultado);
    } catch (err: any) {
      console.error(err);
      setErro('Erro ao gerar OD: ' + (err.message || err));
    } finally {
      setCarregando(false);
    }
  };

  const handleImprimir = () => {
    const w = window.open('', '_blank');
    if (!w) {
      alert('Permita pop-ups para imprimir.');
      return;
    }
    // Cria uma janela com o HTML para imprimir
    w.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Ordem do Dia - Diária ${diaria.numero}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            /* Se o usuário alterar algo, garante que os inputs fiquem bonitos na impressão */
            textarea, input { border: none; background: transparent; font-family: inherit; font-size: inherit; resize: none; overflow: hidden; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${htmlGerado}
        </body>
      </html>
    `);
    w.document.close();
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
              
              <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                <label className="text-xs font-bold text-muted uppercase tracking-widest block mb-2">Chave API do Gemini</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="AIzaSy..." 
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}
                />
                <div className="text-xs text-muted mt-2">A chave ficará salva no banco de dados (Supabase) para todos os usuários usarem.</div>
              </div>

              {erro && <div className="text-danger font-bold text-sm" style={{ marginBottom: '16px' }}>{erro}</div>}

              <button onClick={handleGerar} disabled={carregando} className="btn-primary" style={{ width: '100%', padding: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
                {carregando ? 'Gerando diagrama (aguarde)...' : <><Sparkles size={18} /> Gerar Ordem do Dia</>}
              </button>
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
