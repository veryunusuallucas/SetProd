import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { TrendingDown, CalendarClock } from 'lucide-react';
import { db } from '../db/db';
import { calcularRitmo, avisoDoRitmo } from '../lib/ritmo';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * O alerta de "o projeto está atrasado" (spec §5.2).
 *
 * Ele some sozinho quando não há nada a dizer — ver `avisoDoRitmo`. É a única
 * forma de o aviso continuar valendo alguma coisa no dia em que aparecer.
 */
export function AvisoDeRitmo({ projetoId }: { projetoId: string }) {
  const reduzido = useMovimentoReduzido();

  const cenas = useLiveQuery(() => db.cenas.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const registros = useLiveQuery(() => db.registros_cena.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  const ritmo = calcularRitmo(cenas, registros, diarias);
  const aviso = avisoDoRitmo(ritmo);
  if (!aviso) return null;

  const alerta = aviso.gravidade === 'alerta';
  const cor = alerta ? 'var(--color-danger)' : 'var(--color-warning)';
  const fundo = alerta ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)';
  const Icone = alerta ? TrendingDown : CalendarClock;

  return (
    <motion.div
      initial={reduzido ? undefined : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOLA}
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        borderLeft: `3px solid ${cor}`, backgroundColor: fundo,
      }}
    >
      <Icone size={20} style={{ color: cor, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div className="text-sm font-bold" style={{ color: cor }}>{aviso.titulo}</div>
        <div className="text-xs text-secondary" style={{ lineHeight: 1.5, marginTop: '2px' }}>
          {aviso.detalhe}
        </div>
      </div>
    </motion.div>
  );
}
