import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Projeto } from '../types';
import { Settings, Save } from 'lucide-react';

export function ControleFinanceiro({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);

  const [form, setForm] = useState<Partial<Projeto>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (projeto) {
      setForm(projeto);
    }
  }, [projeto]);

  const salvarConfigs = async () => {
    if (!projetoId) return;
    setSalvando(true);
    await db.projetos.update(projetoId, {
      fonte_orcamento: form.fonte_orcamento,
      produtor_executivo: form.produtor_executivo,
      limite_gasto: form.limite_gasto,
      pix_caixa: form.pix_caixa,
      modo_acerto: form.modo_acerto,
      moeda: form.moeda || 'BRL'
    });
    setSalvando(false);
    alert('Configurações salvas com sucesso!');
  };

  if (!projeto) return <div>Carregando...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Settings size={20} className="text-accent" />
          <h3 className="text-lg font-bold">Controle e Configurações Financeiras</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Fonte do Orçamento</label>
              <input 
                value={form.fonte_orcamento || ''} 
                onChange={e => setForm({ ...form, fonte_orcamento: e.target.value })} 
                placeholder="Ex: Netflix, Edital X, Sócio..." 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Produtor Executivo</label>
              <input 
                value={form.produtor_executivo || ''} 
                onChange={e => setForm({ ...form, produtor_executivo: e.target.value })} 
                placeholder="Nome do produtor"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Orçamento Máximo (R$)</label>
              <input 
                type="number" 
                value={form.limite_gasto ?? ''} 
                onChange={e => setForm({ ...form, limite_gasto: parseFloat(e.target.value) || 0 })} 
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">PIX do Caixa / Produtora</label>
              <input 
                value={form.pix_caixa || ''} 
                onChange={e => setForm({ ...form, pix_caixa: e.target.value })} 
                placeholder="Chave PIX da Produção"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Modo de Acerto</label>
            <p className="text-sm text-muted mb-4">Escolha como as dívidas e repasses serão calculados pelo sistema.</p>
            
            <select 
              value={form.modo_acerto || 'direto'} 
              onChange={e => setForm({ ...form, modo_acerto: e.target.value as any })}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              <option value="direto">Compensado (Líquido) - Cada um paga quem deve direto</option>
              <option value="centralizado">Banco do Projeto - Todos pagam e recebem do Caixa</option>
            </select>

            {form.modo_acerto === 'centralizado' ? (
              <div className="text-xs text-warning">
                <strong>Banco do Projeto:</strong> O sistema criará uma entidade "Caixa Central". Todos que devem pagarão para o Caixa. Todos que precisam receber receberão do Caixa. Ideal para produções maiores.
              </div>
            ) : (
              <div className="text-xs text-success">
                <strong>Compensado (Líquido):</strong> O sistema calculará o mínimo de transferências possíveis cruzando quem deve com quem precisa receber diretamente. Ideal para grupos pequenos.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button onClick={salvarConfigs} disabled={salvando} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={16} /> {salvando ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
