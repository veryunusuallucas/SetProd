import { CalendarDays, ChevronRight } from 'lucide-react';
import type { Projeto } from '../types';
import { dataCurta, diaDaSemana } from '../lib/formato';
import { DESCRICAO } from '../lib/permissoes';
import type { PapelMembro } from '../lib/membros';
import { quandoE, type FaseDaProducao, type ResumoDaProducao } from '../lib/resumoDaProducao';
import { Holofote } from './ui/Holofote';

/**
 * O miolo do card de uma produção na tela inicial. O card que o embrulha é
 * uma coluna flex (o pé do card se prende embaixo).
 *
 * Três andares, do que se lê primeiro ao que se lê por último: a fase (chip), o
 * nome com quem dirige, e a diária que vem com a barra do que já foi. O saldo
 * saiu: a tela inicial é de todo mundo que entrou, e dinheiro é da produção.
 */

const FASE: Record<FaseDaProducao, { rotulo: string; cor: string }> = {
  hoje: { rotulo: 'Filmando hoje', cor: 'var(--color-success)' },
  filmando: { rotulo: 'Em filmagem', cor: 'var(--cor-criativo)' },
  pre: { rotulo: 'Pré-produção', cor: 'var(--color-warning)' },
  encerrada: { rotulo: 'Filmagem encerrada', cor: 'var(--text-muted)' },
  sem_diarias: { rotulo: 'Sem diárias', cor: 'var(--text-muted)' },
};

const numeroDaDiaria = (n: number) => `Diária ${String(n).padStart(2, '0')}`;

export function CardDaProducao({ projeto, resumo, papel, acao }: {
  projeto: Projeto;
  resumo: ResumoDaProducao;
  papel?: PapelMembro;
  /** O canto de cima à direita: a seta, ou a lixeira no modo de apagar. */
  acao?: React.ReactNode;
}) {
  const fase = FASE[resumo.fase];
  const quem = [projeto.diretor && `Dir. ${projeto.diretor}`, projeto.produtora].filter(Boolean).join(' · ');
  const progresso = resumo.total ? Math.min(1, resumo.feitas / resumo.total) : 0;

  let linha: React.ReactNode;
  if (resumo.deHoje) {
    linha = <><strong>{numeroDaDiaria(resumo.deHoje.numero)}</strong> é hoje</>;
  } else if (resumo.proxima) {
    linha = (
      <>
        {resumo.fase === 'pre' ? 'Primeira: ' : 'Próxima: '}
        <strong>{numeroDaDiaria(resumo.proxima.numero)}</strong>
        {' · '}{diaDaSemana(resumo.proxima.data)}
        <span style={{ color: 'var(--text-muted)' }}> · {quandoE(resumo.proxima.faltam)}</span>
      </>
    );
  } else if (resumo.fase === 'encerrada' && resumo.ultima) {
    linha = <>Encerrou em {dataCurta(resumo.ultima.data)}</>;
  } else if (resumo.fase === 'sem_diarias') {
    linha = <span style={{ color: 'var(--text-muted)' }}>Nenhuma diária marcada ainda</span>;
  } else {
    linha = <span style={{ color: 'var(--text-muted)' }}>Próxima diária ainda sem data</span>;
  }

  return (
    <>
      {/* Segue o ponteiro dentro do card. No celular não aparece. */}
      <Holofote />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', minHeight: '34px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '999px',
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
          color: fase.cor, backgroundColor: `color-mix(in srgb, ${fase.cor} 14%, transparent)`,
        }}>
          <span
            aria-hidden
            className={resumo.fase === 'hoje' ? 'pulso-ao-vivo' : undefined}
            style={{ width: '6px', height: '6px', borderRadius: '999px', backgroundColor: fase.cor }}
          />
          {fase.rotulo}
        </span>
        {acao ?? <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} aria-hidden />}
      </div>

      <h3 className="text-xl font-bold" style={{ margin: '14px 0 2px', overflowWrap: 'anywhere' }}>{projeto.nome}</h3>
      <div className="text-sm text-muted" style={{ minHeight: '20px', marginBottom: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {quem}
      </div>

      {/* Preso ao pé: na grade, cards vizinhos alinham a linha da diária mesmo com títulos de tamanhos diferentes. */}
      <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
          <CalendarDays size={15} style={{ flexShrink: 0, color: fase.cor }} aria-hidden />
          <span style={{ minWidth: 0 }}>{linha}</span>
        </div>

        {(resumo.total > 0 || papel) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {resumo.total > 0 ? (
              <>
                <div
                  role="progressbar"
                  aria-label="Diárias feitas"
                  aria-valuemin={0}
                  aria-valuemax={resumo.total}
                  aria-valuenow={resumo.feitas}
                  style={{ flex: 1, height: '4px', borderRadius: '999px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}
                >
                  <div style={{ width: `${progresso * 100}%`, height: '100%', borderRadius: '999px', backgroundColor: fase.cor, transition: 'width 0.4s ease' }} />
                </div>
                <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                  {resumo.feitas} de {resumo.total} diária{resumo.total === 1 ? '' : 's'}
                </span>
              </>
            ) : <span style={{ flex: 1 }} />}
            {/* O papel de quem abre: dono, equipe, só leitura. */}
            {papel && (
              <span className="text-xs" style={{
                padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)', whiteSpace: 'nowrap',
              }}>
                {DESCRICAO[papel].nome}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
