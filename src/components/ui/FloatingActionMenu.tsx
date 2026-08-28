import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ocuparSlotInferior } from './slotFlutuante';
import { BotaoTatil } from './BotaoTatil';

interface FloatingActionMenuProps {
  onCriarProjeto: () => void;
}

export function FloatingActionMenu({ onCriarProjeto }: FloatingActionMenuProps) {
  // Avisa que o canto de baixo está ocupado, para o menu de ajuda subir e não
  // desenhar por cima. Quem sai da tela devolve o lugar.
  useEffect(() => ocuparSlotInferior(), []);

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
      {/* O botão mais tocado do app: é ele que ganha a resposta no dedo
          primeiro. `escala` menor que o padrão porque um círculo grande
          afundando 6% já parece demais. */}
      <BotaoTatil
        className="fab-button"
        onClick={onCriarProjeto}
        title="Criar Projeto"
        escala={0.96}
      >
        <Plus size={24} />
      </BotaoTatil>
    </div>
  );
}
