import { Fragment, useEffect, useRef, useState } from 'react';
import { Vazio } from './ui/Vazio';
import { vinculosDaPessoa } from '../lib/vinculos';
import { naEquipe } from '../lib/vinculos';
import { useAcesso } from '../hooks/useAcesso';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Smartphone, Wallet, FileText, Link2, RefreshCw, Upload, Settings2, SlidersHorizontal, Trash2, UserPlus, Users } from 'lucide-react';
import { syncPerfisDeCadastro, publicarFichaPublica } from '../lib/sync';
import { useRole } from '../hooks/useRole';
import { podeVerCamada } from '../lib/camposSensiveis';
import { criarConvite, linkDoConvite, perfisJaVinculados } from '../lib/membros';
import type { Perfil } from '../types';
import { linkDoApp } from '../lib/urlPublica';
import Stepper, { Step } from './ui/Stepper';
import { ProfileCard } from './ui/ProfileCard';
import { FormBuilder } from './FormBuilder';
import { FichaCompleta } from './FichaCompleta';
import { RelatorioTransversal } from './RelatorioTransversal';
import { useLayoutContext } from '../pages/ProjectLayout';
import { montarSchemaFicha, validarObrigatorios, valoresParaPerfil } from '../lib/camposFicha';
import { confirmar } from './ui/Confirmacao';
import { CampoData } from './ui/CampoData';
import { CampoFuncao } from './ui/CampoFuncao';
import { Janela } from './ui/Janela';
import { funcoesPorHierarquia, ordemDaFuncao, ordemDoDepartamento } from '../lib/creditos';
import { MOMENTOS } from '../lib/gifs';

/** Tamanho único para todos os botões da barra de ações da Equipe. */
const botaoBarra: React.CSSProperties = {
  width: '38px',
  height: '38px',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  flexShrink: 0,
};

/** Menu suspenso simples, fecha ao clicar fora. */
function Menu({ children, onFechar }: { children: React.ReactNode; onFechar: () => void }) {
  return (
    <>
      <div onClick={onFechar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div
        style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 41,
          minWidth: '230px', padding: '6px',
          backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column', gap: '2px',
        }}
      >
        {children}
      </div>
    </>
  );
}

function ItemMenu({
  icone, titulo, descricao, onClick, comoDiv = false,
}: {
  icone: React.ReactNode; titulo: string; descricao: string; onClick?: () => void; comoDiv?: boolean;
}) {
  const conteudo = (
    <>
      <span style={{ color: 'var(--accent-texto)', display: 'flex', marginTop: '2px' }}>{icone}</span>
      <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <span className="text-sm font-bold">{titulo}</span>
        <span className="text-xs text-muted">{descricao}</span>
      </span>
    </>
  );

  const estilo: React.CSSProperties = {
    display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%',
    padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
    background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
  };

  if (comoDiv) return <div style={estilo}>{conteudo}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      style={estilo}
      onMouseOver={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
      onMouseOut={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {conteudo}
    </button>
  );
}

export function PessoasList({ projetoId, onSelectUsuario }: { projetoId: string, onSelectUsuario?: (id: string) => void }) {
  const perfis = useLiveQuery(() => db.perfis.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const camposCustom = projeto?.campos_customizados || [];
  
  const { role, perfilId: meuPerfilId, podeAqui } = useRole();
  const podeConvidar = podeAqui('convidar');
  /*
    Três perguntas diferentes, e não mais um "canEditProducao" para tudo:
    - administrar a equipe (seleção em massa, puxar cadastros do link, montar a
      ficha) é de quem administra;
    - adicionar alguém: quem administra, ou quem é do departamento (no seu);
    - editar uma ficha: a regra por registro — a própria sempre, as do meu
      departamento, e as sem departamento.
  */
  const { podeEscrever } = useAcesso();
  const administra = podeEscrever('projetos');
  const podeAdicionar = podeEscrever('perfis');

  /**
   * Quem da equipe já tem conta vinculada.
   *
   * Serve para não oferecer "convidar" a quem já está dentro — o convite seria
   * gasto à toa, e o índice único do banco recusaria o vínculo na cara da
   * pessoa quando ela tentasse aceitar.
   */
  const [vinculados, setVinculados] = useState<Set<string>>(new Set());
  const [convidando, setConvidando] = useState<string | null>(null);
  const [convidado, setConvidado] = useState<string | null>(null);

  useEffect(() => {
    if (!podeConvidar) return;
    perfisJaVinculados(projetoId)
      .then(ids => setVinculados(new Set(ids)))
      .catch(() => {});
  }, [projetoId, podeConvidar]);

  /**
   * Gera um convite nominal e copia o link.
   *
   * O papel é 'equipe': quem está na ficha da produção trabalha nela. Para
   * convidar alguém como leitura ou admin, o caminho continua sendo o botão
   * de compartilhar, que é onde se escolhe papel.
   */
  const convidarPessoa = async (p: Perfil) => {
    setConvidando(p.id);
    try {
      const convite = await criarConvite(
        projetoId,
        projeto?.nome || 'Produção',
        'equipe',
        `${p.nome} ${p.sobrenome || ''}`.trim(),
        { perfil_id: p.id, email_esperado: p.email || null }
      );
      await navigator.clipboard.writeText(linkDoConvite(convite.token)).catch(() => {});
      setConvidado(p.id);
      setTimeout(() => setConvidado(null), 3000);
    } catch (e: any) {
      alert('Não consegui criar o convite:\n\n' + (e?.message || e));
    } finally {
      setConvidando(null);
    }
  };
  const [showForm, setShowForm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);
  
  // Bulk Delete
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Menus agrupados da barra de ações
  const [menuAberto, setMenuAberto] = useState<'ficha' | 'add' | null>(null);

  // Importação de CSV com mapeamento de colunas
  const [csvCabecalhos, setCsvCabecalhos] = useState<string[] | null>(null);
  const [csvLinhas, setCsvLinhas] = useState<string[][]>([]);
  const [csvMapa, setCsvMapa] = useState<Record<string, number>>({});
  
  const { openPanel, closePanel } = useLayoutContext();
  
  // States para o form de Novo Membro
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [nomeSocial, setNomeSocial] = useState('');
  const [cpf, setCpf] = useState('');
  const [rg, setRg] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [endereco, setEndereco] = useState('');
  const [instagram, setInstagram] = useState('');
  const [contatoEmergencia, setContatoEmergencia] = useState('');
  const [infoMedica, setInfoMedica] = useState('');
  const [tipoSanguineo, setTipoSanguineo] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [restricaoAlimentar, setRestricaoAlimentar] = useState('');
  const [planoSaude, setPlanoSaude] = useState('');
  const [funcao, setFuncao] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [drt, setDrt] = useState('');
  const [experiencia, setExperiencia] = useState('');
  const [valorDiaria, setValorDiaria] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  /*
    FECHAR UMA FICHA MEXIDA PERGUNTA ANTES.
    Com a janela comum o formulário ganhou o Esc — e o Esc, o X e um toque
    errado no fundo apagavam, calados, meia ficha digitada. O retrato é tirado
    quando a janela abre (vazio no "novo", a ficha como estava no "editar"), e
    só pergunta se algo mudou desde então: abrir e fechar sem mexer continua
    sendo um gesto só.
  */
  const retratoDoForm = () => JSON.stringify([
    nome, sobrenome, nomeSocial, cpf, rg, nascimento, telefone, email, endereco, instagram,
    contatoEmergencia, infoMedica, tipoSanguineo, alergias, medicamentos, restricaoAlimentar, planoSaude,
    funcao, departamentoId, drt, experiencia, valorDiaria, tipoVinculo, chavePix,
    banco, agencia, conta, cnpj, razaoSocial, customValues,
  ]);
  const retratoAoAbrir = useRef('');
  useEffect(() => {
    if (showForm) retratoAoAbrir.current = retratoDoForm();
    // Só na abertura: depois disso, mudar é justamente o que se quer detectar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm]);

  const fecharForm = async () => {
    if (retratoDoForm() !== retratoAoAbrir.current) {
      const descartar = await confirmar({
        titulo: editId ? 'Descartar as alterações?' : 'Descartar esta ficha?',
        detalhe: editId
          ? 'O que você mudou nesta ficha ainda não foi salvo. A ficha continua como estava.'
          : 'O que você preencheu ainda não foi salvo e vai se perder.',
        confirmar: 'Descartar',
        cancelar: 'Continuar editando',
        perigo: true,
      });
      if (!descartar) return;
    }
    setShowForm(false);
  };

  // Marca no formulário os campos que o Construtor de Ficha exige.
  const schemaFicha = montarSchemaFicha(projeto);
  const ph = (id: string, texto: string) =>
    schemaFicha.some(c => c.id === id && c.obrigatorio) ? `${texto} *` : texto;

  const limparForm = () => {
    setNome(''); setSobrenome(''); setNomeSocial(''); setCpf(''); setRg(''); setNascimento('');
    setTelefone(''); setEmail(''); setEndereco(''); setInstagram('');
    setContatoEmergencia(''); setInfoMedica(''); setTipoSanguineo(''); setAlergias(''); setMedicamentos(''); setRestricaoAlimentar(''); setPlanoSaude('');
    setFuncao(''); setDepartamentoId(''); setDrt(''); setExperiencia('');
    setValorDiaria(''); setTipoVinculo(''); setChavePix(''); setBanco(''); setAgencia(''); setConta(''); setCnpj(''); setRazaoSocial('');
    setCustomValues({});
    setEditId(null);
  };

  const adicionarPessoa = async () => {
    if (!nome) {
      alert("O nome é obrigatório!");
      return;
    }

    // Campos marcados como obrigatórios no Construtor de Ficha bloqueiam o cadastro (§6.2).
    const schema = montarSchemaFicha(projeto);
    const valoresParaValidar: Record<string, any> = {
      nome, sobrenome, nome_social: nomeSocial, cpf, rg, data_nascimento: nascimento,
      telefone, email, endereco, instagram,
      contato_emergencia: contatoEmergencia, info_medica: infoMedica, tipo_sanguineo: tipoSanguineo,
      alergias, medicamentos_continuos: medicamentos, restricao_alimentar: restricaoAlimentar, plano_saude: planoSaude,
      funcao, drt, experiencia,
      valor_diaria: valorDiaria, tipo_vinculo: tipoVinculo, chave_pix: chavePix,
      banco, agencia, conta, cnpj, razao_social: razaoSocial,
      ...customValues,
    };

    /*
      OBRIGATÓRIO É PARA A FICHA, NÃO PARA QUEM CADASTRA À MÃO.
      Os campos obrigatórios da produção valem no link de cadastro, que a
      própria pessoa preenche. Aqui quem digita é a produção, e às vezes só
      precisa da pessoa no set agora e completa depois: "sei o que estou
      fazendo" (Lucas, 09/10/2026). Antes o alerta travava — e quem tinha
      pressa preenchia tudo com "-", que é pior do que vazio.
    */
    const faltando = validarObrigatorios(valoresParaValidar, schema);
    if (faltando.length > 0 && !(await confirmar({
      titulo: 'Faltam campos que esta produção pede',
      detalhe: `${faltando.join(', ')}. Dá para salvar assim e completar depois — ou mandar o link de cadastro para a pessoa preencher.`,
      confirmar: 'Sei o que estou fazendo, salvar',
      cancelar: 'Voltar e preencher',
    }))) return;

    /*
      "TEM NADA AÍ" (pedido do Lucas, 03/10/2026). Ficha nova só com o nome
      — ou o nome e mais uma coisa — passa, mas com uma pergunta de brincadeira
      e um gif da pasta "vazio". Não bloqueia: às vezes só se sabe o nome
      mesmo, e o resto vem pelo link de cadastro. Editar não pergunta — quem
      edita já passou por aqui.
    */
    if (!editId && faltando.length === 0) {
      const preenchidos = Object.entries(valoresParaValidar)
        .filter(([campo, v]) => campo !== 'nome' && campo !== 'sobrenome' && String(v ?? '').trim() !== '')
        .length + (departamentoId ? 1 : 0);
      if (preenchidos < 2 && !(await confirmar({
        titulo: 'Tem quase nada aí 👀',
        detalhe: `${nome} vai entrar só com ${preenchidos === 0 ? 'o nome' : 'o nome e mais uma informação'}. Dá para completar depois — ou mandar o link de cadastro para a pessoa preencher.`,
        confirmar: 'Salvar assim mesmo',
        cancelar: 'Voltar e completar',
        humor: MOMENTOS.vazio,
      }))) return;
    }

    const payload = {
      projeto_id: projetoId,
      nome, sobrenome, nome_social: nomeSocial, cpf, rg, data_nascimento: nascimento,
      telefone, email, endereco, instagram,
      contato_emergencia: contatoEmergencia, info_medica: infoMedica, tipo_sanguineo: tipoSanguineo, alergias, medicamentos_continuos: medicamentos, restricao_alimentar: restricaoAlimentar, plano_saude: planoSaude,
      funcao, departamento_id: departamentoId || undefined, drt, experiencia,
      valor_diaria: Number(valorDiaria) || undefined, tipo_vinculo: tipoVinculo, chave_pix: chavePix, banco, agencia, conta, cnpj, razao_social: razaoSocial,
      custom: customValues
    };

    if (editId) {
      await db.perfis.update(editId, payload);
    } else {
      await db.perfis.add({ id: crypto.randomUUID(), ...payload });
    }
    
    limparForm();
    setShowForm(false);
  };

  const handleEdit = (p: any) => {
    setEditId(p.id);
    setNome(p.nome); setSobrenome(p.sobrenome || ''); setNomeSocial(p.nome_social || ''); setCpf(p.cpf || ''); setRg(p.rg || ''); setNascimento(p.data_nascimento || '');
    setTelefone(p.telefone || ''); setEmail(p.email || ''); setEndereco(p.endereco || ''); setInstagram(p.instagram || '');
    setContatoEmergencia(p.contato_emergencia || ''); setInfoMedica(p.info_medica || ''); setTipoSanguineo(p.tipo_sanguineo || ''); 
    setAlergias(p.alergias || ''); setMedicamentos(p.medicamentos_continuos || ''); setRestricaoAlimentar(p.restricao_alimentar || ''); setPlanoSaude(p.plano_saude || '');
    setFuncao(p.funcao || ''); setDepartamentoId(p.departamento_id || ''); setDrt(p.drt || ''); setExperiencia(p.experiencia || '');
    setValorDiaria(p.valor_diaria ? String(p.valor_diaria) : ''); setTipoVinculo(p.tipo_vinculo || ''); setChavePix(p.chave_pix || ''); 
    setBanco(p.banco || ''); setAgencia(p.agencia || ''); setConta(p.conta || ''); setCnpj(p.cnpj || ''); setRazaoSocial(p.razao_social || '');
    setCustomValues(p.custom || {});
    setShowForm(true);
  };

  /*
    APAGAR QUEM TEM HISTÓRICO VIRA ARQUIVAR (ROADMAP §10.C). Sem chave
    estrangeira em lugar nenhum, apagar a ficha de quem pagou uma despesa
    deixava a despesa apontando para ninguém — o nome virava "—" e o saldo
    ficava órfão no cálculo. Arquivada, a pessoa sai das listas e continua dando
    nome ao passado. Quem não aparece em nada é apagado de verdade, como antes.
  */
  const handleDelete = async (id: string, nomeCompleto: string) => {
    const nome = nomeCompleto.trim();
    const v = await vinculosDaPessoa(projetoId, id);
    if (v.total > 0) {
      const ok = await confirmar({
        titulo: `Arquivar ${nome}?`,
        detalhe: `${nome} aparece em ${v.frase}. Apagar deixaria esses registros sem dono; arquivando, a pessoa sai das listas e o nome continua no histórico. Dá para restaurar depois.`,
        confirmar: 'Arquivar',
        cancelar: 'Cancelar',
      });
      if (ok) await db.perfis.update(id, { arquivado_em: Date.now() });
      return;
    }
    if (await confirmar(`Tem certeza que deseja excluir ${nome}?`)) {
      await db.perfis.delete(id);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const comHistorico: string[] = [];
    for (const id of selectedIds) {
      if ((await vinculosDaPessoa(projetoId, id)).total > 0) comHistorico.push(id);
    }
    const semHistorico = selectedIds.size - comHistorico.length;
    const aviso = comHistorico.length
      ? ` ${comHistorico.length} delas aparecem em despesas, diárias ou créditos e vão ser arquivadas, não apagadas.`
      : '';
    if (await confirmar(`Tirar as ${selectedIds.size} pessoas selecionadas da equipe?${aviso}`)) {
      for (const id of selectedIds) {
        if (comHistorico.includes(id)) await db.perfis.update(id, { arquivado_em: Date.now() });
        else await db.perfis.delete(id);
      }
      void semHistorico;
      setSelectedIds(new Set());
      setBulkMode(false);
    }
  };

  const arquivados = (perfis || []).filter(p => p.arquivado_em);
  const [verArquivados, setVerArquivados] = useState(false);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const getDeptoNome = (id?: string) => {
    if (!id || !departamentos) return 'S/ Depto';
    const d = departamentos.find(depto => depto.id === id);
    return d ? d.nome : 'S/ Depto';
  };

  /*
    A ORDEM DA EQUIPE (pedido do Lucas, 28/09/2026). A lista vinha na ordem do
    banco — que, com id aleatório, não é ordem nenhuma: quem procurava alguém
    tinha que ler todos os cartões. Agora é alfabética por padrão, ou agrupada
    por departamento. A escolha fica neste aparelho (conveniência de quem olha,
    não dado da produção).
  */
  const [ordem, setOrdemEstado] = useState<'az' | 'departamento'>(() => {
    try { return localStorage.getItem('setprod:equipe:ordem') === 'departamento' ? 'departamento' : 'az'; } catch { return 'az'; }
  });
  const setOrdem = (o: 'az' | 'departamento') => {
    setOrdemEstado(o);
    try { localStorage.setItem('setprod:equipe:ordem', o); } catch { /* aba privada */ }
  };
  const nomeCompleto = (p: { nome: string; sobrenome?: string }) => `${p.nome} ${p.sobrenome || ''}`.trim();
  const porNome = (a: { nome: string; sobrenome?: string }, b: { nome: string; sobrenome?: string }) =>
    nomeCompleto(a).localeCompare(nomeCompleto(b), 'pt-BR', { sensitivity: 'base' });
  const deptoDe = (id?: string) => departamentos?.find(d => d.id === id);
  /*
    "Por departamento" segue a HIERARQUIA DOS CRÉDITOS (pedido do Lucas,
    30/09/2026): os departamentos na ordem da ficha técnica — Direção, Produção,
    Roteiro... — e, dentro de cada um, o chefe antes dos assistentes. Quem não
    tem departamento vai para o fim, e não para o começo por ser "vazio".
  */
  const equipeOrdenada = (perfis || []).filter(naEquipe).sort((a, b) => {
    if (ordem === 'departamento') {
      const porDepto = ordemDoDepartamento(deptoDe(a.departamento_id)) - ordemDoDepartamento(deptoDe(b.departamento_id))
        || getDeptoNome(a.departamento_id).localeCompare(getDeptoNome(b.departamento_id), 'pt-BR', { sensitivity: 'base' });
      if (porDepto !== 0) return porDepto;
      const porFuncao = ordemDaFuncao(deptoDe(a.departamento_id), a.funcao || '') - ordemDaFuncao(deptoDe(b.departamento_id), b.funcao || '');
      if (porFuncao !== 0) return porFuncao;
    }
    return porNome(a, b);
  });

  /**
   * As funções da pessoa na ordem da ficha técnica: "Diretora · Montadora",
   * mesmo que a ficha diga Montadora. A função de outro departamento leva o
   * nome dele entre parênteses — "Trilha Sonora (Pós-produção)".
   */
  const funcoesDe = (p: Perfil) => {
    const todas = funcoesPorHierarquia(p, projeto?.creditos, departamentos);
    const rotulo = (f: (typeof todas)[number]) =>
      f.departamentoId && f.departamentoId !== p.departamento_id ? `${f.papel} (${getDeptoNome(f.departamentoId)})` : f.papel;
    return {
      todas: todas.length > 0 ? todas.map(rotulo) : ['Membro'],
      outras: todas.filter(f => !f.daFicha).map(rotulo),
    };
  };

  /**
   * Publica a ficha antes de copiar: o link é inútil se quem abrir receber
   * uma versão antiga dos campos.
   */
  const copiarLinkCadastro = async () => {
    const url = linkDoApp(`cadastro/${projetoId}`);
    await navigator.clipboard.writeText(url);

    try {
      await publicarFichaPublica(projetoId);
      alert('Link copiado! A ficha atual (com seus campos e obrigatórios) já está publicada.');
    } catch (e: any) {
      alert(
        'Link copiado, MAS a ficha não foi publicada no Supabase:\n\n' +
        (e?.message || e) +
        '\n\nQuem abrir o link vai ver apenas os campos padrão.'
      );
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const novos = await syncPerfisDeCadastro(projetoId);
      alert(
        novos === 0
          ? 'Nenhum cadastro novo pelo link. A equipe já está em dia.'
          : novos === 1
            ? '1 cadastro novo entrou na equipe.'
            : `${novos} cadastros novos entraram na equipe.`
      );
    } catch (e) {
      alert('Erro ao sincronizar. Verifique a internet.');
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * Importação de CSV / Google Forms (§6.4). Lê o arquivo, tenta adivinhar o
   * mapeamento pelo nome das colunas e abre a tela para o usuário confirmar/ajustar
   * antes de criar qualquer membro.
   */
  const handleImportarCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;

        const linhas = text.split(/\r?\n/).filter(l => l.trim() !== '');
        if (linhas.length < 2) return alert('O CSV parece vazio ou só tem o cabeçalho.');

        const separador = linhas[0].split(';').length > linhas[0].split(',').length ? ';' : ',';
        const limpa = (c: string) => c.trim().replace(/^"|"$/g, '');

        const cabecalhos = linhas[0].split(separador).map(limpa);
        const dados = linhas.slice(1).map(l => l.split(separador).map(limpa));

        // Palpite inicial: casa o nome da coluna com o nome/id do campo.
        const schema = montarSchemaFicha(projeto);
        const palpite: Record<string, number> = {};
        schema.forEach(campo => {
          const alvo = campo.nome.toLowerCase();
          const idx = cabecalhos.findIndex(h => {
            const hl = h.toLowerCase();
            if (hl === alvo || hl === campo.id) return true;
            if (campo.id === 'nome') return hl.startsWith('nome');
            if (campo.id === 'email') return hl.includes('mail');
            if (campo.id === 'telefone') return hl.includes('telefone') || hl.includes('celular') || hl.includes('whatsapp');
            if (campo.id === 'funcao') return hl.includes('funç') || hl.includes('func') || hl.includes('cargo');
            /*
              PALAVRA INTEIRA, não pedaço de texto. Com `includes` o RG casava
              com a coluna "Cargo" (ca-RG-o), e a função de cada pessoa ia parar
              no campo de documento da ficha. Nome de campo com mais de uma
              palavra ainda pode aparecer no meio do cabeçalho; nome de uma
              palavra só precisa ser uma palavra do cabeçalho.
            */
            if (/\s/.test(alvo)) return hl.includes(alvo);
            return hl.split(/[^\p{L}\p{N}]+/u).includes(alvo);
          });
          if (idx >= 0) palpite[campo.id] = idx;
        });

        setCsvCabecalhos(cabecalhos);
        setCsvLinhas(dados);
        setCsvMapa(palpite);
      } catch (err) {
        console.error(err);
        alert('Erro ao processar o arquivo CSV.');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const cancelarImportacao = () => { setCsvCabecalhos(null); setCsvLinhas([]); setCsvMapa({}); };

  /*
    O número do botão é o que VAI entrar, não o tamanho do arquivo.
    Antes o botão dizia "Importar 40 membro(s)" contando também as linhas sem
    nome — que são ignoradas —, e o aviso do fim desmentia o botão. Muda na
    hora em que a pessoa troca a coluna do Nome.
  */
  const colunaDoNome = csvMapa['nome'];
  const linhasComNome = colunaDoNome === undefined
    ? 0
    : csvLinhas.filter(l => l[colunaDoNome]?.trim()).length;

  const confirmarImportacao = async () => {
    const schema = montarSchemaFicha(projeto);
    const colunaNome = csvMapa['nome'];
    if (colunaNome === undefined) return alert('Escolha qual coluna corresponde ao campo "Nome".');

    let adicionados = 0;
    let ignorados = 0;

    for (const linha of csvLinhas) {
      if (!linha[colunaNome]?.trim()) { ignorados++; continue; }

      const valores: Record<string, any> = {};
      for (const [campoId, colIdx] of Object.entries(csvMapa)) {
        const bruto = linha[colIdx];
        if (bruto !== undefined && bruto !== '') valores[campoId] = bruto;
      }

      await db.perfis.add({
        id: crypto.randomUUID(),
        projeto_id: projetoId,
        nome: linha[colunaNome].trim(),
        ...valoresParaPerfil(valores, schema),
      } as any);
      adicionados++;
    }

    setCsvCabecalhos(null);
    setCsvLinhas([]);
    setCsvMapa({});
    alert(`${adicionados} membro(s) importados.${ignorados > 0 ? ` ${ignorados} linha(s) sem nome foram ignoradas.` : ''}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className="text-xs text-secondary font-bold uppercase tracking-widest">Equipe {!podeAdicionar && '(Somente Leitura)'}</span>
          <select
            value={ordem}
            onChange={e => setOrdem(e.target.value as 'az' | 'departamento')}
            aria-label="Ordem da equipe"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }}
          >
            <option value="az">Nome (A–Z)</option>
            <option value="departamento">Por departamento</option>
          </select>
        </div>

        {/* Barra de ações: todos os botões com o mesmo tamanho.
            Ficha + link viram um menu só; importar + criar manualmente, outro. */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setShowRelatorio(true)}
            title="Relatório por campo (filtro transversal)"
            style={{ ...botaoBarra, backgroundColor: showRelatorio ? 'var(--accent)' : 'var(--bg-surface)', color: showRelatorio ? '#000' : 'var(--text-primary)' }}
          >
            {/* Controles = filtrar; documento = ficha. Estavam trocados. */}
            <SlidersHorizontal size={16} />
          </button>

          {administra && (
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              title="Apagar vários"
              style={{ ...botaoBarra, backgroundColor: bulkMode ? 'var(--accent)' : 'var(--bg-surface)', color: bulkMode ? '#000' : 'var(--text-primary)' }}
            >
              <Trash2 size={16} />
            </button>
          )}

          {administra && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Atualizar (puxar cadastros enviados pelo link)"
              style={botaoBarra}
            >
              <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
            </button>
          )}

          {administra && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuAberto(menuAberto === 'ficha' ? null : 'ficha')}
                title="Ficha de cadastro"
                style={{ ...botaoBarra, backgroundColor: menuAberto === 'ficha' ? 'var(--bg-active)' : 'var(--bg-surface)' }}
              >
                <FileText size={16} />
              </button>
              {menuAberto === 'ficha' && (
                <Menu onFechar={() => setMenuAberto(null)}>
                  <ItemMenu
                    icone={<Settings2 size={14} />}
                    titulo="Construtor de ficha"
                    descricao="Escolher campos e obrigatórios"
                    onClick={() => { setMenuAberto(null); openPanel(<FormBuilder projetoId={projetoId} onClose={closePanel} />); }}
                  />
                  <ItemMenu
                    icone={<Link2 size={14} />}
                    titulo="Copiar link de cadastro"
                    descricao="Enviar para a equipe preencher"
                    onClick={() => { setMenuAberto(null); copiarLinkCadastro(); }}
                  />
                </Menu>
              )}
            </div>
          )}

          {podeAdicionar && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuAberto(menuAberto === 'add' ? null : 'add')}
                title="Adicionar membros"
                style={{ ...botaoBarra, backgroundColor: menuAberto === 'add' ? 'var(--accent)' : 'var(--accent)', color: '#000' }}
              >
                <Plus size={16} />
              </button>
              {menuAberto === 'add' && (
                <Menu onFechar={() => setMenuAberto(null)}>
                  <ItemMenu
                    icone={<UserPlus size={14} />}
                    titulo="Criar manualmente"
                    descricao="Preencher a ficha aqui"
                    onClick={() => { setMenuAberto(null); limparForm(); setShowForm(true); }}
                  />
                  <label style={{ display: 'block', cursor: 'pointer' }}>
                    <ItemMenu
                      icone={<Upload size={14} />}
                      titulo="Importar planilha"
                      descricao="CSV do Google Forms ou Excel"
                      comoDiv
                    />
                    <input
                      type="file"
                      accept=".csv"
                      onChange={e => { setMenuAberto(null); handleImportarCSV(e); }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </Menu>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        
        {/* Main Content (Lista e Filtros) */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '24px' }}>
            {perfis?.filter(naEquipe).length === 0 && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Vazio
                  icone={<Users size={28} />}
                  titulo="Nenhuma pessoa na equipe ainda"
                  ajuda="Cada pessoa aqui tem uma ficha: função, departamento, contato e dados de pagamento."
                />
              </div>
            )}

            {equipeOrdenada.map((p, i) => (
              <Fragment key={p.id}>
              {/* Por departamento: um título onde o grupo começa. */}
              {ordem === 'departamento' && (i === 0 || equipeOrdenada[i - 1].departamento_id !== p.departamento_id) && (
                <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ gridColumn: '1 / -1', marginTop: i === 0 ? 0 : '8px' }}>
                  {p.departamento_id ? getDeptoNome(p.departamento_id) : 'Sem departamento'}
                </div>
              )}
              <div 
                key={p.id} 
                onClick={() => {
                  if (bulkMode) {
                    toggleSelection(p.id);
                  } else {
                    openPanel(
                      <FichaCompleta
                        perfil={p}
                        projeto={projeto!}
                        departamentoNome={getDeptoNome(p.departamento_id)}
                        outrasFuncoes={funcoesDe(p).outras}
                        canEdit={podeEscrever('perfis', p)}
                        verRestrito={podeVerCamada('restrita', { papel: role, meuPerfilId, perfilId: p.id })}
                        verMedico={podeVerCamada('medica', { papel: role, meuPerfilId, perfilId: p.id })}
                        onClose={closePanel}
                        onEdit={(perfilEditado) => {
                          closePanel();
                          handleEdit(perfilEditado);
                        }}
                        onDelete={async (id, nomeDeletado) => {
                          await handleDelete(id, nomeDeletado);
                          closePanel();
                        }}
                        onViewTransacoes={(id) => {
                          if (onSelectUsuario) onSelectUsuario(id);
                        }}
                      />
                    );
                  }
                }} 
                style={{ cursor: 'pointer', transition: 'transform 0.2s ease', position: 'relative' }} 
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} 
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {bulkMode && (
                  <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                    <input type="checkbox" checked={selectedIds.has(p.id)} readOnly style={{ width: '20px', height: '20px' }} />
                  </div>
                )}
                <div style={{ opacity: bulkMode && !selectedIds.has(p.id) ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <ProfileCard
                    name={`${p.nome} ${p.sobrenome || ''}`}
                    // "Diretora · Montadora": todas as funções da pessoa, na
                    // ordem da ficha técnica (lib/creditos, funcoesPorHierarquia).
                    title={funcoesDe(p).todas.join(' · ')}
                    status={getDeptoNome(p.departamento_id)}
                    handle={p.nome_social || p.nome.toLowerCase()}
                    avatarUrl={`https://ui-avatars.com/api/?name=${p.nome}+${p.sobrenome || ''}&background=random`}
                  >
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                        {p.telefone && <span className="text-xs text-secondary bg-surface" style={{ padding: '4px 8px', borderRadius: '4px' }}><Smartphone size={12} style={{ display: 'inline', marginRight: '4px' }}/> Tel</span>}
                        {p.alergias && <span className="text-xs text-danger bg-surface" style={{ padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>Alergia</span>}
                        {p.chave_pix && <span className="text-xs text-accent bg-surface" style={{ padding: '4px 8px', borderRadius: '4px' }}><Wallet size={12} style={{ display: 'inline', marginRight: '4px' }}/> PIX</span>}
                      </div>
                      {/* Convidar ESTA pessoa.
                          O link nasce sabendo quem ela é, então ela entra já
                          como "Maira, da Arte" — sem precisar achar dropdown
                          nenhum depois. Só quem administra vê o botão. */}
                      {!bulkMode && podeConvidar && !vinculados.has(p.id) && (
                        <button
                          onClick={e => { e.stopPropagation(); convidarPessoa(p); }}
                          disabled={convidando === p.id}
                          title={`Gerar link de convite para ${p.nome}`}
                          className="text-xs"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            padding: '4px 8px', borderRadius: '4px', cursor: 'pointer',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
                            color: convidado === p.id ? 'var(--color-success, #4ade80)' : 'var(--accent)',
                          }}
                        >
                          <Link2 size={12} />
                          {convidado === p.id ? 'link copiado' : convidando === p.id ? '…' : 'convidar'}
                        </button>
                      )}
                      {!bulkMode && vinculados.has(p.id) && (
                        <span className="text-xs text-muted" title="Esta pessoa já tem conta nesta produção">
                          tem conta
                        </span>
                      )}
                      {!bulkMode && <div className="text-xs font-bold text-accent">Abrir Ficha &rarr;</div>}
                    </div>
                  </ProfileCard>
                </div>
              </div>
              </Fragment>
            ))}
          </div>

          {/* Quem saiu, mas está no histórico. Fica fechado: é consulta rara. */}
          {arquivados.length > 0 && (
            <div style={{ marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setVerArquivados(v => !v)}
                className="text-xs text-secondary font-bold uppercase tracking-widest"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                aria-expanded={verArquivados}
              >
                {verArquivados ? '▾' : '▸'} Arquivados ({arquivados.length})
              </button>
              {verArquivados && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  {arquivados.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                      <span className="text-sm text-secondary">
                        {`${p.nome} ${p.sobrenome || ''}`.trim()}
                        {p.funcao && <span className="text-muted"> · {p.funcao}</span>}
                      </span>
                      {podeEscrever('perfis', p) && (
                        <button
                          type="button"
                          className="btn-chip"
                          onClick={() => db.perfis.update(p.id, { arquivado_em: undefined })}
                        >
                          Restaurar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {bulkMode && selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, backgroundColor: 'var(--color-danger)', color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-full)', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <span className="font-bold">{selectedIds.size} selecionados</span>
          <button onClick={handleBulkDelete} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 'bold', textDecoration: 'underline' }}>Apagar Todos</button>
        </div>
      )}

      {showForm && (
        // Clique fora NÃO fecha: é um formulário longo, e um toque no fundo não
        // pode custar a ficha. O Esc e o X passam pela pergunta de descartar.
        <Janela
          titulo={editId ? 'Editar membro' : 'Novo membro'}
          icone={<UserPlus size={18} />}
          aoFechar={fecharForm}
          largura="600px"
          fecharClicandoFora={false}
        >
              <Stepper
                initialStep={1}
                onFinalStepCompleted={adicionarPessoa}
                stepCircleContainerClassName="sem-moldura"
                backButtonText="Voltar"
                nextButtonText="Avançar"
              >
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Pessoais e Contato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder="Nome *" value={nome} onChange={e => setNome(e.target.value)} required style={{ flex: 1 }} />
                      <input placeholder={ph('sobrenome', 'Sobrenome')} value={sobrenome} onChange={e => setSobrenome(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder={ph('nome_social', 'Nome Social / Apelido de Set')} value={nomeSocial} onChange={e => setNomeSocial(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder={ph('cpf', 'CPF')} value={cpf} onChange={e => setCpf(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder={ph('rg', 'RG')} value={rg} onChange={e => setRg(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder={ph('telefone', 'Telefone')} value={telefone} onChange={e => setTelefone(e.target.value)} style={{ flex: 1 }} />
                      <CampoData value={nascimento} onChange={setNascimento} style={{ flex: 1 }} />
                    </div>
                    <input placeholder={ph('email', 'E-mail')} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input placeholder={ph('endereco', 'Endereço Completo')} value={endereco} onChange={e => setEndereco(e.target.value)} />
                    <input placeholder={ph('instagram', 'Instagram')} value={instagram} onChange={e => setInstagram(e.target.value)} />
                  </div>
                </Step>
                
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Profissional / Set</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/*
                      O campo de função sugere do catálogo do audiovisual, ensina
                      o departamento e avisa quando alguém já ocupa a mesma função.
                      Ele era um input em branco, e o texto livre fazia a mesma
                      função virar tres nomes diferentes na ficha tecnica.
                    */}
                    <CampoFuncao
                      value={funcao}
                      aoMudar={setFuncao}
                      departamentoId={departamentoId}
                      aoEscolherDepartamento={setDepartamentoId}
                      departamentos={departamentos || []}
                      perfis={perfis || []}
                      meuId={editId || undefined}
                      placeholder={ph('funcao', 'Função (ex: Diretor, Operador de Câmera)')}
                    />
                    <select 
                      value={departamentoId} 
                      onChange={e => setDepartamentoId(e.target.value)}
                      style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      <option value="">Nenhum Departamento</option>
                      {departamentos?.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    <input placeholder={ph('drt', 'DRT')} value={drt} onChange={e => setDrt(e.target.value)} />
                    <input placeholder={ph('experiencia', 'Experiência')} value={experiencia} onChange={e => setExperiencia(e.target.value)} />
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Saúde & Emergência</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input placeholder={ph('contato_emergencia', 'Contato de Emergência (Nome e Tel)')} value={contatoEmergencia} onChange={e => setContatoEmergencia(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder={ph('tipo_sanguineo', 'Tipo Sanguíneo')} value={tipoSanguineo} onChange={e => setTipoSanguineo(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder={ph('plano_saude', 'Plano de Saúde')} value={planoSaude} onChange={e => setPlanoSaude(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder={ph('alergias', 'Alergias')} value={alergias} onChange={e => setAlergias(e.target.value)} />
                    {/* Faltava: a produção podia exigir e o assistente não tinha onde preencher. */}
                    <input placeholder={ph('medicamentos_continuos', 'Medicamentos contínuos')} value={medicamentos} onChange={e => setMedicamentos(e.target.value)} />
                    <input placeholder={ph('restricao_alimentar', 'Restrição Alimentar (ex: Vegano)')} value={restricaoAlimentar} onChange={e => setRestricaoAlimentar(e.target.value)} />
                    <input placeholder={ph('info_medica', 'Outras infos médicas / remédios')} value={infoMedica} onChange={e => setInfoMedica(e.target.value)} />
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Financeiro / Contrato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input type="number" placeholder={ph('valor_diaria', 'Valor Diária (R$)')} value={valorDiaria} onChange={e => setValorDiaria(e.target.value)} style={{ flex: 1 }} />
                      <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)} style={{ padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', flex: 1 }}>
                        <option value="">Tipo Vínculo...</option>
                        <option value="Diarista">Diarista</option>
                        <option value="Fixo">Fixo / Semanal</option>
                        <option value="Cachê">Cachê Fechado</option>
                      </select>
                    </div>
                    <input placeholder={ph('chave_pix', 'Chave PIX')} value={chavePix} onChange={e => setChavePix(e.target.value)} />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder={ph('banco', 'Banco')} value={banco} onChange={e => setBanco(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder={ph('agencia', 'Agência')} value={agencia} onChange={e => setAgencia(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder={ph('conta', 'Conta')} value={conta} onChange={e => setConta(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input placeholder={ph('cnpj', 'CNPJ')} value={cnpj} onChange={e => setCnpj(e.target.value)} style={{ flex: 1 }} />
                      <input placeholder={ph('razao_social', 'Razão Social')} value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} style={{ flex: 1 }} />
                    </div>

                    {camposCustom.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="text-xs text-secondary font-bold uppercase tracking-widest">Campos Personalizados</div>
                        {camposCustom.map(c => {
                          if (c.tipo === 'selecao') {
                            return (
                              <div key={c.id}>
                                <div className="text-xs text-secondary mb-1">{c.nome}</div>
                                <select 
                                  value={customValues[c.id] || ''} 
                                  onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                                  style={{ width: '100%', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                                >
                                  <option value="">Selecione...</option>
                                  {(c.opcoes || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                              </div>
                            );
                          }
                          return (
                            <input
                              key={c.id}
                              placeholder={c.obrigatorio ? `${c.nome} *` : c.nome}
                              type={c.tipo === 'numero' || c.tipo === 'valor' ? 'number' : c.tipo === 'data' ? 'date' : 'text'}
                              value={customValues[c.id] || ''}
                              onChange={e => setCustomValues({ ...customValues, [c.id]: e.target.value })}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Step>
              </Stepper>
        </Janela>
      )}

      {/* MODAL: MAPEAMENTO DA IMPORTAÇÃO CSV */}
      {csvCabecalhos && (
        // Clique fora não fecha: o mapeamento ajustado à mão se perderia num
        // toque no fundo. Esc e X cancelam — nada foi criado ainda.
        <Janela
          titulo="Importar equipe"
          icone={<Upload size={18} />}
          aoFechar={cancelarImportacao}
          largura="640px"
          fecharClicandoFora={false}
          rodape={
            <>
              <button onClick={cancelarImportacao} className="btn-secondary" style={{ backgroundColor: 'var(--bg-surface)' }}>
                Cancelar
              </button>
              <button onClick={confirmarImportacao} className="btn-primary" disabled={linhasComNome === 0}>
                {linhasComNome === 0
                  ? 'Importar'
                  : `Importar ${linhasComNome} ${linhasComNome === 1 ? 'membro' : 'membros'}`}
              </button>
            </>
          }
        >
          <p className="text-xs text-secondary" style={{ margin: '0 0 16px', lineHeight: 1.5 }}>
            {csvLinhas.length} {csvLinhas.length === 1 ? 'linha encontrada' : 'linhas encontradas'}. Confira para qual campo vai cada coluna do arquivo.
            {colunaDoNome === undefined
              ? <> <strong className="text-danger">Escolha a coluna do Nome</strong> — sem ela ninguém entra.</>
              : linhasComNome < csvLinhas.length && <> {csvLinhas.length - linhasComNome} sem nome {csvLinhas.length - linhasComNome === 1 ? 'fica' : 'ficam'} de fora.</>}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {montarSchemaFicha(projeto).map(campo => (
              <div key={campo.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-bold">
                    {campo.nome} {campo.id === 'nome' && <span className="text-danger">*</span>}
                  </div>
                </div>
                <select
                  value={csvMapa[campo.id] ?? ''}
                  onChange={e => {
                    const novo = { ...csvMapa };
                    if (e.target.value === '') delete novo[campo.id];
                    else novo[campo.id] = Number(e.target.value);
                    setCsvMapa(novo);
                  }}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', fontSize: '13px' }}
                >
                  <option value="">— não importar —</option>
                  {csvCabecalhos.map((h, i) => (
                    <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Janela>
      )}

      {/* MODAL: RELATÓRIO TRANSVERSAL */}
      {showRelatorio && projeto && perfis && (
        <RelatorioTransversal
          perfis={perfis}
          projeto={projeto}
          papel={role}
          meuPerfilId={meuPerfilId}
          onClose={() => setShowRelatorio(false)}
        />
      )}

    </div>
  );
}
