import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ocuparSlotInferior } from './slotFlutuante';

interface FloatingActionMenuProps {
  onCriarProjeto: () => void;
}

export function FloatingActionMenu({ onCriarProjeto }: FloatingActionMenuProps) {
  // Avisa que o canto de baixo está ocupado, para o menu de ajuda subir e não
  // desenhar por cima. Quem sai da tela devolve o lugar.
  useEffect(() => ocuparSlotInferior(), []);

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
