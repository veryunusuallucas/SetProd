import { useEffect, useState } from 'react';
import { lerConexao, frasesDaConexao } from '../lib/conexao';
import { dataHora } from '../lib/formato';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, RefreshCw, Check, X, History, AlertTriangle } from 'lucide-react';
import { ouvirSync, situacaoDe, estaAoVivo, rodada } from '../lib/sincronizacaoAutomatica';
import { tamanhoAproximado } from '../lib/sincronizacao';
import { montarAta, quandoFoi, type LinhaDaAta } from '../lib/ata';
import { formatarTamanho } from '../lib/documentos';
import { MOLA } from './ui/ia';

/**
 * O rodapé da sidebar: em que pé está a sincronização, e o que andou acontecendo.
 *
 * Substitui o antigo seletor "Quem está usando?" (§3.5 da spec). Aquele
 * simulava papel; este mostra fato — se o que você fez já saiu daqui, e o que
 * a outra equipe fez enquanto você não olhava.
 */
export function StatusSync({ projetoId }: { projetoId: string }) {
  const [, redesenhar] = useState(0);
  const [ataAberta, setAtaAberta] = useState(false);

  // O estado do sync vive fora do React (é global e assíncrono), então a tela
  // se inscreve nele em vez de recebê-lo por prop.
  useEffect(() => ouvirSync(() => redesenhar(n => n + 1)), []);

  const situacao = situacaoDe(projetoId);
  const aoVivo = estaAoVivo(projetoId);

  const { icone, texto, cor } = descrever(situacao.estado, situacao.pendentes);
  const { longa } = frasesDaConexao(lerConexao(projetoId));

  return (
    <>
      <button
        className="sidebar-link"
        onClick={() => setAtaAberta(true)}
        title={longa}
        style={{ width: '100%' }}
      >
        <span style={{ color: cor, display: 'flex', alignItems: 'center' }}>{icone}</span>
        {/*
          Texto CURTO aqui. A barra tem 240px, e a frase inteira ("Sem conexão ·
          tudo salvo") era cortada no meio — um rodapé que diz "Sem conexão ·
          tudo sa…" assusta em vez de tranquilizar, que é o contrário do que ele
          existe para fazer. A frase inteira está no título e na ata.
        */}
        <span style={{ flex: 1, textAlign: 'left', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{texto}</span>
        <History size={14} className="text-muted" />
      </button>

      <AnimatePresence>
        {ataAberta && (
          <ModalAta projetoId={projetoId} aoVivo={aoVivo} aoFechar={() => setAtaAberta(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

function descrever(estado: string, pendentes: number) {
  /*
    OFFLINE NÃO É UMA COISA SÓ (PLANO-indicador-conexao). "Offline" seco deixava
    a pergunta que importa sem resposta: o que eu fiz está salvo? Sem pendência,
    é sossego; com pendência, é a única hora em que a pessoa precisa agir — não
    fechar o app e procurar sinal antes de sair da locação.
  */
  if (estado === 'offline') {
    return pendentes > 0
      ? { icone: <CloudOff size={16} />, texto: `Sem conexão · ${pendentes}`, cor: 'var(--color-warning)' }
      : { icone: <CloudOff size={16} />, texto: 'Salvo neste aparelho', cor: 'var(--text-secondary)' };
  }
  if (estado === 'erro') {
    return { icone: <AlertTriangle size={16} />, texto: 'Erro ao salvar', cor: 'var(--color-danger)' };
  }
  if (estado === 'sincronizando') {
    return {
      // A rotação é a única parte animada: um "Salvando…" parado parece travado.
      icone: <RefreshCw size={16} className="girando" />,
      texto: 'Salvando…',
      cor: 'var(--text-secondary)',
    };
  }
  if (pendentes > 0) {
    return { icone: <Cloud size={16} />, texto: `${pendentes} para enviar`, cor: 'var(--text-secondary)' };
  }
  return { icone: <Check size={16} />, texto: 'Salvo', cor: 'var(--color-success, #4ade80)' };
}

function ModalAta({ projetoId, aoVivo, aoFechar }: { projetoId: string; aoVivo: boolean; aoFechar: () => void }) {
  const conexao = lerConexao(projetoId);
  const [linhas, setLinhas] = useState<LinhaDaAta[] | null>(null);
  const [tamanho, setTamanho] = useState<{ dados: number; anexos: number; total: number } | null>(null);

  useEffect(() => {
    montarAta(projetoId).then(setLinhas).catch(() => setLinhas([]));
    tamanhoAproximado(projetoId).then(setTamanho).catch(() => setTamanho(null));
  }, [projetoId]);

  /*
    Portal, pelo mesmo motivo do manual do usuário: este componente mora dentro
    da `.sidebar`, que é `position: fixed; z-index: 50`. Isso é um contexto de
    empilhamento — o `z-index: 300` daqui de dentro só disputaria com irmãos da
    sidebar, e a barra inferior do celular (`z-index: 1000`) passaria por cima.
  */
  return createPortal(
    <div
      onClick={aoFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 300, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold">O que andou acontecendo</h2>
            <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
              {aoVivo
                ? 'Conectado ao vivo — o que a outra equipe faz aparece em segundos.'
                : 'Sem conexão ao vivo; o app confere de tempos em tempos.'}
            </p>
          </div>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        </div>

        {/*
          O ESTADO DO SALVAMENTO, ANTES DA LISTA (pedido do Lucas, 20/09/2026).

          A ata é o lugar onde a pessoa vem quando desconfia — "será que subiu?".
          Chegar aqui e ler só o histórico não responde a pergunta que a trouxe.
          Esta faixa responde, e responde também offline: a ata é montada do
          banco deste aparelho, então ela existe inteira sem internet.
        */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
          padding: '12px 14px', marginBottom: '16px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-primary)', border: '1px solid var(--border-light)',
        }}>
          <span style={{ display: 'flex', color: conexao.estado === 'offline_sujo' ? 'var(--color-warning)' : 'var(--color-success, #4ade80)' }}>
            {conexao.estado.startsWith('offline') ? <CloudOff size={18} /> : <Check size={18} />}
          </span>
          <span className="text-sm" style={{ flex: 1, minWidth: '180px', lineHeight: 1.45 }}>
            {frasesDaConexao(conexao).longa}
          </span>
          {conexao.ultimaVez && (
            <span className="text-xs text-muted">
              última vez: {dataHora(conexao.ultimaVez)}
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', margin: '0 -8px', padding: '0 8px' }}>
          {linhas === null && <p className="text-sm text-muted">Montando…</p>}
          {linhas?.length === 0 && (
            <p className="text-sm text-muted">
              Ainda não há nada registrado nesta produção.
            </p>
          )}
          {linhas?.map(l => (
            <div
              key={l.id}
              style={{
                display: 'flex', alignItems: 'baseline', gap: '10px',
                padding: '10px 0', borderBottom: '1px solid var(--border-light)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm">
                  <strong style={{ color: l.souEu ? 'var(--text-primary)' : 'var(--accent)' }}>{l.quem}</strong>
                  {' '}{l.frase.slice(l.quem.length + 1)}
                </div>
                {l.detalhe && <div className="text-xs text-muted truncate">{l.detalhe}</div>}
              </div>
              <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{quandoFoi(l.quando)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
          <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            {tamanho ? (
              <>
                Esta produção ocupa <strong>~{formatarTamanho(tamanho.total) || '0 B'}</strong>
                {tamanho.anexos > 0 && <> — sendo {formatarTamanho(tamanho.anexos)} em anexos</>}.
                {' '}É uma estimativa medida neste aparelho; o número oficial fica no painel do Supabase.
              </>
            ) : (
              'Calculando o tamanho…'
            )}
          </div>

          <button
            className="btn"
            onClick={() => rodada(projetoId)}
            style={{ marginTop: '12px', width: '100%', justifyContent: 'center' }}
          >
            <RefreshCw size={14} /> Sincronizar agora
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
