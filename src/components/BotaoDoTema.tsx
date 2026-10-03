import { Moon, Sun } from 'lucide-react';
import { mudarPreferencia, usePreferencia } from '../lib/preferencias';

/**
 * Troca entre o modo escuro e o claro.
 *
 * MORA NO APP, NÃO NAS CONFIGURAÇÕES (pedido do Lucas, 02/10/2026). Quem
 * precisa do claro está no set ao meio-dia, com sol batendo na tela — e não
 * vai abrir três telas para achar um interruptor. Por isso ele aparece onde a
 * pessoa já está: na barra lateral, junto de Configurações e Busca; no topo da
 * tela da produção no celular (no lugar da lupa); e no topo da tela inicial.
 *
 * O ícone mostra para ONDE vai, não onde está: no escuro, um sol.
 */
export function BotaoDoTema({ className = 'tema-menu', tamanho = 18, comRotulo = false }: {
  className?: string;
  tamanho?: number;
  /** Mostra "Modo claro"/"Modo escuro" ao lado do ícone (item da barra lateral). */
  comRotulo?: boolean;
}) {
  const tema = usePreferencia('tema');
  const proximo = tema === 'claro' ? 'escuro' : 'claro';
  const rotulo = tema === 'claro' ? 'Modo escuro' : 'Modo claro';
  return (
    <button
      type="button"
      className={className}
      onClick={e => { e.stopPropagation(); mudarPreferencia('tema', proximo); }}
      title={rotulo}
      aria-label={rotulo}
    >
      {tema === 'claro' ? <Moon size={tamanho} /> : <Sun size={tamanho} />}
      {comRotulo && <span>{rotulo}</span>}
    </button>
  );
}

