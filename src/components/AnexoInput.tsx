import { useRef, useState } from 'react';
import { Paperclip, Link as LinkIcon, File } from 'lucide-react';
import { inspecionarLink, lerArquivoComoDataURL, LIMITE_UPLOAD_BYTES } from '../lib/documentos';

interface AnexoInputProps {
  /** Recebe a URL do anexo — link colado ou data URL do arquivo lido localmente. */
  onAddLink: (url: string) => void;
  /** Versão detalhada: recebe também nome e tamanho (quando disponíveis). */
  onAddAnexo?: (info: { url: string; nome: string; tamanho?: number; tipo: 'link' | 'upload' }) => void;
  /** Restringe o seletor de arquivos (ex: "image/*"). */
  accept?: string;
  label?: string;
}

export function AnexoInput({ onAddLink, onAddAnexo, accept, label = 'Anexar' }: AnexoInputProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const emitir = (info: { url: string; nome: string; tamanho?: number; tipo: 'link' | 'upload' }) => {
    onAddLink(info.url);
    onAddAnexo?.(info);
    setOpen(false);
  };

  const handleLink = () => {
    const url = prompt('Cole o link (Google Drive, Dropbox, etc):');
    if (!url?.trim()) {
      setOpen(false);
      return;
    }
    const info = inspecionarLink(url.trim());
    emitir({ url: url.trim(), nome: info.nome, tipo: 'link' });
  };

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > LIMITE_UPLOAD_BYTES) {
      alert(`Arquivo muito grande (máx ${LIMITE_UPLOAD_BYTES / 1024 / 1024}MB para funcionar offline). Use um link do Drive.`);
      setOpen(false);
      return;
    }

    try {
      const dataUrl = await lerArquivoComoDataURL(file);
      emitir({ url: dataUrl, nome: file.name, tamanho: file.size, tipo: 'upload' });
    } catch {
      alert('Não foi possível ler o arquivo.');
      setOpen(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* .btn-chip, não .btn-icon: o .btn-icon é 40x40 fixo, então o rótulo
          vazava para fora da área clicável — o botão parecia quebrado. */}
      <button type="button" onClick={() => setOpen(!open)} className="btn-chip">
        <Paperclip size={16} /> {label}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleArquivo}
        style={{ display: 'none' }}
      />

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '8px',
          backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
          borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column',
          gap: '4px', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: '170px'
        }}>
          <button
            type="button"
            onClick={handleLink}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
              border: 'none', background: 'none', textAlign: 'left', width: '100%',
              cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LinkIcon size={14} className="text-accent" /> Link (Drive)
          </button>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
              border: 'none', background: 'none', textAlign: 'left', width: '100%',
              cursor: 'pointer', borderRadius: '4px', color: 'var(--text-primary)'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'var(--bg-surface)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <File size={14} className="text-info" /> Arquivo Local
          </button>
        </div>
      )}
    </div>
  );
}
