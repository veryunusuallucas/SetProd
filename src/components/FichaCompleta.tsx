import type { Perfil, Projeto } from '../types';
import { Smartphone, Wallet, FileText, UserCircle, Edit2, Trash2, Copy, X } from 'lucide-react';

interface FichaCompletaProps {
  perfil: Perfil;
  projeto: Projeto;
  departamentoNome: string;
  onClose: () => void;
  onEdit: (p: Perfil) => void;
  onDelete: (id: string, nome: string) => void;
  onViewTransacoes: (id: string) => void;
  canEdit: boolean;
}

export function FichaCompleta({ perfil: p, projeto, departamentoNome, onClose, onEdit, onDelete, onViewTransacoes, canEdit }: FichaCompletaProps) {
  
  const copiarFichaInteira = () => {
    const texto = `FICHA CADASTRAL - ${p.nome} ${p.sobrenome || ''}
Nome Social: ${p.nome_social || '-'}
CPF: ${p.cpf || '-'} | RG: ${p.rg || '-'}
Nascimento: ${p.data_nascimento || '-'}
Telefone: ${p.telefone || '-'} | E-mail: ${p.email || '-'}
Instagram: ${p.instagram || '-'}
Endereço: ${p.endereco || '-'}

MÉDICA / EMERGÊNCIA
Contato: ${p.contato_emergencia || '-'}
Sanguíneo: ${p.tipo_sanguineo || '-'}
Alergias: ${p.alergias || '-'} | Restrições: ${p.restricao_alimentar || '-'}
Plano Saúde: ${p.plano_saude || '-'}

SET
Função: ${p.funcao || '-'}
Depto: ${departamentoNome}
DRT: ${p.drt || '-'}

FINANCEIRO
Diária: R$ ${p.valor_diaria || '-'} | Vínculo: ${p.tipo_vinculo || '-'}
PIX: ${p.chave_pix || '-'}
Banco: ${p.banco || '-'} | Ag: ${p.agencia || '-'} | Cc: ${p.conta || '-'}`;

    const extras = (projeto.campos_customizados || []).filter(c => p.custom?.[c.id]);
    const textoFinal = extras.length > 0
      ? texto + '\n\nPERSONALIZADOS\n' + extras.map(c => `${c.nome}: ${p.custom?.[c.id]}`).join('\n')
      : texto;
    navigator.clipboard.writeText(textoFinal);
    alert('Ficha copiada para a área de transferência!');
  };

  const Linha = ({ label, valor, danger = false }: { label: string, valor?: string | number, danger?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className={`text-xs font-bold uppercase tracking-widest ${danger ? 'text-danger' : 'text-muted'}`}>{label}</span>
      <span className={danger ? 'text-danger font-bold' : ''}>{valor || '-'}</span>
    </div>
  );

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      
      {/* HEADER DA PÁGINA INTEIRA */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <img src={`https://ui-avatars.com/api/?name=${p.nome}+${p.sobrenome || ''}&background=random`} alt="Avatar" style={{ width: '64px', height: '64px', borderRadius: '50%' }} />
          <div>
            <h1 className="text-2xl font-bold">{p.nome} {p.sobrenome || ''}</h1>
            <div className="text-sm text-secondary">{p.funcao || 'Membro'} • {departamentoNome}</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {canEdit && (
            <>
              <button onClick={() => onEdit(p)} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }} title="Editar Ficha"><Edit2 size={20} /></button>
              <button onClick={() => { onClose(); onDelete(p.id, `${p.nome} ${p.sobrenome || ''}`); }} className="btn-icon text-danger" style={{ backgroundColor: 'var(--bg-surface)' }} title="Excluir"><Trash2 size={20} /></button>
            </>
          )}
          <button onClick={onClose} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }} title="Fechar Ficha"><X size={20} /></button>
        </div>
      </div>

      {/* CONTEÚDO SCROLLABLE */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={copiarFichaInteira} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              <Copy size={18} style={{ marginRight: '8px' }}/> Copiar Ficha Inteira
            </button>
            <button onClick={() => { onClose(); onViewTransacoes(p.id); }} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              <UserCircle size={18} style={{ marginRight: '8px' }}/> Ver Transações (Acertos)
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            
            {/* Bloco: Pessoais e Contato */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent border-b border-border-light pb-2">Pessoais e Contato</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Linha label="Nome Social / Apelido" valor={p.nome_social} />
                <Linha label="Data de Nascimento" valor={p.data_nascimento} />
                <Linha label="CPF" valor={p.cpf} />
                <Linha label="RG" valor={p.rg} />
                <Linha label="Telefone" valor={p.telefone} />
                <Linha label="E-mail" valor={p.email} />
              </div>
              <Linha label="Endereço" valor={p.endereco} />
              <Linha label="Instagram" valor={p.instagram} />
            </div>

            {/* Bloco: Saúde e Emergência */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent border-b border-border-light pb-2">Saúde e Emergência</h3>
              <Linha label="Contato de Emergência" valor={p.contato_emergencia} danger={!!p.contato_emergencia} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Linha label="Tipo Sanguíneo" valor={p.tipo_sanguineo} />
                <Linha label="Plano de Saúde" valor={p.plano_saude} />
              </div>
              <Linha label="Alergias" valor={p.alergias} danger={!!p.alergias} />
              <Linha label="Restrições Alimentares" valor={p.restricao_alimentar} />
              <Linha label="Medicamentos Contínuos" valor={p.medicamentos_continuos} />
              <Linha label="Outras Infos Médicas" valor={p.info_medica} />
            </div>

            {/* Bloco: Financeiro e Contrato */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent border-b border-border-light pb-2">Financeiro e Contrato</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Linha label="Valor Diária" valor={p.valor_diaria ? `R$ ${p.valor_diaria}` : undefined} />
                <Linha label="Tipo de Vínculo" valor={p.tipo_vinculo} />
                <Linha label="Chave PIX" valor={p.chave_pix} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <Linha label="Banco" valor={p.banco} />
                <Linha label="Agência" valor={p.agencia} />
                <Linha label="Conta" valor={p.conta} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Linha label="CNPJ" valor={p.cnpj} />
                <Linha label="Razão Social" valor={p.razao_social} />
              </div>
            </div>

            {/* Bloco: Set e Personalizados */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-accent border-b border-border-light pb-2">Set e Personalizados</h3>
              <Linha label="DRT" valor={p.drt} />
              <Linha label="Experiência / Mini-Bio" valor={p.experiencia} />
              
              {(projeto.campos_customizados || []).filter(c => p.custom?.[c.id]).length > 0 && (
                <>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }}></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    {(projeto.campos_customizados || []).filter(c => p.custom?.[c.id]).map(c => (
                      <Linha key={c.id} label={c.nome} valor={c.tipo === 'valor' ? `R$ ${p.custom?.[c.id]}` : p.custom?.[c.id]} />
                    ))}
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
