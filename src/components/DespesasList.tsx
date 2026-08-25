import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { TipoDivisao, Despesa } from '../types';
import { Calendar, Trash2, Edit2, RotateCcw, X, Link as LinkIcon } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { registrarDocumento, removerDocumentoDeOrigem, inspecionarLink } from '../lib/documentos';
import { guardarArquivo, LIMITE_BYTES } from '../lib/arquivos';
import { useArquivo } from '../hooks/useArquivo';

/**
 * As categorias de gasto de uma produção.
 *
 * As seis primeiras são as antigas e ficam no começo de propósito: são as mais
 * lançadas, e mudar a ordem obrigaria a reaprender onde cada uma está. As
 * novas cobrem o que antes caía tudo em "Outro" — e "Outro" continua por
 * último, como saída para o que não se encaixa.
 */
const CATEGORIAS = [
  { id: 'transporte', label: 'Transporte', emoji: '🚗' },
  { id: 'alimentacao', label: 'Alimentação', emoji: '🍔' },
  { id: 'moradia', label: 'Moradia', emoji: '🏨' },
  { id: 'equipamento', label: 'Equipamento', emoji: '🎥' },
  { id: 'arte', label: 'Arte', emoji: '🎨' },
  { id: 'elenco', label: 'Elenco', emoji: '🎭' },
  { id: 'equipe', label: 'Cachês', emoji: '💼' },
  { id: 'locacao', label: 'Locação', emoji: '🏠' },
  { id: 'figurino', label: 'Figurino', emoji: '👗' },
  { id: 'maquiagem', label: 'Maquiagem', emoji: '💄' },
  { id: 'som', label: 'Som', emoji: '🎙️' },
  { id: 'luz', label: 'Luz e Elétrica', emoji: '💡' },
  { id: 'pos', label: 'Pós-produção', emoji: '🎞️' },
  { id: 'combustivel', label: 'Combustível', emoji: '⛽' },
  { id: 'seguro', label: 'Seguro e Taxas', emoji: '📋' },
  { id: 'producao', label: 'Produção', emoji: '📌' },
  { id: 'outro', label: 'Outro', emoji: '📄' },
];

/** O chip de escolha, num lugar só — eram cinco cópias do mesmo style inline. */
const chipEstilo = (ativo: boolean): React.CSSProperties => ({
  padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
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

export function DespesasList({ projetoId }: { projetoId: string }) {
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const diariasOficiais = useLiveQuery(async () => {
    const arr = await db.diarias.where('projeto_id').equals(projetoId).toArray();
    return arr.sort((a, b) => a.numero - b.numero);
  }, [projetoId]);
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);

  /** A equipe de verdade: o 'caixa_central' e sentinela da producao, nao pessoa. */
  const equipe = (perfis || []).filter(p => p.id !== 'caixa_central');

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
  const meuDepartamento = (perfis || []).find(p => p.id === meuPerfilId)?.departamento_id || '';
  const [departamentoId, setDepartamentoId] = useState('');

  // Só na primeira vez que o perfil aparece: refazer isso a cada render
  // apagaria a escolha da pessoa no meio do preenchimento.
  const [palpitePronto, setPalpitePronto] = useState(false);
  useEffect(() => {
    if (palpitePronto || !meuDepartamento || editandoId) return;
    setDepartamentoId(meuDepartamento);
    setPalpitePronto(true);
  }, [meuDepartamento, palpitePronto, editandoId]);

  const [dataOcorrencia, setDataOcorrencia] = useState(() => new Date().toISOString().split('T')[0]);

  const [diariaSelecionadaId, setDiariaSelecionadaId] = useState<string>('geral');

  const [dividirComTodos, setDividirComTodos] = useState(true);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [filtroDiaria, setFiltroDiaria] = useState<string>('todas');
  
  const [tipoDespesa, setTipoDespesa] = useState<'producao' | 'reembolsavel' | 'rateio'>('rateio');
  const [comprovanteBase64, setComprovanteBase64] = useState<string | undefined>();
  const [deptoVinculado, setDeptoVinculado] = useState<string>('');

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
    setDepartamentoId(meuDepartamento);
    setSelecionados([]); setDividirComTodos(true);
    setComprovanteBase64(undefined); setComprovanteNome('');
  };

  const iniciarEdicao = (d: any) => {
    setEditandoId(d.id);
    setDescricao(d.descricao);
    setValor(d.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setCategoria(d.categoria || 'outro');
    setDepartamentoId(d.departamento_id || '');
    setPagadorId(d.pagadores[0]?.id_ref || '');
    setDataOcorrencia(d.data_ocorrencia || new Date(d.data).toISOString().split('T')[0]);
    
    // Cascata discovery based on data
    if (d.pagadores[0]?.id_ref === 'caixa_central') {
      setTipoDespesa('producao');
    } else if (d.reembolsavel) {
      setTipoDespesa('reembolsavel');
    } else {
      setTipoDespesa('rateio');
    }
    
    setComprovanteBase64(d.comprovante);
    setComprovanteNome(d.comprovante ? `Comprovante — ${d.descricao}` : '');
    setDeptoVinculado(d.devedores?.find((x: any) => x.tipo === 'departamento')?.id_ref || '');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvarDespesa = async (e: React.FormEvent) => {
    e.preventDefault();
    const valorNum = parseCurrency(valor);
    if (!descricao || valorNum <= 0 || !pagadorId || !perfis) return;

    /*
      O 'caixa_central' é sentinela, não pessoa — e a linha dele no banco é uma
      só, global, que muda de projeto conforme novos vão sendo criados. Exigir
      que ela exista fazia `salvarDespesa` RETORNAR EM SILÊNCIO nos projetos
      onde ela não estava: o botão "Registrar Despesa" simplesmente não fazia
      nada, sem erro nenhum na tela.
    */
    const pagador = pagadorId === 'caixa_central'
      ? { id: 'caixa_central' }
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

    const valorPorPessoa = valorNum / devedoresLista.length;
    
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
      pagadores = [{ tipo: 'pessoa' as const, id_ref: 'caixa_central', valor: valorNum }];
      if (deptoVinculado) {
        devedores = [{ tipo: 'departamento' as const, id_ref: deptoVinculado, valor: valorNum }];
      } else {
        devedores = [{ tipo: 'pessoa' as const, id_ref: 'caixa_central', valor: valorNum }]; // custo cego
      }
    } else if (tipoDespesa === 'reembolsavel') {
      // Pessoa paga, Caixa deve
      pagadores = [{ tipo: 'pessoa' as const, id_ref: pagador.id, valor: valorNum }];
      devedores = [{ tipo: 'pessoa' as const, id_ref: 'caixa_central', valor: valorNum }];
    } else {
      // Pessoa paga, equipe deve
      pagadores = [{ tipo: 'pessoa' as const, id_ref: pagador.id, valor: valorNum }];
      devedores = devedoresLista.map(p => ({ tipo: 'pessoa' as const, id_ref: p.id, valor: valorPorPessoa }));
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
  const despesasFiltradas = (despesas || []).filter(d => filtroDiaria === 'todas' || d.diaria === filtroDiaria);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>

      {toastUndo && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)', padding: '12px 24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 9999 }}>
          <span className="text-sm">Despesa apagada.</span>
          <button onClick={undoDelete} className="btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <RotateCcw size={14} /> Desfazer
          </button>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="text-lg font-bold">{editandoId ? 'Editar Despesa' : 'Lançar Nova Despesa'}</h3>
          {editandoId && (
            <button onClick={limparForm} className="btn-icon" title="Cancelar edição"><X size={16} /></button>
          )}
        </div>
        <form onSubmit={salvarDespesa} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input placeholder="Descrição (ex: Almoço da Equipe)" value={descricao} onChange={e => setDescricao(e.target.value)} required />
            <input type="text" placeholder="Valor (R$)" value={valor} onChange={e => setValor(formatCurrency(e.target.value))} required />
            <input type="date" value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)} />

            {/* Categoria em chips */}
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Categoria</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {CATEGORIAS.map(c => (
                  <div key={c.id} onClick={() => setCategoria(c.id)}
                    style={{ padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', border: `1px solid ${categoria === c.id ? 'var(--accent)' : 'var(--border-light)'}`, backgroundColor: categoria === c.id ? 'var(--bg-active)' : 'var(--bg-surface)', color: categoria === c.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: categoria === c.id ? 'bold' : 'normal', fontSize: '0.85rem' }}>
                    <span>{c.emoji}</span> {c.label}
                  </div>
                ))}
              </div>
            </div>

            {/*
              DE QUEM É a despesa — a área que gastou.

              Diferente de "quem pagou", logo abaixo. A Arte pode comprar uma
              lente que é da Fotografia, e o produtor pode pagar a tinta que é da
              Arte. Confundir as duas coisas é o que impede o orçamento por área
              de existir.

              Vem preenchido com o SEU departamento quando o app sabe quem você
              é: quem lança quase sempre lança o do próprio setor, e uma escolha
              já feita é uma escolha a menos no fim do dia.
            */}
            {(departamentos || []).length > 0 && (
              <div>
                <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>
                  De qual área é este gasto
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div
                    onClick={() => setDepartamentoId('')}
                    style={chipEstilo(departamentoId === '')}
                  >
                    Da produção
                  </div>
                  {(departamentos || []).map(d => (
                    <div
                      key={d.id}
                      onClick={() => setDepartamentoId(d.id)}
                      style={chipEstilo(departamentoId === d.id)}
                    >
                      {d.nome}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: '6px' }}>
                  É de quem o gasto é, não de quem pagou. Seguro, taxa e caixa geral ficam em “Da produção”.
                </div>
              </div>
            )}

            {/* Diária em chips */}
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>Diária</div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }} className="hide-scrollbar">
                {listaDiarias.map(d => (
                  <div key={d.val} onClick={() => setDiariaSelecionadaId(d.val)}
                    style={{ padding: '8px 16px', borderRadius: '20px', whiteSpace: 'nowrap', cursor: 'pointer', border: `1px solid ${diariaSelecionadaId === d.val ? 'var(--accent)' : 'var(--border-light)'}`, backgroundColor: diariaSelecionadaId === d.val ? 'var(--bg-active)' : 'var(--bg-surface)', color: diariaSelecionadaId === d.val ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: diariaSelecionadaId === d.val ? 'bold' : 'normal' }}>
                    {d.label}
                  </div>
                ))}
              </div>
            </div>

            <select value={pagadorId} onChange={e => setPagadorId(e.target.value)} required disabled={tipoDespesa === 'producao'}>
              <option value="">Quem pagou?</option>
              <option value="caixa_central">A Produção (Caixa)</option>
              {equipe.map(p => (<option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>))}
            </select>

            {/*
              Sem ninguém cadastrado, a lista só oferecia "A Produção" e ficava
              parecendo quebrada — o relatório de bug foi exatamente esse:
              "clicamos em Reembolsável e não apareceu a pessoa da equipe".
              A lista não estava com defeito; estava vazia, e não dizia.
            */}
            {equipe.length === 0 && (
              <p className="text-xs text-muted" style={{ marginTop: '-4px', lineHeight: 1.5 }}>
                Ninguém cadastrado na equipe ainda — por isso só aparece a Produção.
                Adicione as pessoas em <strong>Produção → Equipe</strong> para poder
                lançar reembolso e rateio.
              </p>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            
            <div className="text-xs text-secondary font-bold uppercase tracking-widest mt-2">Tipo de Despesa</div>
            
            <label className="checkbox-label" style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <input type="radio" checked={tipoDespesa === 'producao'} onChange={() => { setTipoDespesa('producao'); setPagadorId('caixa_central'); }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="text-sm font-bold">Gasto Direto da Produção (Caixa)</span>
                <span className="text-xs text-muted">Dinheiro já saiu direto da conta do projeto. Ninguém deve a ninguém.</span>
              </div>
            </label>

            {tipoDespesa === 'producao' && (
              <div style={{ padding: '0 12px 12px 32px' }}>
                <select value={deptoVinculado} onChange={e => setDeptoVinculado(e.target.value)} style={{ padding: '8px', fontSize: '0.9rem' }}>
                  <option value="">(Opcional) Vincular a um Departamento</option>
                  {departamentos?.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
            )}

            <label className="checkbox-label" style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', opacity: tipoDespesa === 'producao' ? 0.6 : 1 }}>
              <input type="radio" checked={tipoDespesa === 'reembolsavel'} onChange={() => setTipoDespesa('reembolsavel')} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="text-sm font-bold">Despesa Reembolsável (Adiantamento)</span>
                <span className="text-xs text-muted">Alguém pagou do próprio bolso. A Produção deve reembolsar.</span>
              </div>
            </label>

            <label className="checkbox-label" style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', opacity: tipoDespesa === 'producao' ? 0.6 : 1 }}>
              <input type="radio" checked={tipoDespesa === 'rateio'} onChange={() => setTipoDespesa('rateio')} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span className="text-sm font-bold">Divisão na Equipe (Rateio)</span>
                <span className="text-xs text-muted">Alguém pagou por vários e a equipe deve repassar sua parte.</span>
              </div>
            </label>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', marginTop: '8px' }}>
              <span className="text-sm font-bold">Comprovante (Recibo / Nota)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize: '12px' }} />
                {/* `.btn-chip`, não `.btn-icon`: o .btn-icon é 40x40 fixo, e o
                    rótulo quebrava em três linhas dentro do quadrado. */}
                <button
                  type="button"
                  onClick={anexarLinkComprovante}
                  className="btn-chip"
                  style={{ fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  <LinkIcon size={14} /> Link do Drive
                </button>
              </div>
              {comprovanteBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="text-xs text-accent">Anexado: {comprovanteNome || 'comprovante'}</span>
                  <button
                    type="button"
                    onClick={() => { setComprovanteBase64(undefined); setComprovanteNome(''); }}
                    className="btn-icon text-muted"
                    style={{ padding: '2px' }}
                    title="Remover comprovante"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {tipoDespesa === 'rateio' && (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '12px' }}>Como dividir?</div>
              <label className="checkbox-label" style={{ marginBottom: !dividirComTodos ? '16px' : '0' }}>
                <input type="checkbox" checked={dividirComTodos} onChange={e => setDividirComTodos(e.target.checked)} />
                <span className="text-sm font-medium">Dividir igualmente com todos da produção</span>
              </label>
              {!dividirComTodos && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div className="text-xs text-muted" style={{ marginBottom: '4px' }}>Selecione quem participou da despesa:</div>
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

          <button type="submit" className="btn-primary">{editandoId ? 'Salvar Alterações' : 'Registrar Despesa'}</button>
        </form>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest">Últimas Despesas</div>
          {diariasExistentes.length > 0 && (
            <select value={filtroDiaria} onChange={e => setFiltroDiaria(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}>
              <option value="todas">Todas as diárias</option>
              {diariasExistentes.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {despesasFiltradas.length === 0 && <div className="text-muted text-sm text-center">Nenhuma despesa registrada.</div>}

          {despesasFiltradas.slice().reverse().map(d => {
            const pagador = perfis?.find(p => p.id === d.pagadores[0]?.id_ref) || { nome: 'Caixa', sobrenome: '' };
            const icon = emojiCategoria(d.categoria, d.descricao);

            return (
              <div key={d.id} className="card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', position: 'relative' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="text-base font-bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descricao}</div>
                    <div className="text-base font-bold text-danger" style={{ whiteSpace: 'nowrap' }}>R$ {d.valor_total.toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {d.diaria && <span className="badge badge-warning">{d.diaria}</span>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span className="text-xs">{d.data_ocorrencia || new Date(d.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button onClick={() => iniciarEdicao(d)} className="btn-icon" style={{ padding: '6px' }} title="Editar"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeletar(d.id)} className="btn-icon" style={{ padding: '6px', color: 'var(--color-danger)' }} title="Excluir"><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
