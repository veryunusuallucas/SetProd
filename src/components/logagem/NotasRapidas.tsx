import { useEffect, useState } from 'react';
import { BotaoTatil } from '../ui/BotaoTatil';
import { lerNotas } from '../../lib/logagem/notas';

/** A lista de anotações deste aparelho, acompanhando a edição feita na Config. */
export function useNotas(): string[] {
  const [notas, setNotas] = useState(lerNotas);
  useEffect(() => {
    const reler = () => setNotas(lerNotas());
    window.addEventListener('setprod-notas', reler);
    window.addEventListener('storage', reler);
    return () => {
      window.removeEventListener('setprod-notas', reler);
      window.removeEventListener('storage', reler);
    };
  }, []);
  return notas;
}

/**
 * As pílulas embaixo da observação. Cada toque acrescenta a frase no fim.
 *
 * Quebram linha em vez de rolar de lado: uma pílula escondida à direita é uma
 * pílula que ninguém acha com o take rodando.
 */
export function NotasRapidas({ bloqueado, aoTocar }: { bloqueado: boolean; aoTocar: (nota: string) => void }) {
  const notas = useNotas();
  if (notas.length === 0) return null;
  return (
    <div role="group" aria-label="Anotações rápidas" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {notas.map(n => (
        <BotaoTatil
          key={n}
          disabled={bloqueado}
          escala={0.94}
          onClick={() => aoTocar(n)}
          style={{
            minHeight: '44px', padding: '0 14px', borderRadius: '999px',
            border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600,
            cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? 0.5 : 1,
          }}
        >
          + {n}
        </BotaoTatil>
      ))}
    </div>
  );
}
