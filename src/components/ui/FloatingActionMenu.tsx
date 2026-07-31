import { Plus } from 'lucide-react';

interface FloatingActionMenuProps {
  onCriarProjeto: () => void;
}

export function FloatingActionMenu({ onCriarProjeto }: FloatingActionMenuProps) {
  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
      <button 
        className="fab-button"
        onClick={onCriarProjeto}
        title="Criar Projeto"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
