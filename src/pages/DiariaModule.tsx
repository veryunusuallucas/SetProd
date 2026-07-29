import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Users, MapPin, CheckSquare, SplitSquareHorizontal, Plus, Trash2, Clock, Bus, Paperclip, UserCheck, FileDown, CloudSun, Wallet } from 'lucide-react';
import type { DiariaTask, HorarioOD, AnexoOD } from '../types';
import { logAction } from '../lib/audit';
import { parseCoords, buscarClima, descreverClima, type ClimaDia } from '../lib/clima';
import { ShotList } from '../components/ShotList';

export function DiariaModule() {
  const { id: projetoId, diariaId } = useParams();
  const navigate = useNavigate();

  const projeto = useLiveQuery(() => db.projetos.get(projetoId!), [projetoId]);
  const diaria = useLiveQuery(() => db.diarias.get(diariaId!), [diariaId]);
  const tasks = useLiveQuery(() => db.diaria_tasks.where('diaria_id').equals(diariaId!).toArray(), [diariaId]) || [];
  const locacoes = useLiveQuery(() => db.locacoes.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const despesasDiaria = useLiveQuery(async () => {
    const todas = await db.despesas.where('projeto_id').equals(projetoId!).toArray();
    return todas.filter(d => d.diaria_id === diariaId);
  }, [projetoId, diariaId]) || [];

  const [newTask, setNewTask] = useState('');
  const [selecionandoEquipe, setSelecionandoEquipe] = useState(false);
  const [selecionandoLocacoes, setSelecionandoLocacoes] = useState(false);
  const [novaHora, setNovaHora] = useState('');
  const [novoEvento, setNovoEvento] = useState('');

  const [clima, setClima] = useState<ClimaDia | null>(null);
  const [climaStatus, setClimaStatus] = useState<'idle' | 'carregando' | 'ok' | 'erro' | 'sem_coords'>('idle');

  const [exportModalAberto, setExportModalAberto] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    clima: true, horarios: true, locacoes: true, equipe: true,
    transporte: true, checklist: true, observacoes: true, shotlist: true
  });

  // Locação da diária que tenha coordenadas parseáveis
  const locComCoords = (diaria?.locacoes_ids || [])
    .map(id => locacoes.find(l => l.id === id))
    .find(l => l && parseCoords(l.coordenadas));
  const coords = parseCoords(locComCoords?.coordenadas);
  const dataDiaria = diaria?.data;

  useEffect(() => {
    let cancelado = false;
    if (!coords) { setClimaStatus('sem_coords'); setClima(null); return; }
    if (!dataDiaria) return;
    setClimaStatus('carregando');
    buscarClima(coords.lat, coords.lng, dataDiaria)
      .then(res => { if (!cancelado) { setClima(res); setClimaStatus(res ? 'ok' : 'erro'); } })
      .catch(() => { if (!cancelado) setClimaStatus('erro'); });
    return () => { cancelado = true; };
  }, [coords?.lat, coords?.lng, dataDiaria]);

  if (!diaria) return <div className="screen-padding">Carregando Diária...</div>;

  const escalados = perfis.filter(p => (diaria.equipe_escalada || []).includes(p.id));

  const toggleUnidadeB = async () => {
    await db.diarias.update(diariaId!, { tem_unidade_b: !diaria.tem_unidade_b });
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    await db.diaria_tasks.add({ id: crypto.randomUUID(), diaria_id: diariaId!, departamento_id: 'geral', descricao: newTask, status: 'pendente' });
    setNewTask('');
  };
  const toggleTask = async (task: DiariaTask) => {
    await db.diaria_tasks.update(task.id, { status: task.status === 'pendente' ? 'concluido' : 'pendente' });
  };
  const deleteTask = async (id: string) => { await db.diaria_tasks.delete(id); };

  const toggleMembro = async (perfilId: string) => {
    const equipe = diaria.equipe_escalada || [];
    const nova = equipe.includes(perfilId) ? equipe.filter(id => id !== perfilId) : [...equipe, perfilId];
    await db.diarias.update(diariaId!, { equipe_escalada: nova });
  };
  const escalarDepartamento = async (deptoId: string) => {
    const membrosDepto = perfis.filter(p => p.departamento_id === deptoId).map(p => p.id);
    const equipeAtual = new Set(diaria.equipe_escalada || []);
    membrosDepto.forEach(id => equipeAtual.add(id));
    await db.diarias.update(diariaId!, { equipe_escalada: Array.from(equipeAtual) });
  };
  const toggleLocacao = async (locId: string) => {
    const locs = diaria.locacoes_ids || [];
    const novas = locs.includes(locId) ? locs.filter(id => id !== locId) : [...locs, locId];
    await db.diarias.update(diariaId!, { locacoes_ids: novas });
  };

  // ---- Horários ----
  const addHorario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaHora || !novoEvento.trim()) return;
    const item: HorarioOD = { id: crypto.randomUUID(), hora: novaHora, evento: novoEvento.trim() };
    const lista = [...(diaria.horarios || []), item].sort((a, b) => a.hora.localeCompare(b.hora));
    await db.diarias.update(diariaId!, { horarios: lista });
    setNovaHora(''); setNovoEvento('');
  };
  const removeHorario = async (hid: string) => {
    await db.diarias.update(diariaId!, { horarios: (diaria.horarios || []).filter(h => h.id !== hid) });
  };

  // ---- Transporte ----
  const salvarTransporte = async (valor: string) => {
    await db.diarias.update(diariaId!, { transporte: valor });
  };

  // ---- Anexos (data URL, offline) ----
  const addAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('Arquivo muito grande (máx 3MB para funcionar offline).'); return; }
    const dados = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    const anexo: AnexoOD = { id: crypto.randomUUID(), nome: file.name, tipo: file.type, dados };
    await db.diarias.update(diariaId!, { anexos: [...(diaria.anexos || []), anexo] });
    e.target.value = '';
  };
  const removeAnexo = async (aid: string) => {
    await db.diarias.update(diariaId!, { anexos: (diaria.anexos || []).filter(a => a.id !== aid) });
  };

  // ---- Confirmação de presença ----
  const toggleConfirmacao = async (perfilId: string) => {
    const conf = diaria.confirmacoes || [];
    const nova = conf.includes(perfilId) ? conf.filter(id => id !== perfilId) : [...conf, perfilId];
    await db.diarias.update(diariaId!, { confirmacoes: nova });
  };

  const totalGasto = despesasDiaria.reduce((acc, d) => acc + d.valor_total, 0);
  const limiteGasto = diaria.limite_gasto || 0;
  const valorIdeal = diaria.valor_ideal || 0;
  const saldoGasto = limiteGasto - totalGasto;

  let statusOrc = { texto: 'Defina um valor ideal/máximo', cor: 'var(--text-muted)' };
  if (limiteGasto > 0 && totalGasto > limiteGasto) statusOrc = { texto: '⚠️ Estourou o valor máximo!', cor: 'var(--color-danger)' };
  else if (valorIdeal > 0 && totalGasto > valorIdeal) statusOrc = { texto: 'Acima do ideal (dentro do máximo)', cor: 'var(--color-warning)' };
  else if (valorIdeal > 0 || limiteGasto > 0) statusOrc = { texto: '✓ Dentro do previsto', cor: 'var(--color-success)' };

  const formataData = (d: string) => { const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a}`; };

  // ---- Exportar OD em PDF (via impressão do navegador) ----
  const exportarPDF = async () => {
    const nomeLoc = (diaria.locacoes_ids || []).map(id => locacoes.find(l => l.id === id)).filter(Boolean);
    const linhaEquipe = escalados.map(p => `<li>${p.nome} ${p.sobrenome || ''} — ${p.funcao || 'Equipe'}${(diaria.confirmacoes || []).includes(p.id) ? ' ✔ confirmado' : ''}</li>`).join('');
    const linhaHorarios = (diaria.horarios || []).map(h => `<tr><td style="padding:4px 12px;font-weight:bold">${h.hora}</td><td style="padding:4px 12px">${h.evento}</td></tr>`).join('');
    const linhaLoc = nomeLoc.map((l: any) => `<li><b>${l.nome}</b> — ${l.endereco}${l.hospital_proximo ? ` · Hospital: ${l.hospital_proximo}` : ''}</li>`).join('');
    const linhaTasks = tasks.map(t => `<li>${t.status === 'concluido' ? '☑' : '☐'} ${t.descricao}</li>`).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>OD - Diária ${diaria.numero}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:800px;margin:0 auto}
      h1{margin:0}h2{border-bottom:2px solid #111;padding-bottom:4px;margin-top:24px;font-size:15px;text-transform:uppercase}
      table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px}li{margin:2px 0}.muted{color:#666}</style></head><body>
      <h1>${projeto?.nome || 'Produção'}</h1>
      <div class="muted">Ordem do Dia — Diária ${String(diaria.numero).padStart(2, '0')} · ${formataData(diaria.data)}${diaria.tem_unidade_b ? ' · Unidades A+B' : ''}</div>
      ${exportConfig.clima && clima ? `<h2>Previsão</h2><p>${descreverClima(clima.code).emoji} ${descreverClima(clima.code).texto} · Nascer ${clima.sunrise||'--'} · Pôr ${clima.sunset||'--'} · Máx ${Math.round(clima.tempMax)}° / Mín ${Math.round(clima.tempMin)}° · Chuva ${clima.chuvaProb}%</p>` : ''}
      ${exportConfig.horarios && linhaHorarios ? `<h2>Horários</h2><table>${linhaHorarios}</table>` : ''}
      ${exportConfig.locacoes && linhaLoc ? `<h2>Locações</h2><ul>${linhaLoc}</ul>` : ''}
      ${exportConfig.equipe && linhaEquipe ? `<h2>Equipe Escalada</h2><ul>${linhaEquipe}</ul>` : ''}
      ${exportConfig.transporte && diaria.transporte ? `<h2>Transporte / Logística</h2><p>${diaria.transporte.replace(/\n/g, '<br>')}</p>` : ''}
      ${exportConfig.checklist && linhaTasks ? `<h2>Checklist</h2><ul>${linhaTasks}</ul>` : ''}
      ${exportConfig.observacoes && diaria.observacoes ? `<h2>Observações</h2><p>${diaria.observacoes}</p>` : ''}
      
      ${exportConfig.shotlist && (diaria.cenas || []).length > 0 ? `<h2>Shot List</h2>
        ${(diaria.cenas||[]).map((c: any) => {
          const pl = (diaria.planos||[]).filter((p: any) => p.cena_id === c.id);
          const trs = pl.map((p: any) => `<tr><td style="width:40px;text-align:center"><b>${p.numero}</b></td><td>${p.descricao}</td><td>${p.tamanho||'-'}</td><td>${p.movimento||'-'}</td><td>${p.lente||'-'}</td></tr>`).join('');
          return `
            <div style="margin-top:16px;background:#f9f9f9;padding:12px;border:1px solid #ddd;border-radius:8px">
              <strong>Cena ${c.numero}</strong>: ${c.descricao} (${c.ambiente||'ext'} / ${c.periodo||'dia'})
              ${pl.length > 0 ? `<table style="width:100%;margin-top:8px;font-size:13px">
                <tr style="text-align:left;background:#eee"><th>Plano</th><th>Ação</th><th>Tamanho</th><th>Movimento</th><th>Lente</th></tr>
                ${trs}
              </table>` : ''}
            </div>
          `;
        }).join('')}
      ` : ''}
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permita pop-ups para exportar o PDF.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    setExportModalAberto(false);
    if (projetoId) await logAction(projetoId, 'editar', 'diaria', diariaId!, `Exportou OD da Diária ${diaria.numero}`);
  };

  const card: React.CSSProperties = { };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/projeto/${projetoId}/diarias`)} className="btn-icon"><ArrowLeft size={20} /></button>
        <div style={{ flex: 1 }}>
          <h1 className="text-xl font-bold">Diária {String(diaria.numero).padStart(2, '0')}</h1>
          <p className="text-sm text-secondary">{formataData(diaria.data)}</p>
        </div>
        <button onClick={() => setExportModalAberto(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileDown size={16} /> Exportar OD (PDF)
        </button>
      </div>

      {/* Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-secondary mb-1">Estrutura</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <SplitSquareHorizontal size={18} /> {diaria.tem_unidade_b ? 'Unidade A + B' : 'Unidade Única (A)'}
            </div>
          </div>
          <button onClick={toggleUnidadeB} className="text-xs btn-icon" style={{ padding: '4px 12px', border: '1px solid var(--border-color)' }}>Alternar</button>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="text-xs font-bold uppercase tracking-widest text-secondary">Locações (Sets)</div>
            <button onClick={() => setSelecionandoLocacoes(!selecionandoLocacoes)} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none' }}>Editar</button>
          </div>
          {selecionandoLocacoes ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
              {locacoes.length === 0 && <div className="text-muted text-xs">Cadastre locações no módulo Locações.</div>}
              {locacoes.map(loc => (
                <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={(diaria.locacoes_ids || []).includes(loc.id)} onChange={() => toggleLocacao(loc.id)} />
                  {loc.nome}
                </label>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {(diaria.locacoes_ids || []).map(locId => {
                const loc = locacoes.find(l => l.id === locId);
                return loc ? <div key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}><MapPin size={14} className="text-muted" /> {loc.nome}</div> : null;
              })}
              {(!diaria.locacoes_ids || diaria.locacoes_ids.length === 0) && <div className="text-muted text-sm">Nenhuma locação definida.</div>}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="text-xs font-bold uppercase tracking-widest text-secondary">Equipe Escalada</div>
            <button onClick={() => setSelecionandoEquipe(!selecionandoEquipe)} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none' }}>Editar</button>
          </div>
          {selecionandoEquipe ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
                {departamentos.map(dep => (
                  <button key={dep.id} onClick={() => escalarDepartamento(dep.id)} className="text-xs" style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', whiteSpace: 'nowrap' }}>
                    + {dep.nome}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto' }}>
                {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={(diaria.equipe_escalada || []).includes(p.id)} onChange={() => toggleMembro(p.id)} />
                    {p.nome} {p.sobrenome} <span className="text-xs text-muted">({p.funcao || 'Equipe'})</span>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <Users size={16} className="text-muted" /> <span className="font-bold">{escalados.length}</span> membros
              </div>
              <div className="text-xs text-muted">{escalados.map(p => p.nome).join(', ')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Controle de Gastos */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={16} /> Controle Financeiro da Diária
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="text-xs text-muted uppercase">Gasto Registrado</div>
            <div className="font-bold text-lg" style={{ color: statusOrc.cor }}>R$ {totalGasto.toFixed(2)}</div>
          </div>
          <div style={{ flex: 1, minWidth: '90px' }}>
            <div className="text-xs text-muted uppercase">Valor Ideal</div>
            <input
              type="number"
              placeholder="0.00"
              value={diaria.valor_ideal || ''}
              onChange={async e => await db.diarias.update(diariaId!, { valor_ideal: Number(e.target.value) || 0 })}
              style={{ padding: '6px', fontSize: '16px', fontWeight: 'bold', width: '100px', backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '90px' }}>
            <div className="text-xs text-muted uppercase">Valor Máximo</div>
            <input
              type="number"
              placeholder="0.00"
              value={diaria.limite_gasto || ''}
              onChange={async e => await db.diarias.update(diariaId!, { limite_gasto: Number(e.target.value) || 0 })}
              style={{ padding: '6px', fontSize: '16px', fontWeight: 'bold', width: '100px', backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
            />
          </div>
          {limiteGasto > 0 && (
            <div style={{ flex: 1, minWidth: '90px' }}>
              <div className="text-xs text-muted uppercase">Saldo (p/ máximo)</div>
              <div className="font-bold text-lg" style={{ color: saldoGasto < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                R$ {saldoGasto.toFixed(2)}
              </div>
            </div>
          )}
        </div>
        <div style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '13px', color: statusOrc.cor }}>{statusOrc.texto}</div>
      </div>

      {/* Horários */}
      <div className="card" style={card}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={16} /> Horários / Cronograma
        </h2>
        <form onSubmit={addHorario} style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input type="time" value={novaHora} onChange={e => setNovaHora(e.target.value)} style={{ width: '120px' }} />
          <input placeholder="Evento (ex: Chamada geral, Almoço, Wrap)" value={novoEvento} onChange={e => setNovoEvento(e.target.value)} style={{ flex: 1, minWidth: '160px' }} />
          <button type="submit" className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }}><Plus size={20} /></button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(diaria.horarios || []).length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px' }}>Sem horários definidos.</div>}
          {(diaria.horarios || []).map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <span className="font-bold text-accent" style={{ minWidth: '52px' }}>{h.hora}</span>
              <span style={{ flex: 1 }}>{h.evento}</span>
              <button onClick={() => removeHorario(h.id)} className="btn-icon text-muted" style={{ padding: '6px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Clima */}
      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <CloudSun size={16} /> Previsão do Tempo
        </h2>
        {climaStatus === 'sem_coords' && (
          <div className="text-sm text-muted">Adicione coordenadas (lat,lng ou link do Maps) a uma locação da diária para ver a previsão.</div>
        )}
        {climaStatus === 'carregando' && <div className="text-sm text-muted">Consultando previsão…</div>}
        {climaStatus === 'erro' && (
          <div className="text-sm text-muted">Não foi possível obter a previsão (sem internet ou data fora da janela de ~16 dias).</div>
        )}
        {climaStatus === 'ok' && clima && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '40px', lineHeight: 1 }}>{descreverClima(clima.code).emoji}</div>
            <div>
              <div className="font-bold">{descreverClima(clima.code).texto}</div>
              <div className="text-sm text-secondary">{locComCoords?.nome}</div>
            </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', textAlign: 'center' }}>
                <div><div className="text-xs text-muted uppercase">Nascer</div><div className="font-bold text-secondary">{clima.sunrise || '--'}</div></div>
                <div><div className="text-xs text-muted uppercase">Pôr</div><div className="font-bold text-secondary">{clima.sunset || '--'}</div></div>
                <div><div className="text-xs text-muted uppercase">Máx</div><div className="font-bold">{Math.round(clima.tempMax)}°</div></div>
                <div><div className="text-xs text-muted uppercase">Mín</div><div className="font-bold">{Math.round(clima.tempMin)}°</div></div>
                <div><div className="text-xs text-muted uppercase">Chuva</div><div className="font-bold" style={{ color: clima.chuvaProb >= 50 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{clima.chuvaProb}%</div></div>
              </div>
          </div>
        )}
      </div>

      {/* Transporte */}
      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Bus size={16} /> Transporte / Logística
        </h2>
        <textarea
          defaultValue={diaria.transporte || ''}
          onBlur={e => salvarTransporte(e.target.value)}
          placeholder="Vans, quem vai com quem, pontos e horários de encontro..."
          rows={3}
        />
        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>Salva automaticamente ao sair do campo.</div>
      </div>

      {/* Anexos */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paperclip size={16} /> Anexos
          </h2>
          <label className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', cursor: 'pointer', width: 'auto', padding: '0 12px', gap: '6px' }}>
            <Plus size={16} /> <span className="text-xs">Adicionar</span>
            <input type="file" onChange={addAnexo} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(diaria.anexos || []).length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px' }}>Roteiro do dia, decupagem, referências... (máx 3MB cada).</div>}
          {(diaria.anexos || []).map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <Paperclip size={14} className="text-muted" />
              <a href={a.dados} download={a.nome} style={{ flex: 1, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</a>
              <button onClick={() => removeAnexo(a.id)} className="btn-icon text-muted" style={{ padding: '6px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmação de presença */}
      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <UserCheck size={16} /> Confirmação de Presença
        </h2>
        {escalados.length === 0 ? (
          <div className="text-muted text-sm">Escale a equipe primeiro para confirmar presença.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>
              {(diaria.confirmacoes || []).filter(id => (diaria.equipe_escalada || []).includes(id)).length} de {escalados.length} confirmaram
            </div>
            {escalados.map(p => {
              const ok = (diaria.confirmacoes || []).includes(p.id);
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={ok} onChange={() => toggleConfirmacao(p.id)} style={{ width: '18px', height: '18px', accentColor: 'var(--color-success)' }} />
                  <span style={{ flex: 1 }}>{p.nome} {p.sobrenome} <span className="text-xs text-muted">· {p.funcao || 'Equipe'}</span></span>
                  {ok && <span className="text-xs text-success font-bold">confirmado</span>}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Shot List (Cenas e Planos) */}
      <ShotList diaria={diaria as any} locacoes={locacoes} />

      {/* Checklist / Tasks */}
      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckSquare size={16} /> Checklist de Produção
        </h2>
        <form onSubmit={addTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input placeholder="Nova tarefa... (ex: Pegar rádios, Comprar gelo)" value={newTask} onChange={e => setNewTask(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }}><Plus size={20} /></button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.length === 0 && <div className="text-muted text-sm" style={{ padding: '16px 0', textAlign: 'center' }}>Nenhuma tarefa para o dia.</div>}
          {tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', textDecoration: task.status === 'concluido' ? 'line-through' : 'none', color: task.status === 'concluido' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                <input type="checkbox" checked={task.status === 'concluido'} onChange={() => toggleTask(task)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
                {task.descricao}
              </label>
              <button onClick={() => deleteTask(task.id)} className="btn-icon text-muted" style={{ padding: '8px', border: 'none', background: 'transparent' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </div>

      {exportModalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: 'var(--bg-surface)' }}>
            <h2 className="text-lg font-bold mb-4">Exportar Ordem do Dia</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {Object.keys(exportConfig).map(key => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={exportConfig[key as keyof typeof exportConfig]} 
                    onChange={e => setExportConfig({ ...exportConfig, [key]: e.target.checked })} 
                    style={{ width: '18px', height: '18px', accentColor: 'var(--accent)' }} 
                  />
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setExportModalAberto(false)} className="text-sm font-bold" style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={exportarPDF} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileDown size={16} /> Gerar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
