import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Projeto } from '../types';
import { Settings, Save, Target } from 'lucide-react';
import { CATEGORIAS_DESPESA } from '../core/categoriasDespesa';

/**
 * Só as metas de verdade: campo apagado ou zero sai do objeto.
 *
 * Guardar `{ transporte: 0 }` faria a categoria aparecer no quadro de metas
 * com "0% de R$ 0,00" — e uma meta de zero não é meta, é ausência de meta.
 */
function metasLimpas(metas?: Record<string, number>): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const [id, valor] of Object.entries(metas || {})) {
    if (Number.isFinite(valor) && valor > 0) saida[id] = valor;
  }
  return saida;
}

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
      moeda: form.moeda || 'BRL',
      metas_categoria: metasLimpas(form.metas_categoria),
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

          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
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

          {/*
            METAS POR CATEGORIA (sugestão do botão de relatar, 16/09/2026).
            "Para alimentação precisamos de X, até agora temos Y." Orçamento de
            departamento não responde isso: alimentação é de todo mundo. Esta
            aba só abre para quem administra, e o quadro que acompanha as metas
            na Visão geral também — decisão do Lucas, 27/09/2026.
          */}
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} /> Metas por categoria
            </label>
            <p className="text-sm text-muted mb-4">
              Quanto a produção pretende gastar em cada tipo de despesa. Deixe em branco o que não tem meta. Só quem administra vê.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(210px, 100%), 1fr))', gap: '10px' }}>
              {CATEGORIAS_DESPESA.map(c => (
                <label key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="text-xs text-secondary">{c.emoji} {c.label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="R$ —"
                    value={form.metas_categoria?.[c.id] ?? ''}
                    onChange={e => {
                      const n = parseFloat(e.target.value);
                      const metas = { ...(form.metas_categoria || {}) };
                      if (Number.isFinite(n)) metas[c.id] = n; else delete metas[c.id];
                      setForm({ ...form, metas_categoria: metas });
                    }}
                    style={{ width: '100%' }}
                  />
                </label>
              ))}
            </div>
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
