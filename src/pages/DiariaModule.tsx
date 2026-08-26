import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Users, MapPin, CheckSquare, SplitSquareHorizontal, Plus, Trash2, Clock, Bus, Paperclip, UserCheck, FileDown, CloudSun, Wallet, Cross, Phone, Archive, Lock } from 'lucide-react';
import type { DiariaTask, HorarioOD, AnexoOD, Locacao } from '../types';
import { logAction } from '../lib/audit';
import { parseCoords, buscarClima, descreverClima, agruparClimasIguais, type ClimaPorLocal } from '../lib/clima';
import { formatarDistancia, linkRota } from '../lib/osm';
import { registrarDocumento, removerDocumentoDeOrigem } from '../lib/documentos';
import { ShotList } from '../components/ShotList';
import { GeradorODModal } from '../components/GeradorODModal';
import { AIButton } from '../components/ui/AIButton';
import { imprimirHtml, baixarHtml } from '../lib/impressao';
import { guardarArquivo, LIMITE_BYTES } from '../lib/arquivos';
import { planosPorCena } from '../lib/planos';
import { marcarCena } from '../lib/registroSet';
import { FechamentoDiaria } from '../components/FechamentoDiaria';
import { SincroniaStripboard } from '../components/SincroniaStripboard';
import { ResumoEquipamento } from '../components/ResumoEquipamento';
import { useRole } from '../hooks/useRole';
import { useArquivo } from '../hooks/useArquivo';

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
  const cenasGlobais = useLiveQuery(() => db.cenas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const veiculos = useLiveQuery(() => db.veiculos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const motoristas = useLiveQuery(() => db.motoristas.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];
  const planosGlobais = useLiveQuery(() => db.planos.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  /**
   * As cenas escaladas para este dia, na ordem em que foram escaladas.
   *
   * Sai de `cena_ids` e das cenas globais. Os campos `diaria.cenas` e
   * `diaria.planos` estão marcados DEPRECATED no tipo desde a v4 — e o bloco de
   * Shot List da exportação ainda lia os dois. O resultado é que a caixinha
   * "Shot List" existia, a pessoa marcava, e nada saía impresso: em qualquer
   * diária feita do jeito atual esses arrays estão vazios.
   */
  const cenasDaDiaria = (diaria?.cena_ids || [])
    .map(id => cenasGlobais.find(c => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  /** cena → planos decupados, já na ordem de filmagem (ver `lib/planos.ts`). */
  const planosDaCena = planosPorCena(planosGlobais);

  /** O que já foi marcado hoje. Alimenta o relatório de fechamento. */
  const registrosDoDia = useLiveQuery(
    () => db.registros_cena.where('diaria_id').equals(diariaId!).toArray(),
    [diariaId]
  ) || [];

  const [fechamentoAberto, setFechamentoAberto] = useState(false);
  const { perfilId: meuPerfilId } = useRole();

  const [newTask, setNewTask] = useState('');
  const [selecionandoEquipe, setSelecionandoEquipe] = useState(false);
  const [selecionandoLocacoes, setSelecionandoLocacoes] = useState(false);
  const [novaHora, setNovaHora] = useState('');
  const [novoEvento, setNovoEvento] = useState('');

  const [climas, setClimas] = useState<ClimaPorLocal[]>([]);
  const [climaStatus, setClimaStatus] = useState<'idle' | 'carregando' | 'ok' | 'erro' | 'sem_coords'>('idle');

  const [exportModalAberto, setExportModalAberto] = useState(false);
  const [geradorAberto, setGeradorAberto] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    clima: true, horarios: true, locacoes: true, equipe: true,
    transporte: true, checklist: true, observacoes: true, shotlist: true,
    hospital: true
  });

  /*
    TODAS as locações do dia que tenham coordenadas — não só a primeira.

    Antes isto era um `.find()`: com dois sets, o app buscava o clima de um deles
    e mostrava sem dizer qual. Numa diária que atravessa a cidade — ou que sai
    dela — a previsão do set errado é pior que previsão nenhuma, porque a equipe
    se veste pela informação errada achando que está informada.
  */
  const locaisDoDia = (diaria?.locacoes_ids || [])
    .map(id => locacoes.find(l => l.id === id))
    .filter((l): l is Locacao => Boolean(l && parseCoords(l.coordenadas)));

  const dataDiaria = diaria?.data;
  const chaveLocais = locaisDoDia.map(l => `${l.id}:${l.coordenadas}`).join('|');

  useEffect(() => {
    let cancelado = false;
    if (locaisDoDia.length === 0) { setClimaStatus('sem_coords'); setClimas([]); return; }
    if (!dataDiaria) return;

    setClimaStatus('carregando');
    Promise.all(
      locaisDoDia.map(async loc => {
        const c = parseCoords(loc.coordenadas)!;
        const previsao = await buscarClima(c.lat, c.lng, dataDiaria).catch(() => null);
        // Só o id e o nome viajam: `ClimaPorLocal` não precisa da locação
        // inteira, e um tipo mínimo deixa a função reaproveitável no calendário.
        return previsao ? { locacao: { id: loc.id, nome: loc.nome }, clima: previsao } : null;
      })
    )
      .then(res => {
        if (cancelado) return;
        const bons = res.filter((r): r is ClimaPorLocal => r !== null);
        setClimas(bons);
        setClimaStatus(bons.length ? 'ok' : 'erro');
      })
      .catch(() => { if (!cancelado) setClimaStatus('erro'); });

    return () => { cancelado = true; };
    // `chaveLocais` no lugar do array: o array é recriado a cada render e
    // dispararia uma busca por quadro, batendo na API sem parar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveLocais, dataDiaria]);

  /*
    Dois sets no mesmo bairro têm a MESMA previsão, e mostrar dois cartões
    idênticos é ruído que faz a pessoa parar de ler. Quando a previsão bate,
    junta num cartão só com os dois nomes; quando difere, mostra separado — que
    é justamente quando a informação importa.
  */
  const gruposDeClima = agruparClimasIguais(climas);

  if (!diaria) return <div className="screen-padding">Carregando Diária...</div>;

  const escalados = perfis.filter(p => (diaria.equipe_escalada || []).includes(p.id));

  const toggleUnidadeB = async () => {
    await db.diarias.update(diariaId!, { tem_unidade_b: !diaria.tem_unidade_b });
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    await db.diaria_tasks.add({ id: crypto.randomUUID(), projeto_id: projetoId!, diaria_id: diariaId!, departamento_id: 'geral', descricao: newTask, status: 'pendente' });
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
  /** Grupos/times reutilizáveis (v4 §4.4): escala todo mundo de uma vez. */
  const escalarGrupo = async (grupoId: string) => {
    const grupo = (projeto?.grupos || []).find(g => g.id === grupoId);
    if (!grupo) return;
    const equipeAtual = new Set(diaria.equipe_escalada || []);
    grupo.perfis_ids.forEach(id => equipeAtual.add(id));
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

  // ---- Transporte & Comboios ----
  const salvarTransporte = async (valor: string) => {
    await db.diarias.update(diariaId!, { transporte: valor });
  };
  
  const addComboio = async () => {
    const novo = { id: crypto.randomUUID(), veiculo: '', motorista: '', saida: '', passageiros_ids: [], ponto_encontro: '' };
    await db.diarias.update(diariaId!, { comboios: [...(diaria.comboios || []), novo] });
  };

  const updateComboio = async (cid: string, campo: string, valor: any) => {
    const atualizados = (diaria.comboios || []).map(c => c.id === cid ? { ...c, [campo]: valor } : c);
    await db.diarias.update(diariaId!, { comboios: atualizados });
  };

  /** Puxa veículo do cadastro de Transporte, já trazendo o motorista padrão. */
  const vincularVeiculo = async (cid: string, veiculoId: string) => {
    const v = veiculos.find(x => x.id === veiculoId);
    const motPadrao = v?.motorista_id ? motoristas.find(m => m.id === v.motorista_id) : undefined;
    const atualizados = (diaria.comboios || []).map(c => c.id === cid ? {
      ...c,
      veiculo_id: veiculoId || undefined,
      veiculo: v ? [v.nome, v.placa].filter(Boolean).join(' · ') : c.veiculo,
      ...(motPadrao && !c.motorista_id ? { motorista_id: motPadrao.id, motorista: motPadrao.nome } : {}),
    } : c);
    await db.diarias.update(diariaId!, { comboios: atualizados });
  };

  const vincularMotorista = async (cid: string, motoristaId: string) => {
    const m = motoristas.find(x => x.id === motoristaId);
    const atualizados = (diaria.comboios || []).map(c => c.id === cid ? {
      ...c,
      motorista_id: motoristaId || undefined,
      motorista: m ? [m.nome, m.telefone].filter(Boolean).join(' · ') : c.motorista,
    } : c);
    await db.diarias.update(diariaId!, { comboios: atualizados });
  };

  const removeComboio = async (cid: string) => {
    await db.diarias.update(diariaId!, { comboios: (diaria.comboios || []).filter(c => c.id !== cid) });
  };
  
  const togglePassageiro = async (cid: string, pid: string) => {
    const atualizados = (diaria.comboios || []).map(c => {
      if (c.id === cid) {
        const pids = c.passageiros_ids.includes(pid) 
          ? c.passageiros_ids.filter(id => id !== pid) 
          : [...c.passageiros_ids, pid];
        return { ...c, passageiros_ids: pids };
      }
      return c;
    });
    await db.diarias.update(diariaId!, { comboios: atualizados });
  };

  // ---- Anexos (no Storage, com cópia no aparelho para o set sem sinal) ----
  const addAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // O teto era 3MB porque o arquivo ia inteiro para dentro da linha. Agora
    // ele vai para o Storage, então cabe o que o aparelho aguenta guardar.
    if (file.size > LIMITE_BYTES) { alert(`Arquivo muito grande (máx ${Math.round(LIMITE_BYTES / 1024 / 1024)}MB).`); return; }
    const dados = await guardarArquivo(projetoId!, file, file.name, file.type);
    const anexo: AnexoOD = { id: crypto.randomUUID(), nome: file.name, tipo: file.type, dados };
    await db.diarias.update(diariaId!, { anexos: [...(diaria.anexos || []), anexo] });
    // Índice central: o anexo também aparece na página Documentos, pasta "Diárias".
    await registrarDocumento({
      projetoId: projetoId!,
      origem: 'diaria',
      refId: anexo.id,
      nome: `D${String(diaria.numero).padStart(2, '0')} — ${file.name}`,
      url: dados,
      tipo: 'upload',
      tamanho: file.size,
      previewUrl: file.type.startsWith('image/') ? dados : undefined,
    });
    e.target.value = '';
  };
  const removeAnexo = async (aid: string) => {
    await db.diarias.update(diariaId!, { anexos: (diaria.anexos || []).filter(a => a.id !== aid) });
    await removerDocumentoDeOrigem(projetoId!, 'diaria', aid);
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

  const formataData = (d: string) => { const [a, m, dia] = d.split('-'); return `${dia}/${m}/${a.slice(-2)}`; };

  // Locações da diária que têm hospital confirmado (v4 §4.2)
  const locsDaDiaria = (diaria.locacoes_ids || []).map(lid => locacoes.find(l => l.id === lid)).filter(Boolean) as typeof locacoes;
  const locsComHospital = locsDaDiaria.filter(l => l.hospital_proximo);

  const rotaHospital = (loc: typeof locacoes[number]) => {
    const origem = parseCoords(loc.coordenadas);
    if (!origem || !loc.hospital_coordenadas) return null;
    const [hLat, hLng] = loc.hospital_coordenadas.split(',').map(Number);
    if (Number.isNaN(hLat) || Number.isNaN(hLng)) return null;
    return linkRota(origem, { lat: hLat, lng: hLng });
  };

  // ---- Fechar / arquivar diária (v4 §4.5) ----
  // Arquivar = gerar o documento de prestação de contas. Os dados CONTINUAM no banco.
  const fecharDiaria = async () => {
    const jaFechada = !!diaria.fechada;
    if (jaFechada) {
      if (!confirm('Reabrir esta diária para edição?')) return;
      // Volta a `publicada`, não a `rascunho`: a OD já saiu para a equipe, e
      // devolver a diária ao espelho faria as cenas se mexerem sozinhas num dia
      // que já foi impresso e distribuído.
      await db.diarias.update(diariaId!, { fechada: false, data_fechamento: undefined, estado: 'publicada' });
      if (projetoId) await logAction(projetoId, 'editar', 'diaria', diariaId!, `Reabriu a Diária ${diaria.numero}`);
      return;
    }

    // Fechar deixou de ser um `confirm()`: virou o relatório de produção, onde
    // se confere o que saiu e se resolve o que ficou sem marcação. Ver
    // `FechamentoDiaria`.
    setFechamentoAberto(true);
  };

  /** Chamado pelo relatório, depois de a pessoa conferir tudo. */
  const confirmarFechamento = async (notas: string) => {
    await db.diarias.update(diariaId!, {
      fechada: true,
      estado: 'fechada',
      data_fechamento: Date.now(),
      // As notas do wrap entram nas observações da diária, que é onde o resto
      // do app já procura o texto livre do dia.
      observacoes: notas
        ? `${diaria.observacoes ? diaria.observacoes + '\n\n' : ''}Fechamento: ${notas}`
        : diaria.observacoes,
    });

    /*
      Cena escalada e nunca marcada vira `nao_gravada` AGORA, na hora de fechar.

      Não é assumir sem perguntar: a tela mostrou cada uma delas destacada e
      ofereceu os três botões. Quem fechou mesmo assim decidiu. E deixar sem
      registro nenhum seria pior — a cena sumiria do relatório e da fila de
      repescagem, como se nunca tivesse sido programada.
    */
    const registrosDoDia = await db.registros_cena.where('diaria_id').equals(diariaId!).toArray();
    const marcadas = new Set(registrosDoDia.map(r => r.cena_id));
    for (const cena of cenasDaDiaria) {
      if (!marcadas.has(cena.id)) {
        await marcarCena(projetoId!, diariaId!, cena.id, 'nao_gravada', {
          registrado_por: meuPerfilId || undefined,
          motivo: 'sem registro no fechamento',
        });
      }
    }

    if (projetoId) await logAction(projetoId, 'editar', 'diaria', diariaId!, `Fechou a Diária ${diaria.numero}`);
    setFechamentoAberto(false);
    gerarResumoFechamento();
  };

  const gerarResumoFechamento = () => {
    const tarefasFeitas = tasks.filter(t => t.status === 'concluido').length;
    const confirmados = (diaria.confirmacoes || []).filter(cid => (diaria.equipe_escalada || []).includes(cid)).length;

    const linhasDespesas = despesasDiaria.map(d => {
      const quemPagou = d.pagadores.map(p => {
        if (p.tipo === 'producao') return 'Produção';
        if (p.tipo === 'departamento') return departamentos.find(x => x.id === p.id_ref)?.nome || 'Departamento';
        const pf = perfis.find(x => x.id === p.id_ref);
        return pf ? `${pf.nome} ${pf.sobrenome || ''}`.trim() : '—';
      }).join(', ');
      return `<tr><td>${d.descricao}</td><td>${d.categoria || '-'}</td><td>${quemPagou}</td><td style="text-align:right"><b>R$ ${d.valor_total.toFixed(2)}</b></td></tr>`;
    }).join('');

    const linhasCenas = (diaria.cena_ids || []).map(cid => {
      const c = cenasGlobais.find(x => x.id === cid);
      if (!c) return '';
      return `<li><b>Cena ${c.numero}</b> — ${c.descricao} (${(c.ambiente || 'ext').toUpperCase()} / ${c.periodo || 'dia'})</li>`;
    }).join('');

    const linhasEquipe = escalados
      .map(p => `<li>${p.nome} ${p.sobrenome || ''} — ${p.funcao || 'Equipe'}${(diaria.confirmacoes || []).includes(p.id) ? ' ✔' : ''}</li>`)
      .join('');

    const estouro = limiteGasto > 0 && totalGasto > limiteGasto;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Fechamento — Diária ${diaria.numero}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;padding:40px;max-width:820px;margin:0 auto}
        h1{margin:0;font-size:26px}
        h2{border-bottom:2px solid #111;padding-bottom:4px;margin-top:28px;font-size:14px;text-transform:uppercase;letter-spacing:.08em}
        table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}
        td,th{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left}
        li{margin:3px 0}
        .muted{color:#666}
        .kpis{display:flex;gap:16px;margin-top:16px;flex-wrap:wrap}
        .kpi{border:1px solid #ddd;border-radius:10px;padding:12px 16px;min-width:130px}
        .kpi .rot{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}
        .kpi .val{font-size:20px;font-weight:bold;margin-top:2px}
        .alerta{color:#c0392b}
      </style></head><body>
      <h1>${projeto?.nome || 'Produção'}</h1>
      <div class="muted">Fechamento da Diária ${String(diaria.numero).padStart(2, '0')} · ${formataData(diaria.data)}</div>

      <div class="kpis">
        <div class="kpi"><div class="rot">Gasto do dia</div><div class="val ${estouro ? 'alerta' : ''}">R$ ${totalGasto.toFixed(2)}</div></div>
        <div class="kpi"><div class="rot">Valor ideal</div><div class="val">${valorIdeal > 0 ? `R$ ${valorIdeal.toFixed(2)}` : '—'}</div></div>
        <div class="kpi"><div class="rot">Valor máximo</div><div class="val">${limiteGasto > 0 ? `R$ ${limiteGasto.toFixed(2)}` : '—'}</div></div>
        <div class="kpi"><div class="rot">Equipe</div><div class="val">${confirmados}/${escalados.length}</div></div>
        <div class="kpi"><div class="rot">Checklist</div><div class="val">${tarefasFeitas}/${tasks.length}</div></div>
      </div>
      ${estouro ? '<p class="alerta"><b>Atenção:</b> o gasto do dia passou do valor máximo definido.</p>' : ''}

      ${linhasCenas ? `<h2>Cenas programadas</h2><ul>${linhasCenas}</ul>` : ''}
      ${linhasEquipe ? `<h2>Equipe do dia (✔ = presença confirmada)</h2><ul>${linhasEquipe}</ul>` : ''}

      <h2>Prestação de contas</h2>
      ${linhasDespesas
        ? `<table><tr><th>Descrição</th><th>Categoria</th><th>Quem pagou</th><th style="text-align:right">Valor</th></tr>${linhasDespesas}
           <tr><td colspan="3"><b>Total</b></td><td style="text-align:right"><b>R$ ${totalGasto.toFixed(2)}</b></td></tr></table>`
        : '<p class="muted">Nenhuma despesa lançada nesta diária.</p>'}

      ${diaria.observacoes ? `<h2>Observações</h2><p>${diaria.observacoes.replace(/\n/g, '<br>')}</p>` : ''}

      <p class="muted" style="margin-top:40px;font-size:11px">Gerado pelo SetProd em ${new Date().toLocaleString('pt-BR')}. Os dados permanecem salvos no projeto.</p>
      </body></html>`;

    if (!imprimirHtml(html)) baixarHtml(html, `resumo-diaria-${diaria.numero}`);
  };

  // ---- Exportar OD em PDF (via impressão do navegador) ----
  const exportarPDF = async () => {
    const nomeLoc = (diaria.locacoes_ids || []).map(id => locacoes.find(l => l.id === id)).filter(Boolean);
    const linhaEquipe = escalados.map(p => `<li>${p.nome} ${p.sobrenome || ''} — ${p.funcao || 'Equipe'}${(diaria.confirmacoes || []).includes(p.id) ? ' ✔ confirmado' : ''}</li>`).join('');
    const linhaHorarios = (diaria.horarios || []).map(h => `<tr><td style="padding:4px 12px;font-weight:bold">${h.hora}</td><td style="padding:4px 12px">${h.evento}</td></tr>`).join('');
    const linhaLoc = nomeLoc.map((l: any) => `<li><b>${l.nome}</b> — ${l.endereco}${l.hospital_proximo ? ` · Hospital: ${l.hospital_proximo}` : ''}</li>`).join('');
    const linhaTasks = tasks.map(t => `<li>${t.status === 'concluido' ? '☑' : '☐'} ${t.descricao}</li>`).join('');

    const linhaComboios = (diaria.comboios || []).map(c => {
      const pNomes = c.passageiros_ids.map(id => {
        const p = perfis.find(per => per.id === id);
        return p ? `${p.nome} ${p.sobrenome || ''}` : '';
      }).filter(Boolean).join(', ');
      return `<tr><td style="padding:4px 12px;font-weight:bold">${c.veiculo || 'Veículo'}</td><td style="padding:4px 12px">${c.motorista || '-'}</td><td style="padding:4px 12px">${c.ponto_encontro || '-'}</td><td style="padding:4px 12px;font-weight:bold">${c.saida || '-'}</td><td style="padding:4px 12px;font-size:12px">${pNomes}</td></tr>`;
    }).join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>OD - Diária ${diaria.numero}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:800px;margin:0 auto}
      h1{margin:0}h2{border-bottom:2px solid #111;padding-bottom:4px;margin-top:24px;font-size:15px;text-transform:uppercase}
      table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px}li{margin:2px 0}.muted{color:#666}</style></head><body>
      <h1>${projeto?.nome || 'Produção'}</h1>
      <div class="muted">Ordem do Dia — Diária ${String(diaria.numero).padStart(2, '0')} · ${formataData(diaria.data)}${diaria.tem_unidade_b ? ' · Unidades A+B' : ''}</div>
      ${/*
          A previsão impressa traz TODOS os sets do dia, com o nome de cada um.
          Sem o nome, a equipe lia uma previsão sem saber de onde ela era — e
          numa diária que atravessa a cidade isso é pior que não imprimir nada.
        */''}
      ${exportConfig.clima && gruposDeClima.length > 0 ? `<h2>Previsão</h2>${
        gruposDeClima.map(g => `<p><b>${g.locais.join(' · ')}</b><br>${descreverClima(g.clima.code).emoji} ${descreverClima(g.clima.code).texto} · Nascer ${g.clima.sunrise||'--'} · Pôr ${g.clima.sunset||'--'} · Máx ${Math.round(g.clima.tempMax)}° / Mín ${Math.round(g.clima.tempMin)}° · Chuva ${g.clima.chuvaProb}%</p>`).join('')
      }` : ''}
      ${exportConfig.horarios && linhaHorarios ? `<h2>Horários</h2><table>${linhaHorarios}</table>` : ''}
      ${exportConfig.locacoes && linhaLoc ? `<h2>Locações</h2><ul>${linhaLoc}</ul>` : ''}
      ${exportConfig.equipe && linhaEquipe ? `<h2>Equipe Escalada</h2><ul>${linhaEquipe}</ul>` : ''}
      ${exportConfig.transporte && ((diaria.comboios && diaria.comboios.length > 0) || diaria.transporte) ? `
        <h2>Transporte / Logística</h2>
        ${diaria.transporte ? `<p>${diaria.transporte.replace(/\n/g, '<br>')}</p>` : ''}
        ${linhaComboios ? `<table style="width:100%;font-size:13px;margin-top:8px"><tr style="text-align:left;background:#eee"><th>Veículo</th><th>Motorista</th><th>Ponto de encontro</th><th>Saída</th><th>Passageiros</th></tr>${linhaComboios}</table>` : ''}
      ` : ''}
      ${exportConfig.hospital && locsComHospital.length > 0 ? `<h2>Emergência — Hospital mais próximo</h2><ul>${
        locsComHospital.map(l => {
          const rota = rotaHospital(l);
          return `<li><b>${l.hospital_proximo}</b>${l.hospital_distancia !== undefined ? ` — ${formatarDistancia(l.hospital_distancia)}` : ''}${l.hospital_telefone ? ` · Tel: ${l.hospital_telefone}` : ''} <span class="muted">(a partir de ${l.nome})</span>${rota ? `<br><span style="font-size:11px">Rota: ${rota}</span>` : ''}</li>`;
        }).join('')
      }</ul>` : ''}
      ${exportConfig.checklist && linhaTasks ? `<h2>Checklist</h2><ul>${linhaTasks}</ul>` : ''}
      ${exportConfig.observacoes && diaria.observacoes ? `<h2>Observações</h2><p>${diaria.observacoes}</p>` : ''}
      
      ${exportConfig.shotlist && cenasDaDiaria.length > 0 ? `<h2>Shot List</h2>
        ${cenasDaDiaria.map(c => {
          const pl = planosDaCena.get(c.id) || [];
          const trs = pl.map(p => `<tr><td style="width:40px;text-align:center"><b>${p.numero}</b></td><td>${p.descricao || '-'}</td><td>${p.tamanho||'-'}</td><td>${p.movimento||'-'}</td><td>${p.lente||'-'}</td></tr>`).join('');
          return `
            <div style="margin-top:16px;background:#f9f9f9;padding:12px;border:1px solid #ddd;border-radius:8px">
              <strong>Cena ${c.numero}</strong>: ${c.descricao} (${c.ambiente||'ext'} / ${c.periodo||'dia'})
              ${pl.length > 0 ? `<table style="width:100%;margin-top:8px;font-size:13px">
                <tr style="text-align:left;background:#eee"><th>Plano</th><th>Ação</th><th>Tamanho</th><th>Movimento</th><th>Lente</th></tr>
                ${trs}
              </table>` : '<div class="muted" style="margin-top:6px;font-size:12px">Sem decupagem para esta cena.</div>'}
            </div>
          `;
        }).join('')}
      ` : ''}
      </body></html>`;

    if (!imprimirHtml(html)) baixarHtml(html, `ordem-do-dia-${diaria.numero}`);
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
        
        <AIButton onClick={() => setGeradorAberto(true)}>
          Gerar OD com IA
        </AIButton>

        <button onClick={() => setExportModalAberto(true)} className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)' }}>
          <FileDown size={16} /> OD Simples
        </button>

        <button
          onClick={fecharDiaria}
          className="btn-icon"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)' }}
          title={diaria.fechada ? 'Reabrir a diária para edição' : 'Gerar o resumo de fechamento (os dados continuam salvos)'}
        >
          {diaria.fechada ? <><Lock size={16} /> Reabrir</> : <><Archive size={16} /> Fechar Diária</>}
        </button>
      </div>

      {diaria.fechada && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--color-success)' }}>
          <Archive size={18} className="text-success" />
          <div style={{ flex: 1 }}>
            <div className="font-bold text-sm">Diária fechada</div>
            <div className="text-xs text-muted">
              Arquivada em {diaria.data_fechamento ? new Date(diaria.data_fechamento).toLocaleString('pt-BR') : '—'}. Os dados continuam no banco.
            </div>
          </div>
          <button onClick={gerarResumoFechamento} className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-light)', padding: '6px 12px' }}>
            <FileDown size={14} /> <span className="text-xs">Resumo</span>
          </button>
        </div>
      )}

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
                {(projeto?.grupos || []).map(g => (
                  <button key={g.id} onClick={() => escalarGrupo(g.id)} className="text-xs" style={{ padding: '4px 10px', borderRadius: '12px', border: '1px solid var(--accent)', backgroundColor: 'var(--bg-primary)', color: 'var(--accent)', whiteSpace: 'nowrap', fontWeight: 'bold' }} title={`Grupo com ${g.perfis_ids.length} pessoa(s)`}>
                    + {g.nome}
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
        {climaStatus === 'ok' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {gruposDeClima.map((g, i) => (
              <div
                key={g.locais.join('|')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                  paddingTop: i > 0 ? '14px' : 0,
                  borderTop: i > 0 ? '1px solid var(--border-light)' : 'none',
                }}
              >
                <div style={{ fontSize: '40px', lineHeight: 1 }}>{descreverClima(g.clima.code).emoji}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="font-bold">{descreverClima(g.clima.code).texto}</div>
                  {/* O nome do set SEMPRE aparece, e todos eles. Antes só um era
                      consultado e mostrado, e não dava para saber qual. */}
                  <div className="text-sm text-secondary">{g.locais.join(' · ')}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '20px', textAlign: 'center' }}>
                  <div><div className="text-xs text-muted uppercase">Nascer</div><div className="font-bold text-secondary">{g.clima.sunrise || '--'}</div></div>
                  <div><div className="text-xs text-muted uppercase">Pôr</div><div className="font-bold text-secondary">{g.clima.sunset || '--'}</div></div>
                  <div><div className="text-xs text-muted uppercase">Máx</div><div className="font-bold">{Math.round(g.clima.tempMax)}°</div></div>
                  <div><div className="text-xs text-muted uppercase">Mín</div><div className="font-bold">{Math.round(g.clima.tempMin)}°</div></div>
                  <div><div className="text-xs text-muted uppercase">Chuva</div><div className="font-bold" style={{ color: g.clima.chuvaProb >= 50 ? 'var(--color-danger)' : 'var(--text-primary)' }}>{g.clima.chuvaProb}%</div></div>
                </div>
              </div>
            ))}

            {/* Só aparece quando há de fato diferença — se os sets estão no mesmo
                bairro, o agrupamento já os juntou e este aviso some. */}
            {gruposDeClima.length > 1 && (
              <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                Os sets do dia têm previsões diferentes. Vale conferir qual vale para
                cada bloco antes de decidir figurino e cobertura.
              </div>
            )}

            {/* Locação sem coordenada não some em silêncio: ela existe na diária
                e a equipe vai para lá do mesmo jeito. */}
            {(() => {
              const semCoord = locsDaDiaria.filter(l => !parseCoords(l.coordenadas));
              if (semCoord.length === 0) return null;
              return (
                <div className="text-xs text-muted">
                  Sem previsão para {semCoord.map(l => l.nome).join(', ')} — falta a
                  coordenada em Locações.
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* O que a fotografia conferiu. Some sozinho quando não há acervo
          vinculado — ver `ResumoEquipamento`. */}
      <ResumoEquipamento projetoId={projetoId!} diariaId={diariaId!} />

      {/* Emergência — hospital mais próximo das locações do dia */}
      <div className="card">
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Cross size={16} className="text-danger" /> Emergência — Hospital Mais Próximo
        </h2>
        {locsDaDiaria.length === 0 ? (
          <div className="text-sm text-muted">Defina as locações da diária para ver o hospital de referência.</div>
        ) : locsComHospital.length === 0 ? (
          <div className="text-sm text-muted">
            Nenhuma locação do dia tem hospital confirmado. Abra o módulo Locações e use "Achar Hospital Próximo (OSM)".
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {locsComHospital.map(l => {
              const rota = rotaHospital(l);
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div className="font-bold">{l.hospital_proximo}</div>
                    <div className="text-xs text-muted">
                      a partir de {l.nome}
                      {l.hospital_distancia !== undefined ? ` · ${formatarDistancia(l.hospital_distancia)}` : ''}
                    </div>
                  </div>
                  {l.hospital_telefone && (
                    <a href={`tel:${l.hospital_telefone}`} className="text-sm text-accent font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                      <Phone size={14} /> {l.hospital_telefone}
                    </a>
                  )}
                  {rota && (
                    <a href={rota} target="_blank" rel="noreferrer" className="btn-icon" style={{ padding: '6px 12px', border: '1px solid var(--border-light)', fontSize: '12px', textDecoration: 'none', color: 'var(--text-primary)' }}>
                      Abrir rota
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transporte */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bus size={16} /> Transporte / Logística
          </h2>
          <button onClick={addComboio} className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Plus size={14} /> Novo Comboio/Van
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(diaria.comboios || []).length === 0 && (
            <div className="text-muted text-sm text-center" style={{ padding: '16px 0' }}>
              Nenhum veículo cadastrado. Adicione um comboio para distribuir a equipe.
            </div>
          )}
          
          {(diaria.comboios || []).map((comboio) => (
            <div key={comboio.id} style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Veículo / Van</div>
                  {veiculos.length > 0 && (
                    <select
                      value={comboio.veiculo_id || ''}
                      onChange={e => vincularVeiculo(comboio.id, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', marginBottom: '6px' }}
                    >
                      <option value="">-- Do cadastro de Transporte --</option>
                      {veiculos.map(v => (
                        <option key={v.id} value={v.id}>{v.nome}{v.placa ? ` (${v.placa})` : ''}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={comboio.veiculo}
                    onChange={e => updateComboio(comboio.id, 'veiculo', e.target.value)}
                    placeholder="Ex: Van Elenco"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Motorista / Ref</div>
                  {motoristas.length > 0 && (
                    <select
                      value={comboio.motorista_id || ''}
                      onChange={e => vincularMotorista(comboio.id, e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', marginBottom: '6px' }}
                    >
                      <option value="">-- Do cadastro de Transporte --</option>
                      {motoristas.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={comboio.motorista}
                    onChange={e => updateComboio(comboio.id, 'motorista', e.target.value)}
                    placeholder="Ex: João (Placa XYZ)"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Ponto de Encontro</div>
                  <input
                    type="text"
                    value={comboio.ponto_encontro || ''}
                    onChange={e => updateComboio(comboio.id, 'ponto_encontro', e.target.value)}
                    placeholder="Ex: Metrô Faria Lima"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
                <div style={{ width: '100px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Saída</div>
                  <input
                    type="time"
                    value={comboio.saida}
                    onChange={e => updateComboio(comboio.id, 'saida', e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => removeComboio(comboio.id)} className="btn-icon hover-danger" style={{ padding: '8px', marginBottom: '2px' }} title="Excluir Comboio">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="text-xs text-muted font-bold uppercase mb-2">Passageiros ({comboio.passageiros_ids.length})</div>
              
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {escalados.length === 0 && <span className="text-xs text-muted">Ninguém escalado na diária ainda.</span>}
                {escalados.map(p => {
                  const noComboio = comboio.passageiros_ids.includes(p.id);
                  return (
                    <button 
                      key={p.id}
                      onClick={() => togglePassageiro(comboio.id, p.id)}
                      style={{ 
                        padding: '4px 8px', 
                        fontSize: '12px', 
                        borderRadius: '12px', 
                        cursor: 'pointer',
                        border: noComboio ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        backgroundColor: noComboio ? 'var(--accent)' : 'var(--bg-surface)',
                        color: noComboio ? '#fff' : 'var(--text-primary)',
                        opacity: !noComboio && (diaria.comboios || []).some(c => c.id !== comboio.id && c.passageiros_ids.includes(p.id)) ? 0.3 : 1
                      }}
                      title={!noComboio && (diaria.comboios || []).some(c => c.id !== comboio.id && c.passageiros_ids.includes(p.id)) ? 'Já alocado em outro veículo' : ''}
                    >
                      {p.nome}
                    </button>
                  );
                })}
              </div>

            </div>
          ))}
          
          <div style={{ borderTop: '1px dashed var(--border-light)', margin: '8px 0' }}></div>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Informações Adicionais (Transporte)</div>
          <textarea
            defaultValue={diaria.transporte || ''}
            onBlur={e => salvarTransporte(e.target.value)}
            placeholder="Anotações extras sobre logística..."
            rows={2}
          />
        </div>
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
          {(diaria.anexos || []).length === 0 && <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px' }}>Roteiro do dia, decupagem, referências...</div>}
          {(diaria.anexos || []).map(a => (
            <LinhaAnexo key={a.id} anexo={a} aoRemover={() => removeAnexo(a.id)} />
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

      {/* A ponte com o stripboard vem ANTES da lista de cenas: é ela que explica
          por que a lista é o que é, e por que ela pode ou não mudar sozinha. */}
      <SincroniaStripboard diaria={diaria} />

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

      {fechamentoAberto && (
        <FechamentoDiaria
          numero={diaria.numero}
          projetoId={projetoId!}
          diariaId={diariaId!}
          cenas={cenasDaDiaria}
          registros={registrosDoDia}
          meuPerfilId={meuPerfilId || undefined}
          aoFechar={confirmarFechamento}
          aoCancelar={() => setFechamentoAberto(false)}
        />
      )}

      {geradorAberto && projeto && (
        <GeradorODModal 
          onClose={() => setGeradorAberto(false)}
          projeto={projeto}
          diaria={diaria}
          equipe={perfis}
          locacoes={locacoes}
          departamentos={departamentos}
          cenasGlobais={cenasGlobais}
        />
      )}

    </div>
  );
}

/**
 * Uma linha da lista de anexos.
 *
 * É componente próprio porque resolver o endereço do arquivo virou assíncrono
 * (pode estar no aparelho ou precisar vir do Storage), e hook não pode ser
 * chamado dentro de um `.map`.
 */
function LinhaAnexo({ anexo, aoRemover }: { anexo: AnexoOD; aoRemover: () => void }) {
  const endereco = useArquivo(anexo.dados);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
      <Paperclip size={14} className="text-muted" />
      {endereco ? (
        <a href={endereco} download={anexo.nome} target="_blank" rel="noreferrer" style={{ flex: 1, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{anexo.nome}</a>
      ) : (
        // Sem endereço = o arquivo está no Storage e não há sinal para buscá-lo.
        // Dizer isso é melhor que um link que não abre.
        <span className="text-muted" style={{ flex: 1, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {anexo.nome} <span className="text-xs">(indisponível offline)</span>
        </span>
      )}
      <button onClick={aoRemover} className="btn-icon text-muted" style={{ padding: '6px', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
    </div>
  );
}
