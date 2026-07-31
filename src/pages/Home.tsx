import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Projeto } from '../types';
import { Settings, Search, Film, Trash2, Sparkles } from 'lucide-react';
import { FloatingActionMenu } from '../components/ui/FloatingActionMenu';
import Stepper, { Step } from '../components/ui/Stepper';
import { BugReportModal } from '../components/BugReportModal';
import { CreepyButton } from '../components/ui/CreepyButton';
import { HelpButton } from '../components/HelpButton';
import { ChangelogModal } from '../components/ChangelogModal';

export function Home() {
  const projetos = useLiveQuery(() => db.projetos.toArray());
  const aportesGlobais = useLiveQuery(() => db.aportes.toArray());
  const despesasGlobais = useLiveQuery(() => db.despesas.toArray());
  const navigate = useNavigate();

  const [modoDeletar, setModoDeletar] = useState(false);
  const [projetoParaDeletar, setProjetoParaDeletar] = useState<Projeto | null>(null);

  const [mostrarStepper, setMostrarStepper] = useState(false);
  const [mostrarChangelog, setMostrarChangelog] = useState(false);
  const [termoBusca, setTermoBusca] = useState('');
  
  // Stepper State
  const [novoProjeto, setNovoProjeto] = useState<Partial<Projeto>>({
    nome: '',
    diretor: '',
    produtor: '',
    limite_gasto: 0,
    modo_acerto: 'centralizado'
  });

  const criarProjeto = async () => {
    if (!novoProjeto.nome) {
      alert('O nome do projeto é obrigatório!');
      return;
    }
    
    const id = crypto.randomUUID();
    const projetoCriado: Projeto = {
      id,
      nome: novoProjeto.nome,
      diretor: novoProjeto.diretor || '',
      produtor: novoProjeto.produtor || '',
      limite_gasto: novoProjeto.limite_gasto || 0,
      data_criacao: Date.now(),
      modo_acerto: novoProjeto.modo_acerto || 'centralizado',
      modo: novoProjeto.modo || 'grande',
      moeda: novoProjeto.moeda || 'BRL'
    };

    await db.projetos.add(projetoCriado);
    
    // Adiciona o "Caixa Central" como usuário fantasma sempre
    await db.perfis.add({
      id: 'caixa_central',
      projeto_id: id,
      nome: 'Caixa da Produção',
      funcao: 'Caixa'
    });

    setMostrarStepper(false);
    navigate(`/projeto/${id}`);
  };

  const projetosFiltrados = projetos?.filter(p => 
    p.nome.toLowerCase().includes(termoBusca.toLowerCase()) ||
    (p.diretor && p.diretor.toLowerCase().includes(termoBusca.toLowerCase()))
  ) || [];

  const confirmarDelecao = async () => {
    if (!projetoParaDeletar) return;
    const id = projetoParaDeletar.id;
    await db.projetos.delete(id);
    await db.perfis.where('projeto_id').equals(id).delete();
    await db.despesas.where('projeto_id').equals(id).delete();
    await db.acertos.where('projeto_id').equals(id).delete();
    await db.departamentos.where('projeto_id').equals(id).delete();
    await db.configuracoes.delete(id);
    setProjetoParaDeletar(null);
  };

  return (
    <div className="home-shell" style={{
      padding: '24px',
      paddingBottom: '80px',
      minHeight: '100vh',
      backgroundColor: modoDeletar ? 'rgba(220, 38, 38, 0.05)' : 'transparent',
      transition: 'background-color 0.3s ease'
    }}>
      
      {/* HEADER */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Bem-vindo</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Produtor</h1>
            <button 
              onClick={() => setMostrarChangelog(true)}
              style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles size={12} /> v2.0
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <HelpButton />
          <button className="btn-icon">
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* SEARCH */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Buscar produções..." 
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          style={{ paddingLeft: '44px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="text-xs text-secondary font-bold uppercase tracking-widest">Produções Recentes</h2>
        <span className="text-accent text-sm font-bold">Ver todas</span>
      </div>

      {/* PROJECT LIST */}
      <div className="home-projects" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {projetosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
            <Film size={40} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <p className="text-secondary">Nenhuma produção encontrada.</p>
          </div>
        ) : (
          projetosFiltrados.map(projeto => (
            <div key={projeto.id} className="card" onClick={() => !modoDeletar && navigate(`/projeto/${projeto.id}`)} style={{ cursor: modoDeletar ? 'default' : 'pointer', position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span className="badge" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>ATIVO</span>
                {modoDeletar ? (
                  <button onClick={(e) => { e.stopPropagation(); setProjetoParaDeletar(projeto); }} className="btn-icon text-danger" style={{ padding: 0 }}>
                    <Trash2 size={20} />
                  </button>
                ) : (
                  <span className="text-secondary">&gt;</span>
                )}
              </div>
              <h3 className="text-xl font-bold" style={{ marginBottom: '4px' }}>{projeto.nome}</h3>
              <div className="text-xs text-muted" style={{ textTransform: 'uppercase', letterSpacing: '1px' }}>
                Acerto: {projeto.modo_acerto === 'direto' ? 'Direto' : 'Centralizado'}
              </div>
              
              <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                <div className="text-xs text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Saldo Atual</div>
                <div className="font-bold text-lg" style={{ color: ((aportesGlobais?.filter(a => a.projeto_id === projeto.id).reduce((acc, a) => acc + a.valor, 0) || 0) - (despesasGlobais?.filter(d => d.projeto_id === projeto.id).reduce((acc, d) => acc + d.valor_total, 0) || 0)) < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                  R$ {((aportesGlobais?.filter(a => a.projeto_id === projeto.id).reduce((acc, a) => acc + a.valor, 0) || 0) - (despesasGlobais?.filter(d => d.projeto_id === projeto.id).reduce((acc, d) => acc + d.valor_total, 0) || 0)).toFixed(2)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Creepy Button Fix para modo deletar */}
      <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 50 }}>
        <CreepyButton onClick={() => setModoDeletar(!modoDeletar)}>
          {modoDeletar ? 'Concluir' : 'Apagar'}
        </CreepyButton>
      </div>

      <FloatingActionMenu 
        onCriarProjeto={() => setMostrarStepper(true)}
      />

      {/* MODAL STEPPER (CRIAR PROJETO) */}
      {mostrarStepper && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-lg font-bold">Nova Produção</h2>
              <button onClick={() => setMostrarStepper(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Stepper
                initialStep={1}
                onFinalStepCompleted={criarProjeto}
                backButtonText="Voltar"
                nextButtonText="Avançar"
              >
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Informações Básicas</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Nome do Projeto *</label>
                      <input type="text" value={novoProjeto.nome} onChange={e => setNovoProjeto({...novoProjeto, nome: e.target.value})} placeholder="Ex: Filme A" />
                    </div>
                    <div>
                      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Diretor</label>
                      <input type="text" value={novoProjeto.diretor} onChange={e => setNovoProjeto({...novoProjeto, diretor: e.target.value})} placeholder="Nome do diretor" />
                    </div>
                    <div>
                      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Produtor</label>
                      <input type="text" value={novoProjeto.produtor} onChange={e => setNovoProjeto({...novoProjeto, produtor: e.target.value})} placeholder="Nome do produtor" />
                    </div>
                  </div>
                </Step>
                
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Financeiro</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'block', marginBottom: '8px' }}>Gasto Limite (R$)</label>
                      <input type="number" value={novoProjeto.limite_gasto} onChange={e => setNovoProjeto({...novoProjeto, limite_gasto: Number(e.target.value)})} placeholder="0.00" />
                    </div>
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Modo de Acerto</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <label className="checkbox-label" style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: novoProjeto.modo_acerto === 'centralizado' ? 'var(--bg-active)' : 'transparent' }}>
                      <input type="checkbox" checked={novoProjeto.modo_acerto === 'centralizado'} onChange={() => setNovoProjeto({...novoProjeto, modo_acerto: 'centralizado'})} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="font-bold">Centralizado na Produção</span>
                        <span className="text-xs text-muted">Todos pagam/recebem do Caixa da Produção.</span>
                      </div>
                    </label>
                    
                    <label className="checkbox-label" style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: novoProjeto.modo_acerto === 'direto' ? 'var(--bg-active)' : 'transparent' }}>
                      <input type="checkbox" checked={novoProjeto.modo_acerto === 'direto'} onChange={() => setNovoProjeto({...novoProjeto, modo_acerto: 'direto'})} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span className="font-bold">Direto entre Membros</span>
                        <span className="text-xs text-muted">A equipe transfere dinheiro diretamente entre si.</span>
                      </div>
                    </label>
                  </div>
                </Step>
              </Stepper>
            </div>

          </div>
        </div>
      )}


      {/* MODAL DE CONFIRMAÇÃO DE DELEÇÃO */}
      {projetoParaDeletar && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '360px', borderColor: 'var(--color-danger)', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--color-danger-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={26} className="text-danger" />
              </div>
            </div>
            <h3 className="text-lg font-bold" style={{ textAlign: 'center', marginBottom: '8px' }}>Deletar "{projetoParaDeletar.nome}"?</h3>
            <p className="text-sm text-secondary" style={{ textAlign: 'center', marginBottom: '24px' }}>
              Essa ação é irreversível. Todas as despesas, acertos e a equipe desta produção serão apagados.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setProjetoParaDeletar(null)} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                Cancelar
              </button>
              <button onClick={confirmarDelecao} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}>
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CHANGELOG */}
      {mostrarChangelog && (
        <ChangelogModal onClose={() => setMostrarChangelog(false)} />
      )}
    </div>
  );
}
