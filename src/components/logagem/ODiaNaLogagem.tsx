import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { CalendarClock, ArrowRight, Clapperboard, ChevronDown, CheckCheck } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { Abre } from './pecas';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { calcularAtraso, calcularDia, COR_TIPO, descreverAtraso, montarLinhaDoDia } from '../../lib/linhaDoDia';
import { faseDoDia, descreverEspera } from '../../lib/faseDoDia';
import { diaDaSemana } from '../../lib/formato';
import { claqueteDoPlano, planosDaDiaria } from '../../lib/logagem/decupagem';
import { itemDeAgora, itensAFrente, planoResolvido, proximoPlano, quandoFalta, rotuloDoItem } from '../../lib/logagem/dia';

/** A partir daqui o próximo item está em cima, e a faixa avisa. */
const EM_CIMA_MIN = 10;

/**
 * A faixa "o dia", no alto da Logagem.
 *
 * Responde as duas perguntas de quem opera câmera entre um take e outro: *o que
 * vem depois* (a próxima cena, a pausa, a preparação — com o horário, já
 * deslocado pelo atraso real) e *qual é o próximo plano*. O próximo plano é um
 * botão: um toque põe na claquete.
 *
 * Some quando a diária não tem linha do dia nem decupagem: uma faixa vazia no
 * topo seria o primeiro lugar para onde o olho vai, sem nada para ler.
 */
export function ODiaNaLogagem({ estado, bloqueado, aoEscolher, compacto }: {
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  aoEscolher: (mudanca: Partial<EstadoDaLogagem>) => void;
  /**
   * No Foco (celular), a faixa vira uma linha que abre com um toque. Aberta,
   * ela empurraria a claquete e os botões para fora da primeira tela.
   */
  compacto?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const reduzido = useMovimentoReduzido();
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    // Bate na virada do minuto, como o relógio do set.
    let intervalo: ReturnType<typeof setInterval>;
    const inicio = setTimeout(() => {
      setAgora(new Date());
      intervalo = setInterval(() => setAgora(new Date()), 60_000);
    }, (60 - new Date().getSeconds()) * 1000);
    return () => { clearTimeout(inicio); clearInterval(intervalo); };
  }, []);

  const dados = useLiveQuery(async () => {
    const diaria = await db.diarias.get(estado.diaria_id);
    if (!diaria) return null;
    const [cenas, planos, takes, kits] = await Promise.all([
      db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray(),
      diaria.cena_ids?.length ? db.planos.where('cena_id').anyOf(diaria.cena_ids).toArray() : Promise.resolve([]),
      db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
      db.log_kits.where('projeto_id').equals(estado.projeto_id).toArray(),
    ]);
    return {
      diaria, cenas, planos, takes,
      kitDeLentes: kits.find(k => k.tipo === 'lente' && k.id === estado.kit_lente_id) ?? kits.find(k => k.tipo === 'lente'),
    };
  }, [estado.diaria_id, estado.projeto_id, estado.kit_lente_id]);

  if (!dados) return null;
  const { diaria } = dados;

  const dia = calcularDia(montarLinhaDoDia(diaria), diaria.chamada, id => dados.cenas.find(c => c.id === id));
  const atraso = calcularAtraso(dia);
  const fase = faseDoDia(diaria, agora);
  const agoraMin = fase.ativo ? agora.getHours() * 60 + agora.getMinutes() : null;
  const rodando = fase.ativo ? itemDeAgora(dia) : null;
  const aFrente = itensAFrente(dia, atraso, agoraMin, 3);

  const lista = planosDaDiaria({
    diaria,
    cenas: dados.cenas.filter(c => diaria.cena_ids?.includes(c.id)),
    planos: dados.planos,
    takes: dados.takes,
    letras: estado.plano_letras !== false,
  });
  const proximo = proximoPlano(lista, estado);

  /** Toda a decupagem da diária já teve take: no lugar do botão, a linha que diz isso. */
  const tudoRodou = lista.length > 0 && lista.every(i => i.takes > 0);

  if (aFrente.length === 0 && !rodando && !proximo && !tudoRodou) return null;

  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const atrasado = atraso.marcados > 0 && Math.abs(atraso.minutos) >= 5;

  const primeiro = aFrente[0];
  const expandido = !compacto || aberto;

  const itens = aFrente.length > 0 && (
    <div className="dia-logagem-itens" role="list" aria-label={rodando ? 'A seguir no dia' : 'O dia'}>
      {aFrente.map((it, i) => {
        const cor = it.tipo === 'cena' ? 'var(--cor-set)' : COR_TIPO[it.tipo];
        const emCima = it.faltam !== undefined && it.faltam <= EM_CIMA_MIN;
        return (
          <div
            key={it.id}
            role="listitem"
            style={{
              flex: '0 0 auto', minWidth: '132px', maxWidth: '220px',
              display: 'flex', flexDirection: 'column', gap: '2px',
              padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
              borderLeft: `3px solid ${cor}`,
            }}
          >
            <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums', display: 'flex', gap: '6px' }}>
              {i === 0 && fase.ativo && <ArrowRight size={12} aria-hidden style={{ marginTop: '2px' }} />}
              {it.previsto}
              {it.faltam !== undefined && (
                <span style={{ color: emCima ? 'var(--color-warning)' : undefined, fontWeight: emCima ? 700 : 400 }}>
                  · {quandoFalta(it.faltam)}
                </span>
              )}
            </span>
            <span className="text-sm font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {it.rotulo}
            </span>
            {it.detalhe && <span className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.detalhe}</span>}
          </div>
        );
      })}
    </div>
  );

  /*
    A linha do compacto: a hora e o PRÓXIMO item, que é a pergunta de quem está
    entre dois takes. O resto (quem está rodando, os itens seguintes) abre com
    um toque.
  */
  if (compacto) {
    const emCima = primeiro?.faltam !== undefined && primeiro.faltam <= EM_CIMA_MIN;
    return (
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 14px' }}>
        <button
          type="button"
          onClick={() => setAberto(v => !v)}
          aria-expanded={aberto}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', width: '100%',
            border: 'none', background: 'none', color: 'inherit', cursor: 'pointer', textAlign: 'left', padding: 0,
          }}
        >
          <span style={{ fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
            {fase.ativo ? hora : <CalendarClock size={18} className="text-muted" aria-hidden />}
          </span>
          <span className="text-sm" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {primeiro ? (
              <>
                {fase.ativo && <ArrowRight size={13} aria-label="a seguir" style={{ verticalAlign: '-2px', marginRight: '4px', color: 'var(--text-muted)' }} />}
                <strong>{primeiro.rotulo}</strong>
                <span className="text-muted"> {primeiro.previsto}</span>
                {primeiro.faltam !== undefined && (
                  <span style={{ color: emCima ? 'var(--color-warning)' : 'var(--text-secondary)', fontWeight: emCima ? 700 : 400 }}>
                    {' · '}{quandoFalta(primeiro.faltam)}
                  </span>
                )}
              </>
            ) : rodando ? (
              <><span className="text-muted">rodando </span><strong>{rotuloDoItem(rodando)}</strong></>
            ) : (
              <span className="text-muted">o dia</span>
            )}
          </span>
          {atrasado && (
            <span className="text-xs font-bold" style={{ color: atraso.minutos > 0 ? 'var(--color-warning)' : 'var(--color-success)', flexShrink: 0 }}>
              {atraso.minutos > 0 ? '+' : '−'}{Math.abs(atraso.minutos)}min
            </span>
          )}
          <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={reduzido ? { duration: 0 } : MOLA} style={{ display: 'flex', flexShrink: 0 }}>
            <ChevronDown size={16} className="text-muted" />
          </motion.span>
        </button>

        <Abre aberto={aberto}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '4px' }}>
            {rodando && (
              <span className="text-xs text-muted">
                rodando <strong style={{ color: 'var(--text-primary)' }}>{rotuloDoItem(rodando)}</strong> desde {rodando.item.hora_real}
                {atrasado && ` · ${descreverAtraso(atraso.minutos)}`}
              </span>
            )}
            {itens}
          </div>
        </Abre>

        {botaoDoProximo()}
      </section>
    );
  }

  // Uma função que devolve o botão, e não um componente: declarado aqui dentro,
  // um componente nasceria de novo a cada renderização e perderia o estado.
  function botaoDoProximo() {
    if (!proximo && tudoRodou) {
      return (
        <div
          className="text-sm"
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '6px 12px',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
            border: '1px solid color-mix(in srgb, var(--color-success) 35%, transparent)',
            backgroundColor: 'color-mix(in srgb, var(--color-success) 8%, transparent)',
          }}
        >
          <CheckCheck size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} aria-hidden />
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>Todos os planos da diária já rodaram</strong>
            {expandido && <span className="text-muted"> · {lista.length} plano{lista.length === 1 ? '' : 's'} com take</span>}
          </span>
        </div>
      );
    }
    if (!proximo || !dados) return null;
    const detalhe = [proximo.plano.descricao, proximo.plano.tamanho, proximo.plano.lente].filter(Boolean).join(' · ');
    /*
      O plano da claquete já teve o take bom (OK ou HERO): o botão acende.
      É só destaque — a claquete continua onde está até alguém tocar.
    */
    const aceso = !bloqueado && planoResolvido(dados.takes, estado);
    return (
      <BotaoTatil
        onClick={() => aoEscolher(claqueteDoPlano(proximo, estado, dados.kitDeLentes))}
        disabled={bloqueado}
        escala={0.98}
        className={aceso ? 'proximo-aceso' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: expandido ? '52px' : '44px', padding: '6px 12px',
          borderRadius: 'var(--radius-sm)', textAlign: 'left', width: '100%',
          border: aceso ? '1px solid var(--cor-criativo)' : '1px dashed color-mix(in srgb, var(--cor-criativo) 60%, transparent)',
          backgroundColor: aceso ? 'color-mix(in srgb, var(--cor-criativo) 14%, transparent)' : 'transparent',
          color: 'inherit', cursor: bloqueado ? 'default' : 'pointer',
          transition: 'background-color 0.25s ease, border-color 0.25s ease',
        }}
      >
        <Clapperboard size={16} style={{ color: 'var(--cor-criativo)', flexShrink: 0 }} aria-hidden />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: expandido ? 'column' : 'row', gap: expandido ? 0 : '6px', alignItems: expandido ? 'stretch' : 'baseline' }}>
          <span className="text-xs text-muted uppercase tracking-widest" style={{ flexShrink: 0 }}>{aceso ? (expandido ? 'Plano feito · próximo' : 'Feito · próximo') : expandido ? 'Próximo plano' : 'Próximo'}</span>
          <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            <strong>{proximo.cena.numero} · {proximo.naClaquete}</strong>
            {detalhe && <span className="text-secondary"> — {detalhe}</span>}
          </span>
        </span>
        {!bloqueado && (
          <span
            className="text-xs font-bold"
            style={aceso ? {
              flexShrink: 0, padding: '6px 10px', borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--cor-criativo)', color: '#0b0b0b',
            } : { color: 'var(--cor-criativo)', flexShrink: 0 }}
          >
            {expandido ? 'Pôr na claquete' : 'Usar'}
          </span>
        )}
      </BotaoTatil>
    );
  }

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 18px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px 14px', flexWrap: 'wrap' }}>
        {fase.ativo ? (
          <>
            <span style={{ fontSize: '28px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>{hora}</span>
            {rodando && (
              <span className="text-sm">
                <span className="text-muted">rodando </span>
                <strong>{rotuloDoItem(rodando)}</strong>
                <span className="text-muted"> desde {rodando.item.hora_real}</span>
              </span>
            )}
            {atrasado && (
              <span
                className="text-xs font-bold"
                style={{
                  marginLeft: 'auto', padding: '3px 8px', borderRadius: 'var(--radius-full)',
                  color: atraso.minutos > 0 ? 'var(--color-warning)' : 'var(--color-success)',
                  backgroundColor: atraso.minutos > 0 ? 'var(--color-warning-bg)' : 'var(--color-success-bg)',
                }}
              >
                {descreverAtraso(atraso.minutos)}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarClock size={16} className="text-muted" aria-hidden />
            <span>
              {fase.faltamMinutos !== null
                ? <>Chamada <strong>{descreverEspera(fase.faltamMinutos)}</strong>, às {diaria.chamada}</>
                : <>Diária de <strong>{diaria.data ? diaDaSemana(diaria.data) : 'sem data'}</strong>{diaria.chamada ? ` · chamada ${diaria.chamada}` : ''}</>}
            </span>
          </span>
        )}
      </div>

      {itens}

      {botaoDoProximo()}
    </section>
  );
}
