/**
 * A forma de um aviso do topo da produção — uma só, para todos.
 *
 * Antes cada aviso desenhava a própria caixa, com o mesmo bloco de estilo
 * copiado: mesmo fundo, mesma borda, mesmo espaçamento, escritos três vezes.
 * Copiar não é erro enquanto ninguém muda nada; vira erro no dia em que dois
 * deles mudam e o terceiro fica para trás, e aí o app parece remendado.
 *
 * `tom` existe porque nem todo aviso pede a mesma atenção: o pedido de ficha de
 * outra pessoa é informação, o conflito de edição é urgência. Usar âmbar para os
 * dois ensina a pessoa a ignorar o âmbar.
 */
export type TomDoAviso = 'atencao' | 'neutro';

export function FaixaDeAviso({
  icone, tom = 'atencao', children, acao, aoDispensar,
}: {
  icone: React.ReactNode;
  tom?: TomDoAviso;
  children: React.ReactNode;
  /** O botão da direita: o caminho para resolver o que o aviso diz. */
  acao?: React.ReactNode;
  /** Quando existe, vira o "agora não" discreto no fim. */
  aoDispensar?: () => void;
}) {
  const atencao = tom === 'atencao';
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: '12px',
        background: atencao ? 'var(--color-warning-bg)' : 'var(--bg-surface)',
        border: `1px solid ${atencao
          ? 'color-mix(in srgb, var(--color-warning) 40%, transparent)'
          : 'var(--border-light)'}`,
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: atencao ? 'var(--color-warning)' : 'var(--accent)' }}>
        {icone}
      </span>

      <div className="text-sm" style={{ flex: 1, minWidth: '200px', lineHeight: 1.45 }}>
        {children}
      </div>

      {acao}

      {aoDispensar && (
        <button
          type="button"
          onClick={aoDispensar}
          className="text-xs"
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', textDecoration: 'underline', flexShrink: 0,
          }}
        >
          agora não
        </button>
      )}
    </div>
  );
}
