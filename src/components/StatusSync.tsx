import { useEffect, useState } from 'react';
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

  return (
    <>
      <button
        className="sidebar-link"
        onClick={() => setAtaAberta(true)}
        title={aoVivo ? 'Conectado ao vivo com a outra equipe' : 'Conferindo de tempos em tempos'}
        style={{ width: '100%' }}
      >
        <span style={{ color: cor, display: 'flex', alignItems: 'center' }}>{icone}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{texto}</span>
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
  if (estado === 'offline') {
    return { icone: <CloudOff size={16} />, texto: 'Offline', cor: 'var(--text-secondary)' };
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
  const [linhas, setLinhas] = useState<LinhaDaAta[] | null>(null);
  const [tamanho, setTamanho] = useState<{ dados: number; anexos: number; total: number } | null>(null);

  useEffect(() => {
    montarAta(projetoId).then(setLinhas).catch(() => setLinhas([]));
    tamanhoAproximado(projetoId).then(setTamanho).catch(() => setTamanho(null));
  }, [projetoId]);

  return (
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
          backgroundColor: 'var(--bg-surface)', borderRadius: '16px',
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
    </div>
  );
}
