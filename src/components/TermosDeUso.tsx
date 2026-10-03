import { FileText, AlertTriangle } from 'lucide-react';
import { Janela } from './ui/Janela';
import { ATUALIZADO_EM, RASCUNHO, SECOES_DOS_TERMOS, VERSAO_DOS_TERMOS } from '../lib/termos';

/**
 * Os termos e condições, numa janela para ler.
 *
 * O texto mora em `lib/termos.tsx`, separado da tela: quando houver aceite no
 * cadastro, a mesma lista de seções vai aparecer lá, e o texto não pode existir
 * em dois lugares.
 */
export function TermosDeUso({ aoFechar }: { aoFechar: () => void }) {
  return (
    <Janela
      titulo="Termos e condições"
      icone={<FileText size={18} />}
      aoFechar={aoFechar}
      largura="640px"
      rodape={<button onClick={aoFechar} className="btn-primary" style={{ width: '100%' }}>Fechar</button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '14px', lineHeight: 1.65 }}>
        {RASCUNHO && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning, var(--accent))', background: 'rgba(255,215,0,0.08)' }}>
            <AlertTriangle size={18} className="text-warning" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '13px' }}>
              <strong>Rascunho.</strong> Estes termos ainda estão sendo escritos e não valem. Os trechos entre colchetes ainda vão ser definidos.
            </p>
          </div>
        )}

        <div className="text-xs text-muted">Versão {VERSAO_DOS_TERMOS} · atualizado em {ATUALIZADO_EM}</div>

        {/* Índice: termos são lidos procurando uma coisa, não de ponta a ponta. */}
        <nav aria-label="Seções" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SECOES_DOS_TERMOS.map(s => (
            <a
              key={s.id}
              href={`#termos-${s.id}`}
              onClick={e => { e.preventDefault(); document.getElementById(`termos-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className="text-xs"
              style={{ padding: '4px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              {s.titulo.replace(/^\d+\.\s*/, '')}
            </a>
          ))}
        </nav>

        {SECOES_DOS_TERMOS.map(s => (
          <section key={s.id} id={`termos-${s.id}`} style={{ scrollMarginTop: '8px' }}>
            <h3 className="font-bold" style={{ fontSize: '15px', margin: '0 0 6px' }}>{s.titulo}</h3>
            <div className="termos-corpo text-secondary" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {s.corpo}
            </div>
          </section>
        ))}
      </div>
    </Janela>
  );
}
