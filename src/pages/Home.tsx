import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, TABELAS_SINCRONIZADAS } from '../db/db';
import type { Projeto } from '../types';
import { Search, Film, Trash2, Sparkles } from 'lucide-react';
import { FloatingActionMenu } from '../components/ui/FloatingActionMenu';
import { criarDepartamentosPadrao } from '../lib/creditos';
import { entrarComoFundador, purgarProjetoNoServidor } from '../lib/membros';
import { puxarProjetosCompartilhados } from '../lib/sincronizacaoAutomatica';
import { apagarAnexosDoProjeto } from '../lib/arquivos';
import { apagarPesquisaPublica } from '../lib/pesquisas';
import Stepper, { Step } from '../components/ui/Stepper';
import { CreepyButton } from '../components/ui/CreepyButton';
import { HelpButton } from '../components/HelpButton';
import { ChangelogModal } from '../components/ChangelogModal';
import { useAuth } from '../hooks/useAuth';
import { TituloSetProd } from '../components/ui/webgl/TituloSetProd';
import { FundoEntrada } from '../components/ui/webgl/FundoEntrada';
import { ContadorAnimado } from '../components/ui/ContadorAnimado';
import { MOLA, MOLA_GESTO, PASSO_STAGGER, useMovimentoReduzido } from '../components/ui/ia';
import { LogOut } from 'lucide-react';

export function Home() {
  const { logout } = useAuth();
  const reduzido = useMovimentoReduzido();
  const projetos = useLiveQuery(() => db.projetos.toArray());
  const aportesGlobais = useLiveQuery(() => db.aportes.toArray());
  const despesasGlobais = useLiveQuery(() => db.despesas.toArray());
  const navigate = useNavigate();

  const [modoDeletar, setModoDeletar] = useState(false);
  const [projetoParaDeletar, setProjetoParaDeletar] = useState<Projeto | null>(null);

  /**
   * Busca as produções que compartilharam comigo.
   *
   * É o que faz a Equipe B, que aceitou um convite e nunca teve o projeto neste
   * navegador, ver a produção aparecer aqui. Sem isto o convite daria acesso a
   * uma tela vazia.
   *
   * Não segura a tela: o que já está no aparelho aparece na hora, e o que vem
   * do servidor entra sozinho quando chega (o useLiveQuery redesenha).
   */
  useEffect(() => {
    void puxarProjetosCompartilhados();
  }, []);

  const [mostrarStepper, setMostrarStepper] = useState(false);
  const [mostrarChangelog, setMostrarChangelog] = useState(false);
  const [confirmarSaida, setConfirmarSaida] = useState(false);
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

    try {
      await db.projetos.add(projetoCriado);

      // O "Caixa da Produção" é um id fixo, global, e não uma pessoa: a lógica
      // de despesas usa 'caixa_central' como sentinela para "quem pagou foi a
      // produção".
      //
      // Por isso `put` e não `add`. Com `add`, criar o SEGUNDO projeto batia
      // numa chave repetida, a função morria aqui — e o modal ficava aberto
      // para sempre, sem erro na tela. Quem clicasse de novo criava outro
      // projeto pela metade.
      await db.perfis.put({
        id: 'caixa_central',
        projeto_id: id,
        nome: 'Caixa da Produção',
        funcao: 'Caixa'
      });

      // Departamentos básicos já saem criados — são a base dos Créditos e das despesas.
      await criarDepartamentosPadrao(id);
    } catch (e: any) {
      // Sem isto, qualquer falha aqui deixa a pessoa presa olhando um modal que
      // não fecha, com um projeto meio criado no banco.
      console.error('[SetProd] Falha ao criar a produção:', e);
      alert('Não consegui criar a produção: ' + (e?.message || e));
      return;
    }

    // Registra o fundador no servidor SEM segurar a tela.
    //
    // Com `await` aqui, criar projeto passaria a depender da internet: o modal
    // ficaria aberto esperando a resposta, e quem clicasse de novo acharia que
    // não pegou. Criar produção é trabalho local e tem que ser instantâneo.
    //
    // A participação é recuperável: `garantirParticipacao` roda de novo ao
    // abrir o projeto, e a fase 2 a exige antes de mandar qualquer dado.
    void entrarComoFundador(id, 'Equipe A');

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

    // Varre TODAS as tabelas do projeto, não só cinco.
    //
    // Antes daqui saíam apenas projeto, perfis, despesas, acertos,
    // departamentos e configuração — locações, diárias, cenas, tarefas,
    // documentos, roteiros e o resto ficavam órfãos no banco, invisíveis e
    // para sempre. Com o compartilhamento isso deixa de ser só desperdício:
    // linha órfã é linha que o sync mandaria para um projeto sem dono.
    for (const tabela of TABELAS_SINCRONIZADAS) {
      if (tabela === 'projetos') continue;
      await db.table(tabela).where('projeto_id').equals(id).delete().catch(() => {});
    }
    await db.notificacoes.where('projeto_id').equals(id).delete().catch(() => {});

    // As pesquisas saem do ar ANTES de sumirem daqui.
    //
    // Apagar só a linha local deixava o link de cada pesquisa vivo para quem o
    // tivesse — a produção acabava, e a enquete continuava recebendo respostas
    // num lugar que ninguém mais abria.
    const pesquisasDoProjeto = await db.pesquisas.where('projeto_id').equals(id).toArray();
    for (const p of pesquisasDoProjeto) {
      await apagarPesquisaPublica(p.id).catch(e =>
        console.warn('[SetProd] Link da pesquisa continua ativo:', p.titulo, e?.message)
      );
    }
    await db.pesquisas.where('projeto_id').equals(id).delete().catch(() => {});
    await db.respostas_pesquisa.where('projeto_id').equals(id).delete().catch(() => {});
    await db.configuracoes.delete(id);
    await db.projetos.delete(id);

    // Os anexos primeiro: quem apaga arquivo do Storage é o app, e depois de
    // purgar a participação eu já não teria permissão para isso.
    await apagarAnexosDoProjeto(id).catch(e =>
      console.warn('[SetProd] Anexos não foram apagados do servidor:', e?.message)
    );

    // E some do servidor também: a participação e o espelho não caem sozinhos
    // quando o projeto é apagado aqui. Sem isto sobram participações órfãs,
    // apontando para produções que já não existem.
    purgarProjetoNoServidor(id).catch(e =>
      console.warn('[SetProd] Projeto apagado aqui, mas não no servidor:', e?.message)
    );

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
      
      <FundoEntrada perigo={modoDeletar} />

      {/* HEADER — a barra de cima só tem a versão (esquerda) e as ações
          (direita); o título fica solto embaixo, sem nada disputando espaço. */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => setMostrarChangelog(true)}
          style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '6px 10px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Sparkles size={12} /> v4.2
        </button>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <HelpButton />
          {/* Confirmação na própria tela, não no confirm() do navegador.
              O Chrome oferece "não exibir mais caixas de diálogo" depois de
              alguns avisos seguidos; marcada essa opção, o confirm devolve
              false calado e o botão simplesmente não fazia nada. */}
          <button
            className="btn-icon"
            onClick={() => setConfirmarSaida(true)}
            title="Sair do app"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* O título é o protagonista da tela — e esconde o easter egg. */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Alinhado à esquerda, na mesma coluna do selo, da saudação, da busca
            e dos cards — centralizado ele ficava boiando fora da composição. */}
        <TituloSetProd tamanho={84} alinhamento="esquerda" perigo={modoDeletar} />
      </div>

      {/* Uma frase só. Antes eram dois rótulos de tamanhos muito diferentes
          (10px e 18px) alinhados pela base — o olho lia como duas coisas
          soltas, não como uma saudação. */}
      <h1 style={{
        display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap',
        margin: '0 0 20px', position: 'relative', zIndex: 1,
        fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)',
      }}>
        Bem-vindo,
        <span style={{ fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
          VIADÃO
        </span>
      </h1>

      {/* SEARCH */}
      <motion.div
        initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={MOLA}
        style={{ position: 'relative', marginBottom: '32px', zIndex: 1 }}
      >
        <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Buscar produções..." 
          value={termoBusca}
          onChange={(e) => setTermoBusca(e.target.value)}
          style={{ paddingLeft: '44px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}
        />
      </motion.div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
        <h2 className="text-xs text-secondary font-bold uppercase tracking-widest">Produções Recentes</h2>
        <span className="text-accent text-sm font-bold">Ver todas</span>
      </div>

      {/* PROJECT LIST */}
      {/* zIndex acima do fundo animado, que é fixo e cobre a tela toda. */}
      <div className="home-projects" style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1 }}>
        {projetosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: 'var(--bg-surface)', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
            <Film size={40} style={{ margin: '0 auto 16px', color: 'var(--text-muted)' }} />
            <p className="text-secondary">Nenhuma produção encontrada.</p>
          </div>
        ) : (
          projetosFiltrados.map((projeto, indice) => (
            <motion.div
              key={projeto.id}
              className="card"
              onClick={() => !modoDeletar && navigate(`/projeto/${projeto.id}`)}
              // Entrada escalonada: os cards chegam um atrás do outro, para o
              // olho percorrer a lista em vez de receber um bloco pronto.
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...MOLA, delay: reduzido ? 0 : indice * PASSO_STAGGER }}
              // No modo de apagar o card não levanta no hover: elevação convida
              // a entrar, e entrar é justamente o que ele deixou de fazer.
              whileHover={reduzido || modoDeletar ? undefined : { y: -4, transition: MOLA_GESTO }}
              whileTap={reduzido ? undefined : { scale: 0.99, transition: MOLA_GESTO }}
              style={{
                cursor: modoDeletar ? 'default' : 'pointer',
                position: 'relative',
                // Contorno vermelho grosso enquanto o modo está ligado: o card
                // some quando clicado, e ação sem volta precisa de aviso antes.
                outline: modoDeletar ? '2px solid var(--color-danger)' : '2px solid transparent',
                outlineOffset: '2px',
                transition: 'outline-color 0.18s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <span className="badge" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>ATIVO</span>
                {modoDeletar ? (
                  <motion.button
                    onClick={(e) => { e.stopPropagation(); setProjetoParaDeletar(projeto); }}
                    initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={reduzido ? undefined : { scale: 0.9, transition: MOLA_GESTO }}
                    transition={MOLA}
                    title="Apagar esta produção"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '34px', height: '34px', flexShrink: 0,
                      borderRadius: '10px', border: '1px solid var(--color-danger)',
                      backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                      cursor: 'pointer', padding: 0,
                    }}
                  >
                    <Trash2 size={18} />
                  </motion.button>
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
                  <ContadorAnimado
                    prefixo="R$ "
                    valor={
                      (aportesGlobais?.filter(a => a.projeto_id === projeto.id).reduce((acc, a) => acc + a.valor, 0) || 0) -
                      (despesasGlobais?.filter(d => d.projeto_id === projeto.id).reduce((acc, d) => acc + d.valor_total, 0) || 0)
                    }
                  />
                </div>
              </div>
            </motion.div>
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
          <div style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
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

      {/* SAIR DO APP */}
      {confirmarSaida && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '340px', backgroundColor: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut size={24} className="text-secondary" />
              </div>
            </div>
            <h3 className="text-lg font-bold" style={{ textAlign: 'center', marginBottom: '8px' }}>Sair do SetProd?</h3>
            <p className="text-sm text-secondary" style={{ textAlign: 'center', marginBottom: '24px' }}>
              Seus projetos ficam salvos neste aparelho. É só entrar de novo.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setConfirmarSaida(false)}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              >
                Ficar
              </button>
              <button onClick={() => logout()} className="btn-primary" style={{ flex: 1 }}>
                Sair
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
