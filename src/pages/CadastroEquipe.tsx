import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { CampoCustomizado } from '../types';

export function CadastroEquipe() {
  const { projetoId } = useParams();
  
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [alergias, setAlergias] = useState('');
  const [restricaoAlimentar, setRestricaoAlimentar] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [sucesso, setSucesso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [camposCustomizados, setCamposCustomizados] = useState<CampoCustomizado[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    async function carregarProjeto() {
      if (!projetoId) return;
      try {
        const { data } = await supabase
          .from('projetos')
          .select('campos_customizados')
          .eq('id', projetoId)
          .single();
          
        if (data && data.campos_customizados) {
          setCamposCustomizados(data.campos_customizados);
        }
      } catch (err) {
        console.error("Erro ao carregar campos do projeto", err);
      } finally {
        setLoadingConfig(false);
      }
    }
    carregarProjeto();
  }, [projetoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      if (!projetoId) throw new Error("Link de projeto inválido.");
      
      const novoPerfil = {
        id: crypto.randomUUID(),
        projeto_id: projetoId,
        nome,
        telefone,
        email,
        cpf,
        chave_pix: chavePix,
        alergias,
        restricao_alimentar: restricaoAlimentar,
        custom: customValues
        // The public form doesn't set valor_diaria, that's for the producer to set.
      };

      // Tenta salvar direto no Supabase. O produtor irá baixar (pull) de lá.
      const { error: supabaseError } = await supabase
        .from('perfis')
        .insert([novoPerfil]);

      if (supabaseError) {
        // Fallback: se a pessoa não tiver internet? Supabase SDK não faz fila offline nativamente do jeito que queremos.
        // Mas podemos assumir que para enviar o form, a pessoa tem internet.
        throw supabaseError;
      }

      setSucesso(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao enviar cadastro. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--accent)', marginBottom: '16px' }}>Cadastro Enviado!</h2>
          <p className="text-secondary">Obrigado! Seus dados foram enviados para a equipe de produção.</p>
        </div>
      </div>
    );
  }

  if (loadingConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando formulário...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px', backgroundColor: 'var(--bg-default)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="text-xl font-bold">Ficha de Cadastro</h1>
          <p className="text-sm text-secondary">Preencha seus dados para a produção</p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Nome Completo *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Como você é chamado no set" />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Celular / WhatsApp *</label>
              <input required value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">CPF *</label>
              <input required value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Chave PIX (Para Pagamento)</label>
            <input value={chavePix} onChange={e => setChavePix(e.target.value)} placeholder="Celular, CPF ou E-mail" />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
          
          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Alergias (Medicamentos/Outros)</label>
            <input value={alergias} onChange={e => setAlergias(e.target.value)} placeholder="Ex: Dipirona, Picada de Abelha" />
          </div>

          <div>
            <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Restrição Alimentar</label>
            <input value={restricaoAlimentar} onChange={e => setRestricaoAlimentar(e.target.value)} placeholder="Ex: Vegano, Intolerante à Lactose" />
          </div>

          {camposCustomizados.length > 0 && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
              <div style={{ marginBottom: '8px' }}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-secondary">Campos Personalizados do Projeto</h3>
              </div>
              
              {camposCustomizados.map(c => (
                <div key={c.id}>
                  <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
                    {c.nome} {c.obrigatorio && '*'}
                  </label>
                  {c.tipo === 'selecao' ? (
                    <select
                      required={c.obrigatorio}
                      value={customValues[c.id] || ''}
                      onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      <option value="">Selecione...</option>
                      {(c.opcoes || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <input
                      required={c.obrigatorio}
                      type={c.tipo === 'numero' || c.tipo === 'valor' ? 'number' : c.tipo === 'data' ? 'date' : 'text'}
                      placeholder={c.nome}
                      value={customValues[c.id] || ''}
                      onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
            </>
          )}

          <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '16px' }}>
            {loading ? 'Enviando...' : 'Enviar Cadastro'}
          </button>
        </form>
      </div>
    </div>
  );
}
