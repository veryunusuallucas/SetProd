import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Copy, Smartphone, Wallet, FileText, UserCircle, Link2, RefreshCw, Edit2, Trash2, Upload, Settings2 } from 'lucide-react';
import { syncPerfisDeCadastro } from '../lib/sync';
import { useRole } from '../hooks/useRole';
import Stepper, { Step } from './ui/Stepper';
import { ProfileCard } from './ui/ProfileCard';
import { FormBuilder } from './FormBuilder';
import { FichaCompleta } from './FichaCompleta';
import { RelatorioTransversal } from './RelatorioTransversal';
import { useLayoutContext } from '../pages/ProjectLayout';
import type { Perfil } from '../types';

export function PessoasList({ projetoId, onSelectUsuario }: { projetoId: string, onSelectUsuario?: (id: string) => void }) {
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const camposCustom = projeto?.campos_customizados || [];
  
  const { canEditProducao } = useRole();
  const [showForm, setShowForm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);
  
  const { openPanel, closePanel } = useLayoutContext();
  
  // States para o form de Novo Membro
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [nomeSocial, setNomeSocial] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [instagram, setInstagram] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [infoMedica, setInfoMedica] = useState('');
  const [tipoSanguineo, setTipoSanguineo] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [restricaoAlimentar, setRestricaoAlimentar] = useState('');
  const [planoSaude, setPlanoSaude] = useState('');
  const [funcao, setFuncao] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [drt, setDrt] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [valorDiaria, setValorDiaria] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const limparForm = () => {
    setNome(''); setSobrenome(''); setNomeSocial(''); setCpf(''); setRg(''); setNascimento('');
    setTelefone(''); setEmail(''); setEndereco(''); setInstagram('');
    setContatoEmergencia(''); setInfoMedica(''); setTipoSanguineo(''); setAlergias(''); setMedicamentos(''); setRestricaoAlimentar(''); setPlanoSaude('');
    setFuncao(''); setDepartamentoId(''); setDrt(''); setExperiencia('');
    setValorDiaria(''); setTipoVinculo(''); setChavePix(''); setBanco(''); setAgencia(''); setConta(''); setCnpj(''); setRazaoSocial('');
    setCustomValues({});
    setEditId(null);
  };

  const adicionarPessoa = async () => {
    if (!nome) {
      alert("O nome é obrigatório!");
      return;
    }

    const payload = {
      projeto_id: projetoId,
      nome, sobrenome, nome_social: nomeSocial, cpf, rg, data_nascimento: nascimento,
      telefone, email, endereco, instagram,
      contato_emergencia: contatoEmergencia, info_medica: infoMedica, tipo_sanguineo: tipoSanguineo, alergias, medicamentos_continuos: medicamentos, restricao_alimentar: restricaoAlimentar, plano_saude: planoSaude,
      funcao, departamento_id: departamentoId || undefined, drt, experiencia,
      valor_diaria: Number(valorDiaria) || undefined, tipo_vinculo: tipoVinculo, chave_pix: chavePix, banco, agencia, conta, cnpj, razao_social: razaoSocial,
      custom: customValues
    };

    if (editId) {
      await db.perfis.update(editId, payload);
    } else {
      await db.perfis.add({ id: crypto.randomUUID(), ...payload });
    }
    
    limparForm();
    setShowForm(false);
  };

  const handleEdit = (p: any) => {
    setEditId(p.id);
    setNome(p.nome); setSobrenome(p.sobrenome || ''); setNomeSocial(p.nome_social || ''); setCpf(p.cpf || ''); setRg(p.rg || ''); setNascimento(p.data_nascimento || '');
    setTelefone(p.telefone || ''); setEmail(p.email || ''); setEndereco(p.endereco || ''); setInstagram(p.instagram || '');
    setContatoEmergencia(p.contato_emergencia || ''); setInfoMedica(p.info_medica || ''); setTipoSanguineo(p.tipo_sanguineo || ''); 
    setAlergias(p.alergias || ''); setMedicamentos(p.medicamentos_continuos || ''); setRestricaoAlimentar(p.restricao_alimentar || ''); setPlanoSaude(p.plano_saude || '');
    setFuncao(p.funcao || ''); setDepartamentoId(p.departamento_id || ''); setDrt(p.drt || ''); setExperiencia(p.experiencia || '');
    setValorDiaria(p.valor_diaria ? String(p.valor_diaria) : ''); setTipoVinculo(p.tipo_vinculo || ''); setChavePix(p.chave_pix || ''); 
    setBanco(p.banco || ''); setAgencia(p.agencia || ''); setConta(p.conta || ''); setCnpj(p.cnpj || ''); setRazaoSocial(p.razao_social || '');
    setCustomValues(p.custom || {});
    setShowForm(true);
  };

  const handleDelete = async (id: string, nomeCompleto: string) => {
    if (confirm(`Tem certeza que deseja excluir ${nomeCompleto}?`)) {
      await db.perfis.delete(id);
    }
  };

  const getDeptoNome = (id?: string) => {
    if (!id || !departamentos) return 'S/ Depto';
    const d = departamentos.find(depto => depto.id === id);
    return d ? d.nome : 'S/ Depto';
  };

  const copiarLinkCadastro = () => {
    const url = `${window.location.origin}/cadastro/${projetoId}`;
    navigator.clipboard.writeText(url);
    alert('Link de cadastro copiado! Envie no WhatsApp da equipe.');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncPerfisDeCadastro(projetoId);
      alert('Equipe atualizada com sucesso!');
    } catch (e) {
      alert('Erro ao sincronizar. Verifique a internet.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) return alert('O CSV parece vazio ou sem cabeçalho.');

        const separator = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].toLowerCase().split(separator).map(h => h.trim().replace(/"/g, ''));
        
        const idxNome = headers.findIndex(h => h.includes('nome'));
        const idxEmail = headers.findIndex(h => h.includes('email') || h.includes('e-mail'));
        const idxTelefone = headers.findIndex(h => h.includes('telefone') || h.includes('celular') || h.includes('whatsapp'));
        const idxFuncao = headers.findIndex(h => h.includes('funcao') || h.includes('função') || h.includes('cargo'));

        if (idxNome === -1) {
          return alert('Não encontramos uma coluna "Nome" no seu CSV.');
        }

        let adicionados = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i].split(separator).map(c => c.trim().replace(/"/g, ''));
          if (!row[idxNome]) continue; 

          const novo = {
            id: crypto.randomUUID(),
            projeto_id: projetoId,
            nome: row[idxNome],
            email: idxEmail >= 0 ? row[idxEmail] : '',
            telefone: idxTelefone >= 0 ? row[idxTelefone] : '',
            funcao: idxFuncao >= 0 ? row[idxFuncao] : ''
          };

          await db.perfis.add(novo);
          adicionados++;
        }

        alert(`${adicionados} membros importados com sucesso!`);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o arquivo CSV.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-xs text-secondary font-bold uppercase tracking-widest">Equipe {!canEditProducao && '(Somente Leitura)'}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowRelatorio(true)} className="btn-secondary" title="Relatório Geral" style={{ backgroundColor: showRelatorio ? 'var(--accent)' : 'var(--bg-surface)' }}>
            <FileText size={16} color={showRelatorio ? '#000' : 'currentColor'} />
          </button>
          {canEditProducao && (
            <>
              <button onClick={() => openPanel(<FormBuilder projeto={projeto!} onClose={closePanel} />)} className="btn-secondary" title="Configurar Ficha de Cadastro" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Settings2 size={16} color={'currentColor'} />
              </button>
              <label className="btn-icon" title="Importar CSV (Google Forms)" style={{ backgroundColor: 'var(--bg-surface)', cursor: 'pointer' }}>
                <Upload size={16} />
                <input type="file" accept=".csv" onChange={handleImportarCSV} style={{ display: 'none' }} />
              </label>
              <button onClick={handleSync} disabled={isSyncing} className="btn-icon" title="Sincronizar (Puxar Cadastros)" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <RefreshCw size={16} className={isSyncing ? "spinning" : ""} />
              </button>
              <button onClick={copiarLinkCadastro} className="btn-icon" title="Copiar Link de Cadastro" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <Link2 size={16} />
              </button>
              <button onClick={() => { limparForm(); setShowForm(true); }} className="btn-icon">
                <Plus size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        
        {/* Main Content (Lista e Filtros) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {perfis?.filter(p => p.id !== 'caixa_central').length === 0 && (
              <div className="text-muted text-sm text-center" style={{ width: '100%', padding: '24px' }}>Nenhum membro cadastrado.</div>
            )}

            {perfis?.filter(p => p.id !== 'caixa_central').map(p => (
              <div 
                key={p.id} 
                onClick={() => {
                  openPanel(
                    <FichaCompleta
                      perfil={p}
                      projeto={projeto!}
                      departamentoNome={getDeptoNome(p.departamento_id)}
                      canEdit={canEditProducao}
                      onClose={closePanel}
                      onEdit={(perfilEditado) => {
                        closePanel();
                        handleEdit(perfilEditado);
                      }}
                      onDelete={async (id, nomeDeletado) => {
                        await handleDelete(id, nomeDeletado);
                        closePanel();
                      }}
                      onViewTransacoes={(id) => {
                        if (onSelectUsuario) onSelectUsuario(id);
                      }}
                    />
                  );
                }} 
                style={{ cursor: 'pointer', transition: 'transform 0.2s ease' }} 
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} 
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <ProfileCard
                  name={`${p.nome} ${p.sobrenome || ''}`}
                  title={p.funcao || 'Membro'}
                  status={getDeptoNome(p.departamento_id)}
                  handle={p.nome_social || p.nome.toLowerCase()}
                  avatarUrl={`https://ui-avatars.com/api/?name=${p.nome}+${p.sobrenome || ''}&background=random`}
                >
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      {p.telefone && <span className="text-xs text-secondary bg-surface" style={{ padding: '4px 8px', borderRadius: '4px' }}><Smartphone size={12} style={{ display: 'inline', marginRight: '4px' }}/> Tel</span>}
                      {p.alergias && <span className="text-xs text-danger bg-surface" style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Alergia</span>}
                      {p.chave_pix && <span className="text-xs text-accent bg-surface" style={{ padding: '4px 8px', borderRadius: '4px' }}><Wallet size={12} style={{ display: 'inline', marginRight: '4px' }}/> PIX</span>}
                    </div>
                    <div className="text-xs font-bold text-accent">Abrir Ficha &rarr;</div>
                  </div>
                </ProfileCard>
              </div>
            ))}
          </div>
        </div>

      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-lg font-bold">{editId ? 'Editar Membro' : 'Novo Membro'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Stepper
                initialStep={1}
                onFinalStepCompleted={adicionarPessoa}
                backButtonText="Voltar"
                nextButtonText="Avançar"
              >
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Pessoais e Contato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="Nome *" value={nome} onChange={e => setNome(e.target.value)} required style={{ flex: 1 }} />
                      <input placeholder="Sobrenome" value={sobrenome} onChange={e => setSobrenome(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder="Nome Social / Apelido de Set" value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="CPF" value={cpf} onChange={e => setCpf(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="RG" value={rg} onChange={e => setRg(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="Telefone" value={telefone} onChange={e => setTelefone(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="Data de Nascimento" type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input placeholder="Endereço Completo" value={endereco} onChange={e => setEndereco(e.target.value)} />
                    <input placeholder="Instagram" value={instagram} onChange={e => setInstagram(e.target.value)} />
                  </div>
                </Step>
                
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Profissional / Set</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input placeholder="Função (ex: Diretor, Atriz)" value={funcao} onChange={e => setFuncao(e.target.value)} />
                    <select 
                      value={departamentoId} 
                      onChange={e => setDepartamentoId(e.target.value)}
                      style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      <option value="">Nenhum Departamento</option>
                      {departamentos?.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    <input placeholder="DRT" value={drt} onChange={e => setDrt(e.target.value)} />
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Saúde & Emergência</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input placeholder="Contato de Emergência (Nome e Tel)" value={contatoEmergencia} onChange={e => setContatoEmergencia(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="Tipo Sanguíneo" value={tipoSanguineo} onChange={e => setTipoSanguineo(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="Plano de Saúde" value={planoSaude} onChange={e => setPlanoSaude(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder="Alergias" value={alergias} onChange={e => setAlergias(e.target.value)} />
                    <input placeholder="Restrição Alimentar (ex: Vegano)" value={restricaoAlimentar} onChange={e => setRestricaoAlimentar(e.target.value)} />
                    <input placeholder="Outras infos médicas / remédios" value={infoMedica} onChange={e => setInfoMedica(e.target.value)} />
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Financeiro / Contrato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input type="number" placeholder="Valor Diária (R$)" value={valorDiaria} onChange={e => setValorDiaria(e.target.value)} style={{ flex: 1 }} />
                      <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', flex: 1 }}>
                        <option value="">Tipo Vínculo...</option>
                        <option value="Diarista">Diarista</option>
                        <option value="Fixo">Fixo / Semanal</option>
                        <option value="Cachê">Cachê Fechado</option>
                      </select>
                    </div>
                    <input placeholder="Chave PIX" value={chavePix} onChange={e => setChavePix(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="Banco" value={banco} onChange={e => setBanco(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="Agência" value={agencia} onChange={e => setAgencia(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="Conta" value={conta} onChange={e => setConta(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="CNPJ" value={cnpj} onChange={e => setCnpj(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder="Razão Social" value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} style={{ flex: 1 }} />
                    </div>

                    {camposCustom.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="text-xs text-secondary font-bold uppercase tracking-widest">Campos Personalizados</div>
                        {camposCustom.map(c => {
                          if (c.tipo === 'selecao') {
                            return (
                              <div key={c.id}>
                                <div className="text-xs text-secondary mb-1">{c.nome}</div>
                                <select 
                                  value={customValues[c.id] || ''} 
                                  onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                                >
                                  <option value="">Selecione...</option>
                                  {(c.opcoes || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                            );
                          }
                          return (
                            <input
                              key={c.id}
                              placeholder={c.nome}
                              type={c.tipo === 'numero' || c.tipo === 'valor' ? 'number' : c.tipo === 'data' ? 'date' : 'text'}
                              value={customValues[c.id] || ''}
                              onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Step>
              </Stepper>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RELATÓRIO TRANSVERSAL */}
      {showRelatorio && projeto && perfis && (
        <RelatorioTransversal
          perfis={perfis}
          projeto={projeto}
          onClose={() => setShowRelatorio(false)}
        />
      )}

    </div>
  );
}
