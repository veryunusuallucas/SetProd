/**
 * Liga/desliga. Uma linha inteira clicável — título, explicação e a chave.
 *
 * A linha toda é o botão, e não só a bolinha: no celular, acertar 40px de
 * chave com o dedão é pedir para errar.
 */
export function Interruptor({ titulo, ajuda, ligado, aoMudar }: {
  titulo: string;
  ajuda?: string;
  ligado: boolean;
  aoMudar: (ligado: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => aoMudar(!ligado)}
      style={{
        display: 'flex', alignItems: 'center', gap: '14px', width: '100%', textAlign: 'left',
        padding: '12px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
        border: '1px solid var(--border-light)', background: 'var(--bg-primary)', color: 'inherit',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span className="text-sm font-bold">{titulo}</span>
        {ajuda && <span className="text-xs text-muted" style={{ lineHeight: 1.45 }}>{ajuda}</span>}
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative', flexShrink: 0, width: '42px', height: '24px', borderRadius: 'var(--radius-full)',
          background: ligado ? 'var(--accent)' : 'var(--bg-active)',
          border: `1px solid ${ligado ? 'var(--accent)' : 'var(--border-color)'}`,
          transition: 'background-color .15s ease',
        }}
      >
        <span
          style={{
            position: 'absolute', top: '2px', left: ligado ? '20px' : '2px', width: '18px', height: '18px',
            borderRadius: 'var(--radius-full)', background: ligado ? '#000' : 'var(--text-muted)',
            transition: 'left .15s ease',
          }}
        />
      </span>
    </button>
  );
}
