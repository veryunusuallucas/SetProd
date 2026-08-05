import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2, GripVertical, Settings2, X, CloudUpload, CloudOff, Check, RefreshCw } from 'lucide-react';
import type { CampoCustomizado, TipoCampo } from '../types';
import { CAMPOS_PADRAO, CAMPOS_SEMPRE_OBRIGATORIOS, ROTULO_GRUPO } from '../lib/camposFicha';
import { publicarFichaPublica } from '../lib/sync';

/**
 * Recebe o ID e lê o projeto ao vivo — antes recebia o objeto por prop, e como o
 * painel lateral guarda o elemento React em estado, o retrato do projeto ficava
 * congelado: cada alteração era gravada por cima de uma lista desatualizada e só
 * "aparecia" ao fechar e reabrir o construtor.
 */
export function FormBuilder({ projetoId, onClose }: { projetoId: string, onClose?: () => void }) {
  const [novoCampo, setNovoCampo] = useState('');
  const [novoTipo, setNovoTipo] = useState<TipoCampo>('texto');

  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);

  const campos = projeto?.campos_customizados || [];
  const obrigatorios = projeto?.campos_obrigatorios || [];

  /**
   * O link público roda no navegador de outra pessoa e só enxerga o Supabase.
   * Toda mudança aqui é publicada lá, senão o formulário enviado continuaria
   * com os campos antigos.
   */
  const [statusPub, setStatusPub] = useState<'idle' | 'publicando' | 'ok' | 'erro'>('idle');
  const [erroPub, setErroPub] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publicar = async () => {
    setStatusPub('publicando');
    try {
      await publicarFichaPublica(projetoId);
      setStatusPub('ok');
      setErroPub('');
    } catch (e: any) {
      setStatusPub('erro');
      setErroPub(e?.message || 'Falha ao publicar.');
    }
  };

  const assinatura = JSON.stringify([campos, obrigatorios]);
  useEffect(() => {
    if (!projeto) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(publicar, 800);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, !!projeto]);

  // Parte dos campos que já existem no app (§6.2) — mesma fonte usada pela ficha,
  // pelo link público e pela importação.
  const camposFixos = CAMPOS_PADRAO;

  const toggleObrigatorioFixo = async (id: string) => {
    if (CAMPOS_SEMPRE_OBRIGATORIOS.includes(id)) return; // nome é sempre exigido
    const novos = obrigatorios.includes(id)
      ? obrigatorios.filter(i => i !== id)
      : [...obrigatorios, id];
    await db.projetos.update(projetoId, { campos_obrigatorios: novos });
  };

  const adicionarCampo = async () => {
    if (!novoCampo.trim()) return;
    const campo: CampoCustomizado = {
      id: crypto.randomUUID(),
      nome: novoCampo.trim(),
      tipo: novoTipo,
      obrigatorio: false,
      opcoes: novoTipo === 'selecao' ? ['Opção 1'] : undefined
    };
    await db.projetos.update(projetoId, {
      campos_customizados: [...campos, campo]
    });
    setNovoCampo('');
  };

  const atualizarCampo = async (id: string, updates: Partial<CampoCustomizado>) => {
    const novos = campos.map(c => c.id === id ? { ...c, ...updates } : c);
    await db.projetos.update(projetoId, { campos_customizados: novos });
  };

  const removerCampo = async (id: string, nome: string) => {
    if (confirm(`Tem certeza que deseja remover o campo "${nome}"? Os dados preenchidos pela equipe continuarão salvos, mas não serão mais exibidos.`)) {
      const novos = campos.filter(c => c.id !== id);
      await db.projetos.update(projetoId, { campos_customizados: novos });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-surface)' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="font-bold text-lg" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings2 size={18} /> Construtor de Ficha
          </h2>
          <p className="text-xs text-secondary mt-1">Defina os campos da ficha de equipe e do formulário de cadastro.</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-icon text-muted" style={{ padding: '4px' }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Estado da publicação para o link público */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
        backgroundColor: statusPub === 'erro' ? 'rgba(239,68,68,0.08)' : 'var(--bg-primary)',
      }}>
        {statusPub === 'publicando' && <><RefreshCw size={13} className="spinning text-muted" /><span className="text-xs text-muted">Publicando para o link...</span></>}
        {statusPub === 'ok' && <><Check size={13} className="text-success" /><span className="text-xs text-muted">Ficha publicada — quem abrir o link já vê estes campos.</span></>}
        {statusPub === 'idle' && <><CloudUpload size={13} className="text-muted" /><span className="text-xs text-muted">As alterações são publicadas automaticamente no link.</span></>}
        {statusPub === 'erro' && (
          <>
            <CloudOff size={13} className="text-danger" />
            <span className="text-xs text-danger" style={{ flex: 1, minWidth: '160px' }}>
              Não publicou: {erroPub} O link público continuará com os campos antigos.
            </span>
            <button onClick={publicar} className="btn-icon" style={{ padding: '4px 10px', border: '1px solid var(--border-light)', fontSize: '11px' }}>
              Tentar de novo
            </button>
          </>
        )}
      </div>

      <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Lista de Campos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          <div className="text-xs font-bold text-muted uppercase tracking-widest mb-1 mt-2">Campos Padrão do Sistema</div>
          <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>
            Marcar como obrigatório bloqueia o cadastro (aqui e no link público) enquanto o campo estiver vazio.
          </div>

          {camposFixos.map((campo) => {
            const sempre = CAMPOS_SEMPRE_OBRIGATORIOS.includes(campo.id);
            return (
              <div key={campo.id} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{campo.nome}</div>
                  <div className="text-xs text-muted">{ROTULO_GRUPO[campo.grupo]}</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: sempre ? 'not-allowed' : 'pointer', opacity: sempre ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={sempre || obrigatorios.includes(campo.id)}
                    disabled={sempre}
                    onChange={() => toggleObrigatorioFixo(campo.id)}
                  />
                  Obrigatório
                </label>
              </div>
            );
          })}

          <div className="text-xs font-bold text-muted uppercase tracking-widest mb-1 mt-4">Campos Personalizados</div>
          {campos.map((campo) => (
            <div key={campo.id} style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <GripVertical size={14} className="text-muted" style={{ cursor: 'grab' }} />
                  <input 
                    value={campo.nome} 
                    onChange={e => atualizarCampo(campo.id, { nome: e.target.value })}
                    style={{ fontWeight: 'bold', border: 'none', background: 'transparent', flex: 1, fontSize: '14px', padding: '2px 4px' }}
                  />
                </div>
                <button onClick={() => removerCampo(campo.id, campo.nome)} className="btn-icon text-danger" style={{ padding: '4px' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', paddingLeft: '22px', flexWrap: 'wrap' }}>
                <select 
                  value={campo.tipo} 
                  onChange={e => atualizarCampo(campo.id, { tipo: e.target.value as TipoCampo, opcoes: e.target.value === 'selecao' ? ['Opção 1'] : undefined })}
                  style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                >
                  <option value="texto">Texto Curto</option>
                  <option value="numero">Número</option>
                  <option value="valor">Dinheiro (R$)</option>
                  <option value="data">Data</option>
                  <option value="telefone">Telefone</option>
                  <option value="selecao">Seleção Múltipla</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={campo.obrigatorio || false} 
                    onChange={e => atualizarCampo(campo.id, { obrigatorio: e.target.checked })}
                  />
                  Obrigatório
                </label>
              </div>

              {campo.tipo === 'selecao' && (
                <div style={{ paddingLeft: '22px', marginTop: '4px' }}>
                  <div className="text-xs text-muted mb-1">Opções (separadas por vírgula):</div>
                  <input 
                    value={(campo.opcoes || []).join(', ')} 
                    onChange={e => atualizarCampo(campo.id, { opcoes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Ex: P, M, G, GG"
                    style={{ width: '100%', fontSize: '12px', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}
                  />
                </div>
              )}
            </div>
          ))}
          {campos.length === 0 && (
            <div className="text-center text-muted text-sm py-4">
              Nenhum campo customizado ainda.
            </div>
          )}
        </div>

        {/* Adicionar Novo */}
        <div style={{ marginTop: 'auto', borderTop: '1px dashed var(--border-color)', paddingTop: '16px' }}>
          <div className="text-sm font-bold mb-2">Adicionar Novo Campo</div>
          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <input 
              placeholder="Nome do campo (ex: Tamanho da Camiseta)" 
              value={novoCampo}
              onChange={e => setNovoCampo(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <select 
                value={novoTipo}
                onChange={e => setNovoTipo(e.target.value as TipoCampo)}
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', flex: 1, backgroundColor: 'var(--bg-primary)' }}
              >
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="valor">R$</option>
                <option value="data">Data</option>
                <option value="telefone">Telefone</option>
                <option value="selecao">Seleção (Dropdown)</option>
              </select>
              <button onClick={adicionarCampo} className="btn-primary" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Plus size={16} /> Add
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
