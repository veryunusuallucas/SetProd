import { useEffect, useState } from 'react';
import { Package, AlertTriangle, Check } from 'lucide-react';
import { resumoDaDiaria, type ResumoConferencia } from '../lib/acervoVinculado';

/**
 * O que o SetGear diz sobre o equipamento desta diária.
 *
 * É a outra ponta da ponte: a produção descobre que falta 1 item de Câmera e
 * sabe que precisa esperar o wrap.
 *
 * ⚠️ CONTAGEM, NUNCA LISTA. A produção não descobre QUAL item, nem que existe
 * uma Komodo no acervo. Isso não depende deste componente se comportar — o banco
 * tem um CHECK que recusa a linha se aparecer qualquer chave fora de
 * `nome/total/saiu/voltou/pendente`. Um combinado que vive só no cliente se rompe
 * no primeiro descuido: alguém acrescenta `itens_pendentes` para depurar, e o
 * inventário passa a vazar sem ninguém perceber.
 *
 * Some inteiro quando não há resumo. Produção sem acervo vinculado não deveria
 * ganhar um bloco vazio falando de um app que ela não usa.
 */
export function ResumoEquipamento({ projetoId, diariaId }: { projetoId: string; diariaId: string }) {
  const [resumo, setResumo] = useState<ResumoConferencia | null>(null);

  useEffect(() => {
    let vivo = true;
    resumoDaDiaria(projetoId, diariaId)
      .then(r => { if (vivo) setResumo(r); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [projetoId, diariaId]);

  if (!resumo || resumo.por_departamento.length === 0) return null;

  const tudoVoltou = resumo.pendencias === 0 && resumo.fechada;

  return (
    <div className="card">
      <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Package size={16} /> Equipamento
        <span className="text-xs text-muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          — conferência da fotografia
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {resumo.por_departamento.map(d => {
          const faltando = d.pendente > 0;
          return (
            <div key={d.nome} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="text-sm font-bold" style={{ minWidth: '80px' }}>{d.nome}</span>
              <span className="text-sm text-secondary">
                {d.saiu}/{d.total} saiu
                <span className="text-muted"> · </span>
                {d.voltou}/{d.total} voltou
              </span>
              {faltando && (
                <span
                  className="text-xs"
                  style={{
                    padding: '2px 9px', borderRadius: '20px', fontWeight: 700,
                    color: 'var(--color-danger)', border: '1px solid var(--color-danger)',
                  }}
                >
                  {d.pendente} pendente{d.pendente > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* A fase e a pendência juntas: "falta 1" sem "ainda está no wrap" faria a
          produção achar que perdeu equipamento, quando o dia só não acabou. */}
      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {tudoVoltou ? (
          <>
            <Check size={15} style={{ color: 'var(--color-success, #4ade80)' }} />
            <span className="text-sm">Tudo conferido e devolvido.</span>
          </>
        ) : (
          <>
            <AlertTriangle size={15} style={{ color: 'var(--color-warning, #fbbf24)' }} />
            <span className="text-sm text-secondary">
              {resumo.pendencias > 0
                ? `${resumo.pendencias} item(ns) ainda não voltaram`
                : 'Conferência em andamento'}
              {resumo.fase_atual && <span className="text-muted"> · {resumo.fase_atual}</span>}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
