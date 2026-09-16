import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clapperboard, ShieldCheck, ShieldAlert, ChevronRight } from 'lucide-react';
import { resumoDaLogagem } from '../lib/logagem/resumo';
import type { StatusTake } from '../types';

/**
 * O que a câmera rodou nesta diária, em números.
 *
 * É a ponte da Logagem para a página da diária e para o relatório de produção:
 * quantos takes, quantas cenas, e — a pergunta que a produção faz no wrap — se
 * os cartões já podem ser formatados.
 *
 * Some inteiro quando a diária não tem take. Produção que não usa a Logagem não
 * deveria ganhar um bloco vazio falando de um módulo que ela não abriu.
 *
 * `compacto` é a versão para o fechamento da diária, que já tem muita coisa na
 * tela: uma linha de números e o estado dos cartões, sem o link.
 */

const ORDEM: { status: StatusTake; rotulo: string; plural: string; cor: string }[] = [
  { status: 'OK', rotulo: 'OK', plural: 'OK', cor: 'var(--color-success)' },
  { status: 'NG', rotulo: 'NG', plural: 'NG', cor: 'var(--color-danger)' },
  { status: 'HERO', rotulo: 'HERO', plural: 'HERO', cor: 'var(--accent)' },
  { status: 'RECINV', rotulo: 'REC invertido', plural: 'REC invertidos', cor: 'var(--color-warning)' },
  { status: 'IMPORT', rotulo: 'importado', plural: 'importados', cor: 'var(--text-muted)' },
];

export function ResumoDaLogagem({ projetoId, diariaId, compacto }: {
  projetoId: string;
  diariaId: string;
  compacto?: boolean;
}) {
  const resumo = useLiveQuery(() => resumoDaLogagem(projetoId, diariaId), [projetoId, diariaId]);

  if (!resumo || resumo.takes === 0) return null;

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  const numeros = (
    <p className="text-sm" style={{ margin: 0, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
      <span><strong>{plural(resumo.takes, 'take', 'takes')}</strong></span>
      {resumo.cenas > 0 && <span>{plural(resumo.cenas, 'cena', 'cenas')} · {plural(resumo.planos, 'setup', 'setups')}</span>}
      {resumo.primeiro && resumo.ultimo && (
        <span className="text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {resumo.primeiro.slice(0, 5)} → {resumo.ultimo.slice(0, 5)}
        </span>
      )}
      {resumo.gbEstimados > 0 && <span className="text-muted">~{resumo.gbEstimados.toFixed(0)} GB</span>}
    </p>
  );

  const status = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {ORDEM.filter(o => resumo.porStatus[o.status]).map(o => {
        const n = resumo.porStatus[o.status]!;
        return (
          <span
            key={o.status}
            className="text-xs"
            style={{ padding: '2px 9px', borderRadius: '20px', fontWeight: 700, color: o.cor, border: `1px solid ${o.cor}` }}
          >
            {n} {n === 1 ? o.rotulo : o.plural}
          </span>
        );
      })}
    </div>
  );

  /*
    O estado dos cartões vai por último e com ícone próprio: é a única linha
    deste bloco que pede uma ação de alguém ("não formate ainda").
  */
  const cartoes = resumo.cartoes.length > 0 && (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      {resumo.pendentes === 0 ? (
        <ShieldCheck size={15} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
      ) : (
        <ShieldAlert size={15} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
      )}
      <span className="text-sm text-secondary">
        {resumo.pendentes === 0
          ? `${plural(resumo.cartoes.length, 'cartão liberado', 'cartões liberados')} para formatar.`
          : `${plural(resumo.pendentes, 'cartão ainda não pode', 'cartões ainda não podem')} ser formatado${resumo.pendentes === 1 ? '' : 's'}: `}
        {resumo.pendentes > 0 && (
          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
            {resumo.cartoes.filter(c => !c.seguro).map(c => c.nome).join(', ')}
          </strong>
        )}
        {resumo.pendentes > 0 && resumo.seguros > 0 && (
          <span className="text-muted"> · {plural(resumo.seguros, 'liberado', 'liberados')}</span>
        )}
      </span>
    </div>
  );

  if (compacto) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {numeros}
        {status}
        {cartoes}
      </div>
    );
  }

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Clapperboard size={16} style={{ color: 'var(--cor-criativo)' }} /> Câmera
          <span className="text-xs text-muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            — o que a Logagem registrou
          </span>
        </h2>
        <Link
          to={`/projeto/${projetoId}/logagem?diaria=${diariaId}`}
          className="text-xs"
          style={{ display: 'flex', alignItems: 'center', gap: '2px', minHeight: '44px', color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          Abrir a Logagem <ChevronRight size={14} />
        </Link>
      </div>
      {numeros}
      {status}
      {cartoes}
    </div>
  );
}
