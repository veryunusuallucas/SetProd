import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { Cena, CenaNaDiaria, MotivoNaDiaria } from '../types';
import { MOTIVOS_DE_VOLTA, ROTULO_DO_MOTIVO, type CandidataARegravar } from '../lib/regravacao';
import { dataCurta } from '../lib/formato';

/**
 * "Regravar cena" (PLANO-reshoot, 11/11/2026): uma linha do "Acrescentar" da
 * linha do dia, separada do "Do roteiro" porque é outra intenção — e um campo
 * "é regravação?" no seletor comum faria pensar duas vezes no caso comum.
 *
 * Primeiro as cenas que já rodaram, com de onde vieram; depois as outras,
 * porque o app pode estar errado sobre o que foi gravado.
 */
export function RegravarCena({ aRegravar, aoRegravar }: {
  aRegravar: { gravadas: CandidataARegravar[]; outras: Cena[] };
  aoRegravar: (cena: Cena, volta: CenaNaDiaria) => void;
}) {
  const [cenaId, setCenaId] = useState('');
  const [motivo, setMotivo] = useState<Exclude<MotivoNaDiaria, 'primeira'>>('regravacao');
  const [observacao, setObservacao] = useState('');
  if (!aRegravar.gravadas.length && !aRegravar.outras.length) return null;

  const escolhida = aRegravar.gravadas.find(c => c.cena.id === cenaId);
  const cena = escolhida?.cena ?? aRegravar.outras.find(c => c.id === cenaId);

  const escalar = () => {
    if (!cena) return;
    aoRegravar(cena, {
      motivo,
      ...(escolhida ? { diaria_origem_id: escolhida.origem.id } : {}),
      ...(observacao.trim() ? { observacao: observacao.trim() } : {}),
    });
    setCenaId('');
    setObservacao('');
    setMotivo('regravacao');
  };

  const campo = { padding: '7px 10px', fontSize: '13px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-full)', color: 'var(--text-primary)' };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
      <span className="text-xs text-muted uppercase tracking-widest" style={{ width: '110px', flexShrink: 0, paddingTop: '8px' }}>
        Regravar
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '180px', maxWidth: '520px' }}>
        <select aria-label="Cena a regravar" value={cenaId} onChange={e => setCenaId(e.target.value)} style={campo}>
          <option value="">Escolha a cena que volta…</option>
          {aRegravar.gravadas.length > 0 && (
            <optgroup label="Já rodaram">
              {aRegravar.gravadas.map(({ cena: c, origem, vezes }) => (
                <option key={c.id} value={c.id}>
                  {c.numero} — {(c.ambiente || 'ext').toUpperCase()}. {c.descricao} · Diária {String(origem.numero).padStart(2, '0')}, {dataCurta(origem.data)}
                  {vezes ? ` · já regravada ${vezes}×` : ''}
                </option>
              ))}
            </optgroup>
          )}
          {aRegravar.outras.length > 0 && (
            <optgroup label="Outras cenas">
              {aRegravar.outras.map(c => (
                <option key={c.id} value={c.id}>{c.numero} — {(c.ambiente || 'ext').toUpperCase()}. {c.descricao}</option>
              ))}
            </optgroup>
          )}
        </select>

        {cena && (
          <>
            <div role="radiogroup" aria-label="Por que volta" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {MOTIVOS_DE_VOLTA.map(m => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={motivo === m.id}
                  onClick={() => setMotivo(m.id)}
                  title={m.ajuda}
                  className="text-xs font-bold"
                  style={{
                    padding: '6px 12px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                    border: `1px solid ${motivo === m.id ? 'var(--accent)' : 'var(--border-light)'}`,
                    backgroundColor: motivo === m.id ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                    color: motivo === m.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {ROTULO_DO_MOTIVO[m.id]}
                </button>
              ))}
            </div>
            <input
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') escalar(); }}
              placeholder="Por que está voltando? (opcional — ex.: foco errado)"
              maxLength={140}
              style={{ ...campo, borderRadius: 'var(--radius-sm)' }}
            />
            {escolhida && (
              <span className="text-xs text-muted">
                A Diária {String(escolhida.origem.numero).padStart(2, '0')} continua como está: o que se gravou lá segue sendo do dia dela.
              </span>
            )}
          </>
        )}
      </div>
      <button
        type="button"
        onClick={escalar}
        disabled={!cena}
        className="text-xs font-bold"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px',
          borderRadius: 'var(--radius-full)', border: '1px solid var(--accent)',
          backgroundColor: cena ? 'var(--accent)' : 'transparent',
          color: cena ? '#000' : 'var(--accent-texto)',
          cursor: cena ? 'pointer' : 'not-allowed', opacity: cena ? 1 : 0.5,
        }}
      >
        <RotateCcw size={13} /> Escalar de novo
      </button>
    </div>
  );
}
