import { Lock } from 'lucide-react';

/**
 * O que fica no lugar do botão que sumiu.
 *
 * Botão cinza sem explicação vira pergunta no grupo da produção ("o app
 * travou?"). Uma linha dizendo quem pode resolve antes de virar pergunta —
 * desde que dê para ler: é uma faixa com fundo, no tamanho do texto normal,
 * e não uma nota de rodapé em cinza.
 */
export function SoQuemPode({ motivo, style }: { motivo: string; style?: React.CSSProperties }) {
  if (!motivo) return null;
  return (
    <p
      role="note"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px', margin: 0,
        padding: '10px 14px', borderRadius: '10px',
        background: 'var(--color-warning-bg)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 35%, transparent)',
        color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.45,
        ...style,
      }}
    >
      <Lock size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-warning)' }} />
      <span>{motivo}</span>
    </p>
  );
}
