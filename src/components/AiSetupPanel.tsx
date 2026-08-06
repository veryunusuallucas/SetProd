import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, ListTree, PenLine, Check } from 'lucide-react';
import { AIButton } from './ui/AIButton';
import { AIThinking } from './ui/ia';
import { DEPARTAMENTOS, DEPARTAMENTOS_PADRAO_IA } from '../lib/decupagem';

export type ModoProcessamento = 'FULL_BREAKDOWN' | 'SCENES_ONLY' | 'MANUAL';

interface AiSetupPanelProps {
  totalPaginas: number;
  processando: boolean;
  progresso?: { feito: number; total: number } | null;
  onProcessar: (config: { modo: ModoProcessamento; departamentos: string[]; minucioso: boolean }) => void;
}

const MODOS: { id: ModoProcessamento; icone: React.ReactNode; titulo: string; descricao: string }[] = [
  {
    id: 'FULL_BREAKDOWN',
    icone: <Layers size={18} />,
    titulo: 'Análise completa',
    descricao: 'Separa as cenas e marca os elementos por departamento no PDF.',
  },
  {
    id: 'SCENES_ONLY',
    icone: <ListTree size={18} />,
    titulo: 'Só as cenas',
    descricao: 'Segmenta os cabeçalhos e monta as tiras do stripboard.',
  },
  {
    id: 'MANUAL',
    icone: <PenLine size={18} />,
    titulo: 'Faço na mão',
    descricao: 'Nada de IA. Você marca selecionando o texto no PDF.',
  },
];

/**
 * Etapa 1 da decupagem: depois do PDF lido, o usuário escolhe o que a IA faz.
 * Fica na própria tela (não em modal) porque a escolha faz parte do fluxo —
 * em modal, a pessoa decide no susto e perde o contexto do arquivo enviado.
 */
export function AiSetupPanel({ totalPaginas, processando, progresso, onProcessar }: AiSetupPanelProps) {
  const [modo, setModo] = useState<ModoProcessamento>('FULL_BREAKDOWN');
  const [departamentos, setDepartamentos] = useState<string[]>(DEPARTAMENTOS_PADRAO_IA);
  const [minucioso, setMinucioso] = useState(false);

  const alternarDepto = (chave: string) => {
    setDepartamentos(atual =>
      atual.includes(chave) ? atual.filter(d => d !== chave) : [...atual, chave]
    );
  };

  const mostraDeptos = modo === 'FULL_BREAKDOWN';
  const semDepto = mostraDeptos && departamentos.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      <div>
        <h3 className="text-lg font-bold">O que fazer com o roteiro?</h3>
        <p className="text-xs text-muted mt-1">
          {totalPaginas} página(s) prontas. A IA sugere — você revisa, edita e apaga o que quiser depois.
        </p>
      </div>

      {/* Modos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
        {MODOS.map(m => {
          const ativo = modo === m.id;
          return (
            <motion.button
              key={m.id}
              onClick={() => setModo(m.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px',
                padding: '14px 16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'left',
                border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border-light)'}`,
                backgroundColor: ativo ? 'var(--bg-active)' : 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: ativo ? 'var(--accent)' : 'var(--text-muted)' }}>
                {m.icone}
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{m.titulo}</span>
              </span>
              <span className="text-xs text-muted">{m.descricao}</span>

              {ativo && (
                <motion.span
                  layoutId="modo-ativo"
                  style={{
                    position: 'absolute', inset: -1, borderRadius: '12px',
                    border: '2px solid var(--accent)', pointerEvents: 'none',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Departamentos */}
      <AnimatePresence initial={false}>
        {mostraDeptos && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span className="text-xs text-secondary font-bold uppercase tracking-widest">
                  Departamentos a extrair
                </span>
                <button
                  onClick={() => setDepartamentos(
                    departamentos.length === DEPARTAMENTOS.length ? [] : DEPARTAMENTOS.map(d => d.chave)
                  )}
                  className="text-xs text-accent"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {departamentos.length === DEPARTAMENTOS.length ? 'limpar' : 'marcar todos'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {DEPARTAMENTOS.map(d => {
                  const ligado = departamentos.includes(d.chave);
                  return (
                    <motion.button
                      key={d.chave}
                      onClick={() => alternarDepto(d.chave)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '7px 12px', borderRadius: '20px', cursor: 'pointer',
                        fontSize: '12px', fontWeight: 700,
                        border: `1px solid ${ligado ? d.border : 'var(--border-light)'}`,
                        backgroundColor: ligado ? d.bg : 'transparent',
                        color: ligado ? '#fff' : 'var(--text-muted)',
                        transition: 'background-color 0.15s, color 0.15s',
                      }}
                    >
                      <motion.span
                        animate={{ scale: ligado ? 1 : 0, width: ligado ? 12 : 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: 'inline-flex', overflow: 'hidden' }}
                      >
                        <Check size={12} />
                      </motion.span>
                      {d.rotulo}
                    </motion.button>
                  );
                })}
              </div>

              {semDepto && (
                <span className="text-xs text-danger">Escolha ao menos um departamento.</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado "a IA está trabalhando" — mesmo componente de todos os pontos
          de IA do app, para o comportamento ser sempre o mesmo. */}
      <AnimatePresence>
        {processando && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <AIThinking
              // No modo minucioso cada cena rende duas etapas, então contar
              // "cena" aqui mentiria o total.
              texto={progresso ? `Analisando — etapa ${progresso.feito} de ${progresso.total}` : 'Preparando a análise...'}
              progresso={progresso}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {mostraDeptos ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={minucioso}
              onChange={e => setMinucioso(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
            />
            <span>
              Análise minuciosa
              <span className="text-muted"> — relê cada cena procurando o que escapou. Demora o dobro.</span>
            </span>
          </label>
        ) : <span />}

        {modo === 'MANUAL' ? (
          <button
            onClick={() => onProcessar({ modo, departamentos: [], minucioso: false })}
            className="btn-primary"
            style={{ padding: '10px 20px' }}
          >
            Abrir o roteiro
          </button>
        ) : (
          <AIButton
            onClick={() => !semDepto && onProcessar({ modo, departamentos, minucioso })}
            loading={processando}
            loadingText="Processando..."
            disabled={semDepto}
          >
            {minucioso ? 'Analisar com calma' : 'Analisar roteiro'}
          </AIButton>
        )}
      </div>
    </motion.div>
  );
}
