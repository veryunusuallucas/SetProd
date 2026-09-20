import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { ouvirConexao, frasesDaConexao, type Conexao } from '../lib/conexao';
import { rodada } from '../lib/sincronizacaoAutomatica';
import { useMovimentoReduzido } from './ui/movimento';
import { MOLA } from './ui/ia';
import { dataHora } from '../lib/formato';

/**
 * "Meu trabalho está salvo?" — em qualquer tela (PLANO-indicador-conexao).
 *
 * O rodapé da sidebar já respondia isso, mas só no computador e só com a
 * sidebar à vista. No celular, que é o aparelho do set, não havia resposta
 * nenhuma — e é lá que a pergunta aparece, quando a locação não tem sinal.
 *
 * DECISÕES QUE O PLANO PEDE, E O PORQUÊ DE CADA UMA
 * · Um componente só, montado uma vez no App: um por tela garante que alguma
 *   fica sem.
 * · Ícone pequeno, detalhe ao toque. Texto permanente rouba a tela do trabalho.
 * · Offline NÃO é vermelho. Só o offline COM trabalho parado chama atenção,
 *   porque só ele tem o que fazer: não fechar o app, procurar sinal.
 * · Nada gira para sempre: animação contínua come bateria e atenção. Gira só
 *   enquanto sobe, e nem isso para quem pediu menos movimento.
 * · A cor não carrega a informação sozinha — o ícone riscado carrega. Daltonismo
 *   e tela no sol do set.
 */
export function IndicadorConexao() {
  /*
    O id sai do ENDEREÇO, não de `useParams`: este componente vive fora das
    rotas (é montado uma vez, no App), e ali `useParams` volta sempre vazio —
    o indicador nunca saberia em que produção a pessoa está.
  */
  const { pathname } = useLocation();
  const projetoId = pathname.match(/\/projeto\/([^/]+)/)?.[1];
  const [conexao, setConexao] = useState<Conexao>({ estado: 'conectado', pendentes: 0, aoVivo: false });
  const [aberto, setAberto] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const reduzido = useMovimentoReduzido();

  useEffect(() => ouvirConexao(projetoId, setConexao), [projetoId]);

  const { curta, longa } = frasesDaConexao(conexao);
  const { Icone, cor, chama } = aparencia(conexao);

  const agora = async () => {
    if (!projetoId) return;
    setSincronizando(true);
    try { await rodada(projetoId); } finally { setSincronizando(false); }
  };

  return (
    <>
      <button
        ref={botao}
        onClick={() => setAberto(a => !a)}
        aria-label={longa}
        title={longa}
        /*
          No computador ele some SÓ dentro de uma produção, onde o rodapé da
          barra lateral já responde a mesma pergunta. Na tela inicial e no
          login não há barra lateral nenhuma — lá ele fica em todo tamanho.
          (E o `display` mora no CSS: escrito aqui, ele vencia a regra que
          esconde, porque estilo no elemento ganha de folha de estilo.)
        */
        className={`indicador-conexao${projetoId ? ' so-no-celular' : ''}`}
        style={{
          padding: chama ? '6px 10px' : '6px', borderRadius: '999px',
          background: chama ? 'var(--color-warning-bg)' : 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
          border: `1px solid ${chama ? 'color-mix(in srgb, var(--color-warning) 45%, transparent)' : 'var(--border-light)'}`,
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          color: cor, cursor: 'pointer',
        }}
      >
        <motion.span
          style={{ display: 'flex' }}
          animate={conexao.estado === 'salvando' && !reduzido ? { rotate: 360 } : { rotate: 0 }}
          transition={conexao.estado === 'salvando' && !reduzido
            ? { repeat: Infinity, duration: 1.6, ease: 'linear' }
            : MOLA}
        >
          <Icone size={16} />
        </motion.span>
        {/* O número só aparece quando há trabalho parado: é a única informação
            que muda o que a pessoa faz agora. */}
        {chama && <span className="text-xs font-bold">{conexao.pendentes}</span>}
      </button>

      {/* Para quem usa leitor de tela: a mudança é anunciada sem interromper. */}
      <span aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {curta}
      </span>

      <AnimatePresence>
        {aberto && (
          <Detalhe
            conexao={conexao}
            longa={longa}
            podeSincronizar={Boolean(projetoId)}
            sincronizando={sincronizando}
            aoSincronizar={agora}
            aoFechar={() => setAberto(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function aparencia(c: Conexao) {
  if (c.estado === 'erro') return { Icone: AlertTriangle, cor: 'var(--color-danger)', chama: true };
  if (c.estado === 'offline_sujo') return { Icone: CloudOff, cor: 'var(--color-warning)', chama: true };
  if (c.estado === 'offline_limpo') return { Icone: CloudOff, cor: 'var(--text-secondary)', chama: false };
  if (c.estado === 'salvando') return { Icone: RefreshCw, cor: 'var(--text-secondary)', chama: false };
  return { Icone: Cloud, cor: 'var(--text-secondary)', chama: false };
}

function Detalhe({
  conexao, longa, podeSincronizar, sincronizando, aoSincronizar, aoFechar,
}: {
  conexao: Conexao;
  longa: string;
  podeSincronizar: boolean;
  sincronizando: boolean;
  aoSincronizar: () => void;
  aoFechar: () => void;
}) {
  return createPortal(
    <div onClick={aoFechar} style={{ position: 'fixed', inset: 0, zIndex: 3960 }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 56px)', right: '12px',
          width: 'min(300px, calc(100vw - 24px))',
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '14px', padding: '14px', boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }}
      >
        <p className="text-sm" style={{ margin: 0, lineHeight: 1.5 }}>{longa}</p>

        {conexao.ultimaVez && (
          <p className="text-xs text-muted" style={{ margin: '8px 0 0' }}>
            Última sincronização: {dataHora(conexao.ultimaVez)}
          </p>
        )}

        {podeSincronizar && (
          <button
            className="btn"
            onClick={aoSincronizar}
            disabled={sincronizando}
            style={{ marginTop: '12px', width: '100%' }}
          >
            {sincronizando
              ? <><RefreshCw size={14} style={{ marginRight: '6px' }} /> Sincronizando…</>
              : <><Check size={14} style={{ marginRight: '6px' }} /> Sincronizar agora</>}
          </button>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
