import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Timer, CalendarClock, ArrowRight } from 'lucide-react';
import {
  descreverAtraso, descreverFalta, proximoDoDia, ROTULO_TIPO,
  type Atraso, type DiaCalculado, type ItemCalculado,
} from '../lib/linhaDoDia';
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

/** A partir daqui a contagem vira alerta: o próximo item está em cima. */
const EM_CIMA_MIN = 10;

export function RelogioDoSet({ fase, atraso, wrap, dia }: {
  fase: Fase;
  atraso: Atraso;
  /** Wrap previsto, já com o atraso corrente aplicado. */
  wrap: string | null;
  /**
   * O dia calculado — para a contagem até o próximo item.
   *
   * Vem inteiro, e não só o próximo já resolvido, porque a conta depende do
   * relógio e o relógio bate aqui dentro: resolvida de fora, ela congelaria no
   * minuto em que a tela foi montada e passaria o dia mentindo devagar.
   */
  dia: DiaCalculado;
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

  /*
    A contagem para o próximo item (pedido de quem estava no set).

    Só aparece com o dia ATIVO. Antes da chamada, o bloco do meio já conta a
    espera — e numa diária de depois de amanhã "o próximo item é em 51h" não é
    resposta para pergunta nenhuma.
  */
  const proximo = fase.ativo
    ? proximoDoDia(dia, atraso, agora.getHours() * 60 + agora.getMinutes())
    : null;

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

      {/*
        ---- O QUE VEM A SEGUIR ----

        A tela dizia que horas são e quanto o dia está atrasado: duas coisas
        sobre o passado. Faltava a pergunta que se faz a cada vinte minutos numa
        filmagem — "quanto tempo eu ainda tenho aqui".

        Fica ao lado do atraso e não no lugar dele porque são perguntas
        diferentes: o atraso diz como o dia está, este diz o que fazer agora.
      */}
      {proximo && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            paddingLeft: '18px', borderLeft: '1px solid var(--border-light)',
            minWidth: '170px',
          }}
        >
          <ArrowRight
            size={20}
            style={{ color: proximo.faltamMinutos <= EM_CIMA_MIN ? 'var(--color-warning)' : 'var(--text-muted)', flexShrink: 0 }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="text-xs text-muted uppercase tracking-widest">A seguir</div>
            <div className="font-bold" style={{ fontSize: '15px', lineHeight: 1.25 }}>
              {rotuloDoItem(proximo.item)}
            </div>
            <div
              className="text-xs"
              style={{
                fontVariantNumeric: 'tabular-nums',
                color: proximo.faltamMinutos < 0
                  ? 'var(--color-warning)'
                  : proximo.faltamMinutos <= EM_CIMA_MIN
                    ? 'var(--color-warning)'
                    : 'var(--text-secondary)',
              }}
            >
              {/*
                Contagem negativa vira "era para ter começado", e não "há 8min".

                "há 8min" se lê como se já tivesse acontecido — e o item ainda
                não foi marcado justamente porque não começou. A frase mais longa
                é a única que não pode ser lida ao contrário.
              */}
              {proximo.faltamMinutos < 0
                ? `era para ter começado ${descreverFalta(proximo.faltamMinutos)}`
                : `${descreverFalta(proximo.faltamMinutos)} · previsto ${proximo.previsto}`}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Como o próximo item se chama numa linha só. */
function rotuloDoItem(c: ItemCalculado): string {
  if (c.cena) return `Cena ${c.cena.numero}${c.item.parte || ''}`;
  return c.item.titulo?.trim() || ROTULO_TIPO[c.item.tipo];
}
