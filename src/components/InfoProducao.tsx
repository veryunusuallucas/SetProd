import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PessoasList } from './PessoasList';
import { DepartamentosList } from './DepartamentosList';
import { Film, Users, LayoutList, Download, Plus, Trash2 } from 'lucide-react';
import { useLayoutContext } from '../pages/ProjectLayout';
import { DetalhesUsuario } from './DetalhesUsuario';
import { CreditosPorDepartamento } from './CreditosPorDepartamento';
import type { Credito } from '../types';

type SubAba = 'creditos' | 'departamentos' | 'equipe';

export function InfoProducao({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const [abaAtiva, setAbaAtiva] = useState<SubAba>('creditos');

  const { openPanel, closePanel } = useLayoutContext();

  const [novoCreditoNome, setNovoCreditoNome] = useState('');
  const [novoCreditoPapel, setNovoCreditoPapel] = useState('');
  const [novoCreditoPerfilId, setNovoCreditoPerfilId] = useState('');
  
  // Puxar perfis para exportação
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  if (!projeto) return <div>Carregando...</div>;

  // Créditos sem departamento = apoios, patrocínios e parceiros.
  const apoios = (projeto.creditos || []).filter(c => !c.departamento_id);

  const adicionarCredito = async () => {
    if (!novoCreditoNome && !novoCreditoPerfilId) return;
    if (!novoCreditoPapel) return;
    
    let nome = novoCreditoNome;
    if (novoCreditoPerfilId) {
      const p = perfis?.find(x => x.id === novoCreditoPerfilId);
      if (p) nome = `${p.nome} ${p.sobrenome || ''}`.trim();
    }
    
    const novo: Credito & { perfil_id?: string } = { 
      id: crypto.randomUUID(), 
      nome, 
      papel: novoCreditoPapel,
      ...(novoCreditoPerfilId ? { perfil_id: novoCreditoPerfilId } : {})
    };
    await db.projetos.update(projeto.id, {
      creditos: [...(projeto.creditos || []), novo]
    });
    setNovoCreditoNome('');
    setNovoCreditoPapel('');
    setNovoCreditoPerfilId('');
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
          onClick={() => setAbaAtiva('creditos')}
          style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: abaAtiva === 'creditos' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'creditos' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Film size={18} /> <span style={{ fontSize: '12px' }}>Créditos</span>
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

      {/* SEÇÃO DE CRÉDITOS E EXPORTAÇÃO */}
      {abaAtiva === 'creditos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Créditos organizados por departamento e função */}
          <CreditosPorDepartamento projeto={projeto} />

          {/* Apoios, patrocínios e parceiros — não pertencem a um departamento */}
          <div className="card">
            <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Apoios, Patrocínios e Extras</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {apoios.map(c => (
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
              {apoios.length === 0 && (
                <div className="text-sm text-muted text-center py-4">Nenhum apoio registrado.</div>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', borderTop: '1px dashed var(--border-light)', paddingTop: '16px' }}>
              <select
                value={novoCreditoPerfilId}
                onChange={e => {
                  setNovoCreditoPerfilId(e.target.value);
                  if (e.target.value) setNovoCreditoNome('');
                }}
                style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-primary)' }}
              >
                <option value="">-- Vincular membro da Equipe (Opcional) --</option>
                {perfis?.filter(p => p.id !== 'caixa_central').map(p => (
                  <option key={p.id} value={p.id}>{p.nome} {p.sobrenome || ''} ({p.funcao || 'Sem função'})</option>
                ))}
              </select>

              {!novoCreditoPerfilId && (
                <input placeholder="Ou digite o Nome da Empresa/Pessoa" value={novoCreditoNome} onChange={e => setNovoCreditoNome(e.target.value)} style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-primary)' }} />
              )}

              <input placeholder="Papel (Ex: Apoio de Alimentação, Patrocínio)" value={novoCreditoPapel} onChange={e => setNovoCreditoPapel(e.target.value)} style={{ flex: 1, minWidth: '200px', backgroundColor: 'var(--bg-primary)' }} />
              <button onClick={adicionarCredito} className="btn-primary" style={{ padding: '0 16px' }}>
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="section" style={{ marginTop: '24px' }}>
          <h3 className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Exportar Dados</h3>
          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              onClick={exportarEnxuta}
              className="btn-secondary" 
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              <Download size={16} /> Exportar Créditos (Txt Enxuto)
            </button>
            <button 
              onClick={exportarCSVCompleto}
              className="btn-secondary" 
              style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
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
