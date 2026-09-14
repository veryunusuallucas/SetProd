import { useParams } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { EventosPanel } from '../components/EventosPanel';

/**
 * Eventos — os compromissos da produção que não são dia de filmagem.
 *
 * ⚠️ ERA UMA ABA DENTRO DE DIÁRIAS, E VIROU PÁGINA.
 *
 * A aba existia pelo argumento de que diária e evento respondem à mesma
 * pergunta ("o que a produção tem marcado"). Na prática a tela de diárias
 * cresceu para ser a tela do PLANO — com a lista, a visão detalhada dia a dia,
 * a ordem de filmagem — e o evento ficou espremido numa terceira aba, ao lado
 * de uma coisa muito maior que ele. Visita de locação e reunião com o cliente
 * não são uma forma de ver as diárias; são outro assunto.
 *
 * O painel é o mesmo de antes. Só ganhou o cabeçalho de página que a aba não
 * precisava ter.
 */
export default function EventosPage() {
  const { id: projetoId } = useParams();

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarClock size={24} color="var(--accent)" /> Eventos
        </h1>
        <p className="text-sm text-secondary">Visita de locação, teste, reunião — o que está marcado fora das diárias</p>
      </div>

      <EventosPanel projetoId={projetoId!} />
    </div>
  );
}
