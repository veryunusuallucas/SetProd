import { useState } from 'react';
import type { Perfil, Projeto } from '../types';

interface RelatorioTransversalProps {
  perfis: Perfil[];
  projeto: Projeto;
  onClose: () => void;
}

export function RelatorioTransversal({ perfis, projeto, onClose }: RelatorioTransversalProps) {
  
  const camposFixos = [
    { id: 'alergias', nome: 'Alergias' },
    { id: 'restricao_alimentar', nome: 'Restrições Alimentares' },
    { id: 'tipo_sanguineo', nome: 'Tipo Sanguíneo' },
    { id: 'medicamentos_continuos', nome: 'Medicamentos Contínuos' },
    { id: 'contato_emergencia', nome: 'Contato de Emergência' },
    { id: 'funcao', nome: 'Função / Cargo' },
    { id: 'tipo_vinculo', nome: 'Tipo de Vínculo' }
  ];

  const todosCampos = [
    ...camposFixos,
    ...(projeto.campos_customizados || []).map(c => ({ id: `custom_${c.id}`, nome: c.nome }))
  ];

  const [campoSelecionado, setCampoSelecionado] = useState<string>(todosCampos[0].id);

  // Filtrar e agrupar
  const membros = perfis.filter(p => p.id !== 'caixa_central').map(p => {
    let valor = '';
    if (campoSelecionado.startsWith('custom_')) {
      const customId = campoSelecionado.replace('custom_', '');
      valor = p.custom?.[customId] || '';
    } else {
      valor = (p as any)[campoSelecionado] || '';
    }
    return {
      id: p.id,
      nome: `${p.nome} ${p.sobrenome || ''}`,
      valor: valor.trim()
    };
  }).filter(m => m.valor !== '');

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
        
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-lg font-bold">Relatório Transversal</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="text-xs font-bold uppercase tracking-widest text-secondary">Selecione o Campo para Filtrar</label>
          <select 
            value={campoSelecionado}
            onChange={e => setCampoSelecionado(e.target.value)}
            style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', width: '100%' }}
          >
            {todosCampos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {membros.length === 0 ? (
            <div className="text-center text-muted" style={{ padding: '24px' }}>Nenhum membro possui dados preenchidos para este campo.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }} className="text-xs uppercase tracking-widest text-muted">Membro</th>
                  <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }} className="text-xs uppercase tracking-widest text-muted">Valor</th>
                </tr>
              </thead>
              <tbody>
                {membros.sort((a,b) => a.nome.localeCompare(b.nome)).map(m => (
                  <tr key={m.id}>
                    <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }} className="font-bold">{m.nome}</td>
                    <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }} className="text-accent font-bold">{m.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
