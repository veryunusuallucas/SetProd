import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FileUp, FileText, Loader2 } from 'lucide-react';
import { formatarTamanhoArquivo } from '../lib/decupagem';

interface ScriptDropzoneProps {
  onArquivo: (file: File) => void;
  lendo?: boolean;
  /** Meta do arquivo já lido, mostrada abaixo da zona. */
  meta?: { nome: string; paginas: number; tamanho: number } | null;
}

/** Zona de envio do roteiro: arrastar ou clicar. Aceita só PDF. */
export function ScriptDropzone({ onArquivo, lendo, meta }: ScriptDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  const [erro, setErro] = useState('');

  const receber = (file?: File | null) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErro('Só aceito PDF por aqui.');
      return;
    }
    setErro('');
    onArquivo(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <motion.div
        onDragOver={e => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={e => { e.preventDefault(); setSobre(false); receber(e.dataTransfer.files?.[0]); }}
        onClick={() => !lendo && inputRef.current?.click()}
        animate={{
          borderColor: sobre ? 'var(--accent)' : 'var(--border-color)',
          scale: sobre ? 1.01 : 1,
        }}
        transition={{ duration: 0.18 }}
        style={{
          border: '2px dashed var(--border-color)',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          cursor: lendo ? 'wait' : 'pointer',
          backgroundColor: sobre ? 'var(--bg-active)' : 'var(--bg-primary)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
        }}
      >
        <motion.div
          animate={lendo ? { rotate: 360 } : sobre ? { y: -6 } : { y: 0 }}
          transition={lendo
            ? { duration: 1, repeat: Infinity, ease: 'linear' }
            : { type: 'spring', stiffness: 300, damping: 15 }}
        >
          {lendo ? <Loader2 size={44} className="text-accent" /> : <FileUp size={44} className={sobre ? 'text-accent' : 'text-muted'} />}
        </motion.div>

        <div>
          <div className="font-bold" style={{ fontSize: '16px' }}>
            {lendo ? 'Lendo o roteiro...' : sobre ? 'Pode soltar' : 'Arraste o roteiro em PDF'}
          </div>
          <div className="text-sm text-muted" style={{ marginTop: '4px' }}>
            {lendo ? 'Extraindo o texto de cada página' : 'ou clique para escolher o arquivo'}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={e => { receber(e.target.files?.[0]); e.target.value = ''; }}
          style={{ display: 'none' }}
        />
      </motion.div>

      {erro && <div className="text-sm text-danger">{erro}</div>}

      {meta && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px' }}
        >
          <FileText size={22} className="text-accent" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-bold truncate">{meta.nome}</div>
            <div className="text-xs text-muted">
              {meta.paginas} página(s) · {formatarTamanhoArquivo(meta.tamanho)}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
