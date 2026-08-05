import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2, Link2, UserPlus, Users, LayoutGrid } from 'lucide-react';
import type { Projeto, Departamento } from '../types';
import {
  DEPARTAMENTOS_PADRAO,
  criarDepartamentosPadrao,
  linhasDoDepartamento,
  salvarCredito,
  removerCredito,
  ordenarCandidatos,
  normalizar,
} from '../lib/creditos';

const VALOR_LIVRE = '__livre__';

/**
 * Ficha de créditos organizada por departamento (padrão da indústria).
 * Cada departamento traz suas funções principais — chefe primeiro, depois assistentes —
 * e permite acrescentar outras. Ao vincular um membro da equipe a uma função, o
 * cadastro dele passa a refletir aquele departamento e aquela função.
 */
export function CreditosPorDepartamento({ projeto }: { projeto: Projeto }) {
  const departamentos = useLiveQuery(
    () => db.departamentos.where('projeto_id').equals(projeto.id).toArray(),
    [projeto.id]
  ) || [];
  const perfis = useLiveQuery(
    () => db.perfis.where('projeto_id').equals(projeto.id).toArray(),
    [projeto.id]
  ) || [];

  // Formulário de "adicionar outra função", por departamento
  const [novaFuncao, setNovaFuncao] = useState<Record<string, string>>({});
  // Linhas em que o usuário optou por digitar um nome em vez de escolher da equipe
  const [modoLivre, setModoLivre] = useState<Set<string>>(new Set());
  const [criandoDeptos, setCriandoDeptos] = useState(false);

  const creditos = projeto.creditos || [];

  // Departamentos na ordem do catálogo; os criados pelo usuário vão para o fim.
  const ordemCatalogo = (d: Departamento) => {
    const i = DEPARTAMENTOS_PADRAO.findIndex(x => normalizar(x.nome) === normalizar(d.nome));
    return i === -1 ? 999 : i;
  };
  const ordenados = [...departamentos].sort((a, b) => ordemCatalogo(a) - ordemCatalogo(b) || a.nome.localeCompare(b.nome));

  const faltamPadrao = DEPARTAMENTOS_PADRAO.some(
    p => !departamentos.some(d => normalizar(d.nome) === normalizar(p.nome))
  );

  const gerarPadrao = async () => {
    setCriandoDeptos(true);
    try {
      const criados = await criarDepartamentosPadrao(projeto.id);
      if (criados === 0) alert('Todos os departamentos padrão já existem neste projeto.');
    } finally {
      setCriandoDeptos(false);
    }
  };

  const atribuir = async (departamentoId: string, papel: string, valor: string, creditoExistente?: any) => {
    const chaveLinha = `${departamentoId}::${papel}`;

    if (valor === '') {
      // Voltou para "vazio": remove o crédito, se existir
      if (creditoExistente) await removerCredito(projeto, creditoExistente.id);
      setModoLivre(s => { const n = new Set(s); n.delete(chaveLinha); return n; });
      return;
    }

    if (valor === VALOR_LIVRE) {
      setModoLivre(s => new Set(s).add(chaveLinha));
      return;
    }

    setModoLivre(s => { const n = new Set(s); n.delete(chaveLinha); return n; });
    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      perfilId: valor,
      creditoExistente,
    });
  };

  const salvarNomeLivre = async (departamentoId: string, papel: string, nome: string, creditoExistente?: any) => {
    if (!nome.trim()) {
      if (creditoExistente) await removerCredito(projeto, creditoExistente.id);
      return;
    }
    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      nomeLivre: nome,
      creditoExistente,
      sincronizarPerfil: false,
    });
  };

  const adicionarFuncao = async (departamentoId: string) => {
    const papel = (novaFuncao[departamentoId] || '').trim();
    if (!papel) return;

    const jaExiste = creditos.some(
      c => c.departamento_id === departamentoId && normalizar(c.papel) === normalizar(papel)
    );
    if (jaExiste) {
      alert(`A função "${papel}" já existe neste departamento.`);
      return;
    }

    // Cria a linha com um marcador; o usuário escolhe quem ocupa em seguida.
    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      nomeLivre: 'A definir',
      sincronizarPerfil: false,
    });
    setNovaFuncao({ ...novaFuncao, [departamentoId]: '' });
  };

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-surface)', fontSize: '13px', minWidth: 0, width: '100%',
  };

  if (departamentos.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <LayoutGrid size={40} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <h3 className="font-bold mb-2">Nenhum departamento ainda</h3>
        <p className="text-sm text-secondary" style={{ marginBottom: '20px' }}>
          Os créditos são organizados por departamento. Crie os departamentos básicos do
          audiovisual para começar — depois é só preencher quem ocupa cada função.
        </p>
        <button onClick={gerarPadrao} disabled={criandoDeptos} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> {criandoDeptos ? 'Criando...' : 'Criar departamentos padrão'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Users size={18} className="text-accent" />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div className="text-sm font-bold">Ficha de créditos</div>
          <div className="text-xs text-muted">
            Vincular um membro da equipe atualiza o departamento e a função dele no cadastro.
          </div>
        </div>
        {faltamPadrao && (
          <button onClick={gerarPadrao} disabled={criandoDeptos} className="btn-icon" style={{ padding: '8px 14px', border: '1px solid var(--border-light)', gap: '6px', fontSize: '12px' }}>
            <Plus size={14} /> {criandoDeptos ? 'Criando...' : 'Completar departamentos padrão'}
          </button>
        )}
      </div>

      {ordenados.map(depto => {
        const linhas = linhasDoDepartamento(depto, creditos);
        const preenchidas = linhas.filter(l => l.credito).length;
        const candidatos = ordenarCandidatos(perfis, depto.id);

        return (
          <div key={depto.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${depto.cor || 'var(--accent)'}` }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <h3 className="font-bold" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: depto.cor || 'var(--accent)' }} />
                {depto.nome}
              </h3>
              <span className="text-xs text-muted">{preenchidas} de {linhas.length} preenchidas</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {linhas.map((linha, idx) => {
                const chaveLinha = `${depto.id}::${linha.papel}`;
                const credito = linha.credito;
                const ehChefe = linha.doCatalogo && idx === 0;
                const livre = modoLivre.has(chaveLinha) || (!!credito && !credito.perfil_id);

                return (
                  <div
                    key={linha.chave}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1.4fr) auto',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {linha.papel}
                        {ehChefe && (
                          <span className="text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1px 8px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            chefia
                          </span>
                        )}
                      </div>
                      {credito?.perfil_id && (
                        <div className="text-xs text-accent" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Link2 size={11} /> vinculado à equipe
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <select
                        value={credito?.perfil_id || (livre ? VALOR_LIVRE : '')}
                        onChange={e => atribuir(depto.id, linha.papel, e.target.value, credito)}
                        style={selectStyle}
                      >
                        <option value="">— vazio —</option>
                        {candidatos.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nome} {p.sobrenome || ''}
                            {p.departamento_id === depto.id ? ' ✓' : ''}
                          </option>
                        ))}
                        <option value={VALOR_LIVRE}>Outro (digitar nome)</option>
                      </select>

                      {livre && (
                        <input
                          defaultValue={credito?.nome === 'A definir' ? '' : credito?.nome || ''}
                          onBlur={e => salvarNomeLivre(depto.id, linha.papel, e.target.value, credito)}
                          placeholder="Nome de quem ocupa a função"
                          style={{ ...selectStyle, backgroundColor: 'var(--bg-primary)' }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {credito ? (
                        <button
                          onClick={() => removerCredito(projeto, credito.id)}
                          className="btn-icon text-muted"
                          style={{ padding: '6px' }}
                          title="Limpar esta função"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <UserPlus size={14} className="text-muted" style={{ opacity: 0.4 }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Adicionar outra função neste departamento */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px dashed var(--border-light)', paddingTop: '12px' }}>
              <input
                value={novaFuncao[depto.id] || ''}
                onChange={e => setNovaFuncao({ ...novaFuncao, [depto.id]: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') adicionarFuncao(depto.id); }}
                placeholder={`Outra função em ${depto.nome}...`}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', fontSize: '13px' }}
              />
              <button
                onClick={() => adicionarFuncao(depto.id)}
                className="btn-icon"
                style={{ padding: '8px 14px', border: '1px solid var(--border-color)', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
