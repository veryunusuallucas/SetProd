import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ocuparSlotInferior } from './slotFlutuante';
import { BotaoTatil } from './BotaoTatil';

interface FloatingActionMenuProps {
  onCriarProjeto: () => void;
}

export function FloatingActionMenu({ onCriarProjeto }: FloatingActionMenuProps) {
  /*
    Anuncia quanto do rodapé ele toma: 24px de folga embaixo mais os 56px do
    círculo. O menu de ajuda soma a folga dele por cima disso.
  */
  useEffect(() => ocuparSlotInferior(24 + 56).soltar, []);

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
