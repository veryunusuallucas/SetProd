import { useState } from 'react';
import { db } from '../db/db';

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<'bug' | 'sugestao' | 'duvida'>('bug');
  const [descricao, setDescricao] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const submitFeedback = async () => {
    if (!descricao.trim()) {
      setErro('Por favor, descreva o problema.');
      return;
    }
    setErro('');

    try {
      const projetos = await db.projetos.toArray();
      const perfis = await db.perfis.toArray();
      const despesas = await db.despesas.toArray();
      const acertos = await db.acertos.toArray();

      const dump = {
        tipo,
        descricao,
        data: new Date().toISOString(),
        stats: {
          projetos: projetos.length,
          perfis: perfis.length,
          despesas: despesas.length,
          acertos: acertos.length
        }
      };

      console.log('Feedback gerado:', dump);
      
      setEnviado(true);
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (e: any) {
      setErro('Erro ao processar: ' + e.message);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-primary)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🐛 Relatar Problema
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📍 Página detectada:</span>
            <strong style={{ color: 'var(--accent)' }}>{window.location.pathname}</strong>
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Tipo</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setTipo('bug')} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: tipo === 'bug' ? '1px solid var(--accent)' : '1px solid var(--border-color)', backgroundColor: tipo === 'bug' ? 'rgba(255, 215, 0, 0.1)' : 'transparent', color: tipo === 'bug' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <span>🐛</span>
                <span>Bug</span>
              </button>
              <button 
                onClick={() => setTipo('sugestao')} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: tipo === 'sugestao' ? '1px solid var(--accent)' : '1px solid var(--border-color)', backgroundColor: tipo === 'sugestao' ? 'rgba(255, 215, 0, 0.1)' : 'transparent', color: tipo === 'sugestao' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <span>💡</span>
                <span>Sugestão</span>
              </button>
              <button 
                onClick={() => setTipo('duvida')} 
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: tipo === 'duvida' ? '1px solid var(--accent)' : '1px solid var(--border-color)', backgroundColor: tipo === 'duvida' ? 'rgba(255, 215, 0, 0.1)' : 'transparent', color: tipo === 'duvida' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: 600, fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <span>❓</span>
                <span>Dúvida</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Descrição</label>
            <textarea 
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4} 
              placeholder="Descreva o problema ou sugestão..."
              style={{ width: '100%', padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', resize: 'vertical' }}
            ></textarea>
          </div>

          {erro && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{erro}</div>}
          {enviado && <div style={{ color: 'var(--color-success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>✅</span> Feedback registrado no log! Obrigado.</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={submitFeedback} className="btn-primary" style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <span>📤</span> Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
