import { dinheiro, dataCurta, paraData } from '../lib/formato';
import { emCentavos, emReais } from '../core/dinheiro';
import { areaDaDespesa } from '../core/areaDaDespesa';
import { Vazio } from './ui/Vazio';
import { dividirEmPartes } from '../core/dinheiro';
import { naEquipe } from '../lib/vinculos';
import { CAIXA_CENTRAL } from '../core/caixaCentral';
import { CATEGORIAS_DESPESA } from '../core/categoriasDespesa';
import { Janela } from './ui/Janela';
import { confirmar } from './ui/Confirmacao';
import { useAcesso } from '../hooks/useAcesso';
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { TipoDivisao, Despesa, Aporte } from '../types';
import { Calendar, Trash2, Edit2, RotateCcw, X, Link as LinkIcon, Receipt, Plus, ChevronDown, ArrowDownToLine } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { registrarDocumento, removerDocumentoDeOrigem, inspecionarLink } from '../lib/documentos';
import { guardarArquivo, LIMITE_BYTES } from '../lib/arquivos';
import { useArquivo } from '../hooks/useArquivo';
import { CampoData } from './ui/CampoData';

const CATEGORIAS = CATEGORIAS_DESPESA;

/** O chip de escolha, num lugar só — eram cinco cópias do mesmo style inline. */
const chipEstilo = (ativo: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
  fontSize: '0.85rem', fontWeight: ativo ? 'bold' : 'normal',
  border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-light)'}`,
  backgroundColor: ativo ? 'var(--bg-active)' : 'var(--bg-surface)',
  color: ativo ? 'var(--text-primary)' : 'var(--text-secondary)',
});

const emojiCategoria = (cat?: string, descricao = '') => {
  const found = CATEGORIAS.find(c => c.id === cat);
  if (found) return found.emoji;
  // fallback antigo por palavra-chave
  const d = descricao.toLowerCase();
  if (/(almoço|janta|comida|lanche)/.test(d)) return '🍔';
  if (/(cerveja|bar)/.test(d)) return '🍺';
  if (/(transporte|uber|taxi|gasolina)/.test(d)) return '🚗';
  if (/(moradia|hotel|pousada)/.test(d)) return '🏨';
  if (/(equipamento|luz|som)/.test(d)) return '🎥';
  return '📄';
};

/**
 * `soDoDepartamento` recorta a lista ao departamento de quem está olhando
 * (ROADMAP §3 + pedido do Lucas em 20/09/2026): quem é da Fotografia vê os
 * gastos da Fotografia, não o caixa do filme. Vazio = vê tudo, que é o caso de
 * quem administra.
 */
/**
 * `comEntradas`: a aba LANÇAMENTOS de quem administra (leva 4, passo 3,
 * decisão B do Lucas, 27/09/2026). Saídas e entradas numa lista só, em ordem de
 * data, com filtros — no lugar de três abas (Extrato, Entradas, Saídas) que
 * mostravam o mesmo dinheiro de três jeitos, cada uma com um filtro que as
 * outras não tinham.
 *
 * Sem `comEntradas` é a lista de despesas de sempre — a da "Minha área".
 */
export function DespesasList({ projetoId, soDoDepartamento, comEntradas = false }: {
  projetoId: string;
  soDoDepartamento?: string;
  comEntradas?: boolean;
}) {
  const aportes = useLiveQuery(
    () => comEntradas ? db.aportes.where('projeto_id').equals(projetoId).toArray() : Promise.resolve([] as Aporte[]),
    [projetoId, comEntradas]
  ) || [];
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const diariasOficiais = useLiveQuery(async () => {
    const arr = await db.diarias.where('projeto_id').equals(projetoId).toArray();
    return arr.sort((a, b) => a.numero - b.numero);
  }, [projetoId]);
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  /** A equipe de verdade: o 'caixa_central' e sentinela da producao, nao pessoa. */
  const equipe = (perfis || []).filter(naEquipe);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [categoria, setCategoria] = useState('outro');
  const [pagadorId, setPagadorId] = useState('');

  /**
   * A área a que o gasto pertence.
   *
   * Nasce no departamento de quem está lançando, quando o app sabe quem é a
   * pessoa (`projeto_membros.perfil_id` → `perfis.departamento_id`). Quem é da
   * Arte lança gasto da Arte quase sempre; deixar em branco todo dia seria pedir
   * que a pessoa repita a mesma escolha para sempre.
   *
   * É um palpite, não uma trava: os chips ficam ali e mudar é um toque.
   */
  const { perfilId: meuPerfilId } = useRole();
  // Dinheiro é da produção: lançar e editar é com quem administra (escopo.ts).
  const { podeEscrever } = useAcesso();
  const podeLancar = podeEscrever('despesas');
  const meuDepartamento = (perfis || []).find(p => p.id === meuPerfilId)?.departamento_id || '';
  /*
    QUEM ADMINISTRA NÃO GANHA PALPITE. Para quem é de um departamento, pré-marcar
    o dele é certo: é onde ele lança. Quem administra lança para TODAS as áreas,
    e o departamento da própria ficha ali é um palpite errado com cara de
    escolha — foi assim que um microfone do Som foi parar na Fotografia
    (27/09/2026). Começa em "Da produção", e a área é escolhida de propósito.
  */
  const administraTudo = podeEscrever('projetos');
  const [departamentoId, setDepartamentoId] = useState('');

  // Só na primeira vez que o perfil aparece: refazer isso a cada render
  // apagaria a escolha da pessoa no meio do preenchimento.
  const [palpitePronto, setPalpitePronto] = useState(false);
  useEffect(() => {
    if (palpitePronto || !meuDepartamento || editandoId || administraTudo) return;
    setDepartamentoId(meuDepartamento);
    setPalpitePronto(true);
  }, [meuDepartamento, palpitePronto, editandoId, administraTudo]);

  const [dataOcorrencia, setDataOcorrencia] = useState(() => new Date().toISOString().split('T')[0]);

  const [diariaSelecionadaId, setDiariaSelecionadaId] = useState<string>('geral');

  const [dividirComTodos, setDividirComTodos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [filtroDiaria, setFiltroDiaria] = useState<string>('todas');
  
  /*
    Começa SEM escolha. Era 'rateio' por padrão — e "quem pagou" é justamente a
    pergunta que muda tudo no acerto: um gasto do caixa lançado sem mexer aqui
    virava dívida da equipe inteira. Escolher é um toque; errar calado custa o
    acerto do mês.
  */
  const [tipoDespesa, setTipoDespesa] = useState<'producao' | 'reembolsavel' | 'rateio' | null>(null);
  const [janelaAberta, setJanelaAberta] = useState(false);
  const [maisDetalhes, setMaisDetalhes] = useState(false);
  const [comprovanteBase64, setComprovanteBase64] = useState<string | undefined>();

  const [toastUndo, setToastUndo] = useState<{ id: string, despesa: any, timer: any } | null>(null);

  const [comprovanteNome, setComprovanteNome] = useState<string>('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > LIMITE_BYTES) {
      alert(`Arquivo muito grande (máx ${Math.round(LIMITE_BYTES / 1024 / 1024)}MB). Prefira anexar um link do Drive.`);
      e.target.value = '';
      return;
    }
    try {
      // Vai para o Storage: o comprovante precisa chegar em quem faz o acerto,
      // que quase nunca é quem tirou a foto da nota.
      setComprovanteBase64(await guardarArquivo(projetoId, file, file.name, file.type));
      setComprovanteNome(file.name);
    } catch (err: any) {
      alert('Não foi possível anexar o comprovante. ' + (err?.message || ''));
    }
    e.target.value = '';
  };

  /** Alternativa ao upload: link do Drive, que não gasta Storage (v4 §7). */
  const anexarLinkComprovante = () => {
    const url = prompt('Cole o link do comprovante (Google Drive, Dropbox...):');
    if (!url?.trim()) return;
    setComprovanteBase64(url.trim());
    setComprovanteNome(inspecionarLink(url.trim()).nome);
  };

  const toggleSelecionado = (id: string) => {
    setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const formatCurrency = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw === '') return '';
    return (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  const parseCurrency = (val: string) => {
    const raw = val.replace(/\D/g, '');
    return raw ? parseInt(raw, 10) / 100 : 0;
  };

  const limparForm = () => {
    setEditandoId(null);
    // O departamento volta ao SEU, não a vazio: quem lança dez gastos da Arte
    // seguidos não deveria reescolher "Arte" dez vezes.
    setDescricao(''); setValor(''); setCategoria('outro'); setPagadorId('');
    setDepartamentoId(administraTudo ? '' : meuDepartamento);
    setSelecionados([]); setDividirComTodos(true);
    setComprovanteBase64(undefined); setComprovanteNome('');
    setTipoDespesa(null); setDiariaSelecionadaId('geral'); setMaisDetalhes(false);
    setDataOcorrencia(new Date().toISOString().split('T')[0]);
  };

  /*
    O FORMULÁRIO NUMA JANELA (leva 4, passo 1).

    Ele ficava sempre aberto no topo de Saídas, com seis blocos: para ver a
    lista era preciso rolar o formulário inteiro, e editar uma despesa levava
    a tela lá para cima — a pessoa perdia o lugar onde estava. Agora um botão
    abre a janela comum, e editar abre a mesma janela POR CIMA da lista.

    Fechar uma despesa já mexida pergunta antes, como a ficha de membro.
  */
  const retratoDoForm = () => JSON.stringify([
    descricao, valor, categoria, pagadorId, departamentoId, dataOcorrencia, diariaSelecionadaId,
    dividirComTodos, selecionados, tipoDespesa, comprovanteBase64,
  ]);
  const retratoAoAbrir = useRef('');
  useEffect(() => {
    if (janelaAberta) retratoAoAbrir.current = retratoDoForm();
    // Só na abertura: depois disso, mudar é o que se quer detectar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [janelaAberta]);

  const abrirNova = () => { limparForm(); setJanelaAberta(true); };

  const fecharJanela = async () => {
    if (retratoDoForm() !== retratoAoAbrir.current) {
      const descartar = await confirmar({
        titulo: editandoId ? 'Descartar as alterações?' : 'Descartar esta despesa?',
        detalhe: editandoId
          ? 'O que você mudou ainda não foi salvo. A despesa continua como estava.'
          : 'O que você preencheu ainda não foi salvo e vai se perder.',
        confirmar: 'Descartar',
        cancelar: 'Continuar editando',
        perigo: true,
      });
      if (!descartar) return;
    }
    setJanelaAberta(false);
    limparForm();
  };

  const iniciarEdicao = (d: any) => {
    setEditandoId(d.id);
    setDescricao(d.descricao);
    setValor(d.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setCategoria(d.categoria || 'outro');
    setDepartamentoId(areaDaDespesa(d) || '');
    setPagadorId(d.pagadores[0]?.id_ref || '');
    setDataOcorrencia(d.data_ocorrencia || new Date(d.data).toISOString().split('T')[0]);
    
    // Cascata discovery based on data
    if (d.pagadores[0]?.id_ref === CAIXA_CENTRAL) {
      setTipoDespesa('producao');
    } else if (d.reembolsavel) {
      setTipoDespesa('reembolsavel');
    } else {
      setTipoDespesa('rateio');
    }
    
    setComprovanteBase64(d.comprovante);
    setComprovanteNome(d.comprovante ? `Comprovante — ${d.descricao}` : '');
    // Find ID of the official diaria by name, or use 'geral' / 'pre'
    let selId = 'geral';
    if (d.diaria === 'Pré-produção') selId = 'pre';
    else if (d.diaria === 'Geral') selId = 'geral';
    else {
      const found = (diariasOficiais || []).find(x => `Diária ${x.numero}` === d.diaria || x.id === d.diaria_id);
      if (found) selId = found.id;
      else if (d.diaria) selId = d.diaria; // fallback para nome textual caso já salvo
    }
    setDiariaSelecionadaId(selId);
    const devedoresIds = d.devedores.filter((x: any) => x.tipo === 'pessoa').map((x: any) => x.id_ref);
    const naoCaixa = equipe.map(p => p.id);
    const cobreTodos = naoCaixa.length > 0 && naoCaixa.every(id => devedoresIds.includes(id));
    setDividirComTodos(cobreTodos);
    setSelecionados(devedoresIds);
    // "Mais detalhes" já aberto quando há algo lá dentro: esconder a diária ou
    // o comprovante de uma despesa que os tem faria parecer que sumiram.
    setMaisDetalhes(selId !== 'geral' || Boolean(d.comprovante));
    setJanelaAberta(true);
  };

  const salvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseCurrency(valor);
    if (!descricao || valorNum <= 0 || !perfis) return;
    if (!tipoDespesa) { alert('Diga quem pagou: a produção, alguém que vai ser reembolsado, ou alguém que divide com a equipe.'); return; }
    if (tipoDespesa !== 'producao' && (!pagadorId || pagadorId === CAIXA_CENTRAL)) { alert('Escolha a pessoa que pagou.'); return; }

    /*
      O CAIXA_CENTRAL é sentinela, não pessoa — e a linha dele no banco é uma
      só, global, que muda de projeto conforme novos vão sendo criados. Exigir
      que ela exista fazia `salvarDespesa` RETORNAR EM SILÊNCIO nos projetos
      onde ela não estava: o botão "Registrar Despesa" simplesmente não fazia
      nada, sem erro nenhum na tela.
    */
    const pagador = pagadorId === CAIXA_CENTRAL
      ? { id: CAIXA_CENTRAL }
      : perfis.find(p => p.id === pagadorId);

    if (!pagador) {
      alert('Escolha quem pagou antes de registrar.');
      return;
    }

    let devedoresLista = equipe;
    if (!dividirComTodos) {
      if (selecionados.length === 0) {
        alert('Selecione pelo menos uma pessoa para dividir a despesa.');
        return;
      }
      devedoresLista = perfis.filter(p => selecionados.includes(p.id));
    }

    // Em centavos, com o resto distribuído: R$ 100 entre 7 fecha em R$ 100,00,
    // e não em 7 × 14,285714… (ROADMAP §10.B, `core/dinheiro.ts`).
    const parcelas = dividirEmPartes(valorNum, devedoresLista.length);
    
    let nomeDiaria = 'Geral';
    if (diariaSelecionadaId === 'pre') nomeDiaria = 'Pré-produção';
    else if (diariaSelecionadaId !== 'geral') {
      const found = (diariasOficiais || []).find(x => x.id === diariaSelecionadaId);
      if (found) nomeDiaria = `Diária ${found.numero}`;
      else nomeDiaria = diariaSelecionadaId; // fallback se for string
    }

    // Construção de pagadores e devedores dependendo do tipo
    let pagadores = [];
    let devedores = [];
    
    if (tipoDespesa === 'producao') {
      // Sai do caixa, morre no projeto (departamento se tiver)
      pagadores = [{ tipo: 'pessoa' as const, id_ref: CAIXA_CENTRAL, valor: valorNum }];
      // O departamento que "deve" o gasto direto é a ÁREA escolhida acima — um
      // campo só. Antes havia um seletor próprio aqui, que podia discordar dela.
      if (departamentoId) {
        devedores = [{ tipo: 'departamento' as const, id_ref: departamentoId, valor: valorNum }];
      } else {
        devedores = [{ tipo: 'pessoa' as const, id_ref: CAIXA_CENTRAL, valor: valorNum }]; // custo cego
      }
    } else if (tipoDespesa === 'reembolsavel') {
      // Pessoa paga, Caixa deve
      pagadores = [{ tipo: 'pessoa' as const, id_ref: pagador.id, valor: valorNum }];
      devedores = [{ tipo: 'pessoa' as const, id_ref: CAIXA_CENTRAL, valor: valorNum }];
    } else {
      // Pessoa paga, equipe deve
      pagadores = [{ tipo: 'pessoa' as const, id_ref: pagador.id, valor: valorNum }];
      devedores = devedoresLista.map((p, i) => ({ tipo: 'pessoa' as const, id_ref: p.id, valor: parcelas[i] }));
    }

    const dados = {
      projeto_id: projetoId,
      descricao,
      categoria,
      departamento_id: departamentoId || undefined,
      valor_total: valorNum,
      data_ocorrencia: dataOcorrencia,
      diaria: nomeDiaria,
      diaria_id: diariaSelecionadaId !== 'geral' && diariaSelecionadaId !== 'pre' ? diariaSelecionadaId : undefined,
      pagadores,
      devedores,
      tipo_divisao: 'igual' as TipoDivisao,
      reembolsavel: tipoDespesa === 'reembolsavel',
      comprovante: comprovanteBase64
    };

    let despesaId = editandoId;
    if (editandoId) {
      const original = despesas?.find(x => x.id === editandoId);
      await db.despesas.put({ ...dados, id: editandoId, data: original?.data || Date.now() });
    } else {
      despesaId = crypto.randomUUID();
      await db.despesas.add({ ...dados, id: despesaId, data: Date.now() });
    }

    // Índice central: o comprovante aparece em Documentos, pasta "NFs e Comprovantes".
    if (despesaId) {
      if (comprovanteBase64) {
        await registrarDocumento({
          projetoId,
          origem: 'comprovante',
          refId: despesaId,
          nome: comprovanteNome || `Comprovante — ${descricao}`,
          url: comprovanteBase64,
          previewUrl: comprovanteBase64.startsWith('data:image/') ? comprovanteBase64 : undefined,
        });
      } else {
        await removerDocumentoDeOrigem(projetoId, 'comprovante', despesaId);
      }
    }

    setJanelaAberta(false);
    limparForm();
  };

  const handleDeletar = async (id: string) => {
    const d = despesas?.find(x => x.id === id);
    if (!d) return;
    await db.despesas.delete(id);
    await removerDocumentoDeOrigem(projetoId, 'comprovante', id);
    if (toastUndo?.timer) clearTimeout(toastUndo.timer);
    const timer = setTimeout(() => setToastUndo(null), 5000);
    setToastUndo({ id, despesa: d, timer });
  };

  const undoDelete = async () => {
    if (!toastUndo) return;
    clearTimeout(toastUndo.timer);
    await db.despesas.add(toastUndo.despesa);
    setToastUndo(null);
  };

  const listaDiarias = [
    { val: 'geral', label: 'Geral' },
    { val: 'pre', label: 'Pré-produção' }
  ];
  
  (diariasOficiais || []).forEach(d => {
    listaDiarias.push({ val: d.id, label: `Diária ${d.numero}` });
  });

  // Diárias existentes para o filtro
  const diariasExistentes = Array.from(new Set((despesas || []).map(d => d.diaria).filter(Boolean))) as string[];
  const [filtroTipo, setFiltroTipo] = useState<'tudo' | 'saidas' | 'entradas'>('tudo');
  const [filtroDepto, setFiltroDepto] = useState<string>('');

  const despesasFiltradas = (despesas || [])
    .filter(d => !soDoDepartamento || areaDaDespesa(d) === soDoDepartamento)
    .filter(d => filtroDiaria === 'todas' || d.diaria === filtroDiaria)
    .filter(d => !filtroDepto || (filtroDepto === '__producao__' ? !areaDaDespesa(d) : areaDaDespesa(d) === filtroDepto));

  /*
    Entrada não tem diária nem departamento: é dinheiro que entra no caixa do
    filme. Com um desses filtros ligado, ela sai da lista — mostrar "o Som" com
    o patrocínio no meio seria mentir sobre o que é do Som.
  */
  const entradasFiltradas = comEntradas && filtroTipo !== 'saidas' && filtroDiaria === 'todas' && !filtroDepto
    ? aportes
    : [];

  type Item = { tipo: 'saida'; quando: number; d: Despesa } | { tipo: 'entrada'; quando: number; a: Aporte };
  const itens: Item[] = [
    ...(filtroTipo === 'entradas' ? [] : despesasFiltradas.map(d => ({
      tipo: 'saida' as const,
      // `data_ocorrencia` é "AAAA-MM-DD": `paraData` monta em hora local, e não
      // em UTC (que jogaria a despesa para o dia anterior).
      quando: (paraData(d.data_ocorrencia) ?? paraData(d.data))?.getTime() ?? 0,
      d,
    }))),
    ...entradasFiltradas.map(a => ({ tipo: 'entrada' as const, quando: a.data, a })),
  ].sort((x, y) => y.quando - x.quando);

  // Somas do que está na tela, em centavos.
  const somaSaidas = emReais(itens.reduce((s, i) => s + (i.tipo === 'saida' ? emCentavos(i.d.valor_total) : 0), 0));
  const somaEntradas = emReais(itens.reduce((s, i) => s + (i.tipo === 'entrada' ? emCentavos(i.a.valor) : 0), 0));

  // ---- Entradas: registrar e editar numa janela, como a despesa
  const podeLancarEntrada = comEntradas && podeEscrever('aportes');
  const [entrada, setEntrada] = useState<{ id?: string; origem: string; valor: string; data: string; obs: string } | null>(null);
  const hojeISO = () => new Date().toISOString().split('T')[0];
  const abrirEntrada = (a?: Aporte) => setEntrada(a
    ? {
        id: a.id, origem: a.origem, obs: a.obs || '',
        valor: a.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
        data: (() => { const x = new Date(a.data); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; })(),
      }
    : { origem: '', valor: '', data: hojeISO(), obs: '' });

  const salvarEntrada = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entrada) return;
    const valorNum = parseCurrency(entrada.valor);
    if (!entrada.origem.trim() || valorNum <= 0) return;
    const quando = paraData(entrada.data)?.getTime() ?? Date.now();
    const dados = { projeto_id: projetoId, origem: entrada.origem.trim(), valor: valorNum, data: quando, obs: entrada.obs.trim() || undefined };
    if (entrada.id) await db.aportes.put({ id: entrada.id, ...dados });
    else await db.aportes.add({ id: crypto.randomUUID(), ...dados });
    setEntrada(null);
  };

  const apagarEntrada = async (a: Aporte) => {
    const ok = await confirmar({
      titulo: 'Apagar esta entrada?',
      detalhe: `${a.origem} · ${dinheiro(a.valor)}. O saldo da produção diminui neste valor.`,
      confirmar: 'Apagar', perigo: true,
    });
    if (ok) await db.aportes.delete(a.id);
  };


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>

      {toastUndo && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '12px 24px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <span className="text-sm">Despesa apagada.</span>
          <button onClick={undoDelete} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <RotateCcw size={14} /> Desfazer
          </button>
        </div>
      )}

      {janelaAberta && podeLancar && (
        <Janela
          titulo={editandoId ? 'Editar despesa' : 'Lançar despesa'}
          icone={<Receipt size={18} />}
          aoFechar={fecharJanela}
          largura="620px"
          // Formulário longo: um toque no fundo não pode custar a despesa.
          fecharClicandoFora={false}
          rodape={
            <button type="submit" form="form-despesa" className="btn-primary" style={{ width: '100%' }}>
              {editandoId ? 'Salvar alterações' : 'Registrar despesa'}
            </button>
          }
        >
        <form id="form-despesa" onSubmit={salvarDespesa} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* 1. O quê, quanto, quando */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input placeholder="Descrição (ex: Almoço da equipe)" value={descricao} onChange={e => setDescricao(e.target.value)} required />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '10px' }}>
              <input type="text" inputMode="numeric" placeholder="Valor (R$)" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required />
              <CampoData value={dataOcorrencia} onChange={setDataOcorrencia} />
            </div>
          </div>

          {/*
            2. Quem pagou — ANTES de qualquer outra escolha, porque é ela que
            decide o resto. Antes o "Quem pagou?" vinha primeiro, desligado e
            com "A Produção (Caixa)", e o tipo só depois.
          */}
          <div>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Quem pagou</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {([
                ['producao', 'A produção pagou', 'Saiu do caixa do filme. Ninguém fica devendo.'],
                ['reembolsavel', 'Alguém adiantou, a produção devolve', 'A pessoa pagou do próprio bolso e a produção deve a ela.'],
                ['rateio', 'Alguém pagou, a equipe divide', 'Quem entra na divisão deve a sua parte a quem pagou.'],
              ] as const).map(([id, titulo, ajuda]) => (
                <label key={id} className="checkbox-label" style={{
                  padding: '12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  border: `1px solid ${tipoDespesa === id ? 'var(--accent)' : 'var(--border-light)'}`,
                  backgroundColor: tipoDespesa === id ? 'var(--bg-active)' : 'var(--bg-primary)',
                }}>
                  <input
                    type="radio"
                    name="quem-pagou"
                    checked={tipoDespesa === id}
                    onChange={() => {
                      setTipoDespesa(id);
                      setPagadorId(id === 'producao' ? CAIXA_CENTRAL : (pagadorId === CAIXA_CENTRAL ? '' : pagadorId));
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="text-sm font-bold">{titulo}</span>
                    <span className="text-xs text-muted">{ajuda}</span>
                  </div>
                </label>
              ))}
            </div>

            {/* A pessoa só é perguntada quando existe uma pessoa na história. */}
            {(tipoDespesa === 'reembolsavel' || tipoDespesa === 'rateio') && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <select value={pagadorId === CAIXA_CENTRAL ? '' : pagadorId} onChange={e => setPagadorId(e.target.value)}>
                  <option value="">Quem pagou?</option>
                  {equipe.map(p => (<option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>))}
                </select>
                {/*
                  Sem ninguém cadastrado, a lista fica vazia — e sem dizer por
                  quê, parecia quebrada (relato: "cliquei em Reembolsável e não
                  apareceu a pessoa da equipe").
                */}
                {equipe.length === 0 && (
                  <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                    Ninguém cadastrado na equipe ainda. Adicione as pessoas em <strong>Produção → Equipe</strong> para lançar reembolso e divisão.
                  </p>
                )}
              </div>
            )}

            {tipoDespesa === 'rateio' && (
              <div style={{ marginTop: '10px', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={dividirComTodos} onChange={e => setDividirComTodos(e.target.checked)} />
                  <span className="text-sm">Dividir igualmente com toda a equipe</span>
                </label>
                {!dividirComTodos && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', marginTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                    <div className="text-xs text-muted">Quem entra na divisão:</div>
                    {equipe.map(p => (
                      <label key={p.id} className="checkbox-label">
                        <input type="checkbox" checked={selecionados.includes(p.id)} onChange={() => toggleSelecionado(p.id)} />
                        <span className="text-sm">{p.nome} {p.sobrenome}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/*
            3. De qual departamento é — o gasto é DE QUEM, não de quem pagou.
            A Arte pode comprar uma lente da Fotografia; o produtor pode pagar a
            tinta da Arte. É este campo que o painel de cada departamento lê.
          */}
          {(departamentos || []).length > 0 && (
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>De qual departamento é</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div onClick={() => setDepartamentoId('')} style={chipEstilo(departamentoId === '')}>Da produção</div>
                {(departamentos || []).map(d => (
                  <div key={d.id} onClick={() => setDepartamentoId(d.id)} style={chipEstilo(departamentoId === d.id)}>{d.nome}</div>
                ))}
              </div>
              <div className="text-xs text-muted" style={{ marginTop: '6px' }}>
                É o departamento que vê este gasto no painel dele. Seguro, taxa e caixa geral ficam em “Da produção”.
              </div>
            </div>
          )}

          {/*
            4. Tipo de gasto (era "Categoria"). Os tipos com nome de departamento
            saíram da escolha (`aposentada`). Uma despesa antiga com um deles
            continua mostrando o dela, para a edição não trocar calada.
          */}
          <div>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Tipo de gasto</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CATEGORIAS_DESPESA.filter(c => !c.aposentada || c.id === categoria).map(c => (
                <div key={c.id} onClick={() => setCategoria(c.id)} style={chipEstilo(categoria === c.id)}>
                  <span>{c.emoji}</span> {c.label}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Mais detalhes: diária e comprovante */}
          <div>
            <button
              type="button"
              onClick={() => setMaisDetalhes(m => !m)}
              aria-expanded={maisDetalhes}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}
              className="text-xs font-bold uppercase tracking-widest"
            >
              <ChevronDown size={14} style={{ transform: maisDetalhes ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              Mais detalhes
              {!maisDetalhes && (diariaSelecionadaId !== 'geral' || comprovanteBase64) && (
                <span className="text-accent" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>· preenchido</span>
              )}
            </button>

            {maisDetalhes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                <div>
                  <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Diária</div>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }} className="hide-scrollbar">
                    {listaDiarias.map(d => (
                      <div key={d.val} onClick={() => setDiariaSelecionadaId(d.val)} style={chipEstilo(diariaSelecionadaId === d.val)}>
                        {d.label}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Comprovante (recibo ou nota)</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize: '12px' }} />
                    {/* `.btn-chip`, não `.btn-icon`: o .btn-icon é 40x40 fixo, e o
                        rótulo quebrava em três linhas dentro do quadrado. */}
                    <button type="button" onClick={anexarLinkComprovante} className="btn-chip" style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>
                      <LinkIcon size={14} /> Link do Drive
                    </button>
                  </div>
                  {comprovanteBase64 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span className="text-xs text-accent">Anexado: {comprovanteNome || 'comprovante'}</span>
                      <button type="button" onClick={() => { setComprovanteBase64(undefined); setComprovanteNome(''); }} className="btn-icon text-muted" style={{ padding: '2px' }} title="Remover comprovante">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
        </Janela>
      )}


      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest">{comEntradas ? 'Lançamentos' : 'Despesas'}</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {podeLancarEntrada && (
              <button onClick={() => abrirEntrada()} className="btn-chip" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ArrowDownToLine size={14} /> Registrar entrada
              </button>
            )}
            {podeLancar && (
              <button onClick={abrirNova} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} /> Lançar despesa
              </button>
            )}
          </div>
        </div>

        {/* Filtros: o que o Extrato, as Saídas e as Entradas tinham, cada um o seu. */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
          {comEntradas && (['tudo', 'saidas', 'entradas'] as const).map(f => (
            <div key={f} onClick={() => setFiltroTipo(f)} style={chipEstilo(filtroTipo === f)}>
              {f === 'tudo' ? 'Tudo' : f === 'saidas' ? 'Saídas' : 'Entradas'}
            </div>
          ))}
          {!soDoDepartamento && (departamentos || []).length > 0 && filtroTipo !== 'entradas' && (
            <select value={filtroDepto} onChange={e => setFiltroDepto(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}>
              <option value="">Todos os departamentos</option>
              <option value="__producao__">Da produção</option>
              {(departamentos || []).map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
            </select>
          )}
          {diariasExistentes.length > 0 && filtroTipo !== 'entradas' && (
            <select value={filtroDiaria} onChange={e => setFiltroDiaria(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}>
              <option value="todas">Todas as diárias</option>
              {diariasExistentes.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {itens.length > 0 && (
          <div className="text-xs text-muted" style={{ marginBottom: '12px' }}>
            {itens.length} {itens.length === 1 ? 'lançamento' : 'lançamentos'}
            {somaSaidas > 0 && <> · saídas <strong className="text-danger">{dinheiro(somaSaidas)}</strong></>}
            {somaEntradas > 0 && <> · entradas <strong className="text-success">{dinheiro(somaEntradas)}</strong></>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Na Minha área o painel de cima já diz que não há despesa: não repetir. */}
          {itens.length === 0 && !soDoDepartamento && (
            (despesas || []).length + aportes.length > 0 ? (
              // Busca sem resultado não é lista vazia (guia visual).
              <p className="text-sm text-muted" style={{ margin: '8px 0' }}>Nada com esses filtros.</p>
            ) : (
            <Vazio
              icone={<Receipt size={28} />}
              titulo={comEntradas ? 'Nenhum lançamento ainda' : 'Nenhuma despesa lançada'}
              ajuda={comEntradas
                ? 'Aqui entra todo o dinheiro da produção: o que saiu (despesas) e o que entrou (patrocínio, edital, investimento).'
                : 'Aqui entram os gastos da produção: quem pagou, quanto, e como se divide entre a equipe.'}
              acao={podeLancar ? (
                <button onClick={abrirNova} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={16} /> Lançar a primeira
                </button>
              ) : undefined}
            />
            )
          )}

          {itens.map(item => {
            if (item.tipo === 'entrada') return <LinhaDeEntrada key={'e-' + item.a.id} a={item.a} podeLancar={podeLancarEntrada} aoEditar={() => abrirEntrada(item.a)} aoApagar={() => apagarEntrada(item.a)} />;
            const d = item.d;
            const pagador = perfis?.find(p => p.id === d.pagadores[0]?.id_ref) || { nome: 'Caixa', sobrenome: '' };
            const icon = emojiCategoria(d.categoria, d.descricao);

            return (
              <div key={d.id} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="text-base font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descricao}</div>
                    <div className="text-base font-bold text-danger" style={{ whiteSpace: 'nowrap' }}>{dinheiro(d.valor_total)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {d.diaria && <span className="badge badge-warning">{d.diaria}</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      {/* `data_ocorrencia` é uma string "AAAA-MM-DD" e estava
                          indo CRUA para a tela: a linha mostrava 2026-08-28 em
                          vez de 28/08/26. Passava despercebido porque só
                          aparece na despesa que tem data de ocorrência — as
                          outras caíam no ramo formatado do lado direito. */}
                      <span className="text-xs">{dataCurta(d.data_ocorrencia || d.data)}</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Pago por: <strong style={{ color: 'var(--text-primary)' }}>{pagador.nome} {pagador.sobrenome}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {d.reembolsavel && <span className="text-xs font-bold px-2 py-1 bg-surface rounded text-danger">Reembolsável</span>}
                    {d.comprovante && <LinkComprovante despesa={d} />}
                  </div>
                </div>

                {podeLancar && <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button onClick={() => iniciarEdicao(d)} className="btn-icon" style={{ padding: '6px' }} title="Editar"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeletar(d.id)} className="btn-icon" style={{ padding: '6px', color: 'var(--color-danger)' }} title="Excluir"><Trash2 size={16} /></button>
                </div>}
              </div>
            );
          })}
        </div>
      </div>

      {entrada && (
        <Janela
          titulo={entrada.id ? 'Editar entrada' : 'Registrar entrada'}
          icone={<ArrowDownToLine size={18} />}
          aoFechar={() => setEntrada(null)}
          largura="480px"
          fecharClicandoFora={false}
          rodape={
            <button type="submit" form="form-entrada" className="btn-primary" style={{ width: '100%' }}>
              {entrada.id ? 'Salvar alterações' : 'Registrar entrada'}
            </button>
          }
        >
          <form id="form-entrada" onSubmit={salvarEntrada} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <p className="text-xs text-muted" style={{ margin: '0 0 4px', lineHeight: 1.5 }}>
              Dinheiro que entra no caixa do filme: patrocínio, edital, investimento, sócio.
            </p>
            <input placeholder="De onde veio (ex: Edital, Patrocínio)" value={entrada.origem} onChange={e => setEntrada({ ...entrada, origem: e.target.value })} required />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '10px' }}>
              <input type="text" inputMode="numeric" placeholder="Valor (R$)" value={entrada.valor} onChange={e => setEntrada({ ...entrada, valor: formatCurrency(e.target.value) })} required />
              <CampoData value={entrada.data} onChange={v => setEntrada({ ...entrada, data: v })} />
            </div>
            <input placeholder="Observação (opcional)" value={entrada.obs} onChange={e => setEntrada({ ...entrada, obs: e.target.value })} />
          </form>
        </Janela>
      )}

    </div>
  );
}

/** Uma entrada de dinheiro na lista de Lançamentos. */
function LinhaDeEntrada({ a, podeLancar, aoEditar, aoApagar }: {
  a: Aporte;
  podeLancar: boolean;
  aoEditar: () => void;
  aoApagar: () => void;
}) {
  return (
    <div className="card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: 'color-mix(in srgb, var(--color-success) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <ArrowDownToLine size={20} className="text-success" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div className="text-base font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.origem}</div>
          <div className="text-base font-bold text-success" style={{ whiteSpace: 'nowrap' }}>+ {dinheiro(a.valor)}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
          <span className="badge badge-success">Entrada</span>
          <Calendar size={12} />
          <span className="text-xs">{dataCurta(a.data)}</span>
        </div>
        {a.obs && <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>{a.obs}</div>}
      </div>
      {podeLancar && <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button onClick={aoEditar} className="btn-icon" style={{ padding: '6px' }} title="Editar"><Edit2 size={16} /></button>
        <button onClick={aoApagar} className="btn-icon" style={{ padding: '6px', color: 'var(--color-danger)' }} title="Excluir"><Trash2 size={16} /></button>
      </div>}
    </div>
  );
}


/**
 * Link "Ver Comprovante".
 *
 * Componente próprio porque o comprovante agora mora no Storage e o endereço é
 * resolvido de forma assíncrona — hook não roda dentro de `.map`.
 */
function LinkComprovante({ despesa }: { despesa: Despesa }) {
  const endereco = useArquivo(despesa.comprovante);

  if (!endereco) {
    return <span className="text-xs font-bold px-2 py-1 bg-surface rounded text-muted">Comprovante (sem sinal)</span>;
  }

  return (
    <a
      href={endereco}
      download={`Comprovante_${despesa.descricao}`}
      className="text-xs font-bold px-2 py-1 bg-surface rounded text-accent"
      style={{ textDecoration: 'none' }}
      target="_blank"
      rel="noreferrer"
    >
      Ver Comprovante
    </a>
  );
}
