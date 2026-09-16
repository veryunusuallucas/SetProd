import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, Star, RefreshCw, Trash2, ListVideo, AlertTriangle } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, StatusTake, Take } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import { ImagemAnexo } from '../ImagemAnexo';
import { apagarArquivo } from '../../lib/arquivos';
import { MONO, Rotulo } from './pecas';
import {
  COR_DO_STATUS, ROTULO_DO_STATUS, acharDuplicado, apagarTake, claqueteDoAcrescimo,
  registrarTake, substituirTake,
} from '../../lib/logagem/takes';
import { mudarEstado } from '../../lib/logagem/estado';

/**
 * O registro do take: quatro botões, e o que acontece depois deles.
 *
 * Os botões são grandes e ficam SEMPRE no mesmo lugar, na mesma ordem. Quem
 * loga aperta olhando para o set, não para a tela — um botão que muda de lugar
 * (porque um aviso apareceu, porque a lista cresceu) vira take com status
 * errado, e status errado é pior que take faltando: ninguém vai conferir.
 */

const BOTOES: { status: StatusTake; icone: typeof Check; atalho?: string }[] = [
  { status: 'OK', icone: Check, atalho: 'Espaço' },
  { status: 'NG', icone: X, atalho: 'Shift+Espaço' },
  { status: 'HERO', icone: Star },
  { status: 'RECINV', icone: RefreshCw },
];

export function RegistroDeTake({ estado, podeEditar, quem }: {
  estado: EstadoDaLogagem;
  podeEditar: boolean;
  quem?: string;
}) {
  const takes = useLiveQuery(
    () => db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
    [estado.diaria_id]
  ) ?? [];
  const emOrdem = [...takes].sort((a, b) => (b.ordem || 0) - (a.ordem || 0));

  /** A claquete repetida esperando decisão: substituir, acrescentar ou desistir. */
  const [repetido, setRepetido] = useState<{ status: StatusTake; take: Take } | null>(null);
  /** O "revisar antes de enviar" ligado, esperando o sim. */
  const [revisando, setRevisando] = useState<StatusTake | null>(null);
  const [ultimo, setUltimo] = useState<string>('');

  const gravar = async (status: StatusTake, comEstado = estado) => {
    const take = await registrarTake(comEstado, status, quem);
    setUltimo(take.id);
    setRepetido(null);
    setRevisando(null);
  };

  const tentar = (status: StatusTake) => {
    if (!podeEditar) return;
    if (estado.revisar_antes) { setRevisando(status); return; }
    seguir(status);
  };

  const seguir = (status: StatusTake) => {
    const repetida = acharDuplicado(takes, estado);
    if (repetida) { setRepetido({ status, take: repetida }); setRevisando(null); return; }
    void gravar(status);
  };

  /*
    Espaço = OK, Shift+Espaço = NG.

    Só valem aqui dentro, e só quando ninguém está digitando e nenhuma decisão
    está aberta na tela. O Lumavi registrava de qualquer aba, e isso é um jeito
    de logar um take sem estar olhando para a claquete.
  */
  useEffect(() => {
    if (!podeEditar) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (repetido || revisando) return;
      const alvo = e.target as HTMLElement | null;
      const digitando = alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(alvo.tagName));
      if (digitando) return;
      e.preventDefault();
      tentar(e.shiftKey ? 'NG' : 'OK');
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  const placar = contar(takes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <Rotulo icone={<ListVideo size={14} />}>Registrar</Rotulo>
          {podeEditar && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(estado.revisar_antes)}
                onChange={e => void mudarEstado(estado.diaria_id, { revisar_antes: e.target.checked })}
                style={{ width: '18px', height: '18px', accentColor: 'var(--cor-criativo)' }}
              />
              <span className="text-xs text-secondary">Perguntar antes de registrar</span>
            </label>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '10px' }}>
          {BOTOES.map(({ status, icone: Icone, atalho }) => (
            <BotaoTatil
              key={status}
              disabled={!podeEditar}
              onClick={() => tentar(status)}
              escala={0.96}
              title={atalho ? `${ROTULO_DO_STATUS[status]} · ${atalho}` : ROTULO_DO_STATUS[status]}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                minHeight: '64px', borderRadius: 'var(--radius-md)',
                border: `1.5px solid ${COR_DO_STATUS[status]}`,
                backgroundColor: `color-mix(in srgb, ${COR_DO_STATUS[status]} 12%, transparent)`,
                color: COR_DO_STATUS[status], fontWeight: 800, fontSize: '16px',
                cursor: podeEditar ? 'pointer' : 'default', opacity: podeEditar ? 1 : 0.45,
              }}
            >
              <Icone size={20} />
              {ROTULO_DO_STATUS[status]}
            </BotaoTatil>
          ))}
        </div>

        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Registrar guarda a claquete e o setup de agora, soma 1 no take e 1 no clipe, e limpa a observação.
          No computador: <strong>Espaço</strong> para OK, <strong>Shift+Espaço</strong> para NG.
        </p>

        <Decisao aberta={Boolean(revisando)}>
          {revisando && (
            <Caixa
              titulo={`Registrar este take como ${ROTULO_DO_STATUS[revisando]}?`}
              detalhe={`Cena ${estado.cena} · Plano ${estado.plano} · Take ${estado.take}`}
              acoes={[
                { rotulo: 'Registrar', principal: true, aoClicar: () => seguir(revisando) },
                { rotulo: 'Agora não', aoClicar: () => setRevisando(null) },
              ]}
            />
          )}
        </Decisao>

        <Decisao aberta={Boolean(repetido)}>
          {repetido && (
            <Caixa
              alerta
              titulo={`Já existe Cena ${estado.cena} · Plano ${estado.plano} · Take ${estado.take}.`}
              detalhe={`Registrado às ${repetido.take.hora} como ${ROTULO_DO_STATUS[repetido.take.status]}, no arquivo ${repetido.take.arquivo}.`}
              acoes={[
                {
                  rotulo: `Outro setup — plano ${claqueteDoAcrescimo(takes, estado).plano}`,
                  principal: true,
                  aoClicar: () => {
                    // Setup novo da mesma cena: o plano pula para a letra livre e
                    // o take volta para 1. É a convenção 1, 1A, 1B.
                    const mudanca = claqueteDoAcrescimo(takes, estado);
                    void mudarEstado(estado.diaria_id, mudanca).then(() =>
                      gravar(repetido.status, { ...estado, ...mudanca })
                    );
                  },
                },
                {
                  rotulo: 'Substituir o que está lá',
                  aoClicar: () => {
                    void substituirTake(repetido.take.id, estado, repetido.status).then(() => {
                      void mudarEstado(estado.diaria_id, { obs: '' });
                      setUltimo(repetido.take.id);
                      setRepetido(null);
                    });
                  },
                },
                { rotulo: 'Cancelar', aoClicar: () => setRepetido(null) },
              ]}
            />
          )}
        </Decisao>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <Rotulo icone={<ListVideo size={14} />}>Takes desta diária</Rotulo>
          <span className="text-xs text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {takes.length === 0 ? 'nenhum ainda' : `${takes.length} take${takes.length > 1 ? 's' : ''} · ${placar}`}
          </span>
        </div>

        {emOrdem.length === 0 ? (
          <p className="text-sm text-secondary" style={{ margin: 0 }}>
            O primeiro take da diária aparece aqui, e os novos entram por cima.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {emOrdem.map(t => (
              <LinhaDoTake key={t.id} take={t} novo={t.id === ultimo} podeEditar={podeEditar} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function contar(takes: Take[]) {
  const por = takes.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});
  return Object.entries(por).map(([s, n]) => `${n} ${ROTULO_DO_STATUS[s as StatusTake]}`).join(' · ');
}

/**
 * Uma linha da lista: o que foi rodado, em uma olhada.
 *
 * O take recém-registrado chega de cima e dá um pulso na cor do status — é o
 * recibo de que o toque virou registro, sem tirar ninguém da tela nem pedir
 * para fechar nada.
 */
function LinhaDoTake({ take, novo, podeEditar }: { take: Take; novo: boolean; podeEditar: boolean }) {
  const reduzido = useMovimentoReduzido();
  const cor = COR_DO_STATUS[take.status];

  const apagar = async () => {
    if (!(await confirmar({
      titulo: `Apagar o take ${take.cena}/${take.plano}/${take.take}?`,
      detalhe: `O arquivo ${take.arquivo} continua no cartão; o que some é o registro dele aqui.`,
      confirmar: 'Apagar',
      perigo: true,
    }))) return;
    await apagarTake(take.id);
    // A foto era daquele take e de mais ninguém; deixá-la ocuparia o aparelho
    // e o Storage para sempre, sem nada apontando para ela.
    if (take.foto) void apagarArquivo(take.foto);
  };

  return (
    <motion.div
      initial={reduzido ? false : { opacity: 0, y: -10 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: novo && !reduzido ? [`color-mix(in srgb, ${cor} 22%, transparent)`, 'var(--bg-primary)'] : 'var(--bg-primary)',
      }}
      transition={{ ...MOLA, backgroundColor: { duration: 1.1 } }}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
      }}
    >
      <span
        style={{
          minWidth: '68px', textAlign: 'center', padding: '4px 8px', borderRadius: 'var(--radius-sm)',
          border: `1px solid ${cor}`, color: cor, fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
        }}
      >
        {ROTULO_DO_STATUS[take.status]}
      </span>

      {take.foto && (
        <ImagemAnexo
          valor={take.foto}
          alt={`Referência do take ${take.cena}/${take.plano}/${take.take}`}
          estiloLink={{ display: 'block', width: '56px', height: '38px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-light)', flexShrink: 0 }}
          estiloImagem={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      )}

      <span className="text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {take.cena} · {take.plano} · take {take.take}
      </span>

      <span className="text-xs text-secondary" style={{ fontFamily: MONO }}>{take.arquivo}</span>
      <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>{take.hora}</span>

      {take.lente && <span className="text-xs text-muted">{take.lente}{take.abertura ? ` · ${take.abertura}` : ''}</span>}

      {take.obs && (
        <span className="text-xs text-secondary" style={{ flex: '1 1 100%', minWidth: 0 }}>{take.obs}</span>
      )}

      {podeEditar && (
        <button
          type="button"
          title="Apagar este take"
          aria-label="Apagar este take"
          onClick={() => void apagar()}
          style={{
            marginLeft: 'auto', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <Trash2 size={16} />
        </button>
      )}
    </motion.div>
  );
}

/** A decisão aparece embaixo dos botões, onde o dedo já está. */
function Decisao({ aberta, children }: { aberta: boolean; children: React.ReactNode }) {
  const reduzido = useMovimentoReduzido();
  return (
    <AnimatePresence initial={false}>
      {aberta && (
        <motion.div
          initial={reduzido ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduzido ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={reduzido ? { duration: 0 } : { ...MOLA, opacity: { duration: 0.15 } }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Caixa({ titulo, detalhe, acoes, alerta }: {
  titulo: string;
  detalhe?: string;
  alerta?: boolean;
  acoes: { rotulo: string; principal?: boolean; aoClicar: () => void }[];
}) {
  return (
    <div
      role="group"
      aria-label={titulo}
      style={{
        display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px',
        borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-active)',
        border: `1px solid ${alerta ? 'var(--color-warning)' : 'var(--border-light)'}`,
      }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        {alerta && <AlertTriangle size={18} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
          <span className="text-sm font-bold">{titulo}</span>
          {detalhe && <span className="text-xs text-secondary">{detalhe}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {acoes.map(a => (
          <BotaoTatil
            key={a.rotulo}
            onClick={a.aoClicar}
            style={{
              minHeight: '44px', padding: '0 16px', borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 700,
              border: a.principal ? 'none' : '1px solid var(--border-color)',
              backgroundColor: a.principal ? 'var(--cor-criativo)' : 'transparent',
              color: a.principal ? '#fff' : 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {a.rotulo}
          </BotaoTatil>
        ))}
      </div>
    </div>
  );
}
