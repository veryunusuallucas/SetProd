import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PessoasList } from './PessoasList';
import { DepartamentosList } from './DepartamentosList';
import { Film, Users, LayoutList, Download, Plus, Trash2 } from 'lucide-react';
import { useLayoutContext } from '../pages/ProjectLayout';
import { DetalhesUsuario } from './DetalhesUsuario';
import type { Projeto, Credito, Perfil } from '../types';

type SubAba = 'producao' | 'departamentos' | 'equipe';

export function InfoProducao({ projetoId, onSelectUsuario }: { projetoId: string, onSelectUsuario?: (id: string) => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const [abaAtiva, setAbaAtiva] = useState<SubAba>('producao');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Projeto | null>(null);
  
  const { openPanel, closePanel } = useLayoutContext();

  const [novoCreditoNome, setNovoCreditoNome] = useState('');
  const [novoCreditoPapel, setNovoCreditoPapel] = useState('');
  
  // Puxar perfis para exportação
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  useEffect(() => {
    if (projeto && !editMode) setForm(projeto);
  }, [projeto, editMode]);

  if (!projeto) return <div>Carregando...</div>;

  const salvar = async () => {
    if (!form) return;
    await db.projetos.put(form);
    setEditMode(false);
  };

  const num = (v: string) => (v === '' ? undefined : Number(v));

  const adicionarCredito = async () => {
    if (!novoCreditoNome || !novoCreditoPapel) return;
    const novo: Credito = { id: crypto.randomUUID(), nome: novoCreditoNome, papel: novoCreditoPapel };
    await db.projetos.update(projeto.id, {
      creditos: [...(projeto.creditos || []), novo]
    });
    setNovoCreditoNome('');
    setNovoCreditoPapel('');
  };

  const removerCredito = async (id: string) => {
    await db.projetos.update(projeto.id, {
      creditos: (projeto.creditos || []).filter(c => c.id !== id)
    });
  };

  const exportarEnxuta = () => {
    if (!perfis) return;
    let txt = `CRÉDITOS - ${projeto.nome}\n\nEQUIPE:\n`;
    perfis.filter(p => p.id !== 'caixa_central').forEach(p => {
      txt += `${p.nome} ${p.sobrenome || ''} - ${p.funcao || 'Membro'}\n`;
    });
    if (projeto.creditos && projeto.creditos.length > 0) {
      txt += `\nAPOIOS E EXTRAS:\n`;
      projeto.creditos.forEach(c => {
        txt += `${c.nome} - ${c.papel}\n`;
      });
    }
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Creditos_${projeto.nome}.txt`;
    a.click();
  };

  const exportarCSVCompleto = () => {
    if (!perfis) return;
    const headers = ['Nome', 'Sobrenome', 'CPF', 'Telefone', 'Email', 'Função', 'PIX', 'Valor Diária'];
    const linhas = perfis.filter(p => p.id !== 'caixa_central').map(p => {
      return [
        p.nome, p.sobrenome || '', p.cpf || '', p.telefone || '', p.email || '', 
        p.funcao || '', p.chave_pix || '', p.valor_diaria || ''
      ].map(v => `"${v}"`).join(';');
    });
    const csv = [headers.join(';'), ...linhas].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Equipe_Completa_${projeto.nome}.csv`;
    a.click();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Sub Navbar */}
      <div style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
        <button 
          onClick={() => setAbaAtiva('producao')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'producao' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'producao' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Film size={18} /> <span style={{ fontSize: '12px' }}>Dados</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('departamentos')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'departamentos' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'departamentos' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <LayoutList size={18} /> <span style={{ fontSize: '12px' }}>Depto</span>
        </button>
        <button 
          onClick={() => setAbaAtiva('equipe')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'equipe' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'equipe' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Users size={18} /> <span style={{ fontSize: '12px' }}>Equipe</span>
        </button>
      </div>

      {abaAtiva === 'producao' && form && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest">Dados da Produção</div>
            <button
              onClick={() => editMode ? salvar() : setEditMode(true)}
              className="text-xs font-bold"
              style={{ backgroundColor: editMode ? 'var(--accent)' : 'var(--bg-surface)', color: editMode ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '4px 12px' }}
            >
              {editMode ? 'Salvar' : 'Editar'}
            </button>
          </div>

          {editMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Campo label="Nome do Projeto"><input value={form.nome || ''} onChange={e => setForm({ ...form, nome: e.target.value })} /></Campo>
              <Campo label="Diretor"><input value={form.diretor || ''} onChange={e => setForm({ ...form, diretor: e.target.value })} /></Campo>
              <Campo label="Produtor"><input value={form.produtor || ''} onChange={e => setForm({ ...form, produtor: e.target.value })} /></Campo>
              <Campo label="Produtora"><input value={form.produtora || ''} onChange={e => setForm({ ...form, produtora: e.target.value })} /></Campo>
              <Campo label="Locação / Cidade"><input value={form.local || ''} onChange={e => setForm({ ...form, local: e.target.value })} /></Campo>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Campo label="Início"><input type="date" value={form.data_inicio || ''} onChange={e => setForm({ ...form, data_inicio: e.target.value })} /></Campo>
                <Campo label="Fim"><input type="date" value={form.data_fim || ''} onChange={e => setForm({ ...form, data_fim: e.target.value })} /></Campo>
              </div>
              <Campo label="Nº de Diárias (total)"><input type="number" value={form.num_diarias ?? ''} onChange={e => setForm({ ...form, num_diarias: num(e.target.value) })} /></Campo>
              <Campo label="Observações"><textarea rows={3} value={form.obs || ''} onChange={e => setForm({ ...form, obs: e.target.value })} /></Campo>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              <Linha label="Diretor" valor={projeto.diretor} />
              <Linha label="Produtor" valor={projeto.produtor} />
              <Linha label="Produtora" valor={projeto.produtora} />
              <Linha label="Locação" valor={projeto.local} />
              <Linha label="Período" valor={projeto.data_inicio || projeto.data_fim ? `${fmtData(projeto.data_inicio)} — ${fmtData(projeto.data_fim)}` : undefined} />
              <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
              <Linha label="Nº de Diárias" valor={projeto.num_diarias != null ? `${projeto.num_diarias}` : undefined} />
              <Linha label="Criado em" valor={new Date(projeto.data_criacao).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} />
              {projeto.obs && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '4px 0' }}></div>
                  <div className="text-muted text-xs uppercase tracking-widest">Observações</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{projeto.obs}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO DE CRÉDITOS E EXPORTAÇÃO */}
      {abaAtiva === 'producao' && form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card">
            <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Créditos, Apoios e Extras</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(projeto.creditos || []).map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                  <div>
                    <div className="font-bold">{c.nome}</div>
                    <div className="text-xs text-muted">{c.papel}</div>
                  </div>
                  <button onClick={() => removerCredito(c.id)} className="btn-icon text-danger" style={{ padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {(projeto.creditos || []).length === 0 && (
                <div className="text-sm text-muted text-center py-4">Nenhum apoio registrado.</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
              <input placeholder="Nome da Empresa/Pessoa" value={novoCreditoNome} onChange={e => setNovoCreditoNome(e.target.value)} style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }} />
              <input placeholder="O que fez (Ex: Patrocínio)" value={novoCreditoPapel} onChange={e => setNovoCreditoPapel(e.target.value)} style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }} />
              <button onClick={adicionarCredito} className="btn-primary" style={{ padding: '0 16px' }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="card">
            <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Exportar Dados</div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button onClick={exportarEnxuta} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
                <Download size={16} /> Exportar Créditos (Txt Enxuto)
              </button>
              <button onClick={exportarCSVCompleto} className="btn-secondary" style={{ flex: 1, justifyContent: 'center', backgroundColor: 'var(--bg-primary)' }}>
                <Download size={16} /> Exportar Equipe (CSV Completo)
              </button>
            </div>
          </div>

        </div>
      )}

      {abaAtiva === 'departamentos' && (
        <DepartamentosList projetoId={projetoId} />
      )}

      {abaAtiva === 'equipe' && (
        <PessoasList 
          projetoId={projetoId} 
          onSelectUsuario={(uid) => {
            openPanel(
              <DetalhesUsuario 
                projetoId={projetoId} 
                usuarioId={uid} 
                origem="producao" 
                onVoltar={closePanel} 
              />
            );
          }} 
        />
      )}

    </div>
  );
}

function Campo({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div style={{ flex: 1 }}>
      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  );
}

function Linha({ label, valor }: { label: string, valor?: string }) {
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
