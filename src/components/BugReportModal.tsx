import { useState } from 'react';
import { db } from '../db/db';
import { supabase } from '../lib/supabase';
import { obterEventos, coletarAmbiente } from '../lib/diagnostico';

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const [tipo, setTipo] = useState<'bug' | 'sugestao' | 'duvida'>('bug');
  const [descricao, setDescricao] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const eventos = obterEventos();
  const qtdErros = eventos.filter(e => e.nivel !== 'warn').length;

  /** Monta o pacote que vai para o Supabase (e que dá para copiar à mão). */
  const montarPacote = async () => {
    const projetoId = window.location.pathname.match(/\/projeto\/([a-zA-Z0-9-]+)/)?.[1];

    const [projetos, perfis, despesas, acertos, diarias, tasks] = await Promise.all([
      db.projetos.count(), db.perfis.count(), db.despesas.count(),
      db.acertos.count(), db.diarias.count(), db.tasks.count(),
    ]);

    const ambiente = coletarAmbiente();

    return {
      tipo,
      descricao: descricao.trim(),
      url_atual: ambiente.url_completa,
      resolucao: ambiente.tela,
      user_agent: navigator.userAgent,
      erros_console: eventos,
      // A tabela não tem colunas para tudo isso, então vai dentro de `stats` (jsonb).
      stats: {
        ambiente,
        projeto_id: projetoId || null,
        papel: localStorage.getItem('mock_papel') || null,
        perfil_id: localStorage.getItem('mock_perfil_id') || null,
        versao_app: `v${__VERSAO_APP__}`,
        banco: { projetos, perfis, despesas, acertos, diarias, tasks },
        resumo_log: {
          total: eventos.length,
          erros: eventos.filter(e => e.nivel === 'error').length,
          avisos: eventos.filter(e => e.nivel === 'warn').length,
          nao_tratados: eventos.filter(e => e.nivel === 'uncaught').length,
          promessas: eventos.filter(e => e.nivel === 'promise').length,
        },
      },
    };
  };

  const submitFeedback = async () => {
    if (!descricao.trim()) {
      setErro('Por favor, descreva o problema.');
      return;
    }
    setErro('');
    setEnviando(true);

    try {
      const pacote = await montarPacote();
      const { error: supaError } = await supabase.from('bug_reports').insert([pacote]);

      if (supaError) {
        // Antes isso virava um console.warn e a tela dizia "registrado, obrigado!"
        // mesmo sem ter salvo nada. Agora o erro aparece e sobra a opção de copiar.
        setErro(
          `Não foi possível enviar: ${supaError.message}. ` +
          'Use "Copiar dados" abaixo e mande o texto direto para o Lucas.'
        );
        return;
      }

      setEnviado(true);
      setTimeout(onClose, 2000);
    } catch (e: any) {
      setErro('Erro ao processar: ' + (e?.message || e));
    } finally {
      setEnviando(false);
    }
  };

  /** Plano B: leva tudo para a área de transferência, com ou sem Supabase. */
  const copiarDados = async () => {
    const pacote = await montarPacote();
    await navigator.clipboard.writeText(JSON.stringify(pacote, null, 2));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
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

          {/* Mostra o que será enviado junto — sem isso, ninguém sabe se o log foi capturado */}
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', padding: '10px 14px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
              <span>🧾 Vai junto:</span>
              <strong style={{ color: qtdErros > 0 ? 'var(--color-warning)' : 'var(--text-secondary)' }}>
                {eventos.length === 0
                  ? 'nenhum erro no log'
                  : `${eventos.length} evento(s), ${qtdErros} erro(s)`}
              </strong>
              <span>· tela · navegador · papel · contagens</span>
            </div>

            {eventos.length > 0 && (
              <details style={{ marginTop: '8px' }}>
                <summary style={{ cursor: 'pointer', color: 'var(--accent)', fontSize: '11px' }}>
                  ver os últimos erros
                </summary>
                <div style={{ maxHeight: '120px', overflowY: 'auto', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {eventos.slice(-6).reverse().map((ev, i) => (
                    <div key={i} style={{ fontSize: '10px', fontFamily: 'monospace', color: ev.nivel === 'warn' ? 'var(--text-muted)' : 'var(--color-danger)', wordBreak: 'break-word' }}>
                      [{ev.nivel}] {ev.mensagem.slice(0, 160)}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {erro && <div style={{ color: 'var(--color-danger)', fontSize: '13px' }}>{erro}</div>}
          {enviado && <div style={{ color: 'var(--color-success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><span>✅</span> Enviei! Vai trabalhar, seu bosta!</div>}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={copiarDados} style={{ flex: 1, padding: '12px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
              {copiado ? '✅ Copiado' : '📋 Copiar dados'}
            </button>
            <button onClick={submitFeedback} disabled={enviando} className="btn-primary" style={{ flex: 2, padding: '12px', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: enviando ? 'wait' : 'pointer', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <span>📤</span> {enviando ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
