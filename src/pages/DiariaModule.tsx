import { useState, useEffect } from 'react';
import { dinheiro } from '../lib/formato';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Users, MapPin, CheckSquare, Plus, Trash2, Bus, Paperclip, UserCheck, FileDown, Wallet, Archive, Lock } from 'lucide-react';
import type { DiariaTask, AnexoOD, Locacao, ItemDoDia } from '../types';
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
import { oitavosParaPaginas } from '../lib/decupagem';
import { marcarCena, relatorioDoDia } from '../lib/registroSet';
import { FechamentoDiaria } from '../components/FechamentoDiaria';
import { SincroniaStripboard } from '../components/SincroniaStripboard';
import { LinhaDoDia } from '../components/LinhaDoDia';
import { montarLinhaDoDia, calcularDia, calcularAtraso, descreverAtraso, emMinutos } from '../lib/linhaDoDia';
import { estadoDa } from '../lib/sincronizaOD';
import { faseDoDia } from '../lib/faseDoDia';
import { ResumoEquipamento } from '../components/ResumoEquipamento';
import { CardDeLocacao } from '../components/CardDeLocacao';
import { AvisoDeRitmo } from '../components/AvisoDeRitmo';
import { RelogioDoSet } from '../components/RelogioDoSet';
import { RegistroDoSet } from '../components/RegistroDoSet';
import { DistribuirOD } from '../components/DistribuirOD';
import { Colapsavel } from '../components/ui/Colapsavel';
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
  const { perfilId: meuPerfilId, canEditProducao: podeMarcarODia } = useRole();

  const [newTask, setNewTask] = useState('');
  const [frenteAberta, setFrenteAberta] = useState<string | null>(null);
  const [selecionandoEquipe, setSelecionandoEquipe] = useState(false);
  const [selecionandoLocacoes, setSelecionandoLocacoes] = useState(false);

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
    ---- AS FRENTES DO DIA (spec §3) ----

    O conceito de "Unidade A/B" deixou de existir como sistema próprio. A
    divisão do dia vem dos GRUPOS que já se criam na Produção — eram dois
    conceitos fazendo quase a mesma coisa, e manter os dois obrigava a produção
    a escalar a equipe duas vezes, uma em cada lugar.

    Um grupo conta como escalado quando TODA a gente dele está no dia. Meia
    equipe escalada não é uma frente: é uma escalação em andamento, e transformar
    isso em duas abas atrapalharia justamente quem ainda está montando o dia.
  */
  const gruposDoProjeto = projeto?.grupos || [];
  const idsEscalados = new Set(diaria?.equipe_escalada || []);
  const gruposEscalados = gruposDoProjeto.filter(
    g => g.perfis_ids.length > 0 && g.perfis_ids.every(id => idsEscalados.has(id))
  );
  const dividido = gruposEscalados.length >= 2;
  const frenteId = dividido
    ? (gruposEscalados.some(g => g.id === frenteAberta) ? frenteAberta! : gruposEscalados[0].id)
    : null;
  const grupoDaFrente = gruposEscalados.find(g => g.id === frenteId);
  const frente = frenteId ? (diaria?.frentes || {})[frenteId] : undefined;

  /**
   * Todas as locações do dia — a união das frentes quando ele está dividido.
   *
   * A previsão do tempo e o hospital são buscados por aqui, e não pela aba
   * aberta: trocar de aba não pode disparar uma busca nova, e a OD impressa
   * precisa dos dois sets, não só do que estava na tela na hora de exportar.
   */
  const idsDasLocacoesDoDia = dividido
    ? Array.from(new Set(gruposEscalados.flatMap(g => (diaria?.frentes || {})[g.id]?.locacoes_ids || [])))
    : (diaria?.locacoes_ids || []);

  /*
    TODAS as locações do dia que tenham coordenadas — não só a primeira.

    Antes isto era um `.find()`: com dois sets, o app buscava o clima de um deles
    e mostrava sem dizer qual. Numa diária que atravessa a cidade — ou que sai
    dela — a previsão do set errado é pior que previsão nenhuma, porque a equipe
    se veste pela informação errada achando que está informada.
  */
  const locaisDoDia = idsDasLocacoesDoDia
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

  /*
    A FASE DO DIA (Parte 2, §1).

    Não é escolha de ninguém: exportar a OD é a linha divisória, e a chamada é o
    que liga o registro. Ver `lib/faseDoDia.ts` — a razão de o seletor
    "Montar / No set" ter sido removido está escrita lá.
  */
  const fase = faseDoDia(diaria);
  const dia = calcularDia(montarLinhaDoDia(dividido ? { linha_do_tempo: frente?.linha_do_tempo, cena_ids: frente?.cena_ids || [] } : diaria), dividido ? frente?.chamada : diaria.chamada, id => cenasGlobais.find(c => c.id === id));
  const atrasoDoDia = calcularAtraso(dia);

  /** Quem aparece na aba aberta. Sem divisão, é o dia inteiro. */
  const escaladosDaVisao = dividido
    ? escalados.filter(p => grupoDaFrente?.perfis_ids.includes(p.id))
    : escalados;

  /** As locações da aba aberta. */
  const locacoesDaVisao = dividido ? (frente?.locacoes_ids || []) : (diaria.locacoes_ids || []);

  /**
   * De onde a linha do tempo sai, e para onde ela volta.
   *
   * Estes quatro juntos são o que permite a `LinhaDoDia` não saber se está
   * mexendo na diária ou numa frente dentro dela.
   */
  const visaoDoDia = dividido
    ? { linha_do_tempo: frente?.linha_do_tempo, cena_ids: frente?.cena_ids || [] }
    : diaria;
  const chamadaDaVisao = dividido ? frente?.chamada : diaria.chamada;

  const gravarNaFrente = async (campos: Record<string, unknown>) => {
    if (!frenteId) return;
    const frentes = { ...(diaria.frentes || {}) };
    frentes[frenteId] = { ...(frentes[frenteId] || {}), ...campos };
    await db.diarias.update(diariaId!, { frentes });
  };

  const gravarLinha = (linha: ItemDoDia[]) =>
    dividido ? gravarNaFrente({ linha_do_tempo: linha }) : db.diarias.update(diariaId!, { linha_do_tempo: linha });

  const gravarChamada = (hora: string) =>
    dividido ? gravarNaFrente({ chamada: hora }) : db.diarias.update(diariaId!, { chamada: hora });

  /** Cenas escaladas no dia que ainda não foram para nenhuma frente. */
  const cenasEmFrentes = new Set(
    gruposEscalados.flatMap(g => (diaria.frentes || {})[g.id]?.cena_ids || [])
  );
  const cenasOrfas = dividido ? cenasDaDiaria.filter(c => !cenasEmFrentes.has(c.id)) : [];

  const trazerOrfasParaAFrente = () =>
    gravarNaFrente({ cena_ids: [...(frente?.cena_ids || []), ...cenasOrfas.map(c => c.id)] });

  const climaDaLocacao = (locacaoId: string) =>
    climas.find(c => c.locacao.id === locacaoId)?.clima;

  /** Por que este set não tem previsão. Silêncio aqui vira "o app está quebrado". */
  const motivoSemClima = (loc: Locacao) => {
    if (!parseCoords(loc.coordenadas)) return 'Falta a coordenada desta locação — cadastre em Locações.';
    if (climaStatus === 'carregando') return 'Consultando a previsão…';
    return 'Previsão indisponível: sem internet, ou data fora da janela de ~16 dias.';
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
    const locs = locacoesDaVisao;
    const novas = locs.includes(locId) ? locs.filter(id => id !== locId) : [...locs, locId];
    // Dia dividido: a locação é da frente, não do dia. É o ponto todo de dividir —
    // duas equipes em dois lugares diferentes ao mesmo tempo.
    if (dividido) await gravarNaFrente({ locacoes_ids: novas });
    else await db.diarias.update(diariaId!, { locacoes_ids: novas });
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

  /** As locações da aba aberta — são estas que viram cartão na tela. */
  const locsDaDiaria = locacoesDaVisao.map(lid => locacoes.find(l => l.id === lid)).filter(Boolean) as typeof locacoes;

  /*
    O bloco de emergência da OD impressa olha o DIA INTEIRO, não a aba.

    Quem imprime está exportando o documento do dia, e um papel de segurança que
    traz o hospital de uma frente e omite o da outra é pior que nenhum: quem
    está na frente que ficou de fora acha que está coberto.
  */
  const locsComHospital = idsDasLocacoesDoDia
    .map(lid => locacoes.find(l => l.id === lid))
    .filter((l): l is Locacao => Boolean(l?.hospital_proximo));

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
    gerarDPR();
  };

  /**
   * O DPR — Relatório Diário de Produção (spec §6).
   *
   * O nome na indústria é Daily Production Report, e ele não é um resumo bonito
   * do dia: é o documento de prestação de contas. O que ele tem de diferente de
   * um resumo é o que ficou de FORA — cena agendada e não filmada, com o motivo
   * de cada uma; hora real contra hora planejada; quem faltou. É a metade
   * incômoda, e é justamente a que decide o que acontece amanhã.
   */
  const gerarDPR = () => {
    const tarefasFeitas = tasks.filter(t => t.status === 'concluido').length;
    const confirmados = (diaria.confirmacoes || []).filter(cid => (diaria.equipe_escalada || []).includes(cid)).length;
    const relatorio = relatorioDoDia(cenasDaDiaria, registrosDoDia);

    const linhasDespesas = despesasDiaria.map(d => {
      const quemPagou = d.pagadores.map(p => {
        if (p.tipo === 'producao') return 'Produção';
        if (p.tipo === 'departamento') return departamentos.find(x => x.id === p.id_ref)?.nome || 'Departamento';
        const pf = perfis.find(x => x.id === p.id_ref);
        return pf ? `${pf.nome} ${pf.sobrenome || ''}`.trim() : '—';
      }).join(', ');
      return `<tr><td>${d.descricao}</td><td>${d.categoria || '-'}</td><td>${quemPagou}</td><td style="text-align:right"><b>${dinheiro(d.valor_total)}</b></td></tr>`;
    }).join('');

    /*
      Planejado contra realizado, lado a lado.

      É a leitura que o DPR existe para permitir. Só os horários reais não dizem
      nada; só os planejados descrevem um dia que não aconteceu. A diferença
      entre as duas colunas é o relatório.
    */
    const dia = calcularDia(montarLinhaDoDia(diaria), diaria.chamada, id => cenasGlobais.find(c => c.id === id));
    const atraso = calcularAtraso(dia);
    const linhasTempo = dia.itens.map(c => {
      const rotulo = c.cena
        ? `<b>Cena ${c.cena.numero}</b> — ${c.cena.descricao}`
        : (c.item.titulo || '—');
      const real = c.item.hora_real;
      const diff = real ? emMinutos(real)! - c.inicio : null;
      return `<tr>
        <td style="white-space:nowrap">${c.hora}</td>
        <td style="white-space:nowrap"><b>${real || '—'}</b></td>
        <td style="white-space:nowrap" class="${diff !== null && diff > 5 ? 'alerta' : 'muted'}">${diff !== null && Math.abs(diff) >= 5 ? descreverAtraso(diff) : ''}</td>
        <td>${rotulo}</td>
      </tr>`;
    }).join('');

    const linhaCena = (c: typeof cenasDaDiaria[number]) => {
      const reg = registrosDoDia.find(x => x.cena_id === c.id);
      const detalhes = [
        reg?.oitavos_gravados !== undefined ? `${oitavosParaPaginas(reg.oitavos_gravados)} pág.` : '',
        reg?.setups ? `${reg.setups} setup${reg.setups > 1 ? 's' : ''}` : '',
        reg?.som_wild ? 'som wild' : '',
      ].filter(Boolean).join(' · ');

      return `<li><b>Cena ${c.numero}</b> — ${c.descricao} <span class="muted">(${(c.ambiente || 'ext').toUpperCase()} / ${c.periodo || 'dia'})</span>${
        detalhes ? ` <span class="muted">[${detalhes}]</span>` : ''
      }${reg?.motivo ? ` — <b class="alerta">${reg.motivo}</b>` : ''
      }${reg?.cobertura ? `<br><span class="muted">${reg.cobertura}</span>` : ''
      }${reg?.observacao ? `<br><span class="muted">${reg.observacao}</span>` : ''}${
        assinatura(reg?.registrado_por, reg?.atualizado_em || reg?.registrado_em)
      }</li>`;
    };

    /*
      A ASSINATURA AUTOMÁTICA (spec §3.4).

      A indústria resolve isso com um campo de assinatura no rodapé do relatório.
      Como cada pessoa entra com a conta dela, dá para fazer melhor: a autoria é
      por anotação, e não por documento. "Cena 4 — filmada · Mari, 14h32"
      responde uma pergunta que uma assinatura no pé da página nunca responde.
    */
    const nomeDoPerfil = (id?: string) => {
      if (!id) return null;
      const pf = perfis.find(x => x.id === id);
      return pf ? `${pf.nome} ${pf.sobrenome || ''}`.trim() : null;
    };

    const assinatura = (perfilId?: string, quando?: number) => {
      const nome = nomeDoPerfil(perfilId);
      if (!nome) return '';
      const hora = quando ? new Date(quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      return ` <span class="muted" style="font-size:11px">— ${nome}${hora ? `, ${hora}` : ''}</span>`;
    };

    /*
      Ausência é campo do DPR, não fofoca.

      Quem foi escalado e não confirmou presença aparece aqui porque isso muda
      dinheiro (diária paga a quem não veio), escala (o dia seguinte conta com
      essa pessoa) e responsabilidade. Sai como "sem confirmação", que é o que o
      app de fato sabe — dizer "faltou" seria afirmar mais do que se pode.
    */
    const semConfirmar = escalados.filter(p => !(diaria.confirmacoes || []).includes(p.id));

    /*
      A JORNADA DE CADA UM (spec §3.2).

      Sai como tabela porque é o pedaço do relatório que alguém vai conferir
      linha a linha na hora de pagar. Quem não teve nada marcado não some: sai
      com traços, e a lacuna fica visível — um nome ausente da tabela pareceria
      alguém que não estava escalado.
    */
    const presencas = diaria.presencas || {};
    const ROTULO_PRESENCA: Record<string, string> = { chegou: 'Chegou', atrasado: 'Atrasou', faltou: 'Faltou' };
    const linhasJornada = escalados.map(pf => {
      const r = presencas[pf.id];
      const cel = (v?: string) => v || '<span class="muted">—</span>';
      return `<tr>
        <td>${pf.nome} ${pf.sobrenome || ''}<br><span class="muted" style="font-size:11px">${pf.funcao || 'Equipe'}</span></td>
        <td class="${r?.status === 'faltou' ? 'alerta' : ''}">${r ? ROTULO_PRESENCA[r.status] : '<span class="muted">sem marcação</span>'}</td>
        <td>${cel(r?.chegada)}</td>
        <td>${cel(r?.inicio)}</td>
        <td>${cel(r?.refeicao_saida)} – ${cel(r?.refeicao_volta)}</td>
        <td>${cel(r?.fim)}</td>
        <td>${r?.nota || ''}${assinatura(r?.registrado_por, r?.registrado_em)}</td>
      </tr>`;
    }).join('');

    const faltaram = escalados.filter(pf => presencas[pf.id]?.status === 'faltou');

    const ocorrencias = diaria.ocorrencias || [];
    const ROTULO_OCORRENCIA: Record<string, string> = {
      atraso: 'Atraso', equipamento: 'Equipamento', incidente: 'Incidente',
      clima: 'Clima', locacao: 'Locação', transporte: 'Transporte',
    };
    const minutosPerdidos = ocorrencias.reduce((a, o) => a + (o.minutos_perdidos || 0), 0);
    const linhasOcorrencias = ocorrencias.map(o => `<tr>
      <td style="white-space:nowrap">${o.hora || '—'}</td>
      <td><b>${ROTULO_OCORRENCIA[o.tipo] || o.tipo}</b></td>
      <td>${o.minutos_perdidos ? `${o.minutos_perdidos}min` : '<span class="muted">—</span>'}</td>
      <td>${o.descricao}${assinatura(o.registrado_por, o.registrado_em)}</td>
    </tr>`).join('');

    const fig = diaria.figuracao;
    const temFiguracao = Boolean(fig && (fig.quantidade || fig.chamada || fig.wrap || fig.notas));

    const estouro = limiteGasto > 0 && totalGasto > limiteGasto;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>DPR — Diária ${diaria.numero}</title>
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
      <div class="muted">Relatório Diário de Produção (DPR) — Diária ${String(diaria.numero).padStart(2, '0')} · ${formataData(diaria.data)}</div>

      <div class="kpis">
        <div class="kpi"><div class="rot">Cenas filmadas</div><div class="val">${relatorio.gravadas.length} de ${cenasDaDiaria.length}</div></div>
        <div class="kpi"><div class="rot">Não filmadas</div><div class="val ${relatorio.naoGravadas.length ? 'alerta' : ''}">${relatorio.naoGravadas.length}</div></div>
        <div class="kpi"><div class="rot">Wrap</div><div class="val">${atraso.wrapPrevisto || '—'}</div></div>
        <div class="kpi"><div class="rot">Gasto do dia</div><div class="val ${estouro ? 'alerta' : ''}">${dinheiro(totalGasto)}</div></div>
        <div class="kpi"><div class="rot">Equipe</div><div class="val">${confirmados}/${escalados.length}</div></div>
        <div class="kpi"><div class="rot">Checklist</div><div class="val">${tarefasFeitas}/${tasks.length}</div></div>
      </div>
      ${estouro ? '<p class="alerta"><b>Atenção:</b> o gasto do dia passou do valor máximo definido.</p>' : ''}
      ${atraso.marcados > 0 && Math.abs(atraso.minutos) >= 5
        ? `<p class="${atraso.minutos > 0 ? 'alerta' : ''}"><b>O dia terminou ${descreverAtraso(atraso.minutos)}</b> — wrap às ${atraso.wrapPrevisto}, planejado ${atraso.wrapPlanejado}.</p>`
        : ''}

      ${linhasTempo ? `<h2>Horários — planejado × real</h2>
        <table><tr><th>Previsto</th><th>Real</th><th>Diferença</th><th>O quê</th></tr>${linhasTempo}</table>` : ''}

      ${relatorio.gravadas.length ? `<h2>Cenas filmadas</h2><ul>${relatorio.gravadas.map(linhaCena).join('')}</ul>` : ''}
      ${relatorio.parciais.length ? `<h2>Cenas parciais</h2><ul>${relatorio.parciais.map(linhaCena).join('')}</ul>` : ''}
      ${relatorio.naoGravadas.length ? `<h2>Cenas agendadas e NÃO filmadas</h2><ul>${relatorio.naoGravadas.map(linhaCena).join('')}</ul>
        <p class="muted" style="font-size:12px">Voltam ao stripboard como pendentes, prontas para reagendar.</p>` : ''}

      ${(diaria.rolos?.camera || diaria.rolos?.som) ? `<h2>Rolos</h2>
        <p>${diaria.rolos?.camera ? `<b>Câmera:</b> ${diaria.rolos.camera}` : ''}${diaria.rolos?.camera && diaria.rolos?.som ? ' &nbsp;·&nbsp; ' : ''}${diaria.rolos?.som ? `<b>Som:</b> ${diaria.rolos.som}` : ''}</p>` : ''}

      <h2>Equipe — presença e jornada</h2>
      <table>
        <tr><th>Pessoa</th><th>Presença</th><th>Chegada</th><th>Início</th><th>Refeição</th><th>Fim</th><th>Nota</th></tr>
        ${linhasJornada}
      </table>
      ${faltaram.length ? `<p class="alerta"><b>Faltaram:</b> ${faltaram.map(p => `${p.nome} ${p.sobrenome || ''}`.trim()).join(', ')}.</p>` : ''}
      ${semConfirmar.length ? `<p class="muted" style="font-size:12px">Sem confirmação de presença no app: ${semConfirmar.map(p => `${p.nome} ${p.sobrenome || ''}`.trim()).join(', ')}.</p>` : ''}

      ${temFiguracao ? `<h2>Figuração e stand-ins</h2>
        <p>${fig!.quantidade !== undefined ? `<b>${fig!.quantidade}</b> pessoa(s)` : ''}${fig!.chamada ? ` · chamada ${fig!.chamada}` : ''}${fig!.wrap ? ` · liberação ${fig!.wrap}` : ''}${fig!.notas ? `<br>${fig!.notas}` : ''}</p>` : ''}

      ${linhasOcorrencias ? `<h2>Ocorrências${minutosPerdidos ? ` — ${minutosPerdidos}min perdidos` : ''}</h2>
        <table><tr><th>Hora</th><th>Tipo</th><th>Perdido</th><th>O que aconteceu</th></tr>${linhasOcorrencias}</table>` : ''}

      <h2>Prestação de contas</h2>
      ${linhasDespesas
        ? `<table><tr><th>Descrição</th><th>Categoria</th><th>Quem pagou</th><th style="text-align:right">Valor</th></tr>${linhasDespesas}
           <tr><td colspan="3"><b>Total</b></td><td style="text-align:right"><b>${dinheiro(totalGasto)}</b></td></tr></table>`
        : '<p class="muted">Nenhuma despesa lançada nesta diária.</p>'}

      ${diaria.observacoes ? `<h2>Ocorrências e observações</h2><p>${diaria.observacoes.replace(/\n/g, '<br>')}</p>` : ''}

      <h2>Assinaturas</h2>
      <p class="muted" style="font-size:12px">
        Cada anotação deste relatório traz quem a fez, ao lado dela. Este documento
        foi gerado por <b>${nomeDoPerfil(meuPerfilId || undefined) || 'um administrador do projeto'}</b>
        em ${new Date().toLocaleString('pt-BR')}, a partir do que a produção registrou durante o dia.
        A OD que a equipe recebeu foi a versão ${diaria.versao_od || 1}.
      </p>

      <p class="muted" style="margin-top:40px;font-size:11px">Gerado pelo SetProd. Os dados permanecem salvos no projeto.</p>
      </body></html>`;

    if (!imprimirHtml(html)) baixarHtml(html, `dpr-diaria-${diaria.numero}`);
  };

  // ---- Exportar OD em PDF (via impressão do navegador) ----
  /**
   * Monta o documento da Ordem do Dia.
   *
   * Separado da impressão porque agora ele tem dois destinos: a caixa de
   * impressão do navegador e o corpo do email. Um só gerador é o que garante
   * que o papel e o email digam a mesma coisa — duas montagens divergem no
   * primeiro campo novo que alguém acrescenta em um lado só.
   *
   * `completo` decide se sai com `<html>` em volta. Cliente de email arranca a
   * casca e a folha de estilo, então para lá vai só o miolo.
   */
  const montarHtmlOD = (completo = true, versaoForcada?: number) => {
    const nomeLoc = idsDasLocacoesDoDia.map(id => locacoes.find(l => l.id === id)).filter(Boolean);
    const linhaEquipe = escalados.map(p => `<li>${p.nome} ${p.sobrenome || ''} — ${p.funcao || 'Equipe'}${(diaria.confirmacoes || []).includes(p.id) ? ' ✔ confirmado' : ''}</li>`).join('');
    /*
      O cronograma impresso sai da MESMA linha do tempo que está na tela.

      Antes ele lia `diaria.horarios`, que era outra lista — a equipe recebia um
      papel com a chamada e o almoço, e nenhuma das cenas do dia. Agora sai o
      dia inteiro, cenas incluídas, com os horários já encadeados.
    */
    const diaCalculado = calcularDia(montarLinhaDoDia(diaria), diaria.chamada, id => cenasGlobais.find(c => c.id === id));
    const linhaHorarios = diaCalculado.itens.map(c => {
      const rotulo = c.cena
        ? `<b>Cena ${c.cena.numero}</b> — ${c.cena.descricao} <span class="muted">(${(c.cena.ambiente || 'ext').toUpperCase()} / ${c.cena.periodo || 'dia'})</span>`
        : (c.item.titulo || '—');
      return `<tr><td style="padding:4px 12px;font-weight:bold;white-space:nowrap">${c.hora}</td><td style="padding:4px 12px">${rotulo}</td></tr>`;
    }).join('');
    const linhaLoc = nomeLoc.map((l: any) => `<li><b>${l.nome}</b> — ${l.endereco}${l.hospital_proximo ? ` · Hospital: ${l.hospital_proximo}` : ''}</li>`).join('');
    const linhaTasks = tasks.map(t => `<li>${t.status === 'concluido' ? '☑' : '☐'} ${t.descricao}</li>`).join('');

    const linhaComboios = (diaria.comboios || []).map(c => {
      const pNomes = c.passageiros_ids.map(id => {
        const p = perfis.find(per => per.id === id);
        return p ? `${p.nome} ${p.sobrenome || ''}` : '';
      }).filter(Boolean).join(', ');
      return `<tr><td style="padding:4px 12px;font-weight:bold">${c.veiculo || 'Veículo'}</td><td style="padding:4px 12px">${c.motorista || '-'}</td><td style="padding:4px 12px">${c.ponto_encontro || '-'}</td><td style="padding:4px 12px;font-weight:bold">${c.saida || '-'}</td><td style="padding:4px 12px;font-size:12px">${pNomes}</td></tr>`;
    }).join('');

    /*
      A versão pode vir de fora porque o `useLiveQuery` ainda não devolveu a
      diária nova quando o documento é montado logo depois do `update`. Ler
      `diaria.versao_od` ali imprimiria "v1" no papel que acabou de virar v2 —
      e o número no cabeçalho é justamente o que impede alguém de seguir o PDF
      velho.
    */
    const versao = versaoForcada ?? diaria.versao_od ?? 1;
    const corpo = `
      ${completo ? `<h1>${projeto?.nome || 'Produção'}</h1>
      <div class="muted">Ordem do Dia — Diária ${String(diaria.numero).padStart(2, '0')}${versao > 1 ? ` (v${versao})` : ''} · ${formataData(diaria.data)}</div>` : ''}
      ${diaria.link_reuniao && completo ? `<p><b>Reunião:</b> <a href="${diaria.link_reuniao}">${diaria.link_reuniao}</a></p>` : ''}
      ${/*
          A previsão impressa traz TODOS os sets do dia, com o nome de cada um.
          Sem o nome, a equipe lia uma previsão sem saber de onde ela era — e
          numa diária que atravessa a cidade isso é pior que não imprimir nada.
        */''}
      ${exportConfig.clima && gruposDeClima.length > 0 ? `<h2>Previsão</h2>${
        gruposDeClima.map(g => `<p><b>${g.locais.join(' · ')}</b><br>${descreverClima(g.clima.code).emoji} ${descreverClima(g.clima.code).texto} · Nascer ${g.clima.sunrise||'--'} · Pôr ${g.clima.sunset||'--'} · Máx ${Math.round(g.clima.tempMax)}° / Mín ${Math.round(g.clima.tempMin)}° · Chuva ${g.clima.chuvaProb}%</p>`).join('')
      }` : ''}
      ${exportConfig.horarios && linhaHorarios ? `<h2>Linha do dia</h2><table style="width:100%">${linhaHorarios}</table>${diaCalculado.wrap ? `<p class="muted" style="font-size:12px">Wrap previsto: <b>${diaCalculado.wrap}</b></p>` : ''}` : ''}
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
      ` : ''}`;

    if (!completo) return corpo;

    return `<!doctype html><html><head><meta charset="utf-8"><title>OD - Diária ${diaria.numero}${versao > 1 ? ` v${versao}` : ''}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;padding:32px;max-width:800px;margin:0 auto}
      h1{margin:0}h2{border-bottom:2px solid #111;padding-bottom:4px;margin-top:24px;font-size:15px;text-transform:uppercase}
      table{border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:4px}li{margin:2px 0}.muted{color:#666}</style></head><body>${corpo}</body></html>`;
  };

  /**
   * Exportar É a linha divisória (spec §1.1).
   *
   * ⚠️ ESTE BOTÃO NÃO SÓ IMPRIME — ELE PUBLICA.
   *
   * Antes ele era inofensivo: gerava um papel e ia embora. Só que gerar o papel
   * é exatamente o momento em que o plano deixa de ser rascunho: a partir dali
   * a equipe está com aquele documento na mão, e mudar o plano por baixo produz
   * a pior situação possível — o set seguindo um horário e o app mostrando
   * outro, sem ninguém saber qual vale.
   *
   * Reexportar sobe a versão em vez de repetir. Voltar a rascunho continua
   * possível (é a faixa do stripboard que faz isso); o que não é possível é
   * mudar o plano fingindo que ele nunca saiu.
   */
  const exportarPDF = async () => {
    const versaoNova = (diaria.versao_od || 0) + 1;
    await db.diarias.update(diariaId!, {
      versao_od: versaoNova,
      data_export: Date.now(),
      ...(estadoDa(diaria) === 'rascunho' ? { estado: 'publicada' as const, data_publicacao: Date.now() } : {}),
    });

    const html = montarHtmlOD(true, versaoNova);

    if (!imprimirHtml(html)) baixarHtml(html, `ordem-do-dia-${diaria.numero}-v${versaoNova}`);
    setExportModalAberto(false);
    if (projetoId) await logAction(projetoId, 'editar', 'diaria', diariaId!, `Exportou a OD da Diária ${diaria.numero} (v${versaoNova})`);
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

      {/*
        ---- NÍVEL 1: a faixa de contexto (spec §10) ----
        Densa e pequena de propósito. Ela responde "que dia é este e em que pé
        ele está" numa linha, e devolve a tela para o cronograma, que é o que se
        olha o tempo todo no set.
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate(`/projeto/${projetoId}/diarias`)} className="btn-icon"><ArrowLeft size={20} /></button>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <h1 className="text-xl font-bold" style={{ lineHeight: 1.2 }}>
            Diária {String(diaria.numero).padStart(2, '0')}
          </h1>
          <div className="text-sm text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>{formataData(diaria.data)}</span>
            <span className="text-muted">·</span>
            <span>{escalados.length} na equipe</span>
            <span className="text-muted">·</span>
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: diaria.fechada ? 'var(--color-success)' : diaria.estado === 'publicada' ? 'var(--cor-set)' : 'var(--text-muted)' }}
            >
              {diaria.fechada ? 'Fechada' : diaria.estado === 'publicada' ? 'Publicada' : 'Rascunho'}
            </span>
          </div>
        </div>

        <AIButton onClick={() => setGeradorAberto(true)}>Gerar OD com IA</AIButton>

        <button onClick={() => setExportModalAberto(true)} className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)', whiteSpace: 'nowrap', width: 'auto', padding: '0 14px', }}>
          <FileDown size={16} /> {estadoDa(diaria) === 'rascunho' ? 'Exportar e publicar' : `Reexportar (v${(diaria.versao_od || 1) + 1})`}
        </button>

        <button
          onClick={fecharDiaria}
          className="btn-icon"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)', whiteSpace: 'nowrap', width: 'auto', padding: '0 14px', }}
          title={diaria.fechada ? 'Reabrir a diária para edição' : 'Fazer o relatório do dia (DPR) e arquivar'}
        >
          {diaria.fechada ? <><Lock size={16} /> Reabrir</> : <><Archive size={16} /> Fechar Diária</>}
        </button>
      </div>

      {/* O atraso acumulado do projeto também aparece aqui, e não só no
          dashboard: quem está montando o dia de amanhã é exatamente quem pode
          fazer alguma coisa a respeito. Some sozinho quando não há atraso. */}
      <AvisoDeRitmo projetoId={projetoId!} />

      {/*
        O relógio só aparece no dia — não na véspera nem depois de fechada.

        Um relógio grande numa diária de daqui a três semanas não informa nada e
        rouba o lugar do cronograma, que é o que se está montando naquele
        momento. Ele entra quando a OD já saiu e a data é hoje (ou já passou e a
        diária continua aberta).
      */}
      {fase.ativo && (
        <RelogioDoSet fase={fase} atraso={atrasoDoDia} wrap={atrasoDoDia.wrapPrevisto} />
      )}

      {diaria.fechada && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '3px solid var(--color-success)' }}>
          <Archive size={18} className="text-success" />
          <div style={{ flex: 1 }}>
            <div className="font-bold text-sm">Diária fechada</div>
            <div className="text-xs text-muted">
              Arquivada em {diaria.data_fechamento ? new Date(diaria.data_fechamento).toLocaleString('pt-BR') : '—'}. Os dados continuam no banco.
            </div>
          </div>
          <button onClick={gerarDPR} className="btn-icon" style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-light)', padding: '6px 12px' }}>
            <FileDown size={14} /> <span className="text-xs">Relatório (DPR)</span>
          </button>
        </div>
      )}

      {/*
        ---- As frentes do dia (spec §3) ----
        Aparecem só quando dois ou mais grupos estão escalados. Com um grupo, ou
        nenhum, esta faixa não existe — e é por isso que a caixa "Estrutura —
        Unidade Única (A)" foi embora: ela ocupava lugar em 95% das diárias para
        dizer que nada de especial estava acontecendo.
      */}
      {dividido && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="text-xs text-muted uppercase tracking-widest" style={{ marginRight: '4px' }}>
            <Users size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Duas frentes hoje
          </span>
          {gruposEscalados.map(g => (
            <button
              key={g.id}
              onClick={() => setFrenteAberta(g.id)}
              className="text-sm font-bold"
              style={{
                padding: '7px 16px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                border: `1px solid ${frenteId === g.id ? 'var(--cor-equipe)' : 'var(--border-light)'}`,
                backgroundColor: frenteId === g.id ? 'var(--cor-equipe)' : 'transparent',
                color: frenteId === g.id ? '#062c28' : 'var(--text-secondary)',
              }}
            >
              {g.nome} <span style={{ opacity: 0.7, fontWeight: 'normal' }}>· {g.perfis_ids.length}</span>
            </button>
          ))}
        </div>
      )}

      {/*
        ---- Layout assimétrico (spec §12.1) ----
        ~2/3 para o cronograma, ~1/3 para os cartões de apoio. Colunas iguais
        ficariam monótonas e não respeitariam a forma do conteúdo: a linha do
        dia é vertical e longa, os cartões são compactos.

        `minmax(0, …)` nas duas faixas, e não `2fr 1fr` puro: sem isso, uma
        tabela larga dentro da coluna principal força a grade a crescer e a
        página inteira ganha rolagem horizontal.
      */}
      <div className="diaria-grade">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>

          {/* A ponte com o stripboard vem ANTES da linha: é ela que explica por
              que o dia é o que é, e se ele ainda pode mudar sozinho. */}
          <SincroniaStripboard diaria={diaria} />

          {/* Cenas do dia que ainda não foram para nenhuma frente. Sem este
              aviso elas sumiriam da tela ao dia se dividir — escaladas no
              banco, invisíveis para quem monta o dia. */}
          {dividido && cenasOrfas.length > 0 && (
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderLeft: '3px solid var(--color-warning)' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div className="text-sm font-bold">
                  {cenasOrfas.length} cena{cenasOrfas.length > 1 ? 's' : ''} do dia ainda sem frente
                </div>
                <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                  {cenasOrfas.map(c => `Cena ${c.numero}`).join(', ')} — decida qual equipe filma cada uma.
                </div>
              </div>
              <button onClick={trazerOrfasParaAFrente} className="btn-secondary text-xs">
                Trazer para {grupoDaFrente?.nome}
              </button>
            </div>
          )}

          <LinhaDoDia
            diaria={diaria}
            modo={fase.modo}
            visao={visaoDoDia}
            chamada={chamadaDaVisao}
            aoGravar={gravarLinha}
            aoMudarChamada={gravarChamada}
            cenas={cenasGlobais}
            registros={registrosDoDia}
            meuPerfilId={meuPerfilId || undefined}
            podeMarcar={podeMarcarODia}
            planosPorCena={planosDaCena}
          />

          {/*
            O registro do dia (presença, jornada, figuração, rolos, ocorrências)
            vem logo depois da linha, e só quando há dia para registrar. Antes da
            exportação ele mostraria campos que ninguém tem como preencher.
          */}
          {fase.modo === 'interativo' && (
            <RegistroDoSet
              diaria={diaria}
              escalados={escaladosDaVisao}
              meuPerfilId={meuPerfilId || undefined}
              podeMarcar={podeMarcarODia}
            />
          )}

          {/* Shot List (cenas e planos decupados) */}
          <ShotList diaria={diaria as any} locacoes={locacoes} />
        </div>

        {/* ---- NÍVEL 3: cartões de apoio ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', minWidth: 0 }}>

          {/* Só existe depois de exportada: antes disso não há o que distribuir,
              e mandar rascunho para a equipe é o problema que o congelamento na
              exportação existe para evitar. */}
          {fase.modo === 'interativo' && (
            <DistribuirOD
              diaria={diaria}
              cenas={cenasGlobais}
              escalados={escaladosDaVisao}
              nomeDoProjeto={projeto?.nome || 'Produção'}
              locais={locsDaDiaria.map(l => l.nome)}
              montarHtmlOD={montarHtmlOD}
              podeEnviar={podeMarcarODia}
            />
          )}

          {/* Locação: o exemplo-mestre do agrupamento por afinidade (§9.1).
              Lugar, tempo daquele lugar e hospital daquele lugar, juntos. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={15} style={{ color: 'var(--cor-logistica)' }} /> Locações do dia
            </h2>
            <button onClick={() => setSelecionandoLocacoes(!selecionandoLocacoes)} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              {selecionandoLocacoes ? 'Pronto' : 'Editar'}
            </button>
          </div>

          {selecionandoLocacoes ? (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {locacoes.length === 0 && <div className="text-muted text-xs">Cadastre locações no módulo Locações.</div>}
              {locacoes.map(loc => (
                <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={locacoesDaVisao.includes(loc.id)} onChange={() => toggleLocacao(loc.id)} />
                  {loc.nome}
                </label>
              ))}
            </div>
          ) : locsDaDiaria.length === 0 ? (
            <div className="card text-sm text-muted" style={{ lineHeight: 1.6 }}>
              Nenhuma locação neste dia. Sem ela não há previsão do tempo nem hospital de
              referência — toque em <b>Editar</b> para escolher.
            </div>
          ) : (
            locsDaDiaria.map(loc => (
              <CardDeLocacao
                key={loc.id}
                locacao={loc}
                clima={climaDaLocacao(loc.id)}
                climaIndisponivel={motivoSemClima(loc)}
              />
            ))
          )}

          {/* Financeiro do dia */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '3px solid var(--cor-financeiro)' }}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={15} style={{ color: 'var(--cor-financeiro)' }} /> Financeiro do dia
            </h2>

            <div>
              <div className="text-xs text-muted uppercase">Gasto registrado</div>
              <div className="font-bold" style={{ fontSize: '26px', color: statusOrc.cor }}>{dinheiro(totalGasto)}</div>
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '92px' }}>
                <div className="text-xs text-muted uppercase">Ideal</div>
                <input
                  type="number"
                  placeholder="0,00"
                  value={diaria.valor_ideal || ''}
                  onChange={async e => await db.diarias.update(diariaId!, { valor_ideal: Number(e.target.value) || 0 })}
                  style={{ padding: '4px 0', fontSize: '15px', fontWeight: 'bold', width: '100%', backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
                />
              </div>
              <div style={{ flex: 1, minWidth: '92px' }}>
                <div className="text-xs text-muted uppercase">Máximo</div>
                <input
                  type="number"
                  placeholder="0,00"
                  value={diaria.limite_gasto || ''}
                  onChange={async e => await db.diarias.update(diariaId!, { limite_gasto: Number(e.target.value) || 0 })}
                  style={{ padding: '4px 0', fontSize: '15px', fontWeight: 'bold', width: '100%', backgroundColor: 'transparent', borderBottom: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}
                />
              </div>
              {limiteGasto > 0 && (
                <div style={{ flex: 1, minWidth: '92px' }}>
                  <div className="text-xs text-muted uppercase">Saldo</div>
                  <div className="font-bold" style={{ fontSize: '15px', color: saldoGasto < 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                    {dinheiro(saldoGasto)}
                  </div>
                </div>
              )}
            </div>

            <div className="text-xs font-bold" style={{ color: statusOrc.cor }}>{statusOrc.texto}</div>
          </div>

          {/* Equipe do dia */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '3px solid var(--cor-equipe)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={15} style={{ color: 'var(--cor-equipe)' }} /> {dividido ? grupoDaFrente?.nome : 'Equipe do dia'}
              </h2>
              <button onClick={() => setSelecionandoEquipe(!selecionandoEquipe)} className="text-xs text-accent font-bold" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                {selecionandoEquipe ? 'Pronto' : 'Escalar'}
              </button>
            </div>

            {selecionandoEquipe ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Escalar por departamento ou por grupo. Escalar DOIS grupos é
                    o que divide o dia — não existe botão separado para isso. */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
                  {departamentos.map(dep => (
                    <button key={dep.id} onClick={() => escalarDepartamento(dep.id)} className="text-xs" style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                      + {dep.nome}
                    </button>
                  ))}
                  {(projeto?.grupos || []).map(g => (
                    <button key={g.id} onClick={() => escalarGrupo(g.id)} className="text-xs" style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--cor-equipe)', backgroundColor: 'var(--bg-primary)', color: 'var(--cor-equipe)', whiteSpace: 'nowrap', fontWeight: 'bold', cursor: 'pointer' }} title={`Grupo com ${g.perfis_ids.length} pessoa(s)`}>
                      + {g.nome}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={(diaria.equipe_escalada || []).includes(p.id)} onChange={() => toggleMembro(p.id)} />
                      {p.nome} {p.sobrenome} <span className="text-xs text-muted">({p.funcao || 'Equipe'})</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : escaladosDaVisao.length === 0 ? (
              <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
                Ninguém escalado ainda. Toque em <b>Escalar</b> — dá para chamar um
                departamento ou um grupo inteiro de uma vez.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {escaladosDaVisao.map(p => {
                  const confirmou = (diaria.confirmacoes || []).includes(p.id);
                  return (
                    <span
                      key={p.id}
                      className="text-xs"
                      style={{
                        padding: '4px 10px', borderRadius: 'var(--radius-full)',
                        border: `1px solid ${confirmou ? 'var(--color-success)' : 'var(--border-light)'}`,
                        color: confirmou ? 'var(--color-success)' : 'var(--text-secondary)',
                      }}
                      title={`${p.funcao || 'Equipe'}${confirmou ? ' · presença confirmada' : ''}`}
                    >
                      {p.nome}{confirmou ? ' ✓' : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* O que a fotografia conferiu. Some sozinho quando não há acervo
              vinculado — ver `ResumoEquipamento`. */}
          <ResumoEquipamento projetoId={projetoId!} diariaId={diariaId!} />
        </div>
      </div>

      {/*
        ---- NÍVEL 4: o apoio, fechado por padrão (spec §10) ----
        Existe, é consultado de vez em quando, e não pode ficar empurrando o
        cronograma para fora da tela. O número no cabeçalho é o que decide se
        vale abrir.

        O transporte fica AQUI, e não na coluna estreita como a §10 sugere: o
        editor de comboio tem cinco campos lado a lado e um seletor de
        passageiros, e espremido em um terço da tela ele deixa de ser usável.
        A intenção da spec — transporte é apoio, não protagonista — continua de
        pé; o lugar é que mudou.
      */}
      <Colapsavel
        titulo="Transporte e logística"
        icone={<Bus size={15} />}
        cor="var(--cor-logistica)"
        resumo={(diaria.comboios || []).length > 0
          ? `${(diaria.comboios || []).length} comboio(s) · ${(diaria.comboios || []).reduce((a, c) => a + c.passageiros_ids.length, 0)} a bordo`
          : 'nenhum comboio'}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <button onClick={addComboio} className="btn-primary" style={{ padding: '4px 12px', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Plus size={14} /> Novo comboio/van
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(diaria.comboios || []).length === 0 && (
            <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px 0', lineHeight: 1.6 }}>
              Nenhum veículo neste dia. Um comboio diz quem vai com quem, de onde e a que horas.
            </div>
          )}

          {(diaria.comboios || []).map((comboio) => (
            <div key={comboio.id} style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Veículo / van</div>
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
                  <div className="text-xs text-muted font-bold uppercase mb-1">Motorista / ref</div>
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
                    placeholder="Ex: João (placa XYZ)"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div className="text-xs text-muted font-bold uppercase mb-1">Ponto de encontro</div>
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
                  <button onClick={() => removeComboio(comboio.id)} className="btn-icon hover-danger" style={{ padding: '8px', marginBottom: '2px' }} title="Excluir comboio">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="text-xs text-muted font-bold uppercase mb-2">Passageiros ({comboio.passageiros_ids.length})</div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {escalados.length === 0 && <span className="text-xs text-muted">Ninguém escalado na diária ainda.</span>}
                {escalados.map(p => {
                  const noComboio = comboio.passageiros_ids.includes(p.id);
                  const noutro = !noComboio && (diaria.comboios || []).some(c => c.id !== comboio.id && c.passageiros_ids.includes(p.id));
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePassageiro(comboio.id, p.id)}
                      style={{
                        padding: '4px 8px', fontSize: '12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                        border: noComboio ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                        backgroundColor: noComboio ? 'var(--accent)' : 'var(--bg-surface)',
                        color: noComboio ? '#000' : 'var(--text-primary)',
                        opacity: noutro ? 0.3 : 1,
                      }}
                      title={noutro ? 'Já alocado em outro veículo' : ''}
                    >
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed var(--border-light)', margin: '8px 0' }} />
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">Informações adicionais</div>
          <textarea
            defaultValue={diaria.transporte || ''}
            onBlur={e => salvarTransporte(e.target.value)}
            placeholder="Anotações extras sobre logística..."
            rows={2}
          />
        </div>
      </Colapsavel>

      <Colapsavel
        titulo="Checklist de produção"
        icone={<CheckSquare size={15} />}
        cor="var(--cor-set)"
        resumo={tasks.length ? `${tasks.filter(t => t.status === 'concluido').length}/${tasks.length}` : 'vazio'}
      >
        <form onSubmit={addTask} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input placeholder="Nova tarefa... (ex: pegar rádios, comprar gelo)" value={newTask} onChange={e => setNewTask(e.target.value)} style={{ flex: 1 }} />
          <button type="submit" className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)' }}><Plus size={20} /></button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {tasks.length === 0 && <div className="text-muted text-sm" style={{ padding: '8px 0', textAlign: 'center' }}>Nenhuma tarefa para o dia.</div>}
          {tasks.map(task => (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', textDecoration: task.status === 'concluido' ? 'line-through' : 'none', color: task.status === 'concluido' ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                <input type="checkbox" checked={task.status === 'concluido'} onChange={() => toggleTask(task)} style={{ width: '20px', height: '20px', accentColor: 'var(--accent)' }} />
                {task.descricao}
              </label>
              <button onClick={() => deleteTask(task.id)} className="btn-icon text-muted" style={{ padding: '8px', border: 'none', background: 'transparent' }}><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      </Colapsavel>

      <Colapsavel
        titulo="Confirmação de presença"
        icone={<UserCheck size={15} />}
        cor="var(--cor-equipe)"
        resumo={escalados.length
          ? `${(diaria.confirmacoes || []).filter(id => (diaria.equipe_escalada || []).includes(id)).length}/${escalados.length}`
          : '—'}
      >
        {escalados.length === 0 ? (
          <div className="text-muted text-sm">Escale a equipe primeiro para confirmar presença.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {escalados.map(p => {
              const ok = (diaria.confirmacoes || []).includes(p.id);
              return (
                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={ok} onChange={() => toggleConfirmacao(p.id)} style={{ width: '18px', height: '18px', accentColor: 'var(--color-success)' }} />
                  <span style={{ flex: 1 }}>{p.nome} {p.sobrenome} <span className="text-xs text-muted">· {p.funcao || 'Equipe'}</span></span>
                  {ok && <span className="text-xs text-success font-bold">confirmado</span>}
                </label>
              );
            })}
          </div>
        )}
      </Colapsavel>

      <Colapsavel
        titulo="Anexos"
        icone={<Paperclip size={15} />}
        cor="var(--cor-criativo)"
        resumo={(diaria.anexos || []).length ? `${(diaria.anexos || []).length} arquivo(s)` : 'nenhum'}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
          <label className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', cursor: 'pointer', width: 'auto', padding: '0 12px', gap: '6px' }}>
            <Plus size={16} /> <span className="text-xs">Adicionar</span>
            <input type="file" onChange={addAnexo} style={{ display: 'none' }} />
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {(diaria.anexos || []).length === 0 && (
            <div className="text-muted text-sm" style={{ textAlign: 'center', padding: '8px', lineHeight: 1.6 }}>
              Roteiro do dia, decupagem, referências — o que a equipe precisa abrir no set.
            </div>
          )}
          {(diaria.anexos || []).map(a => (
            <LinhaAnexo key={a.id} anexo={a} aoRemover={() => removeAnexo(a.id)} />
          ))}
        </div>
      </Colapsavel>

      {exportModalAberto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: 'var(--bg-surface)' }}>
            <h2 className="text-lg font-bold" style={{ marginBottom: '8px' }}>
              {estadoDa(diaria) === 'rascunho' ? 'Exportar e publicar' : `Reexportar como v${(diaria.versao_od || 1) + 1}`}
            </h2>

            {/*
              O aviso não é formalidade: este botão MUDA O ESTADO da diária.

              Quem clica achando que só vai imprimir precisa saber que, a partir
              dali, o plano congela e a tela vira registro. Descobrir isso depois
              — com o cronograma que não deixa mais editar — seria a pior forma
              de aprender.
            */}
            <p className="text-sm text-secondary" style={{ marginBottom: '18px', lineHeight: 1.6 }}>
              {estadoDa(diaria) === 'rascunho' ? (
                <>
                  Ao exportar, o plano <b>congela</b> e a diária passa a registrar o
                  que acontecer. Para mudar o plano depois, volte a rascunho na faixa
                  do stripboard e reexporte — a nova versão sai numerada.
                </>
              ) : (
                <>
                  A equipe já recebeu a versão {diaria.versao_od || 1}. A nova sai
                  marcada como <b>v{(diaria.versao_od || 1) + 1}</b> no cabeçalho,
                  para ninguém seguir o papel antigo.
                </>
              )}
            </p>

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
                <FileDown size={16} /> {estadoDa(diaria) === 'rascunho' ? 'Exportar e publicar' : 'Gerar nova versão'}
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
