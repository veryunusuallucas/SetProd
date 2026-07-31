import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Save, Trash2, Download, Archive, Bug } from 'lucide-react';
import { CreepyButton } from './ui/CreepyButton';
import { BugReportModal } from './BugReportModal';

export function Configuracoes({ projetoId }: { projetoId: string }) {
  const navigate = useNavigate();
  const configuracao = useLiveQuery(() => db.configuracoes.get(projetoId), [projetoId]);
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const qtdDespesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).count(), [projetoId]) || 0;

  const trocarModoAcerto = async (novo: 'centralizado' | 'direto') => {
    if (!projeto || projeto.modo_acerto === novo) return;
    if (qtdDespesas > 0) {
      const ok = confirm(`Já existem ${qtdDespesas} despesa(s) lançadas. Trocar o modo de acerto vai RECALCULAR todos os saldos e pendências. Deseja continuar?`);
      if (!ok) return;
    }
    await db.projetos.update(projetoId, { modo_acerto: novo });
  };
  
  const [templateCobranca, setTemplateCobranca] = useState('');
  const [templatePagamento, setTemplatePagamento] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [confirmNome, setConfirmNome] = useState('');
  const [showBug, setShowBug] = useState(false);
  const [novoCampoNome, setNovoCampoNome] = useState('');
  const [novoCampoTipo, setNovoCampoTipo] = useState<'texto' | 'numero' | 'data' | 'valor'>('texto');

  useEffect(() => {
    if (configuracao) {
      setTemplateCobranca(configuracao.template_cobranca || '');
      setTemplatePagamento(configuracao.template_pagamento || '');
    } else {
      setTemplateCobranca('Olá {{nome}}! No projeto {{projeto}}, seu saldo ficou em R$ {{valor}} a pagar para a Produção.\nChave PIX para pagamento: {{pix}}');
      setTemplatePagamento('Olá {{nome}}! A Produção vai te repassar R$ {{valor}} referente ao projeto {{projeto}}.');
    }
  }, [configuracao]);

  const salvar = async () => {
    await db.configuracoes.put({
      id: projetoId,
      projeto_id: projetoId,
      template_cobranca: templateCobranca,
      template_pagamento: templatePagamento,
      template_geral: configuracao?.template_geral || ''
    });
    alert('Configurações salvas!');
  };

  const deletarProjeto = async () => {
    await db.projetos.delete(projetoId);
    await db.perfis.where('projeto_id').equals(projetoId).delete();
    await db.despesas.where('projeto_id').equals(projetoId).delete();
    await db.acertos.where('projeto_id').equals(projetoId).delete();
    await db.departamentos.where('projeto_id').equals(projetoId).delete();
    await db.configuracoes.delete(projetoId);
    navigate('/');
  };

  const nomeProjeto = projeto?.nome || '';
  const nomeConfere = confirmNome.trim() === nomeProjeto.trim() && nomeProjeto !== '';

  const camposCustom = projeto?.campos_customizados || [];

  const adicionarCampo = async () => {
    if (!projeto || !novoCampoNome.trim()) return;
    const novo = { id: crypto.randomUUID(), nome: novoCampoNome.trim(), tipo: novoCampoTipo };
    await db.projetos.put({ ...projeto, campos_customizados: [...camposCustom, novo] });
    setNovoCampoNome('');
    setNovoCampoTipo('texto');
  };

  const removerCampo = async (id: string) => {
    if (!projeto) return;
    await db.projetos.put({ ...projeto, campos_customizados: camposCustom.filter(c => c.id !== id) });
  };

  const exportarDados = async () => {
    try {
      const proj = await db.projetos.get(projetoId);
      const perfis = await db.perfis.where('projeto_id').equals(projetoId).toArray();
      const despesas = await db.despesas.where('projeto_id').equals(projetoId).toArray();
      const acertos = await db.acertos.where('projeto_id').equals(projetoId).toArray();
      const config = await db.configuracoes.get(projetoId);

      const data = { proj, perfis, despesas, acertos, config };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_projeto_${projetoId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Erro ao exportar: ' + e);
    }
  };

  const arquivarDespesas = async () => {
    if (confirm('Deseja arquivar (zerar) o financeiro? O projeto e a equipe serão mantidos, mas as despesas e acertos serão apagados. É recomendado exportar os dados antes!')) {
      await db.despesas.where('projeto_id').equals(projetoId).delete();
      await db.acertos.where('projeto_id').equals(projetoId).delete();
      alert('Financeiro zerado com sucesso!');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '16px' }}>Templates de Mensagem</h3>
        <p className="text-xs text-muted" style={{ marginBottom: '8px' }}>
          Variáveis: <code style={{ color: 'var(--accent)' }}>{'{{nome}}'}</code>, <code style={{ color: 'var(--accent)' }}>{'{{valor}}'}</code>, <code style={{ color: 'var(--accent)' }}>{'{{projeto}}'}</code>, <code style={{ color: 'var(--accent)' }}>{'{{funcao}}'}</code>, <code style={{ color: 'var(--accent)' }}>{'{{pix}}'}</code> (PIX do caixa)
        </p>
        <p className="text-xs text-muted" style={{ marginBottom: '24px', fontStyle: 'italic' }}>
          Estes textos são a base. Ao gerar a mensagem de um membro você pode ajustar o texto na hora, sem alterar o template salvo aqui.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Mensagem de Cobrança (A Pagar)</label>
            <textarea 
              value={templateCobranca} 
              onChange={e => setTemplateCobranca(e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Mensagem de Repasse (A Receber)</label>
            <textarea 
              value={templatePagamento} 
              onChange={e => setTemplatePagamento(e.target.value)}
              rows={3}
            />
          </div>

          <button onClick={salvar} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
            <Save size={16} /> Salvar Configurações
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '16px' }}>Gestão de Dados</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '24px' }}>
          Você pode exportar os dados do projeto para um arquivo JSON ou arquivar (zerar) as despesas atuais.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button onClick={exportarDados} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            <Download size={16} /> Exportar Relatório (JSON)
          </button>
          
          <button onClick={arquivarDespesas} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--color-warning)', border: 'none', color: '#000' }}>
            <Archive size={16} /> Arquivar Despesas e Acertos
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '8px' }}>Modo de Acerto</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '16px' }}>
          Como o app calcula os pagamentos entre a equipe.
          {qtdDespesas > 0 && <span className="text-warning"> Trocar agora recalcula os {qtdDespesas} lançamento(s) existentes.</span>}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="checkbox-label" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: projeto?.modo_acerto === 'centralizado' ? 'var(--bg-active)' : 'transparent' }}>
            <input type="checkbox" checked={projeto?.modo_acerto === 'centralizado'} onChange={() => trocarModoAcerto('centralizado')} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="font-bold">Banco do Projeto (centralizado)</span>
              <span className="text-xs text-muted">Todos pagam/recebem do caixa central; o banco redistribui.</span>
            </div>
          </label>
          <label className="checkbox-label" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: projeto?.modo_acerto === 'direto' ? 'var(--bg-active)' : 'transparent' }}>
            <input type="checkbox" checked={projeto?.modo_acerto === 'direto'} onChange={() => trocarModoAcerto('direto')} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="font-bold">Compensado (direto entre membros)</span>
              <span className="text-xs text-muted">O app compensa o que a pessoa deve com o que tem a receber; menos transações.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '8px' }}>Modo de Diária</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '16px' }}>
          Como novas despesas escolhem a diária.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label className="checkbox-label" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: (projeto?.modo_diaria || 'automatico') === 'automatico' ? 'var(--bg-active)' : 'transparent' }}>
            <input type="checkbox" checked={(projeto?.modo_diaria || 'automatico') === 'automatico'} onChange={() => projeto && db.projetos.put({ ...projeto, modo_diaria: 'automatico' })} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="font-bold">Automático</span>
              <span className="text-xs text-muted">Novas despesas já vêm na diária atual da produção.</span>
            </div>
          </label>
          <label className="checkbox-label" style={{ padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: projeto?.modo_diaria === 'manual' ? 'var(--bg-active)' : 'transparent' }}>
            <input type="checkbox" checked={projeto?.modo_diaria === 'manual'} onChange={() => projeto && db.projetos.put({ ...projeto, modo_diaria: 'manual' })} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="font-bold">Manual / Antecipado</span>
              <span className="text-xs text-muted">Você escolhe livremente a diária de cada gasto (prepara diárias futuras).</span>
            </div>
          </label>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '8px' }}>Campos Personalizados da Ficha</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '16px' }}>
          Crie campos extras que aparecerão no cadastro de cada membro (além dos padrão).
        </p>

        {camposCustom.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {camposCustom.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <span className="text-sm">{c.nome} <span className="text-xs text-muted">· {c.tipo}</span></span>
                <button onClick={() => removerCampo(c.id)} className="btn-icon text-danger" style={{ width: '30px', height: '30px' }} title="Remover"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <input placeholder="Nome do campo (ex: Tamanho de camiseta)" value={novoCampoNome} onChange={e => setNovoCampoNome(e.target.value)} style={{ flex: 1 }} />
          <select value={novoCampoTipo} onChange={e => setNovoCampoTipo(e.target.value as any)} style={{ width: 'auto' }}>
            <option value="texto">Texto</option>
            <option value="numero">Número</option>
            <option value="data">Data</option>
            <option value="valor">Valor (R$)</option>
          </select>
          <button onClick={adicionarCampo} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Adicionar</button>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '16px' }}>Suporte</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '24px' }}>
          Encontrou um erro ou tem uma sugestão? Nos conte.
        </p>
        <button onClick={() => setShowBug(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          <Bug size={16} className="text-danger" /> Relatar Problema
        </button>
      </div>

      <div className="card" style={{ borderColor: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
        <h3 className="text-lg font-bold text-danger" style={{ marginBottom: '16px' }}>Zona de Perigo</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '24px' }}>
          Esta ação é irreversível. Todos os dados desta produção, incluindo despesas, acertos e perfis serão apagados.
        </p>
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <CreepyButton onClick={() => { setConfirmNome(''); setShowDelete(true); }}>
            Deletar Produção
          </CreepyButton>
        </div>
      </div>

      {/* MODAL DUPLA ETAPA */}
      {showDelete && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', borderColor: 'var(--color-danger)', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={26} className="text-danger" />
              </div>
            </div>
            <h3 className="text-lg font-bold" style={{ textAlign: 'center', marginBottom: '8px' }}>Deletar esta produção?</h3>
            <p className="text-sm text-secondary" style={{ textAlign: 'center', marginBottom: '20px' }}>
              Ação irreversível. Para confirmar, digite o nome do projeto:
              <br /><strong className="text-primary">{nomeProjeto}</strong>
            </p>
            <input
              value={confirmNome}
              onChange={e => setConfirmNome(e.target.value)}
              placeholder="Digite o nome do projeto"
              style={{ marginBottom: '20px' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowDelete(false)} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button
                onClick={deletarProjeto}
                disabled={!nomeConfere}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: nomeConfere ? 'var(--color-danger)' : 'var(--bg-surface)', border: 'none', color: nomeConfere ? '#fff' : 'var(--text-muted)', opacity: nomeConfere ? 1 : 0.6, cursor: nomeConfere ? 'pointer' : 'not-allowed' }}
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {showBug && <BugReportModal onClose={() => setShowBug(false)} />}
    </div>
  );
}
