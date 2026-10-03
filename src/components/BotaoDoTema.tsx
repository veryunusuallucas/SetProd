import { Moon, Sun } from 'lucide-react';
import { mudarPreferencia, usePreferencia } from '../lib/preferencias';

/**
 * Troca entre o modo escuro e o claro.
 *
 * MORA NO APP, NÃO NAS CONFIGURAÇÕES (pedido do Lucas, 02/10/2026). Quem
 * precisa do claro está no set ao meio-dia, com sol batendo na tela — e não
 * vai abrir três telas para achar um interruptor. Por isso ele aparece onde a
 * pessoa já está: no pé da barra lateral, ao lado do alfinete; no topo da
 * tela da produção no celular (no lugar da lupa); e no topo da tela inicial.
 *
 * O ícone mostra para ONDE vai, não onde está: no escuro, um sol.
 */
export function BotaoDoTema({ className = 'tema-menu', tamanho = 18 }: { className?: string; tamanho?: number }) {
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
    </button>
  );
}

