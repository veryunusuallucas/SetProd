import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Bug, FolderPlus } from 'lucide-react';

interface FloatingActionMenuProps {
  onCriarProjeto: () => void;
  onRelatarBug: () => void;
}

export function FloatingActionMenu({ onCriarProjeto, onRelatarBug }: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end', marginBottom: '8px' }}
          >
            <button 
              onClick={() => { setIsOpen(false); onRelatarBug(); }}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '24px', padding: '8px 16px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
            >
              <Bug size={16} className="text-danger" /> Relatar Bug
            </button>

            <button 
              onClick={() => { setIsOpen(false); onCriarProjeto(); }}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--accent)', color: '#000', borderRadius: '24px', padding: '8px 16px', boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)' }}
            >
              <FolderPlus size={16} /> Criar Projeto
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        className="fab-button"
        onClick={() => setIsOpen(!isOpen)}
        style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
      >
        <Plus size={24} />
      </button>

    </div>
  );
}
