import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { GitMerge, X, Check } from 'lucide-react';
import { db, escreverGanhandoDe } from '../db/db';
import { MOLA } from './ui/ia';
import type { ConflitoGuardado } from '../types';

/**
 * O que foi substituído, e a chance de trazer de volta.
 *
 * O passo 2 do PLANO-conflitos-sync guarda a nossa versão antes de o LWW passar
 * por cima. Este é o passo 3: mostrar as duas e deixar escolher. Sem ele, o dado
 * está salvo num canto do banco que ninguém abre — o que, para quem usa, é a
 * mesma coisa que ter sumido.
 *
 * A escolha é do REGISTRO INTEIRO, de propósito. Mesclar campo a campo exige a
 * versão base (passo 4), que ainda não existe; oferecer uma mescla sem base é
 * como inventar qual dos dois lados tinha razão.
 */

/** O nome que a pessoa usa para aquele registro, não o id. */
function comoChamar(tabela: string, r: Record<string, unknown> | null): string {
  if (!r) return 'um registro apagado';
  const numero = r.numero ? `Diária ${r.numero}` : null;
  const nome = [r.nome, r.sobrenome].filter(Boolean).join(' ').trim();
  return (numero || nome || (r.descricao as string) || (r.titulo as string) || (r.local_base as string) || tabela);
}

const ROTULO: Record<string, string> = {
  diarias: 'diária', tasks: 'task', despesas: 'despesa', perfis: 'ficha',
  locacoes: 'locação', documentos: 'documento', cenas: 'cena', eventos: 'evento',
};

/** Um valor de campo em uma linha legível. */
function mostrar(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? `${v.length} item(ns)` : 'vazio';
  if (typeof v === 'object') return '(dados)';
  if (typeof v === 'boolean') return v ? 'sim' : 'não';
  return String(v);
}

export function ConflitosPanel({ projetoId }: { projetoId: string }) {
  const [aberto, setAberto] = useState(false);
  const conflitos = useLiveQuery(
    async () => (await db.conflitos.where('projeto_id').equals(projetoId).toArray())
      .filter(c => !c.resolvido_em)
      .sort((a, b) => b.detectado_em - a.detectado_em),
    [projetoId]
  ) || [];

  if (!conflitos.length) return null;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '12px 16px', margin: '0 0 16px', borderRadius: '12px',
        background: 'var(--color-warning-bg)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
      }}>
        <GitMerge size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
        <div className="text-sm" style={{ flex: 1, minWidth: '200px', lineHeight: 1.45 }}>
          {conflitos.length === 1
            ? <>Uma alteração sua foi substituída pela de outra pessoa. <strong>Ela não se perdeu</strong> — dá para ver e escolher.</>
            : <><strong>{conflitos.length} alterações suas</strong> foram substituídas pelas de outras pessoas. Elas não se perderam.</>}
        </div>
        <button className="btn btn-primary" onClick={() => setAberto(true)} style={{ flexShrink: 0 }}>
          Ver e escolher
        </button>
      </div>

      {aberto && <Janela conflitos={conflitos} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function Janela({ conflitos, aoFechar }: { conflitos: ConflitoGuardado[]; aoFechar: () => void }) {
  const [erro, setErro] = useState('');
  const [mexendo, setMexendo] = useState('');

  /*
    "Usar a minha" reescreve o registro com a versão guardada e carimbo de
    agora: o hook do Dexie a põe na fila e ela sobe como qualquer edição. Não é
    um caminho especial de sincronização — é uma edição normal, feita pela
    pessoa, que por acaso tem o conteúdo antigo.
  */
  const escolher = async (c: ConflitoGuardado, escolha: 'minha' | 'servidor') => {
    setMexendo(c.id);
    setErro('');
    try {
      if (escolha === 'minha' && c.versao_local) {
        const dados = { ...(c.versao_local as Record<string, unknown>) };
        delete dados.atualizado_em;
        // Tem que ganhar do carimbo que está valendo, senão a volta seria
        // descartada pelo mesmo LWW — inclusive com o relógio do outro
        // aparelho adiantado.
        const doServidor = Number((c.versao_remota as { atualizado_em?: number } | null)?.atualizado_em ?? 0);
        escreverGanhandoDe(doServidor);
        await db.table(c.tabela).put(dados);
      }
      await db.conflitos.update(c.id, { resolvido_em: Date.now(), escolha });
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui aplicar a sua versão.');
    } finally {
      setMexendo('');
    }
  };

  return createPortal(
    <div
      onClick={aoFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 3950, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: '16px', padding: '20px', width: 'min(640px, 100%)',
          maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <GitMerge size={20} style={{ color: 'var(--color-warning)' }} />
          <h2 style={{ margin: 0, fontSize: '18px', flex: 1 }}>O que foi substituído</h2>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <p className="text-xs text-muted" style={{ marginBottom: '18px', lineHeight: 1.5 }}>
          Duas pessoas mexeram no mesmo registro. A versão de quem salvou por último
          ficou valendo, e a sua foi guardada aqui, neste aparelho.
        </p>

        {erro && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', marginBottom: '14px', fontSize: '13px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
            {erro}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {conflitos.map(c => {
            const local = c.versao_local as Record<string, unknown>;
            const remota = c.versao_remota as Record<string, unknown> | null;
            return (
              <div key={c.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px' }}>
                <div className="text-sm font-bold" style={{ marginBottom: '2px' }}>
                  {ROTULO[c.tabela] || c.tabela} · {comoChamar(c.tabela, remota || local)}
                </div>
                <div className="text-xs text-muted" style={{ marginBottom: '12px' }}>
                  {new Date(c.detectado_em).toLocaleString('pt-BR')}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {c.campos_em_disputa.length === 0 && (
                    <span className="text-sm text-muted">Nada em disputa além do carimbo de hora.</span>
                  )}
                  {c.campos_em_disputa.map(campo => (
                    <div key={campo} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 1fr 1fr', gap: '8px', alignItems: 'baseline' }}>
                      <span className="text-xs text-muted" style={{ textTransform: 'capitalize' }}>{campo.replace(/_/g, ' ')}</span>
                      <span className="text-sm" style={{ color: 'var(--color-warning)' }}>{mostrar(local?.[campo])}</span>
                      <span className="text-sm text-secondary">{mostrar(remota?.[campo])}</span>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 1fr) 1fr 1fr', gap: '8px' }}>
                    <span />
                    <span className="text-xs text-muted">a sua</span>
                    <span className="text-xs text-muted">a que está valendo</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={mexendo === c.id} onClick={() => escolher(c, 'minha')}>
                    Usar a minha de volta
                  </button>
                  <button className="btn" disabled={mexendo === c.id} onClick={() => escolher(c, 'servidor')}>
                    <Check size={14} style={{ marginRight: '6px' }} /> Manter a que está valendo
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
