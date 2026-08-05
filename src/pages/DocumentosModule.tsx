import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Folder, File, Link as LinkIcon, Plus, ChevronRight, Edit2, Trash2, X, Upload } from 'lucide-react';
import type { Pasta, Documento } from '../types';
import { inspecionarLink, lerArquivoComoDataURL, LIMITE_UPLOAD_BYTES, formatarTamanho, descreverOrigem, apagarOrigemDoDocumento } from '../lib/documentos';

const ROTULO_ORIGEM: Record<string, string> = {
  roteiro: 'Roteiro',
  comprovante: 'Financeiro',
  diaria: 'Diária',
  storyboard: 'Storyboard',
};

export function DocumentosModule() {
  const { id } = useParams<{ id: string }>();
  const [pastaSelecionada, setPastaSelecionada] = useState<Pasta | null>(null);

  // Modal States
  const [modalMode, setModalMode] = useState<'none' | 'new_folder' | 'edit_folder' | 'new_link' | 'rename_doc'>('none');
  const [modalInput, setModalInput] = useState('');
  const [modalNome, setModalNome] = useState('');
  const [modalPreview, setModalPreview] = useState<string | undefined>();
  const [modalColor, setModalColor] = useState('#4cc9f0');
  const [targetPasta, setTargetPasta] = useState<Pasta | null>(null);
  const [targetDoc, setTargetDoc] = useState<Documento | null>(null);
  const [enviando, setEnviando] = useState(false);

  const pastas = useLiveQuery(() => db.pastas.where('projeto_id').equals(id!).toArray(), [id]);
  const documentos = useLiveQuery(() =>
    pastaSelecionada
      ? db.documentos.where({ projeto_id: id!, pasta_id: pastaSelecionada.id }).toArray()
      : Promise.resolve([] as Documento[])
  , [id, pastaSelecionada]);

  // Quantos documentos cada pasta tem (para mostrar no card)
  const todosDocs = useLiveQuery(() => db.documentos.where('projeto_id').equals(id!).toArray(), [id]) || [];

  const openNewFolder = () => {
    setModalInput('');
    setModalColor('#4cc9f0');
    setModalMode('new_folder');
  };

  const openEditFolder = (p: Pasta, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetPasta(p);
    setModalInput(p.nome);
    setModalColor(p.cor || '#4cc9f0');
    setModalMode('edit_folder');
  };

  const openNewLink = () => {
    setModalInput('');
    setModalNome('');
    setModalPreview(undefined);
    setModalMode('new_link');
  };

  /**
   * Ao colar/digitar o link, tenta preencher nome e miniatura automaticamente.
   * O nome continua editável — se o usuário já mexeu nele, não sobrescreve.
   */
  const handleLinkChange = (valor: string) => {
    setModalInput(valor);
    if (!valor.trim()) {
      setModalPreview(undefined);
      return;
    }
    const info = inspecionarLink(valor);
    setModalPreview(info.previewUrl);
    setModalNome(atual => (atual.trim() === '' ? info.nome : atual));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pastaSelecionada) return;

    if (file.size > LIMITE_UPLOAD_BYTES) {
      alert(`Arquivo muito grande (máx ${LIMITE_UPLOAD_BYTES / 1024 / 1024}MB para funcionar offline). Prefira colar um link do Drive.`);
      return;
    }

    setEnviando(true);
    try {
      const dataUrl = await lerArquivoComoDataURL(file);
      await db.documentos.add({
        id: crypto.randomUUID(),
        projeto_id: id!,
        pasta_id: pastaSelecionada.id,
        nome: file.name,
        tipo: 'upload',
        url: dataUrl,
        preview_url: file.type.startsWith('image/') ? dataUrl : undefined,
        tamanho: file.size,
        data_criacao: Date.now(),
        origem: 'manual',
      });
    } catch {
      alert('Não foi possível ler o arquivo.');
    } finally {
      setEnviando(false);
    }
  };

  const handleModalSubmit = async () => {
    if (modalMode === 'new_link') {
      if (!modalInput.trim()) return;
      await db.documentos.add({
        id: crypto.randomUUID(),
        projeto_id: id!,
        pasta_id: pastaSelecionada!.id,
        nome: modalNome.trim() || inspecionarLink(modalInput).nome,
        tipo: 'link',
        url: modalInput.trim(),
        preview_url: modalPreview,
        data_criacao: Date.now(),
        origem: 'manual',
      });
      setModalMode('none');
      return;
    }

    if (!modalInput.trim()) return;

    if (modalMode === 'new_folder') {
      await db.pastas.add({
        id: crypto.randomUUID(),
        projeto_id: id!,
        nome: modalInput.trim(),
        cor: modalColor,
        data_criacao: Date.now()
      });
    } else if (modalMode === 'edit_folder' && targetPasta) {
      await db.pastas.update(targetPasta.id, { nome: modalInput.trim(), cor: modalColor });
    } else if (modalMode === 'rename_doc' && targetDoc) {
      await db.documentos.update(targetDoc.id, { nome: modalInput.trim() });
    }

    setModalMode('none');
  };

  /**
   * Documento vindo de outro módulo não é cópia, é espelho. Apagar só o espelho
   * fazia o arquivo continuar no lugar de origem (e reaparecer aqui), passando a
   * impressão de que a exclusão não funcionou. Agora apaga os dois — avisando.
   */
  const deleteDoc = async (doc: Documento) => {
    const origem = descreverOrigem(doc);

    const aviso = origem
      ? `Excluir "${doc.nome}"?\n\nIsto também remove ${origem}.`
      : `Excluir "${doc.nome}"?`;

    if (!confirm(aviso)) return;

    if (origem) await apagarOrigemDoDocumento(doc);
    await db.documentos.delete(doc.id);
  };

  const renderModal = () => {
    if (modalMode === 'none') return null;

    let title = '';
    let placeholder = '';
    if (modalMode === 'new_folder') { title = 'Nova Pasta'; placeholder = 'Nome da pasta'; }
    if (modalMode === 'edit_folder') { title = 'Editar Pasta'; placeholder = 'Nome da pasta'; }
    if (modalMode === 'new_link') { title = 'Anexar Link'; placeholder = 'Cole o link do Google Drive/Dropbox'; }
    if (modalMode === 'rename_doc') { title = 'Renomear Documento'; placeholder = 'Novo nome'; }

    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="font-bold">{title}</h3>
            <button onClick={() => setModalMode('none')} className="btn-icon"><X size={16} /></button>
          </div>

          <input
            autoFocus
            type="text"
            placeholder={placeholder}
            value={modalInput}
            onChange={e => modalMode === 'new_link' ? handleLinkChange(e.target.value) : setModalInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && modalMode !== 'new_link' && handleModalSubmit()}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
          />

          {modalMode === 'new_link' && (
            <>
              <div>
                <label className="text-xs text-secondary font-bold uppercase mb-2 block">Nome (preenchido automaticamente, sempre editável)</label>
                <input
                  type="text"
                  placeholder="Nome do documento"
                  value={modalNome}
                  onChange={e => setModalNome(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleModalSubmit()}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
                />
              </div>
              {modalPreview && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', backgroundColor: 'var(--bg-surface)', borderRadius: '8px' }}>
                  <img
                    src={modalPreview}
                    alt="Pré-visualização"
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px' }}
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="text-xs text-muted">Miniatura do Drive (aparece só se o arquivo estiver compartilhado).</span>
                </div>
              )}
            </>
          )}

          {(modalMode === 'new_folder' || modalMode === 'edit_folder') && (
            <div>
              <label className="text-xs text-secondary font-bold uppercase mb-2 block">Cor</label>
              <input type="color" value={modalColor} onChange={e => setModalColor(e.target.value)} style={{ width: '100%', height: '40px', padding: 0, border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: 'transparent' }} />
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={() => setModalMode('none')} className="btn-secondary" style={{ flex: 1, backgroundColor: 'var(--bg-surface)' }}>Cancelar</button>
            <button onClick={handleModalSubmit} className="btn-primary" style={{ flex: 1 }}>Salvar</button>
            {modalMode === 'edit_folder' && targetPasta && (
              <button
                onClick={() => {
                  if (confirm(`Tem certeza que deseja excluir a pasta "${targetPasta.nome}" e todo o seu conteúdo?`)) {
                    db.documentos.where('pasta_id').equals(targetPasta.id).delete().then(() => {
                      db.pastas.delete(targetPasta.id).then(() => setModalMode('none'));
                    });
                  }
                }}
                className="btn-primary"
                style={{ backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}
                title="Excluir Pasta"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!pastaSelecionada) {
    return (
      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="text-xl font-bold">Documentos</h2>
            <p className="text-xs text-muted mt-1">Roteiros, comprovantes e anexos das diárias aparecem aqui automaticamente.</p>
          </div>
          <button onClick={openNewFolder} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Nova Pasta
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
          {pastas?.map(pasta => {
            const qtd = todosDocs.filter(d => d.pasta_id === pasta.id).length;
            return (
              <div
                key={pasta.id}
                className="card-hover"
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  position: 'relative'
                }}
                onClick={() => setPastaSelecionada(pasta)}
              >
                <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                  <button onClick={(e) => openEditFolder(pasta, e)} className="btn-icon" style={{ padding: '4px' }}><Edit2 size={14} /></button>
                </div>
                <Folder size={48} style={{ color: pasta.cor || '#4cc9f0' }} fill={pasta.cor || '#4cc9f0'} fillOpacity={0.2} />
                <span className="font-bold">{pasta.nome}</span>
                <span className="text-xs text-muted">{qtd} {qtd === 1 ? 'item' : 'itens'}</span>
              </div>
            );
          })}
          {pastas?.length === 0 && (
            <div className="text-muted" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0' }}>
              Nenhuma pasta criada.
            </div>
          )}
        </div>
        {renderModal()}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={() => setPastaSelecionada(null)} className="btn-icon">
          <Folder size={20} />
        </button>
        <ChevronRight size={16} className="text-muted" />
        <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: pastaSelecionada.cor || '#4cc9f0' }}>●</span>
          {pastaSelecionada.nome}
        </h2>
        <div style={{ flex: 1 }}></div>

        <label
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', cursor: 'pointer' }}
        >
          <Upload size={16} /> {enviando ? 'Lendo...' : 'Upload'}
          <input type="file" onChange={handleUpload} style={{ display: 'none' }} />
        </label>

        <button
          onClick={openNewLink}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        >
          <LinkIcon size={16} /> Link Drive
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {documentos?.map(doc => (
          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '8px', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
              {doc.preview_url ? (
                <img
                  src={doc.preview_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => { e.currentTarget.style.display = 'none'; }}
                />
              ) : doc.tipo === 'link' ? <LinkIcon size={22} className="text-accent" /> : <File size={22} className="text-info" />}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="font-bold truncate">{doc.nome}</span>
                <button
                  className="btn-icon"
                  style={{ padding: '4px' }}
                  onClick={() => {
                    setTargetDoc(doc);
                    setModalInput(doc.nome);
                    setModalMode('rename_doc');
                  }}
                >
                  <Edit2 size={12} />
                </button>
                {doc.origem && doc.origem !== 'manual' && (
                  <span className="text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                    via {ROTULO_ORIGEM[doc.origem] || doc.origem}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted">
                Adicionado em {new Date(doc.data_criacao).toLocaleDateString('pt-BR')}
                {doc.tamanho ? ` · ${formatarTamanho(doc.tamanho)}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={() => deleteDoc(doc)} className="btn-icon text-danger" style={{ padding: '8px' }}>
                <Trash2 size={16} />
              </button>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                download={doc.tipo === 'upload' ? doc.nome : undefined}
                className="btn-primary"
                style={{ fontSize: '12px', padding: '8px 16px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              >
                Abrir
              </a>
            </div>
          </div>
        ))}
        {documentos?.length === 0 && (
          <div className="text-muted" style={{ textAlign: 'center', padding: '40px 0' }}>
            Esta pasta está vazia.
          </div>
        )}
      </div>
      {renderModal()}
    </div>
  );
}
