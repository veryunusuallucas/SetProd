import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from './movimento';

/**
 * Uma seção que começa fechada.
 *
 * É o Nível 4 da hierarquia da tela da diária (spec §10): o que existe, é
 * consultado de vez em quando, e não pode ficar empurrando o cronograma para
 * fora da tela — anexos, checklist, confirmação de presença.
 *
 * O `resumo` é o que faz a seção fechada valer alguma coisa. "Anexos" fechado
 * não diz nada; "Anexos · 3" diz se vale a pena abrir. Sem ele, a pessoa abre
 * todas as seções toda vez, e o colapso vira só um clique a mais.
 */
export function Colapsavel({
  titulo, icone, resumo, cor, children, abertoInicialmente = false,
}: {
  titulo: string;
  icone?: ReactNode;
  /** O número/estado que responde "preciso abrir isto?" sem abrir. */
  resumo?: ReactNode;
  /** Cor de área (§11). Entra só na borda e no ícone. */
  cor?: string;
  children: ReactNode;
  abertoInicialmente?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicialmente);
  const reduzido = useMovimentoReduzido();

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', borderLeft: cor ? `3px solid ${cor}` : undefined }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
          textAlign: 'left', color: 'var(--text-primary)',
        }}
      >
        <ChevronDown
          size={15}
          className="text-muted"
          style={{ transform: aberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .18s ease', flexShrink: 0 }}
        />
        {icone && <span style={{ display: 'flex', color: cor || 'var(--text-secondary)' }}>{icone}</span>}
        <span className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ flex: 1 }}>
          {titulo}
        </span>
        {resumo !== undefined && <span className="text-xs text-muted">{resumo}</span>}
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={reduzido ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduzido ? undefined : { height: 0, opacity: 0 }}
            transition={MOLA}
            /*
              `overflow: hidden` é obrigatório aqui, não é enfeite: sem ele o
              conteúdo escapa da caixa durante a animação de altura, e a seção
              fechando parece a tela quebrando.
            */
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '0 16px 16px' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
