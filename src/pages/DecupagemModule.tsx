import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useParams } from 'react-router-dom';
import { Camera, Clapperboard, Plus, Trash2, ChevronDown, ChevronUp, GripVertical, FileDown, CalendarPlus, X } from 'lucide-react';
import type { Cena, Plano } from '../types';

import { AnexoInput } from '../components/AnexoInput';
import { ImagemAnexo } from '../components/ImagemAnexo';
import { BreakdownModule } from './BreakdownModule';
import { ElementosManager } from '../components/ElementosManager';
import { StripboardTimeline } from '../components/StripboardTimeline';
import { RelatoriosModal } from '../components/RelatoriosModal';
import { sincronizarElementos } from '../lib/elementos';
import { registrarDocumento } from '../lib/documentos';
import { acharLocacao, oitavosParaPaginas, paginasParaOitavos, registrarCategoriasExtras } from '../lib/decupagem';

export function DecupagemModule() {
  const { id: projetoId } = useParams<{ id: string }>();
  const [expandida, setExpandida] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'roteiro' | 'shotlist' | 'stripboard' | 'storyboard' | 'elementos'>('roteiro');

  // Envio da ordem de filmagem para uma diária
  const [modalDiaria, setModalDiaria] = useState(false);
  const [exportAberto, setExportAberto] = useState(false);

  /** Cenas escolhidas por "Virar OD" numa quebra; null = a ordem inteira. */
  const [cenasParaExportar, setCenasParaExportar] = useState<Cena[] | null>(null);
  /** Página que o Roteiro deve abrir ao clicar numa tira. */
  const [paginaAlvo, setPaginaAlvo] = useState<number | null>(null);

  const projeto = useLiveQuery(() => db.projetos.get(projetoId!), [projetoId]);
  const itensStrip = useLiveQuery(
    () => db.stripboard_itens.where('projeto_id').equals(projetoId!).toArray(), [projetoId]
  ) || [];
  const tags = useLiveQuery(
    () => db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray(), [projetoId]
  );
  const elementos = useLiveQuery(
    () => db.elementos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]
  );
  const locacoes = useLiveQuery(() => db.locacoes.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);
  const cenas = useLiveQuery(() => db.cenas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);
  const planos = useLiveQuery(() => db.planos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]);
  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  /**
   * Adota as marcações gravadas antes do inventário existir e mantém as
   * categorias do projeto disponíveis para o destaque no PDF.
   *
   * Roda uma vez por projeto: `sincronizarElementos` é idempotente, então
   * reabrir a decupagem não duplica nada.
   */
  useEffect(() => {
    if (!projetoId) return;
    registrarCategoriasExtras(projeto?.categorias_extras);
    sincronizarElementos(projetoId).catch(e =>
      console.warn('[SetProd] Falha ao sincronizar o inventário de elementos', e)
    );
  }, [projetoId, projeto?.categorias_extras]);

  /**
   * Vincula sozinha a cena à locação cadastrada que corresponde ao cabeçalho.
   *
   * As cenas vindas do roteiro já trazem o lugar no nome ("QUARTO DA CASA DE
   * MARCOS, BELVEDERE"), então pedir para escolher de novo numa lista era
   * digitar duas vezes a mesma informação.
   */
  useEffect(() => {
    if (!cenas || !locacoes || locacoes.length === 0) return;

    const pendentes = cenas.filter(c => !c.locacao_id && c.descricao?.trim());
    if (pendentes.length === 0) return;

    (async () => {
      for (const c of pendentes) {
        const achada = acharLocacao(c.descricao, locacoes);
        if (achada) await db.cenas.update(c.id, { locacao_id: achada.id });
      }
    })();
  }, [cenas, locacoes]);

  /** Cria a locação a partir do cabeçalho da cena e já deixa vinculada. */
  const criarLocacaoDaCena = async (cena: Cena) => {
    const nome = cena.descricao.trim();
    if (!nome) return;
    const id = crypto.randomUUID();
    await db.locacoes.add({ id, projeto_id: projetoId!, nome, endereco: '' });
    await db.cenas.update(cena.id, { locacao_id: id });
  };

  if (!cenas || !planos || !locacoes) return <div style={{ padding: '24px' }}>Carregando decupagem...</div>;

  // Ordem de filmagem: usa `ordem` quando definida no stripboard; senão, o número da cena.
  const chaveOrdem = (c: Cena) =>
    c.ordem !== undefined ? c.ordem : (parseInt(c.numero.replace(/\D/g, '')) || 0);
  const cenasOrdenadas = [...cenas].sort((a, b) => chaveOrdem(a) - chaveOrdem(b));

  /**
   * Manda cenas para uma diária (v4 §2.4/§2.6).
   *
   * Sem seleção, vai a ordem inteira. Com o botão "Virar OD" de uma quebra,
   * vão só as cenas daquele dia — que é o ponto de ter quebras: cada bloco do
   * stripboard vira uma Ordem do Dia.
   */
  const enviarParaDiaria = async (diariaId: string) => {
    const diaria = diarias.find(d => d.id === diariaId);
    if (!diaria) return;

    const escolhidas = cenasParaExportar ?? cenasOrdenadas;
    const atuais = diaria.cena_ids || [];
    const novos = escolhidas.map(c => c.id).filter(id => !atuais.includes(id));

    await db.diarias.update(diariaId, { cena_ids: [...atuais, ...novos] });
    setModalDiaria(false);
    setCenasParaExportar(null);
    alert(
      novos.length > 0
        ? `${novos.length} cena(s) adicionadas à Diária ${diaria.numero}, na ordem do stripboard.`
        : 'Essa diária já tinha todas as cenas.'
    );
  };

  /** Primeira página do roteiro em que a cena aparece, para o "ver no roteiro". */
  const paginaDaCena = (cena: Cena): number | undefined => {
    const daCena = (tags || []).filter(t => t.cena_id === cena.id).map(t => t.pagina);
    return daCena.length ? Math.min(...daCena) : undefined;
  };

  /**
   * Soma as páginas em oitavos (padrão da indústria).
   * A versão anterior exigia espaço depois do número inteiro, então uma cena
   * marcada só como "2" era ignorada na conta.
   */
  const totalPaginas = () =>
    oitavosParaPaginas(cenas.reduce((soma, c) => soma + paginasParaOitavos(c.paginas), 0));

  const addCena = async () => {
    const novaCena: Cena = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      numero: String(cenas.length + 1),
      descricao: 'Nova cena...',
      ambiente: 'ext',
      periodo: 'dia'
    };
    await db.cenas.add(novaCena);
  };

  const updateCena = async (id: string, updates: Partial<Cena>) => {
    await db.cenas.update(id, updates);
  };

  const removeCena = async (id: string) => {
    if (!window.confirm("Deseja realmente apagar esta cena e todos os seus planos?")) return;
    await db.cenas.delete(id);
    const planosDaCena = planos.filter(p => p.cena_id === id);
    for (const p of planosDaCena) {
      await db.planos.delete(p.id);
    }
  };

  const handleAddAnexo = async (cena: Cena, url: string, nome?: string) => {
    const novosAnexos = [...(cena.anexos || []), url];
    await updateCena(cena.id, { anexos: novosAnexos });
    // Índice central: a referência de storyboard também aparece em Documentos.
    await registrarDocumento({
      projetoId: projetoId!,
      origem: 'storyboard',
      refId: `${cena.id}:${novosAnexos.length - 1}`,
      nome: nome || `Cena ${cena.numero} — referência ${novosAnexos.length}`,
      url,
      previewUrl: url,
    });
  };

  const removerAnexo = async (cena: Cena, index: number) => {
    if (!confirm('Remover esta referência?')) return;
    const novosAnexos = (cena.anexos || []).filter((_, i) => i !== index);
    await updateCena(cena.id, { anexos: novosAnexos });
  };

  const addPlano = async (cenaId: string) => {
    const planosDaCena = planos.filter(p => p.cena_id === cenaId);
    const novoPlano: Plano = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      cena_id: cenaId,
      numero: String(planosDaCena.length + 1),
      descricao: '',
    };
    await db.planos.add(novoPlano);
    setExpandida(novoPlano.id);
  };

  const updatePlano = async (id: string, updates: Partial<Plano>) => {
    await db.planos.update(id, updates);
  };

  const removePlano = async (id: string) => {
    await db.planos.delete(id);
  };

  const selectStyle = { padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', fontSize: '13px', color: 'var(--text-primary)' };

  return (
    <div style={{ paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clapperboard size={20} /> Decupagem Geral
        </h2>
        
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {([
            ['roteiro', 'Roteiro'],
            ['shotlist', 'Master Shot List'],
            ['stripboard', 'Stripboard'],
            ['storyboard', 'Storyboard'],
            ['elementos', 'Elementos'],
          ] as const).map(([modo, rotulo]) => (
            <button
              key={modo}
              onClick={() => setViewMode(modo)}
              style={{
                position: 'relative', padding: '8px 16px', borderRadius: '10px', border: 'none',
                background: 'transparent', color: viewMode === modo ? '#000' : 'var(--text-primary)',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              }}
            >
              {viewMode === modo && (
                <motion.span
                  layoutId="aba-decupagem"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  style={{ position: 'absolute', inset: 0, borderRadius: '10px', backgroundColor: 'var(--accent)', zIndex: 0 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{rotulo}</span>
            </button>
          ))}
        </div>

        {viewMode !== 'roteiro' && viewMode !== 'elementos' && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => setExportAberto(true)} className="btn-chip">
              <FileDown size={16} /> <span className="font-bold text-sm">Exportar</span>
            </button>
            <button onClick={addCena} className="btn-chip">
              <Plus size={16} /> <span className="font-bold text-sm">Cena</span>
            </button>
          </div>
        )}
      </div>

      {viewMode === 'roteiro' && (
        <BreakdownModule
          paginaAlvo={paginaAlvo}
          onPaginaAtendida={() => setPaginaAlvo(null)}
        />
      )}
      {viewMode === 'elementos' && <ElementosManager projetoId={projetoId!} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {viewMode !== 'roteiro' && viewMode !== 'elementos' && cenasOrdenadas.length === 0 && (
          <div className="card text-muted text-center" style={{ padding: '40px 16px' }}>
            Nenhuma cena ainda. Crie na mão ou envie o roteiro na aba <strong>Roteiro</strong> e deixe a IA separar.
          </div>
        )}

        {viewMode === 'stripboard' && (
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
              <div className="text-xs text-muted">
                Arraste as tiras para definir a ordem · <strong>{totalPaginas()}</strong> páginas no total
              </div>
              <button
                onClick={() => { setCenasParaExportar(null); setModalDiaria(true); }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
                disabled={cenasOrdenadas.length === 0}
              >
                <CalendarPlus size={16} /> Enviar tudo para uma diária
              </button>
            </div>

            <StripboardTimeline
              projetoId={projetoId!}
              cenas={cenas}
              itens={itensStrip}
              locacoes={locacoes}
              paginaDaCena={paginaDaCena}
              onVerNoRoteiro={pagina => { setPaginaAlvo(pagina); setViewMode('roteiro'); }}
              onExportarDia={(lista) => { setCenasParaExportar(lista); setModalDiaria(true); }}
            />
          </div>
        )}

        {viewMode === 'storyboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="text-xs text-muted">
              Anexe imagens de referência por cena — upload local ou link do Drive. Elas também aparecem em Documentos.
            </div>

            {/* Grade: um card por linha deixava a maior parte da largura vazia,
                porque a cena sem referência ocupa poucas linhas de altura. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', alignItems: 'start' }}>
            {cenasOrdenadas.map(cena => (
              <div key={cena.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div className="font-bold">Cena {cena.numero} — {cena.descricao}</div>
                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase' }}>{cena.ambiente} · {cena.periodo}</div>
                  </div>
                  <AnexoInput
                    projetoId={projetoId}
                    accept="image/*"
                    label="Referência"
                    onAddLink={() => {}}
                    onAddAnexo={info => handleAddAnexo(cena, info.url, info.nome)}
                  />
                </div>

                {(cena.anexos || []).length === 0 ? (
                  <div className="text-sm text-muted">Nenhuma referência anexada.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                    {(cena.anexos || []).map((url, i) => (
                      <div key={i} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}>
                        <ImagemAnexo
                          valor={url}
                          alt={`Referência ${i + 1} da cena ${cena.numero}`}
                          estiloLink={{ display: 'block', height: '110px' }}
                        />
                        <button
                          onClick={() => removerAnexo(cena, i)}
                          className="btn-icon"
                          style={{ position: 'absolute', top: '4px', right: '4px', padding: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none' }}
                          title="Remover referência"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        )}

        {viewMode === 'shotlist' && cenasOrdenadas.map(cena => {
          const planosDaCena = planos.filter(p => p.cena_id === cena.id).sort((a, b) => parseInt(a.numero) - parseInt(b.numero));
          
          return (
            <div key={cena.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
              {/* Header da Cena */}
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <input 
                    value={cena.numero} 
                    onChange={e => updateCena(cena.id, { numero: e.target.value })} 
                    style={{ width: '48px', fontWeight: 'bold', textAlign: 'center', padding: '6px', fontSize: '16px' }}
                    placeholder="Nº"
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input 
                    value={cena.descricao} 
                    onChange={e => updateCena(cena.id, { descricao: e.target.value })} 
                    style={{ fontWeight: 'bold', fontSize: '18px', border: 'none', background: 'transparent', padding: 0 }}
                    placeholder="Descrição da cena (ex: Assalto no banco)..."
                  />
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <select value={cena.ambiente || 'ext'} onChange={e => updateCena(cena.id, { ambiente: e.target.value as any })} style={selectStyle}>
                      <option value="int">INT.</option>
                      <option value="ext">EXT.</option>
                    </select>
                    <select
                      value={cena.locacao_id || ''}
                      onChange={e => {
                        if (e.target.value === '__criar__') criarLocacaoDaCena(cena);
                        else updateCena(cena.id, { locacao_id: e.target.value });
                      }}
                      style={selectStyle}
                    >
                      <option value="">(Sem Locação definida)</option>
                      {/* Nada cadastrado bate com o cabeçalho: em vez de deixar
                          a pessoa travada, oferece cadastrar com esse nome. */}
                      {!cena.locacao_id && cena.descricao.trim() && (
                        <option value="__criar__">+ Cadastrar "{cena.descricao.trim()}"</option>
                      )}
                      {locacoes.map(l => (
                        <option key={l.id} value={l.id}>{l.nome}</option>
                      ))}
                    </select>
                    <select value={cena.periodo || 'dia'} onChange={e => updateCena(cena.id, { periodo: e.target.value as any })} style={selectStyle}>
                      <option value="dia">DIA</option>
                      <option value="noite">NOITE</option>
                    </select>
                  </div>
                  
                  {/* Storyboard Anexos */}
                  {cena.anexos && cena.anexos.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                      {cena.anexos.map((url, i) => (
                        <ImagemAnexo
                          key={i}
                          valor={url}
                          alt={`Storyboard ${i}`}
                          estiloLink={{ display: 'block', width: '60px', height: '60px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}
                        />
                      ))}
                    </div>
                  )}
                  
                </div>
                {/* O botão de IA que existia aqui mandava só o TÍTULO da cena
                    para o modelo e despejava o resultado em Tasks — não era o
                    breakdown de ninguém. A análise de verdade acontece na aba
                    Roteiro, cena a cena e com o texto da cena. */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <AnexoInput projetoId={projetoId} onAddLink={(url) => handleAddAnexo(cena, url)} />
                  <button onClick={() => removeCena(cena.id)} className="btn-icon text-muted hover-danger" style={{ padding: '8px', border: 'none', background: 'transparent' }} title="Excluir Cena"><Trash2 size={18} /></button>
                </div>
              </div>

              {/* Lista de Planos */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {planosDaCena.map((plano, index) => {
                  const isExpanded = expandida === plano.id;
                  return (
                    <div key={plano.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <GripVertical size={16} className="text-muted" style={{ cursor: 'grab' }} />
                        <span className="text-secondary font-bold text-xs" style={{ width: '20px' }}>{(index+1).toString().padStart(2, '0')}</span>
                        
                        <input 
                          value={plano.descricao} 
                          onChange={e => updatePlano(plano.id, { descricao: e.target.value })} 
                          style={{ flex: 1, padding: '8px', fontSize: '14px', backgroundColor: 'transparent', border: '1px solid var(--border-light)' }}
                          placeholder="Ação neste plano..."
                        />
                        <button onClick={() => setExpandida(isExpanded ? null : plano.id)} className="btn-icon" style={{ padding: '8px', border: 'none', background: 'transparent' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                        <button onClick={() => removePlano(plano.id)} className="btn-icon text-muted" style={{ padding: '8px', border: 'none', background: 'transparent' }}><Trash2 size={16} /></button>
                      </div>

                      {isExpanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px', paddingLeft: '40px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Tamanho</span>
                            <select value={plano.tamanho || ''} onChange={e => updatePlano(plano.id, { tamanho: e.target.value })} style={selectStyle}>
                              <option value="">-</option>
                              <option value="Wide">Wide (Aberto)</option>
                              <option value="Medium">Medium (Médio)</option>
                              <option value="Close">Close</option>
                              <option value="Detail">Detail (Detalhe)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Ângulo</span>
                            <select value={plano.angulo || ''} onChange={e => updatePlano(plano.id, { angulo: e.target.value })} style={selectStyle}>
                              <option value="">-</option>
                              <option value="Nível">Nível</option>
                              <option value="Plongée (Alto)">Plongée (Alto)</option>
                              <option value="Contra-plongée (Baixo)">Contra-plongée (Baixo)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Movimento</span>
                            <select value={plano.movimento || ''} onChange={e => updatePlano(plano.id, { movimento: e.target.value })} style={selectStyle}>
                              <option value="">-</option>
                              <option value="Estático">Estático</option>
                              <option value="Pan">Pan</option>
                              <option value="Tilt">Tilt</option>
                              <option value="Dolly/Track">Dolly / Track</option>
                              <option value="Handheld">Handheld (Mão)</option>
                            </select>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span className="text-xs text-muted uppercase font-bold">Lente / Info</span>
                            <input 
                              value={plano.lente || ''} 
                              onChange={e => updatePlano(plano.id, { lente: e.target.value })} 
                              style={selectStyle} 
                              placeholder="ex: 35mm"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button onClick={() => addPlano(cena.id)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                  <Camera size={16} /> Adicionar Plano
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enviar a ordem de filmagem para uma diária */}
      {modalDiaria && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="font-bold text-lg">Montar o dia</h3>
                {/* O texto precisa refletir a seleção: vindo de "Virar OD" de
                    uma quebra, vão só as cenas daquele dia, não a ordem toda. */}
                <p className="text-xs text-muted">
                  {cenasParaExportar
                    ? `As ${cenasParaExportar.length} cena(s) deste dia entram na diária escolhida.`
                    : `As ${cenasOrdenadas.length} cenas entram na diária escolhida, na ordem atual do stripboard.`}
                </p>
              </div>
              {/* Limpa a seleção ao fechar, senão ela sobreviveria para o
                  próximo "Enviar tudo" e mandaria menos cenas do que o rótulo diz. */}
              <button onClick={() => { setModalDiaria(false); setCenasParaExportar(null); }} className="btn-icon"><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {diarias.length === 0 && <div className="text-sm text-muted">Nenhuma diária criada ainda.</div>}
              {[...diarias].sort((a, b) => a.numero - b.numero).map(d => (
                <button
                  key={d.id}
                  onClick={() => enviarParaDiaria(d.id)}
                  className="btn-icon"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', width: '100%' }}
                >
                  <span className="font-bold">Diária {String(d.numero).padStart(2, '0')}</span>
                  <span className="text-xs text-muted">{(d.cena_ids || []).length} cena(s)</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Exportação seletiva */}
      {exportAberto && (
        <RelatoriosModal
          onFechar={() => setExportAberto(false)}
          dados={{
            cenas,
            itens: itensStrip,
            tags: tags || [],
            elementos: elementos || [],
            locacoes,
            tituloProjeto: projeto?.nome || 'Produção',
          }}
        />
      )}
    </div>
  );
}
