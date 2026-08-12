import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Smartphone, Wallet, FileText, Link2, RefreshCw, Upload, Settings2, SlidersHorizontal, Trash2, UserPlus } from 'lucide-react';
import { syncPerfisDeCadastro, publicarFichaPublica } from '../lib/sync';
import { useRole } from '../hooks/useRole';
import { linkDoApp } from '../lib/urlPublica';
import Stepper, { Step } from './ui/Stepper';
import { ProfileCard } from './ui/ProfileCard';
import { FormBuilder } from './FormBuilder';
import { FichaCompleta } from './FichaCompleta';
import { RelatorioTransversal } from './RelatorioTransversal';
import { useLayoutContext } from '../pages/ProjectLayout';
import { montarSchemaFicha, validarObrigatorios, valoresParaPerfil } from '../lib/camposFicha';

/** Tamanho único para todos os botões da barra de ações da Equipe. */
const botaoBarra: React.CSSProperties = {
  width: '38px',
  height: '38px',
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '10px',
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
          borderRadius: '12px', boxShadow: '0 12px 28px rgba(0,0,0,0.45)',
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
      <span style={{ color: 'var(--accent)', display: 'flex', marginTop: '2px' }}>{icone}</span>
      <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <span className="text-sm font-bold">{titulo}</span>
        <span className="text-xs text-muted">{descricao}</span>
      </span>
    </>
  );

  const estilo: React.CSSProperties = {
    display: 'flex', gap: '10px', alignItems: 'flex-start', width: '100%',
    padding: '10px 12px', borderRadius: '8px', border: 'none',
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
  
  const { canEditProducao } = useRole();
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

    const faltando = validarObrigatorios(valoresParaValidar, schema);
    if (faltando.length > 0) {
      alert(`Preencha os campos obrigatórios:\n\n• ${faltando.join('\n• ')}`);
      return;
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

  const handleDelete = async (id: string, nomeCompleto: string) => {
    if (confirm(`Tem certeza que deseja excluir ${nomeCompleto}?`)) {
      await db.perfis.delete(id);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Tem certeza que deseja excluir as ${selectedIds.size} pessoas selecionadas?`)) {
      for (const id of selectedIds) {
        await db.perfis.delete(id);
      }
      setSelectedIds(new Set());
      setBulkMode(false);
    }
  };

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
      await syncPerfisDeCadastro(projetoId);
      alert('Equipe atualizada com sucesso!');
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
            return hl.includes(alvo);
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
        <span className="text-xs text-secondary font-bold uppercase tracking-widest">Equipe {!canEditProducao && '(Somente Leitura)'}</span>

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

          {canEditProducao && (
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              title="Apagar vários"
              style={{ ...botaoBarra, backgroundColor: bulkMode ? 'var(--accent)' : 'var(--bg-surface)', color: bulkMode ? '#000' : 'var(--text-primary)' }}
            >
              <Trash2 size={16} />
            </button>
          )}

          {canEditProducao && (
            <button
              onClick={handleSync}
              disabled={isSyncing}
              title="Atualizar (puxar cadastros enviados pelo link)"
              style={botaoBarra}
            >
              <RefreshCw size={16} className={isSyncing ? 'spinning' : ''} />
            </button>
          )}

          {canEditProducao && (
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

          {canEditProducao && (
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
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
            {perfis?.filter(p => p.id !== 'caixa_central').length === 0 && (
              <div className="text-muted text-sm text-center" style={{ width: '100%', padding: '24px' }}>Nenhum membro cadastrado.</div>
            )}

            {perfis?.filter(p => p.id !== 'caixa_central').map(p => (
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
                        canEdit={canEditProducao}
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
                    title={p.funcao || 'Membro'}
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
                      {!bulkMode && <div className="text-xs font-bold text-accent">Abrir Ficha &rarr;</div>}
                    </div>
                  </ProfileCard>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {bulkMode && selectedIds.size > 0 && (
        <div style={{ position: 'fixed', bottom: '90px', left: '50%', transform: 'translateX(-50%)', zIndex: 50, backgroundColor: 'var(--color-danger)', color: '#fff', padding: '12px 24px', borderRadius: '24px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          <span className="font-bold">{selectedIds.size} selecionados</span>
          <button onClick={handleBulkDelete} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: 'bold', textDecoration: 'underline' }}>Apagar Todos</button>
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '600px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="text-lg font-bold">{editId ? 'Editar Membro' : 'Novo Membro'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '24px', cursor: 'pointer' }}>&times;</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Stepper
                initialStep={1}
                onFinalStepCompleted={adicionarPessoa}
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
                      <input placeholder={ph('data_nascimento', 'Data de Nascimento')} type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} style={{ flex: 1 }} />
                    </div>
                    <input placeholder={ph('email', 'E-mail')} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input placeholder={ph('endereco', 'Endereço Completo')} value={endereco} onChange={e => setEndereco(e.target.value)} />
                    <input placeholder={ph('instagram', 'Instagram')} value={instagram} onChange={e => setInstagram(e.target.value)} />
                  </div>
                </Step>
                
                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Profissional / Set</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <input placeholder={ph('funcao', 'Função (ex: Diretor, Atriz)')} value={funcao} onChange={e => setFuncao(e.target.value)} />
                    <select 
                      value={departamentoId} 
                      onChange={e => setDepartamentoId(e.target.value)}
                      style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      <option value="">Nenhum Departamento</option>
                      {departamentos?.map(d => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                    </select>
                    <input placeholder={ph('drt', 'DRT')} value={drt} onChange={e => setDrt(e.target.value)} />
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
                    <input placeholder={ph('restricao_alimentar', 'Restrição Alimentar (ex: Vegano)')} value={restricaoAlimentar} onChange={e => setRestricaoAlimentar(e.target.value)} />
                    <input placeholder={ph('info_medica', 'Outras infos médicas / remédios')} value={infoMedica} onChange={e => setInfoMedica(e.target.value)} />
                  </div>
                </Step>

                <Step>
                  <h2 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 'bold' }}>Financeiro / Contrato</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <input type="number" placeholder={ph('valor_diaria', 'Valor Diária (R$)')} value={valorDiaria} onChange={e => setValorDiaria(e.target.value)} style={{ flex: 1 }} />
                      <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value)} style={{ padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', flex: 1 }}>
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
                                  style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}
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
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MAPEAMENTO DA IMPORTAÇÃO CSV */}
      {csvCabecalhos && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '640px', backgroundColor: 'var(--bg-primary)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-light)' }}>
              <h2 className="text-lg font-bold">Importar equipe</h2>
              <p className="text-xs text-secondary mt-1">
                {csvLinhas.length} linha(s) encontradas. Confira para qual campo vai cada coluna do arquivo.
              </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', fontSize: '13px' }}
                  >
                    <option value="">— não importar —</option>
                    {csvCabecalhos.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ padding: '24px', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setCsvCabecalhos(null); setCsvLinhas([]); setCsvMapa({}); }}
                className="btn-secondary"
                style={{ backgroundColor: 'var(--bg-surface)' }}
              >
                Cancelar
              </button>
              <button onClick={confirmarImportacao} className="btn-primary">
                Importar {csvLinhas.length} membro(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RELATÓRIO TRANSVERSAL */}
      {showRelatorio && projeto && perfis && (
        <RelatorioTransversal
          perfis={perfis}
          projeto={projeto}
          onClose={() => setShowRelatorio(false)}
        />
      )}

    </div>
  );
}
