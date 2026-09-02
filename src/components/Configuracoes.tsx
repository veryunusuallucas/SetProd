import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Save, Trash2, Bug, Info, X, ShieldCheck } from 'lucide-react';
import { CreepyButton } from './ui/CreepyButton';
import { BugReportModal } from './BugReportModal';
import type { Projeto } from '../types';
import { CampoData } from './ui/CampoData';

export function Configuracoes({ projetoId }: { projetoId: string }) {
  const navigate = useNavigate();
  const configuracao = useLiveQuery(() => db.configuracoes.get(projetoId), [projetoId]);
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);

  const [templateCobranca, setTemplateCobranca] = useState('');
  const [templatePagamento, setTemplatePagamento] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [confirmNome, setConfirmNome] = useState('');
  const [showBug, setShowBug] = useState(false);
  const [showSobre, setShowSobre] = useState(false);

  // Edição dos dados do projeto (movidos da aba Créditos)
  const [editandoProjeto, setEditandoProjeto] = useState(false);
  const [form, setForm] = useState<Projeto | null>(null);

  useEffect(() => {
    if (projeto && !editandoProjeto) setForm(projeto);
  }, [projeto, editandoProjeto]);

  const salvarProjeto = async () => {
    if (!form) return;
    await db.projetos.put(form);
    setEditandoProjeto(false);
  };

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

      {/* Dados da produção — veio da aba Créditos, onde não fazia mais sentido */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 className="text-lg font-bold">Dados da Produção</h3>
            <p className="text-xs text-secondary">Nome, produtora, local e período do projeto.</p>
          </div>
          <button
            onClick={() => editandoProjeto ? salvarProjeto() : setEditandoProjeto(true)}
            className="text-xs font-bold"
            style={{ backgroundColor: editandoProjeto ? 'var(--accent)' : 'var(--bg-surface)', color: editandoProjeto ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '6px 14px' }}
          >
            {editandoProjeto ? 'Salvar' : 'Editar'}
          </button>
        </div>

        {editandoProjeto && form ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CampoProjeto label="Nome do Projeto">
              <input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </CampoProjeto>
            <CampoProjeto label="Produtora">
              <input value={form.produtora || ''} onChange={e => setForm({ ...form, produtora: e.target.value })} />
            </CampoProjeto>
            <CampoProjeto label="Cidade / Local">
              <input value={form.local || ''} onChange={e => setForm({ ...form, local: e.target.value })} />
            </CampoProjeto>
            <div style={{ display: 'flex', gap: '12px' }}>
              <CampoProjeto label="Início">
                <CampoData value={form.data_inicio || ''} onChange={d => setForm({ ...form, data_inicio: d })} />
              </CampoProjeto>
              <CampoProjeto label="Fim">
                <CampoData value={form.data_fim || ''} onChange={d => setForm({ ...form, data_fim: d })} />
              </CampoProjeto>
            </div>
            <CampoProjeto label="Observações">
              <textarea rows={3} value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} />
            </CampoProjeto>
            <p className="text-xs text-muted">
              Diretor, produtor e o resto da equipe agora vivem na ficha de créditos, em Produção → Créditos.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <LinhaProjeto label="Nome" valor={projeto?.nome} />
            <LinhaProjeto label="Produtora" valor={projeto?.produtora} />
            <LinhaProjeto label="Local" valor={projeto?.local} />
            <LinhaProjeto
              label="Período"
              valor={projeto?.data_inicio || projeto?.data_fim ? `${fmtData(projeto?.data_inicio)} — ${fmtData(projeto?.data_fim)}` : undefined}
            />
            {projeto?.obs && (
              <>
                <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }} />
                <div className="text-muted text-xs uppercase tracking-widest">Observações</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{projeto.obs}</div>
              </>
            )}
          </div>
        )}
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
        <h3 className="text-lg font-bold" style={{ marginBottom: '16px' }}>Suporte</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '24px' }}>
          Encontrou um erro ou tem uma sugestão? Nos conte.
        </p>
        <button onClick={() => setShowBug(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
          <Bug size={16} className="text-danger" /> Relatar Problema
        </button>
      </div>

      <div className="card">
        <h3 className="text-lg font-bold" style={{ marginBottom: '16px' }}>Sobre</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '24px' }}>
          Quem fez este aplicativo, com que ajuda e por quanto tempo ele será gratuito.
        </p>
        <button
          onClick={() => setShowSobre(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          <Info size={16} className="text-accent" /> Sobre o SetProd
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

      {/* MODAL SOBRE */}
      {showSobre && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '85vh', overflowY: 'auto', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Info size={20} className="text-accent" />
                <h3 className="text-lg font-bold">Sobre o SetProd</h3>
              </div>
              <button onClick={() => setShowSobre(false)} className="btn-icon"><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '14px', lineHeight: 1.7 }}>
              <p>
                Este aplicativo surgiu por um sentimento do último set em que participei, onde a
                questão financeira foi extremamente confusa. Diante dessa bagunça, resolvi engatar
                de vez e criar um app voltado para a produção por completo. Não vamos mais fazer
                contas no Word, beleza, Lages? Amo você.
              </p>

              <p>
                A ideia é do <strong>Lucas Viol</strong>, com a colaboração do{' '}
                <strong>Pedro Simões</strong>, e a execução técnica foi pura parceria com o{' '}
                <strong>Claudio</strong> e o <strong>Geminos</strong>. Nós dois dominamos a nobre
                arte do <em>bitch code</em>: basicamente mandar a inteligência artificial trabalhar,
                ficar esperando ela fazer o código pra gente e reclamar quando dá errado. E assim
                nasceu o app.
              </p>

              <p>
                A proposta é simples: uma ferramenta útil de verdade pra quem vive o caos do set,
                100% gratuita. <strong>Sempre*</strong>.
              </p>

              <p className="text-secondary" style={{ fontSize: '13px', borderLeft: '3px solid var(--accent)', paddingLeft: '14px' }}>
                * Vai ser gratuito até essa bosta dessa bolha de IA estourar. Quando isso acontecer,
                fudeu o cu da bunda e a gente vai ter que ou rebolar lentinho pros crias ou bancar
                essa bomba do próprio bolso. Até lá, é grátis :)
              </p>

              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <ShieldCheck size={18} className="text-success" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '13px' }}>
                  <strong>Importante:</strong> seus dados são seus e jamais serão vendidos ou
                  compartilhados com ninguém.
                  <span className="text-muted"> .... mas se pedirem com carinho.........</span>
                </p>
              </div>

              <div className="text-xs text-muted">
                SetProd v4.2 · Feito para produção audiovisual.
              </div>
            </div>

            <button
              onClick={() => setShowSobre(false)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '24px' }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showBug && <BugReportModal onClose={() => setShowBug(false)} />}
    </div>
  );
}

function CampoProjeto({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

function LinhaProjeto({ label, valor }: { label: string; valor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span className="text-muted">{label}:</span>
      <span className="font-bold" style={{ textAlign: 'right' }}>{valor || '-'}</span>
    </div>
  );
}

function fmtData(d?: string) {
  if (!d) return '...';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano}`;
}
