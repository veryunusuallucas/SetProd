import { Lock } from 'lucide-react';

/**
 * O que fica no lugar do botão que sumiu.
 *
 * Botão cinza sem explicação vira pergunta no grupo da produção ("o app
 * travou?"). Uma linha dizendo quem pode resolve antes de virar pergunta.
 */
export function SoQuemPode({ motivo, style }: { motivo: string; style?: React.CSSProperties }) {
  if (!motivo) return null;
  return (
    <p
      className="text-xs text-muted"
      style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, ...style }}
    >
      <Lock size={12} style={{ flexShrink: 0 }} />
      {motivo}
    </p>
  );
}
