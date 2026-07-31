import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useParams } from 'react-router-dom';
import { pdfjs, Document, Page } from 'react-pdf';
import { FileUp, FileText, Trash2, Tag, CheckSquare, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import type { RoteiroPDF, RoteiroTag } from '../types';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const TAG_CATEGORIES = [
  { id: 'elenco', label: 'Elenco', color: '#ff6b6b' },
  { id: 'figuracao', label: 'Figuração', color: '#feca57' },
  { id: 'arte', label: 'Arte/Objetos', color: '#48dbfb' },
  { id: 'figurino', label: 'Figurino', color: '#ff9ff3' },
  { id: 'maquiagem', label: 'Maquiagem (SFX)', color: '#1dd1a1' },
  { id: 'efeitos', label: 'Efeitos/VFX', color: '#5f27cd' },
  { id: 'camera', label: 'Câmera/Equip.', color: '#c8d6e5' },
  { id: 'outro', label: 'Outro', color: '#a4b0be' },
];

export function BreakdownModule() {
  const { id: projetoId } = useParams<{ id: string }>();
  const [numPages, setNumPages] = useState<number>();
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  
  const roteiro = useLiveQuery(() => db.roteiro_pdfs.where('projeto_id').equals(projetoId!).first(), [projetoId]);
  const tags = useLiveQuery(() => db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray(), [projetoId]) || [];

  const [textoSelecionado, setTextoSelecionado] = useState('');
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (roteiro) {
      setPdfFile(roteiro.dados);
    } else {
      setPdfFile(null);
    }
  }, [roteiro]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const b64 = event.target?.result as string;
      if (roteiro) {
        await db.roteiro_pdfs.update(roteiro.id, {
          nome: file.name,
          dados: b64,
          data_upload: Date.now()
        });
      } else {
        await db.roteiro_pdfs.add({
          id: crypto.randomUUID(),
          projeto_id: projetoId!,
          nome: file.name,
          dados: b64,
          data_upload: Date.now()
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApagarRoteiro = async () => {
    if (window.confirm("Apagar roteiro e TODAS as tags?")) {
      if (roteiro) {
        await db.roteiro_pdfs.delete(roteiro.id);
        const tagsProj = await db.roteiro_tags.where('projeto_id').equals(projetoId!).toArray();
        for (const t of tagsProj) {
          await db.roteiro_tags.delete(t.id);
        }
      }
      setPdfFile(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text) {
      setTextoSelecionado(text);
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowTagMenu(true);
    } else {
      setShowTagMenu(false);
    }
  };

  const addTag = async (categoriaId: string, cor: string) => {
    if (!textoSelecionado) return;
    
    const novaTag: RoteiroTag = {
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      roteiro_id: roteiro!.id,
      texto_selecionado: textoSelecionado,
      categoria: categoriaId,
      cor: cor,
      pagina: pageNumber,
      cena_id: undefined // Pode ser vinculado depois
    };

    await db.roteiro_tags.add(novaTag);
    setShowTagMenu(false);
    window.getSelection()?.removeAllRanges();
  };

  const removeTag = async (id: string) => {
    await db.roteiro_tags.delete(id);
  };

  const converterParaTask = async (tag: RoteiroTag) => {
    await db.tasks.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId!,
      titulo: `Providenciar: ${tag.texto_selecionado}`,
      descricao: `Categoria: ${tag.categoria}. (Extraído do roteiro pág ${tag.pagina})`,
      status: 'todo',
      data_criacao: Date.now(),
      responsavel_id: undefined
    });
    alert(`Tarefa "${tag.texto_selecionado}" criada com sucesso!`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px', height: '100%' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={20} /> Breakdown de Roteiro
        </h2>
        
        {!pdfFile ? (
          <label className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <FileUp size={16} /> Subir PDF do Roteiro
            <input type="file" accept="application/pdf" onChange={handleUpload} style={{ display: 'none' }} />
          </label>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="text-xs text-muted font-bold truncate" style={{ maxWidth: '200px' }}>{roteiro?.nome}</span>
            <button onClick={handleApagarRoteiro} className="btn-icon hover-danger" style={{ padding: '8px' }} title="Excluir Roteiro"><Trash2 size={16} /></button>
          </div>
        )}
      </div>

      {!pdfFile ? (
        <div className="card text-center text-muted" style={{ padding: '60px 20px' }}>
          <FileUp size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p className="font-bold mb-2">Nenhum roteiro carregado.</p>
          <p className="text-sm">Faça o upload do arquivo PDF para iniciar a marcação e breakdown automático.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: '600px' }}>
          
          {/* Painel Esquerdo: PDF */}
          <div className="card" style={{ flex: 2, padding: '16px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button disabled={pageNumber <= 1} onClick={() => setPageNumber(p => p - 1)} className="btn-icon"><ChevronLeft size={20} /></button>
                <span className="text-sm font-bold">Pág {pageNumber} de {numPages || '?'}</span>
                <button disabled={pageNumber >= (numPages || 1)} onClick={() => setPageNumber(p => p + 1)} className="btn-icon"><ChevronRight size={20} /></button>
              </div>
              <div className="text-xs text-muted">Selecione um texto para tagear</div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', backgroundColor: '#e5e5e5', borderRadius: '8px', display: 'flex', justifyContent: 'center', padding: '24px 0' }} onMouseUp={handleMouseUp}>
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div className="text-muted" style={{ padding: '40px' }}>Processando PDF...</div>}
                error={<div className="text-danger" style={{ padding: '40px' }}>Erro ao ler PDF. Tente outro arquivo.</div>}
              >
                <Page pageNumber={pageNumber} scale={1.2} renderTextLayer={true} renderAnnotationLayer={true} className="shadow-lg" />
              </Document>
            </div>

            {/* Menu Contextual de Tag */}
            {showTagMenu && (
              <div style={{
                position: 'fixed', left: menuPos.x + 10, top: menuPos.y + 10,
                backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 100, border: '1px solid var(--border-color)',
                width: '280px'
              }}>
                <div className="text-xs text-muted mb-2 font-bold uppercase">Tagear: "{textoSelecionado.substring(0, 30)}{textoSelecionado.length > 30 ? '...' : ''}"</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {TAG_CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => addTag(cat.id, cat.color)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', borderRadius: '6px', border: `1px solid ${cat.color}`, backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cat.color }}></div>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Painel Direito: Tags Cadastradas */}
          <div className="card" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={16} /> Itens Extraídos
            </h3>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {tags.length === 0 ? (
                <div className="text-xs text-muted text-center" style={{ marginTop: '40px' }}>Nenhuma tag registrada.</div>
              ) : (
                tags.sort((a,b) => a.pagina - b.pagina).map(tag => {
                  const cat = TAG_CATEGORIES.find(c => c.id === tag.categoria);
                  return (
                    <div key={tag.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', backgroundColor: 'var(--bg-primary)', borderLeft: `4px solid ${tag.cor || 'var(--accent)'}`, borderRadius: '8px', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span className="font-bold text-sm">{tag.texto_selecionado}</span>
                        <button onClick={() => removeTag(tag.id)} className="btn-icon text-muted" style={{ padding: '4px', fontSize: '10px', border: 'none', background: 'transparent' }}><Trash2 size={12} /></button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="text-xs text-secondary">{cat?.label} <span className="text-muted">· pág {tag.pagina}</span></span>
                        <button onClick={() => converterParaTask(tag)} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 8px', gap: '4px', border: '1px solid var(--border-light)' }} title="Gerar Tarefa">
                          <Plus size={12} /> <CheckSquare size={12} className="text-accent" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
