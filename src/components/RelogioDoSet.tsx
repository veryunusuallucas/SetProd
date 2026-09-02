import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer, CalendarClock } from 'lucide-react';
import { descreverAtraso, type Atraso } from '../lib/linhaDoDia';
import { descreverEspera, type Fase } from '../lib/faseDoDia';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * O relógio grande e o indicador de ritmo (spec §2).
 *
 * POR QUE UM RELÓGIO, SE O CELULAR JÁ TEM UM
 * Porque a pergunta no set nunca é "que horas são" — é "que horas são EM
 * RELAÇÃO AO PLANO". Sozinho, o relógio do sistema não responde nada; ao lado
 * do atraso, ele vira a única linha que o AD precisa ler o dia inteiro.
 *
 * A cor vem da severidade, e os cortes são de ofício, não redondos:
 *
 *   até 15min    verde   — o dia respira isso sem ninguém mexer em nada
 *   15 a 45min   âmbar   — dá para recuperar cortando setup ou apertando a virada
 *   acima de 45  vermelho— alguma cena vai cair, e é hora de decidir qual
 *
 * Meia hora não é o corte porque meia hora ainda se recupera num dia normal; e
 * pintar de vermelho cedo demais é como o alerta perde o sentido.
 */

const ATENCAO_MIN = 15;
const GRAVE_MIN = 45;

export function RelogioDoSet({ fase, atraso, wrap }: {
  fase: Fase;
  atraso: Atraso;
  /** Wrap previsto, já com o atraso corrente aplicado. */
  wrap: string | null;
}) {
  const reduzido = useMovimentoReduzido();
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    /*
      O relógio bate no SEGUNDO cheio, não a cada 30s corridos.

      Um `setInterval(30000)` a partir de um instante qualquer mostra 14:07
      quando já são 14:08 na parede, e no set as pessoas comparam a tela com o
      relógio delas. O primeiro tique é calculado para cair na virada do minuto.
    */
    let intervalo: ReturnType<typeof setInterval>;
    const ateOProximoMinuto = (60 - new Date().getSeconds()) * 1000;
    const inicio = setTimeout(() => {
      setAgora(new Date());
      intervalo = setInterval(() => setAgora(new Date()), 60_000);
    }, ateOProximoMinuto);

    return () => { clearTimeout(inicio); clearInterval(intervalo); };
  }, []);

  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;

  const marcado = atraso.marcados > 0;
  const abs = Math.abs(atraso.minutos);
  const cor = !marcado || abs <= ATENCAO_MIN
    ? 'var(--color-success)'
    : abs <= GRAVE_MIN && atraso.minutos > 0
      ? 'var(--color-warning)'
      : atraso.minutos > 0
        ? 'var(--color-danger)'
        : 'var(--color-success)';

  return (
    <motion.div
      initial={reduzido ? undefined : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOLA}
      className="card"
      style={{
        display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap',
        borderLeft: `3px solid ${cor}`,
      }}
    >
      <div style={{ lineHeight: 1 }}>
        <div className="text-xs text-muted uppercase tracking-widest" style={{ marginBottom: '4px' }}>Agora</div>
        {/*
          `tabular-nums` para o relógio não dançar a cada minuto: sem ele, o "1"
          é mais estreito que o "8" e o bloco inteiro se mexe de 14:11 para
          14:18, no canto do olho de quem está trabalhando.
        */}
        <div className="font-bold" style={{ fontSize: 'clamp(38px, 7vw, 56px)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {hora}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: '180px' }}>
        {fase.faltamMinutos !== null || (fase.diasAte !== null && fase.diasAte > 0) ? (
          /*
            A espera, em duas escalas.

            Dentro do dia ela conta em horas e minutos; de véspera, em dias —
            porque "em 26h" não é como ninguém pensa a diária de depois de
            amanhã. As duas frases respondem à mesma pergunta de quem abriu a OD
            antes da hora: falta muito?
          */
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarClock size={20} className="text-muted" />
            <div>
              <div className="text-sm font-bold">
                {fase.faltamMinutos !== null
                  ? `A chamada é ${descreverEspera(fase.faltamMinutos)}`
                  : fase.diasAte === 1
                    ? 'A chamada é amanhã'
                    : `A chamada é daqui a ${fase.diasAte} dias`}
              </div>
              <div className="text-xs text-muted">O dia entra em modo de registro sozinho na hora.</div>
            </div>
          </div>
        ) : marcado ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Timer size={20} style={{ color: cor }} />
            <div>
              <div className="font-bold" style={{ fontSize: '19px', color: cor }}>
                {atraso.minutos > 0 ? 'Estamos ' : ''}{descreverAtraso(atraso.minutos)}
              </div>
              <div className="text-xs text-secondary">
                Wrap previsto {wrap || '—'}
                {atraso.wrapPlanejado && atraso.wrapPlanejado !== wrap && (
                  <span className="text-muted"> · planejado {atraso.wrapPlanejado}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /*
            Ninguém marcou nada ainda, e o texto diz isso em vez de "no
            horário". Não é a mesma coisa: um dia sem marcação nenhuma não está
            no horário — ele está sem informação, e mostrar verde ali seria
            afirmar que está tudo bem sem ter olhado.
          */
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Timer size={20} className="text-muted" />
            <div>
              <div className="text-sm font-bold text-secondary">O dia ainda não foi marcado</div>
              <div className="text-xs text-muted">
                Toque em "começou" na linha do dia e o ritmo aparece aqui.
                {wrap ? ` Wrap planejado ${wrap}.` : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
