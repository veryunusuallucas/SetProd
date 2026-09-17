import { motion } from 'framer-motion';
import { Eye, LayoutList, Target, type LucideIcon } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { NOME_DA_DENSIDADE, densidadesPossiveis, type Densidade } from '../../lib/logagem/densidade';

/**
 * A visão da Logagem num interruptor pequeno, do tipo claro/escuro, no topo
 * ao lado da diária.
 *
 * Antes era um cartão inteiro no fim da aba: longe de onde se olha, e ocupando
 * uma linha de tela no celular por uma escolha que se faz uma vez por dia.
 * Dois ícones e uma bolinha que desliza até o escolhido; o nome da visão vem
 * no `title` e no leitor de tela.
 */

const ICONE: Record<Densidade, LucideIcon> = {
  foco: Target,
  detalhada: LayoutList,
  acompanhamento: Eye,
};

export function ToggleDeVisao({ podeEditar, valor, aoMudar }: {
  podeEditar: boolean;
  valor: Densidade;
  aoMudar: (d: Densidade) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const opcoes = densidadesPossiveis(podeEditar);

  return (
    <div
      role="radiogroup"
      aria-label="Visão da Logagem"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '1px', flexShrink: 0,
        borderRadius: '999px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)',
      }}
    >
      {opcoes.map(d => {
        const Icone = ICONE[d];
        const marcada = d === valor;
        return (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={marcada}
            aria-label={`Visão ${NOME_DA_DENSIDADE[d]}`}
            title={`Visão ${NOME_DA_DENSIDADE[d]}`}
            onClick={() => aoMudar(d)}
            onKeyDown={e => {
              // Setas trocam, como em qualquer grupo de rádio.
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
              e.preventDefault();
              const outra = opcoes[(opcoes.indexOf(d) + (e.key === 'ArrowRight' ? 1 : -1) + opcoes.length) % opcoes.length];
              aoMudar(outra);
              (e.currentTarget.parentElement?.querySelector(`[data-visao="${outra}"]`) as HTMLElement | null)?.focus();
            }}
            data-visao={d}
            tabIndex={marcada ? 0 : -1}
            style={{
              position: 'relative', width: '44px', height: '44px', borderRadius: '999px', padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', cursor: 'pointer',
              color: marcada ? '#0b0b0b' : 'var(--text-muted)', transition: 'color 0.2s ease',
            }}
          >
            {marcada && (
              <motion.span
                layoutId="toggle-visao-bolinha"
                transition={reduzido ? { duration: 0 } : MOLA}
                aria-hidden
                style={{ position: 'absolute', inset: 0, borderRadius: '999px', backgroundColor: 'var(--cor-criativo)' }}
              />
            )}
            <Icone size={18} style={{ position: 'relative' }} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
