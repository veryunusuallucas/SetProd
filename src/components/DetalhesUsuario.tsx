import { dinheiro } from '../lib/formato';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { calcularSaldos, detalharParticipante } from '../core/calculadora';
import { simplificarDividas } from '../core/simplificador';
import type { StatusAcerto, ModoAcerto } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft, Check, Copy, ArrowRight, RotateCcw } from 'lucide-react';

type Origem = 'producao' | 'acertos';

export function DetalhesUsuario({ projetoId, usuarioId, onVoltar, origem = 'acertos', onVerFicha }: { projetoId: string, usuarioId: string, onVoltar: () => void, origem?: Origem, onVerFicha?: (id: string) => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const perfil = useLiveQuery(() => db.perfis.get(usuarioId), [usuarioId]);
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const acertos = useLiveQuery(() => db.acertos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const configuracao = useLiveQuery(() => db.configuracoes.get(projetoId), [projetoId]);

  const [mensagemGerada, setMensagemGerada] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [perfilEdit, setPerfilEdit] = useState(perfil || {} as any);

  // Atualizar o form se o perfil carregar depois
  useEffect(() => {
    if (perfil && !editMode) {
      setPerfilEdit(perfil);
    }
  }, [perfil, editMode]);

  if (!projeto || !despesas || !acertos) return <div>Carregando...</div>;

  const isProjeto = usuarioId === 'caixa_central';
  const nomeUsuario = isProjeto ? 'Caixa da Produção' : (perfil?.nome + ' ' + (perfil?.sobrenome || ''));
  const campos = projeto.campos_customizados || [];

  const setCustom = (campoId: string, valor: string) =>
    setPerfilEdit({ ...perfilEdit, custom: { ...(perfilEdit.custom || {}), [campoId]: valor } });

  const saldos = calcularSaldos(despesas, acertos);
  const transacoesSugeridas = simplificarDividas(saldos, projeto.modo_acerto as ModoAcerto);

  const minhatransacoes = transacoesSugeridas.filter(t => t.de.id_ref === usuarioId || t.para.id_ref === usuarioId);

  // Detalhamento das despesas que compõem o saldo desta pessoa
  const detalhe = detalharParticipante(despesas, 'pessoa', usuarioId);
  const linhasDeve = detalhe.linhas.filter(l => l.tipo === 'deve');
  const linhasAdiantou = detalhe.linhas.filter(l => l.tipo === 'adiantou');

  // Pagamentos já confirmados envolvendo esta pessoa (histórico de PAGAS)
  const pagasDoMembro = acertos
    .filter(a => a.status === 'confirmado' && (a.de.id_ref === usuarioId || a.para.id_ref === usuarioId))
    .sort((a, b) => b.data - a.data);

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

  const gerarMensagem = () => {
    let msgFinal = '';
    if (isProjeto) {
      msgFinal = `*Resumo Financeiro - ${projeto.nome}*\n\nTotal de pendências:\n`;
      transacoesSugeridas.forEach(t => {
        const deNome = t.de.id_ref === 'caixa_central' ? 'Produção' : 'Membro';
        const paraNome = t.para.id_ref === 'caixa_central' ? 'Produção' : 'Membro';
        msgFinal += `- ${deNome} transfere ${dinheiro(t.valor)} para ${paraNome}\n`;
      });
      setMensagemGerada(msgFinal);
      return;
    }
    if (minhatransacoes.length === 0) {
      setMensagemGerada('Não há pendências financeiras.');
      return;
    }
    const t = minhatransacoes[0];
    const isDevedor = t.de.id_ref === usuarioId;
    const pixCaixa = projeto.pix_caixa || '(PIX do caixa não definido)';
    const templateBase = isDevedor
      ? (configuracao?.template_cobranca || 'Olá {{nome}}! No projeto {{projeto}}, seu saldo ficou em R$ {{valor}} a pagar para a Produção.\nChave PIX para pagamento: {{pix}}')
      : (configuracao?.template_pagamento || 'Olá {{nome}}! A Produção vai te repassar R$ {{valor}} referente ao projeto {{projeto}}.');

    // Preenche variáveis: aceita {{var}} (padrão) e [var] (legado)
    const preencher = (tpl: string) => tpl
      .replace(/\{\{\s*nome\s*\}\}/gi, nomeUsuario.trim())
      .replace(/\{\{\s*valor\s*\}\}/gi, t.valor.toFixed(2))
      .replace(/\{\{\s*projeto\s*\}\}/gi, projeto.nome)
      .replace(/\{\{\s*funcao\s*\}\}/gi, perfil?.funcao || '')
      .replace(/\{\{\s*pix\s*\}\}/gi, pixCaixa)
      .replace(/\[nome\]/gi, nomeUsuario.trim())
      .replace(/\[valor\]/gi, t.valor.toFixed(2));

    msgFinal = preencher(templateBase);

    // Cobrança detalhada: anexa de onde vem a dívida
    if (isDevedor && linhasDeve.length > 0) {
      msgFinal += '\n\nDetalhamento:\n' + linhasDeve
        .map(l => `- ${l.descricao}${l.diaria ? ` (${l.diaria})` : ''}: ${dinheiro(l.valor)}`)
        .join('\n');
    }
    setMensagemGerada(msgFinal);
  };

  const copiarMensagem = () => {
    navigator.clipboard.writeText(mensagemGerada);
    alert('Mensagem copiada!');
  };

  // Copia toda a ficha do usuário (usado na aba Produção)
  const copiarFicha = () => {
    if (!perfil) return;
    const linhas = [
      `Nome: ${perfil.nome} ${perfil.sobrenome || ''}`.trim(),
      perfil.funcao ? `Função: ${perfil.funcao}` : null,
      perfil.cpf ? `CPF: ${perfil.cpf}` : null,
      perfil.telefone ? `Telefone: ${perfil.telefone}` : null,
      perfil.email ? `Email: ${perfil.email}` : null,
      perfil.chave_pix ? `PIX: ${perfil.chave_pix}` : null,
      perfil.endereco ? `Endereço: ${perfil.endereco}` : null,
      perfil.info_medica ? `Alergias/Medicação: ${perfil.info_medica}` : null,
      perfil.tipo_sanguineo ? `Tipo Sanguíneo: ${perfil.tipo_sanguineo}` : null,
      perfil.contato_emergencia ? `Contato de Emergência: ${perfil.contato_emergencia}` : null,
      ...campos.filter(c => perfil.custom?.[c.id]).map(c => `${c.nome}: ${perfil.custom?.[c.id]}`),
    ].filter(Boolean);
    navigator.clipboard.writeText(linhas.join('\n'));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  let dataGraficoCaixa: { name: string; valor: number }[] = [];
  if (isProjeto) {
    const totalAReceber = transacoesSugeridas.filter(t => t.para.id_ref === 'caixa_central').reduce((acc, t) => acc + t.valor, 0);
    const totalAPagar = transacoesSugeridas.filter(t => t.de.id_ref === 'caixa_central').reduce((acc, t) => acc + t.valor, 0);
    dataGraficoCaixa = [
      { name: 'A Receber', valor: totalAReceber },
      { name: 'A Pagar', valor: totalAPagar }
    ];
  }

  const COLORS = ['#4ade80', '#f87171'];

  const salvarPerfil = async () => {
    await db.perfis.put({ ...perfilEdit, projeto_id: projetoId });
    setEditMode(false);
  };

  // Decide o que mostrar conforme a aba de origem
  const mostrarFicha = origem === 'producao' && !isProjeto;
  const mostrarPendencias = origem === 'acertos';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <button onClick={onVoltar} className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: 0 }}>
        <ChevronLeft size={16} /> Voltar
      </button>

      <div>
        <h3 className="text-xl font-bold">{nomeUsuario}</h3>
        {!isProjeto && perfil?.funcao && <div className="text-xs text-muted uppercase tracking-widest">{perfil.funcao}</div>}
      </div>

      {/* ===== ABA PRODUÇÃO: apenas ficha do usuário ===== */}
      {mostrarFicha && perfil && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest">Ficha Completa</div>
              <button
                onClick={() => editMode ? salvarPerfil() : setEditMode(true)}
                className="text-xs font-bold"
                style={{ backgroundColor: editMode ? 'var(--accent)' : 'var(--bg-surface)', color: editMode ? '#000' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '4px 12px' }}
              >
                {editMode ? 'Salvar' : 'Editar'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
              {editMode ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input placeholder="Nome" value={perfilEdit.nome || ''} onChange={e => setPerfilEdit({ ...perfilEdit, nome: e.target.value })} />
                  <input placeholder="Sobrenome" value={perfilEdit.sobrenome || ''} onChange={e => setPerfilEdit({ ...perfilEdit, sobrenome: e.target.value })} />
                  <input placeholder="Função" value={perfilEdit.funcao || ''} onChange={e => setPerfilEdit({ ...perfilEdit, funcao: e.target.value })} />
                  <input placeholder="CPF" value={perfilEdit.cpf || ''} onChange={e => setPerfilEdit({ ...perfilEdit, cpf: e.target.value })} />
                  <input placeholder="Telefone" value={perfilEdit.telefone || ''} onChange={e => setPerfilEdit({ ...perfilEdit, telefone: e.target.value })} />
                  <input placeholder="Email" value={perfilEdit.email || ''} onChange={e => setPerfilEdit({ ...perfilEdit, email: e.target.value })} />
                  <input placeholder="Endereço" value={perfilEdit.endereco || ''} onChange={e => setPerfilEdit({ ...perfilEdit, endereco: e.target.value })} />
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }}></div>
                  <input placeholder="Alergias/Medicação" value={perfilEdit.info_medica || ''} onChange={e => setPerfilEdit({ ...perfilEdit, info_medica: e.target.value })} />
                  <input placeholder="Tipo Sanguíneo" value={perfilEdit.tipo_sanguineo || ''} onChange={e => setPerfilEdit({ ...perfilEdit, tipo_sanguineo: e.target.value })} />
                  <input placeholder="Contato Emergência" value={perfilEdit.contato_emergencia || ''} onChange={e => setPerfilEdit({ ...perfilEdit, contato_emergencia: e.target.value })} />
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }}></div>
                  <input placeholder="Chave PIX" value={perfilEdit.chave_pix || ''} onChange={e => setPerfilEdit({ ...perfilEdit, chave_pix: e.target.value })} />
                  {campos.length > 0 && (
                    <>
                      <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginTop: '8px' }}>Personalizados</div>
                      {campos.map(c => (
                        <input
                          key={c.id}
                          placeholder={c.nome}
                          type={c.tipo === 'numero' || c.tipo === 'valor' ? 'number' : c.tipo === 'data' ? 'date' : 'text'}
                          value={perfilEdit.custom?.[c.id] || ''}
                          onChange={e => setCustom(c.id, e.target.value)}
                        />
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">CPF:</span> <span>{perfil.cpf || '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Telefone:</span> <span>{perfil.telefone || '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Email:</span> <span>{perfil.email || '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Endereço:</span> <span style={{ textAlign: 'right' }}>{perfil.endereco || '-'}</span></div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-warning">Alergias/Med:</span> <span style={{ textAlign: 'right' }}>{perfil.info_medica || '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-danger">Tipo Sang:</span> <span>{perfil.tipo_sanguineo || '-'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-success">Emergência:</span> <span style={{ textAlign: 'right' }}>{perfil.contato_emergencia || '-'}</span></div>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)', margin: '8px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">PIX:</span> <span style={{ textAlign: 'right' }}>{perfil.chave_pix || '-'}</span></div>
                  {campos.map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">{c.nome}:</span>
                      <span style={{ textAlign: 'right' }}>{perfil.custom?.[c.id] ? (c.tipo === 'valor' ? `R$ ${perfil.custom[c.id]}` : perfil.custom[c.id]) : '-'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          {!editMode && (
            <button onClick={copiarFicha} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Copy size={16} /> {copiado ? 'Copiado!' : 'Copiar Informações'}
            </button>
          )}
        </>
      )}

      {/* ===== ABA ACERTOS: Caixa da Produção (gráfico geral) ===== */}
      {mostrarPendencias && isProjeto && (
        <div className="card">
          <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Balanço de Pagamentos</div>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataGraficoCaixa} cx="50%" cy="50%" innerRadius={50} outerRadius={70} fill="#8884d8" dataKey="valor">
                  {dataGraficoCaixa.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '8px' }} formatter={(value) => `${dinheiro(Number(value))}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ===== ABA ACERTOS: pessoa — ficha resumida read-only ===== */}
      {mostrarPendencias && !isProjeto && perfil && (
        <div className="card">
          <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>Ficha Rápida</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Função:</span> <span>{perfil.funcao || '-'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="text-muted">Telefone:</span> <span>{perfil.telefone || '-'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted">PIX:</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {perfil.chave_pix || '-'}
                {perfil.chave_pix && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(perfil.chave_pix || ''); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                    className="btn-icon" style={{ width: '28px', height: '28px' }} title="Copiar PIX"
                  >
                    <Copy size={13} />
                  </button>
                )}
              </span>
            </div>
          </div>
          {copiado && <div className="text-xs text-success" style={{ marginTop: '8px' }}>Copiado!</div>}
          {onVerFicha && (
            <button
              onClick={() => onVerFicha(usuarioId)}
              className="text-xs font-bold"
              style={{ marginTop: '14px', background: 'none', border: 'none', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
            >
              Ver ficha completa <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* ===== ABA ACERTOS: pessoa — pendência detalhada ===== */}
      {mostrarPendencias && !isProjeto && (
        <div>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '16px' }}>Pendências de Acerto</div>

          {/* Explicação do saldo líquido */}
          {(detalhe.total_adiantou > 0 || detalhe.total_deve > 0) && (
            <div className="card" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <div className="text-xs text-muted uppercase tracking-widest">Adiantou</div>
                <div className="font-bold text-success">{dinheiro(detalhe.total_adiantou)}</div>
              </div>
              <div className="text-muted">−</div>
              <div>
                <div className="text-xs text-muted uppercase tracking-widest">Deve</div>
                <div className="font-bold text-danger">{dinheiro(detalhe.total_deve)}</div>
              </div>
              <div className="text-muted">=</div>
              <div>
                <div className="text-xs text-muted uppercase tracking-widest">Saldo</div>
                <div className={`font-bold ${detalhe.saldo >= 0 ? 'text-success' : 'text-danger'}`}>
                  {detalhe.saldo >= 0 ? '+' : '−'} {dinheiro(Math.abs(detalhe.saldo))}
                </div>
              </div>
            </div>
          )}

          {minhatransacoes.length === 0 && detalhe.linhas.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center', padding: '24px' }}>Nenhuma pendência. Tudo quite! 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Resumo do saldo líquido / transação a acertar */}
              {minhatransacoes.map((t, i) => {
                const isPagar = t.de.id_ref === usuarioId;
                return (
                  <div key={i} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div className="text-xs text-muted uppercase tracking-widest">{isPagar ? 'Deve pagar à Produção' : 'A receber da Produção'}</div>
                      <div className={`text-lg font-bold ${isPagar ? 'text-danger' : 'text-success'}`}>{dinheiro(t.valor)}</div>
                    </div>
                    <button onClick={() => registrarPagamento(t)} className="btn-icon" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'transparent', color: 'var(--color-success)' }} title="Marcar como Pago">
                      <Check size={20} />
                    </button>
                  </div>
                );
              })}

              {/* Detalhamento: de onde vem a dívida */}
              {linhasDeve.length > 0 && (
                <div className="card">
                  <div className="text-xs text-danger font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>
                    Deve — {dinheiro(detalhe.total_deve)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linhasDeve.map((l, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <div>
                          <div>{l.descricao}</div>
                          <div className="text-xs text-muted">{[l.diaria, l.categoria].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className="font-bold text-danger">{dinheiro(l.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalhamento: o que adiantou */}
              {linhasAdiantou.length > 0 && (
                <div className="card">
                  <div className="text-xs text-success font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>
                    Adiantou — {dinheiro(detalhe.total_adiantou)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {linhasAdiantou.map((l, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                        <div>
                          <div>{l.descricao}</div>
                          <div className="text-xs text-muted">{[l.diaria, l.categoria].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className="font-bold text-success">{dinheiro(l.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Histórico de pagamentos já feitos com esta pessoa */}
          {pagasDoMembro.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div className="text-xs text-success font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>Pagas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pagasDoMembro.map(a => {
                  const recebeu = a.para.id_ref === usuarioId;
                  return (
                    <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px' }}>
                      <div>
                        <div className="text-sm">{recebeu ? 'Recebeu da Produção' : 'Pagou à Produção'}</div>
                        <div className="text-xs text-muted">{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="font-bold" style={{ color: recebeu ? 'var(--color-success)' : 'var(--text-primary)' }}>{dinheiro(a.valor)}</span>
                        <button onClick={() => estornarPagamento(a.id)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Estornar (desfazer)">
                          <RotateCcw size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botão de gerar mensagem só faz sentido na aba Acertos */}
      {mostrarPendencias && (
        <div style={{ marginTop: '16px' }}>
          <button onClick={gerarMensagem} className="btn-primary" style={{ width: '100%', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            {isProjeto ? 'Gerar Relatório (Texto)' : 'Gerar Mensagem (WhatsApp)'}
          </button>

          {mensagemGerada && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <textarea
                value={mensagemGerada}
                onChange={e => setMensagemGerada(e.target.value)}
                rows={5}
              />
              <button onClick={copiarMensagem} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Copy size={16} /> Copiar Mensagem
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
