import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Check, X, Star, RefreshCw, Trash2, ListVideo, AlertTriangle, Pencil } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, StatusTake, Take } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import { ImagemAnexo } from '../ImagemAnexo';
import { apagarArquivo } from '../../lib/arquivos';
import { Abre, MONO, Rotulo } from './pecas';
import {
  COR_DO_STATUS, ROTULO_DO_STATUS, acharDuplicado, apagarTake, claqueteDoAcrescimo, claqueteLegivel,
  registrarTake, substituirTake,
} from '../../lib/logagem/takes';
import { mudarEstado } from '../../lib/logagem/estado';
import { EditarTake } from './EditarTake';

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

export interface Registro {
  takes: Take[];
  /** O último take registrado nesta tela, para a lista dar o pulso nele. */
  ultimo: string;
  tentar: (status: StatusTake) => void;
  decisoes: React.ReactNode;
  /** Há uma pergunta aberta: os botões continuam no lugar, mas esperam. */
  decidindo: boolean;
}

/**
 * O registro do take, sem desenho: quem o chama decide onde ficam os botões.
 *
 * Saiu do componente que desenhava tudo junto porque a leva de UI pôs a
 * claquete e os botões num bloco só, e a lista lá embaixo. Os dois precisam da
 * mesma verdade — o último take, a pergunta aberta —, e duas cópias dela
 * seriam duas telas discordando.
 */
export function useRegistroDeTake(estado: EstadoDaLogagem, podeEditar: boolean, quem?: string): Registro {
  const takes = useLiveQuery(
    () => db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
    [estado.diaria_id]
  ) ?? [];

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

    Só valem na aba Logagem, e só quando ninguém está digitando e nenhuma
    decisão está aberta na tela. O Lumavi registrava de qualquer aba, e isso é
    um jeito de logar um take sem estar olhando para a claquete.
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

  const decisoes = (
    <>
      <Abre aberto={Boolean(revisando)}>
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
      </Abre>

      <Abre aberto={Boolean(repetido)}>
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
      </Abre>
    </>
  );

  return { takes, ultimo, tentar, decisoes, decidindo: Boolean(repetido || revisando) };
}

/**
 * Os quatro botões. Grandes, de cor cheia, e SEMPRE no mesmo lugar e na mesma
 * ordem: quem loga aperta olhando para o set, não para a tela — um botão que
 * muda de lugar vira take com status errado, e status errado é pior que take
 * faltando, porque ninguém vai conferir.
 */
export function BotoesDeStatus({ registro, podeEditar }: { registro: Registro; podeEditar: boolean }) {
  return (
    <div className="status-grade" role="group" aria-label="Registrar o take">
      {BOTOES.map(({ status, icone: Icone, atalho }) => (
        <BotaoTatil
          key={status}
          className="botao-status"
          data-status={status}
          disabled={!podeEditar}
          onClick={() => registro.tentar(status)}
          escala={0.95}
          title={atalho ? `${ROTULO_DO_STATUS[status]} · ${atalho}` : ROTULO_DO_STATUS[status]}
        >
          <Icone size={20} strokeWidth={2.6} aria-hidden />
          {status === 'RECINV' ? 'REC INV.' : ROTULO_DO_STATUS[status]}
        </BotaoTatil>
      ))}
    </div>
  );
}

/**
 * A lista do que já foi rodado, do mais novo para o mais velho.
 *
 * Com `limite`, mostra só os últimos — é o modo Foco, onde a tela é para
 * registrar e não para conferir, e uma lista de quarenta takes empurraria os
 * botões para fora do alcance do polegar.
 */
export function ListaDeTakes({ takes, ultimo, podeEditar, limite, titulo = 'Takes desta diária' }: {
  takes: Take[];
  ultimo?: string;
  podeEditar: boolean;
  limite?: number;
  titulo?: string;
}) {
  const emOrdem = [...takes].sort((a, b) => (b.ordem || 0) - (a.ordem || 0));
  const mostrados = limite ? emOrdem.slice(0, limite) : emOrdem;
  const escondidos = emOrdem.length - mostrados.length;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <Rotulo icone={<ListVideo size={14} />}>{titulo}</Rotulo>
        <span className="text-xs text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {takes.length === 0 ? 'nenhum ainda' : `${takes.length} take${takes.length > 1 ? 's' : ''} · ${contar(takes)}`}
        </span>
      </div>

      {mostrados.length === 0 ? (
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          O primeiro take da diária aparece aqui, e os novos entram por cima.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mostrados.map(t => (
            <LinhaDoTake key={t.id} take={t} novo={t.id === ultimo} podeEditar={podeEditar} />
          ))}
        </div>
      )}

      {escondidos > 0 && (
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          e mais {escondidos} take{escondidos > 1 ? 's' : ''} nesta diária — a lista inteira está na visão Detalhada.
        </p>
      )}
    </section>
  );
}

/*
  OK, NG e HERO são siglas e não variam. "Importado" e "REC invertido" são
  palavras — "42 Importado" lê como erro de digitação.
*/
const NO_PLACAR: Record<StatusTake, string> = { OK: 'OK', NG: 'NG', HERO: 'HERO', RECINV: 'REC invertido', IMPORT: 'importado' };
const NO_PLACAR_PLURAL: Record<StatusTake, string> = { OK: 'OK', NG: 'NG', HERO: 'HERO', RECINV: 'REC invertidos', IMPORT: 'importados' };

function contar(takes: Take[]) {
  const por = takes.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {});
  return Object.entries(por)
    .map(([s, n]) => `${n} ${(n === 1 ? NO_PLACAR : NO_PLACAR_PLURAL)[s as StatusTake]}`)
    .join(' · ');
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
  const [editando, setEditando] = useState(false);

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
      /*
        Só o take RECÉM-REGISTRADO chega animado. Os que já estavam ali nascem
        prontos: uma linha que começa invisível some de vez se os quadros não
        rodarem (aba em segundo plano, aparelho economizando bateria), e a
        lista do que foi rodado não pode depender de animação para existir.
      */
      initial={novo && !reduzido ? { opacity: 0, y: -10 } : false}
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
        {claqueteLegivel(take)}
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
          title="Corrigir este take"
          aria-label="Corrigir este take"
          aria-expanded={editando}
          onClick={() => setEditando(v => !v)}
          style={{
            marginLeft: 'auto', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 'var(--radius-sm)', background: editando ? 'var(--bg-active)' : 'none',
            color: editando ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <Pencil size={16} />
        </button>
      )}

      {podeEditar && (
        <button
          type="button"
          title="Apagar este take"
          aria-label="Apagar este take"
          onClick={() => void apagar()}
          style={{
            width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <Trash2 size={16} />
        </button>
      )}

      {podeEditar && (
        <div style={{ flex: '1 1 100%', minWidth: 0 }}>
          <Abre aberto={editando}>
            {editando && <EditarTake take={take} aoFechar={() => setEditando(false)} />}
          </Abre>
        </div>
      )}
    </motion.div>
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
