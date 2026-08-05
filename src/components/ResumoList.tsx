import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { calcularSaldos, detalharParticipante, getChaveParticipante } from '../core/calculadora';
import { simplificarDividas } from '../core/simplificador';
import { Check, Copy, ArrowRight, RotateCcw, Wallet } from 'lucide-react';
import type { ModoAcerto, StatusAcerto, Perfil } from '../types';
import { ProfileCard } from './ui/ProfileCard';

export function ResumoList({ projetoId, onVerFicha }: { projetoId: string, onVerFicha?: (id: string) => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const acertos = useLiveQuery(() => db.acertos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const configuracao = useLiveQuery(() => db.configuracoes.get(projetoId), [projetoId]);

  const [mensagemGerada, setMensagemGerada] = useState<{ id: string, msg: string } | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  if (!projeto || !perfis || !despesas || !acertos) return <div>Carregando...</div>;

  const saldos = calcularSaldos(despesas, acertos);
  const transacoesSugeridas = simplificarDividas(saldos, projeto.modo_acerto as ModoAcerto);

  const nomePorId = (id: string) => {
    if (id === 'caixa_central') return 'Produção';
    const p = perfis.find(x => x.id === id);
    return p ? `${p.nome} ${p.sobrenome || ''}`.trim() : 'Desconhecido';
  };

  // Números do Caixa (entidade, não pessoa)
  const confirmados = acertos.filter(a => a.status === 'confirmado');
  const aReceberPend = transacoesSugeridas.filter(t => t.para.id_ref === 'caixa_central').reduce((s, t) => s + t.valor, 0);
  const aPagarPend = transacoesSugeridas.filter(t => t.de.id_ref === 'caixa_central').reduce((s, t) => s + t.valor, 0);

  const registrarPagamento = async (t: any) => {
    await db.acertos.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      de: t.de,
      para: t.para,
      valor: t.valor,
      data: Date.now(),
      status: 'confirmado' as StatusAcerto
    });
  };

  const estornarPagamento = async (id: string) => {
    await db.acertos.delete(id);
  };

  const gerarMensagem = (perfil: Perfil, minhatransacoes: any[]) => {
    if (minhatransacoes.length === 0) {
      setMensagemGerada({ id: perfil.id, msg: 'Não há pendências financeiras.' });
      return;
    }
    const t = minhatransacoes[0];
    const isDevedor = t.de.id_ref === perfil.id;
    const nomeUsuario = `${perfil.nome} ${perfil.sobrenome || ''}`.trim();
    const pixCaixa = projeto.pix_caixa || '(PIX do caixa não definido)';
    const base = isDevedor
      ? (configuracao?.template_cobranca || 'Olá {{nome}}! No projeto {{projeto}}, seu saldo ficou em R$ {{valor}} a pagar para a Produção.\nChave PIX para pagamento: {{pix}}')
      : (configuracao?.template_pagamento || 'Olá {{nome}}! A Produção vai te repassar R$ {{valor}} referente ao projeto {{projeto}}.');

    let msg = base
      .replace(/\{\{\s*nome\s*\}\}/gi, nomeUsuario)
      .replace(/\{\{\s*valor\s*\}\}/gi, t.valor.toFixed(2))
      .replace(/\{\{\s*projeto\s*\}\}/gi, projeto.nome)
      .replace(/\{\{\s*funcao\s*\}\}/gi, perfil.funcao || '')
      .replace(/\{\{\s*pix\s*\}\}/gi, pixCaixa)
      .replace(/\[nome\]/gi, nomeUsuario)
      .replace(/\[valor\]/gi, t.valor.toFixed(2));

    if (isDevedor) {
      const linhasDeve = detalharParticipante(despesas, 'pessoa', perfil.id).linhas.filter(l => l.tipo === 'deve');
      if (linhasDeve.length > 0) {
        msg += '\n\nDetalhamento:\n' + linhasDeve
          .map(l => `- ${l.descricao}${l.diaria ? ` (${l.diaria})` : ''}: R$ ${l.valor.toFixed(2)}`)
          .join('\n');
      }
    }
    setMensagemGerada({ id: perfil.id, msg });
  };

  const gerarRelatorioCaixa = () => {
    let msg = `*Resumo Financeiro - ${projeto.nome}*\n\nPendências:\n`;
    transacoesSugeridas.forEach(t => {
      msg += `- ${nomePorId(t.de.id_ref)} → ${nomePorId(t.para.id_ref)}: R$ ${t.valor.toFixed(2)}\n`;
    });
    setMensagemGerada({ id: 'caixa_central', msg });
  };

  const copiarMensagem = () => {
    if (mensagemGerada) navigator.clipboard.writeText(mensagemGerada.msg);
  };

  const historicoGeral = confirmados.slice().sort((a, b) => b.data - a.data);

  const modoBanco = projeto.modo_acerto === 'centralizado';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ===== SELO DO MODO DE ACERTO ATIVO ===== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span className="badge" style={{ backgroundColor: modoBanco ? 'rgba(255,215,0,0.15)' : 'var(--color-success-bg)', color: modoBanco ? 'var(--accent)' : 'var(--color-success)', border: `1px solid ${modoBanco ? 'var(--accent)' : 'var(--color-success)'}`, padding: '4px 10px', fontSize: '11px' }}>
          MODO: {modoBanco ? 'Banco do Projeto' : 'Compensado (direto)'}
        </span>
        <span className="text-xs text-muted">
          {modoBanco ? 'Todos acertam com o caixa central.' : 'Saldo já compensado; membros acertam entre si.'}
        </span>
      </div>

      {/* ===== CAIXA DA PRODUÇÃO — entidade, não membro ===== */}
      {projeto.modo_acerto === 'centralizado' && (
        <div>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>Caixa da Produção</div>
          <div className="card" style={{ borderColor: 'var(--accent)', background: 'linear-gradient(145deg, rgba(255,215,0,0.08) 0%, var(--bg-surface) 60%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(255,215,0,0.15)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Wallet size={22} className="text-accent" />
              </div>
              <div>
                <div className="font-bold text-accent">Banco Central do Projeto</div>
                <div className="text-xs text-muted">Todos acertam com o Caixa</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="text-xs text-muted uppercase tracking-widest font-bold">1. A Receber (Pendências da Equipe)</span>
                  <span className="text-sm text-secondary">Soma do que as pessoas devem à Produção</span>
                </div>
                <div className="font-bold text-success text-lg">+ R$ {aReceberPend.toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="text-xs text-muted uppercase tracking-widest font-bold">2. A Pagar (Dívidas da Produção)</span>
                  <span className="text-sm text-secondary">Soma do que a Produção deve repassar/reembolsar</span>
                </div>
                <div className="font-bold text-danger text-lg">- R$ {aPagarPend.toFixed(2)}</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: '12px', border: '1px solid var(--accent)' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="text-xs text-accent uppercase tracking-widest font-bold">3. Resultado Projetado</span>
                  <span className="text-sm text-secondary">Depois de receber tudo e pagar todos</span>
                </div>
                <div className={`font-bold text-lg ${aReceberPend - aPagarPend >= 0 ? 'text-success' : 'text-danger'}`}>
                  R$ {(aReceberPend - aPagarPend).toFixed(2)}
                </div>
              </div>

            </div>

            <button onClick={gerarRelatorioCaixa} className="btn-primary" style={{ width: '100%', marginTop: '16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
              Gerar Relatório (Texto)
            </button>
            {mensagemGerada?.id === 'caixa_central' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                <textarea value={mensagemGerada.msg} onChange={e => setMensagemGerada({ id: 'caixa_central', msg: e.target.value })} rows={5} />
                <button onClick={copiarMensagem} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Copy size={16} /> Copiar Relatório
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== SALDOS DA EQUIPE ===== */}
      <div>
        <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Acertos da Equipe</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {perfis.filter(p => p.id !== 'caixa_central').map(p => {
            const minhatransacoes = transacoesSugeridas.filter(t => t.de.id_ref === p.id || t.para.id_ref === p.id);
            const detalhe = detalharParticipante(despesas, 'pessoa', p.id);
            const linhasDeve = detalhe.linhas.filter(l => l.tipo === 'deve');
            const linhasAdiantou = detalhe.linhas.filter(l => l.tipo === 'adiantou');
            const pagasDoMembro = confirmados
              .filter(a => a.de.id_ref === p.id || a.para.id_ref === p.id)
              .sort((a, b) => b.data - a.data);

            // Saldo COMPENSADO (já desconta pagamentos confirmados) para o selo
            const saldoComp = saldos[getChaveParticipante('pessoa', p.id)]?.saldo_liquido ?? 0;
            const isPositivo = saldoComp > 0;
            const saldoFormatado = Math.abs(saldoComp) < 0.01
              ? 'Quite ✓'
              : `${isPositivo ? 'A receber' : 'A pagar'} R$ ${Math.abs(saldoComp).toFixed(2)}`;

            return (
              <ProfileCard
                key={p.id}
                name={`${p.nome} ${p.sobrenome || ''}`}
                title={p.funcao || 'Membro'}
                status={saldoFormatado}
                avatarUrl={`https://ui-avatars.com/api/?name=${p.nome}+${p.sobrenome || ''}&background=random`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Ficha rápida read-only (dinheiro, não cadastro) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Função</span><span>{p.funcao || '-'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="text-muted">PIX</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.chave_pix || '-'}
                        {p.chave_pix && (
                          <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(p.chave_pix || ''); }} className="btn-icon" style={{ width: '26px', height: '26px' }} title="Copiar PIX"><Copy size={12} /></button>
                        )}
                      </span>
                    </div>
                    {onVerFicha && (
                      <button onClick={(e) => { e.stopPropagation(); onVerFicha(p.id); }} className="text-xs font-bold" style={{ marginTop: '4px', background: 'none', border: 'none', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}>
                        Ver ficha completa <ArrowRight size={13} />
                      </button>
                    )}
                  </div>

                  {minhatransacoes.length === 0 && detalhe.linhas.length === 0 ? (
                    <div className="text-muted text-sm text-center">Nenhuma pendência. Tudo quite! 🎉</div>
                  ) : (
                    <>
                      {/* Transação a acertar (saldo já compensado) */}
                      {minhatransacoes.map((t, i) => {
                        const isPagar = t.de.id_ref === p.id;
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                            <div>
                              <div className="text-xs text-muted uppercase tracking-widest">{isPagar ? 'Deve à Produção' : 'A receber da Produção'}</div>
                              <div className={`text-lg font-bold ${isPagar ? 'text-danger' : 'text-success'}`}>R$ {t.valor.toFixed(2)}</div>
                            </div>
                            <button onClick={() => registrarPagamento(t)} className="btn-icon" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'transparent', color: 'var(--color-success)' }} title="Confirmar pagamento">
                              <Check size={20} />
                            </button>
                          </div>
                        );
                      })}

                      {/* Explicação do saldo */}
                      {(detalhe.total_adiantou > 0 || detalhe.total_deve > 0) && (
                        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', fontSize: '0.8rem' }}>
                          <div><div className="text-xs text-muted uppercase">Adiantou</div><div className="font-bold text-success">R$ {detalhe.total_adiantou.toFixed(2)}</div></div>
                          <div className="text-muted" style={{ alignSelf: 'center' }}>−</div>
                          <div><div className="text-xs text-muted uppercase">Deve</div><div className="font-bold text-danger">R$ {detalhe.total_deve.toFixed(2)}</div></div>
                          <div className="text-muted" style={{ alignSelf: 'center' }}>=</div>
                          <div><div className="text-xs text-muted uppercase">Saldo</div><div className={`font-bold ${isPositivo ? 'text-success' : 'text-danger'}`}>R$ {Math.abs(detalhe.saldo).toFixed(2)}</div></div>
                        </div>
                      )}

                      {/* Detalhamento por despesa */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                        {linhasDeve.length > 0 && (
                          <div style={{ borderLeft: '2px solid var(--color-danger)', paddingLeft: '8px' }}>
                            <div className="text-xs text-danger font-bold uppercase tracking-widest" style={{ marginBottom: '4px' }}>Deve — R$ {detalhe.total_deve.toFixed(2)}</div>
                            {linhasDeve.map((l, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">{l.descricao}{l.diaria ? ` · ${l.diaria}` : ''}</span>
                                <span>R$ {l.valor.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {linhasAdiantou.length > 0 && (
                          <div style={{ borderLeft: '2px solid var(--color-success)', paddingLeft: '8px', marginTop: '8px' }}>
                            <div className="text-xs text-success font-bold uppercase tracking-widest" style={{ marginBottom: '4px' }}>Adiantou — R$ {detalhe.total_adiantou.toFixed(2)}</div>
                            {linhasAdiantou.map((l, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">{l.descricao}{l.diaria ? ` · ${l.diaria}` : ''}</span>
                                <span>R$ {l.valor.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <button onClick={() => gerarMensagem(p, minhatransacoes)} className="btn-primary" style={{ width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        Gerar Mensagem (WhatsApp)
                      </button>
                      {mensagemGerada?.id === p.id && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <textarea value={mensagemGerada.msg} onChange={e => setMensagemGerada({ id: p.id, msg: e.target.value })} rows={5} />
                          <button onClick={copiarMensagem} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Copy size={16} /> Copiar
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {/* Pagas deste membro */}
                  {pagasDoMembro.length > 0 && (
                    <div>
                      <div className="text-xs text-success font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Pagas</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pagasDoMembro.map(a => {
                          const recebeu = a.para.id_ref === p.id;
                          return (
                            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                              <span className="text-muted">{recebeu ? 'Recebeu' : 'Pagou'} · {new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                R$ {a.valor.toFixed(2)}
                                <button onClick={(e) => { e.stopPropagation(); estornarPagamento(a.id); }} className="btn-icon" style={{ width: '26px', height: '26px' }} title="Estornar"><RotateCcw size={12} /></button>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ProfileCard>
            );
          })}
        </div>
      </div>

      {/* ===== HISTÓRICO GERAL DE PAGAS ===== */}
      {historicoGeral.length > 0 && (
        <div>
          <button onClick={() => setMostrarHistorico(!mostrarHistorico)} className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ background: 'none', border: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            Histórico de Pagamentos ({historicoGeral.length}) {mostrarHistorico ? '▲' : '▼'}
          </button>
          {mostrarHistorico && (
            <div className="card" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {historicoGeral.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <div>{nomePorId(a.de.id_ref)} → {nomePorId(a.para.id_ref)}</div>
                    <div className="text-xs text-muted">{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="font-bold">R$ {a.valor.toFixed(2)}</span>
                    <button onClick={() => estornarPagamento(a.id)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Estornar"><RotateCcw size={13} /></button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

