import type { Perfil, Projeto } from '../types';
import { UserCircle, Edit2, Trash2, Copy, X, Lock } from 'lucide-react';

interface FichaCompletaProps {
  perfil: Perfil;
  projeto: Projeto;
  departamentoNome: string;
  onClose: () => void;
  onEdit: (p: Perfil) => void;
  onDelete: (id: string, nome: string) => void;
  onViewTransacoes: (id: string) => void;
  canEdit: boolean;
  /** Documento, endereço, cachê e dados bancários. Ver `camposSensiveis.ts`. */
  verRestrito: boolean;
  /** Ficha médica e contato de emergência. */
  verMedico: boolean;
}

export function FichaCompleta({ perfil: p, projeto, departamentoNome, onClose, onEdit, onDelete, onViewTransacoes, canEdit, verRestrito, verMedico }: FichaCompletaProps) {

  /**
   * O texto copiado segue as mesmas camadas da tela.
   *
   * Esconder na tela e liberar tudo no "Copiar Ficha Inteira" não protegeria
   * nada — seria o mesmo dado, um clique adiante, e ainda por cima na área de
   * transferência, onde ninguém lembra que ficou.
   */
  const copiarFichaInteira = () => {
    const blocos: string[] = [
      `FICHA CADASTRAL - ${p.nome} ${p.sobrenome || ''}
Nome Social: ${p.nome_social || '-'}
Telefone: ${p.telefone || '-'} | E-mail: ${p.email || '-'}
Instagram: ${p.instagram || '-'}`,
      `SET
Função: ${p.funcao || '-'}
Depto: ${departamentoNome}
DRT: ${p.drt || '-'}`,
    ];

    if (verRestrito) {
      blocos.push(`DOCUMENTOS
CPF: ${p.cpf || '-'} | RG: ${p.rg || '-'}
Nascimento: ${p.data_nascimento || '-'}
Endereço: ${p.endereco || '-'}`);
      blocos.push(`FINANCEIRO
Diária: R$ ${p.valor_diaria || '-'} | Vínculo: ${p.tipo_vinculo || '-'}
PIX: ${p.chave_pix || '-'}
Banco: ${p.banco || '-'} | Ag: ${p.agencia || '-'} | Cc: ${p.conta || '-'}`);
    }

    if (verMedico) {
      blocos.push(`MÉDICA / EMERGÊNCIA
Contato: ${p.contato_emergencia || '-'}
Sanguíneo: ${p.tipo_sanguineo || '-'}
Alergias: ${p.alergias || '-'} | Restrições: ${p.restricao_alimentar || '-'}
Plano Saúde: ${p.plano_saude || '-'}`);
    }

    const extras = (projeto.campos_customizados || []).filter(c => p.custom?.[c.id]);
    if (extras.length > 0) {
      blocos.push('PERSONALIZADOS\n' + extras.map(c => `${c.nome}: ${p.custom?.[c.id]}`).join('\n'));
    }

    navigator.clipboard.writeText(blocos.join('\n\n'));
    alert('Ficha copiada para a área de transferência!');
  };

  /**
   * O lugar vazio, com o motivo.
   *
   * Sumir sem explicação faz a pessoa achar que a ficha está incompleta e sair
   * pedindo para alguém preencher de novo o que já estava lá.
   */
  const Escondido = ({ o }: { o: string }) => (
    <p className="text-xs text-muted" style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.5, margin: 0 }}>
      <Lock size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
      <span>Só a própria pessoa e quem administra a produção veem {o}.</span>
    </p>
  );

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
                <Linha label="Telefone" valor={p.telefone} />
                <Linha label="E-mail" valor={p.email} />
                <Linha label="Instagram" valor={p.instagram} />
                {/* Documento e endereço saem do bloco público: são a camada
                    restrita, e estavam à vista de qualquer convidado. */}
                {verRestrito && <Linha label="Data de Nascimento" valor={p.data_nascimento} />}
                {verRestrito && <Linha label="CPF" valor={p.cpf} />}
                {verRestrito && <Linha label="RG" valor={p.rg} />}
              </div>
              {verRestrito && <Linha label="Endereço" valor={p.endereco} />}
              {!verRestrito && <Escondido o="documento, nascimento e endereço" />}
            </div>

            {/* Bloco: Saúde e Emergência */}
            {verMedico && (
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
            )}

            {/* Bloco: Financeiro e Contrato */}
            {verRestrito && (
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
            )}

            {!verMedico && (
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-accent border-b border-border-light pb-2">Saúde e Emergência</h3>
                <Escondido o="a ficha médica" />
              </div>
            )}

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
