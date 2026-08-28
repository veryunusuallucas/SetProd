import { useState, type ReactNode } from 'react';
import { MOLA, PASSO_STAGGER, useMovimentoReduzido } from './movimento';
import { BotaoTatil } from './BotaoTatil';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X } from 'lucide-react';

/**
 * Linguagem visual dos momentos de IA.
 *
 * ⚠️ O ESCOPO AQUI É O CAPRICHO VISUAL, NÃO O MOVIMENTO.
 *
 * Este arquivo dizia que o capricho valia só onde a IA aparece, e misturava
 * duas coisas diferentes sob essa regra. A física — mola, resposta no toque,
 * movimento reduzido — foi promovida para `ui/movimento.ts` e vale no app
 * inteiro: ela é o que separa fluido de travado, não é enfeite.
 *
 * O que continua exclusivo daqui é o ENFEITE COM SIGNIFICADO: borda com
 * gradiente, brilho, `Sparkles`. Ele marca saída de máquina, e quem lê precisa
 * saber que aquilo é sugestão e não fato apurado. Espalhar isso pelo app
 * deixaria tudo barulhento e, pior, faria o brilho perder o sentido.
 *
 * As molas continuam reexportadas abaixo para nenhum import existente quebrar.
 */

// ---- Fundamentos ----

/**
 * A física mora em `ui/movimento.ts`, e é global.
 *
 * Reexportado daqui porque meia dúzia de telas já importavam destas linhas — e
 * uma migração de import não é motivo para mexer em arquivo que está certo.
 */
export { MOLA, MOLA_GESTO, PASSO_STAGGER, useMovimentoReduzido } from './movimento';

// ---- Pensando ----

interface AIThinkingProps {
  texto?: string;
  /** Quando informado, mostra a barra de progresso real em vez do vaivém. */
  progresso?: { feito: number; total: number } | null;
}

/**
 * O estado "a IA está trabalhando".
 *
 * Não é um spinner: spinner gira igual tenha passado um segundo ou trinta, e
 * por isso vira ansiedade. Aqui a barra tem um brilho que percorre — sinal de
 * vida, sem prometer prazo. Havendo progresso real, ele manda.
 */
export function AIThinking({ texto = 'Pensando...', progresso }: AIThinkingProps) {
  const reduzido = useMovimentoReduzido();
  const pct = progresso && progresso.total > 0
    ? Math.round((progresso.feito / progresso.total) * 100)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <motion.span
          style={{ display: 'inline-flex', color: '#c77dff' }}
          animate={reduzido ? { opacity: [0.5, 1, 0.5] } : { scale: [1, 1.18, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Sparkles size={15} />
        </motion.span>
        <span className="text-sm text-secondary" style={{ flex: 1 }}>{texto}</span>
        {pct !== null && <span className="text-xs font-bold text-accent">{pct}%</span>}
      </div>

      <div style={{
        position: 'relative', height: '5px', borderRadius: '3px',
        backgroundColor: 'var(--bg-primary)', overflow: 'hidden',
      }}>
        {pct !== null ? (
          <motion.div
            animate={{ width: `${pct}%` }}
            transition={MOLA}
            style={{ height: '100%', background: 'linear-gradient(90deg, #9d4edd, #4cc9f0)' }}
          />
        ) : reduzido ? (
          <motion.div
            animate={{ opacity: [0.35, 0.9, 0.35] }}
            transition={{ duration: 1.6, repeat: Infinity }}
            style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #9d4edd, #4cc9f0)' }}
          />
        ) : (
          <motion.div
            animate={{ x: ['-60%', '160%'] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', top: 0, height: '100%', width: '40%',
              background: 'linear-gradient(90deg, transparent, #9d4edd, #4cc9f0, transparent)',
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---- Lista com entrada escalonada ----

/**
 * Container das sugestões: elas entram uma após a outra, não todas de vez.
 *
 * O escalonamento existe para o olho conseguir acompanhar. Cinco cartões
 * aparecendo no mesmo frame viram um bloco só; espaçados por 50ms, viram uma
 * lista que a pessoa lê.
 */
export function AISuggestionList({ children }: { children: ReactNode }) {
  const reduzido = useMovimentoReduzido();

  return (
    <motion.div
      initial="oculto"
      animate="visivel"
      variants={{
        visivel: { transition: { staggerChildren: reduzido ? 0 : PASSO_STAGGER } },
      }}
      style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
    >
      {/* Sem `initial={false}` aqui: essa opção manda pular a animação de
          entrada dos itens já presentes na primeira renderização — ou seja,
          desligaria exatamente o escalonamento que este container existe para
          fazer. A saída animada continua funcionando. */}
      <AnimatePresence>{children}</AnimatePresence>
    </motion.div>
  );
}

interface AISuggestionProps {
  children: ReactNode;
  onAceitar?: () => void;
  onRecusar?: () => void;
  rotuloAceitar?: string;
  rotuloRecusar?: string;
  /** Cor da barra lateral — normalmente a do departamento. */
  cor?: string;
}

/**
 * Um cartão de sugestão da IA, com aceitar e recusar.
 *
 * O cartão sai deslizando para o lado da decisão: aceito vai para a direita,
 * recusado para a esquerda. É informação, não enfeite — a pessoa confirma pelo
 * movimento o que acabou de fazer, sem precisar ler nada.
 */
export function AISuggestion({
  children, onAceitar, onRecusar,
  rotuloAceitar = 'Aceitar', rotuloRecusar = 'Não',
  cor = '#9d4edd',
}: AISuggestionProps) {
  const reduzido = useMovimentoReduzido();
  const [saindo, setSaindo] = useState<'aceito' | 'recusado' | null>(null);

  const decidir = (decisao: 'aceito' | 'recusado', acao?: () => void) => {
    if (saindo) return;
    setSaindo(decisao);
    // A ação roda junto com a saída: esperar a animação para só então gravar
    // faz a interface parecer lenta sem motivo.
    acao?.();
  };

  const deslocamento = reduzido ? 0 : saindo === 'aceito' ? 40 : -40;

  return (
    <motion.div
      layout={!reduzido}
      variants={{
        oculto: reduzido ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 },
        visivel: { opacity: 1, y: 0, scale: 1 },
      }}
      exit={{ opacity: 0, x: deslocamento, scale: 0.97 }}
      transition={MOLA}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        padding: '10px 12px', borderRadius: '10px',
        border: '1px solid var(--border-light)', borderLeft: `3px solid ${cor}`,
        backgroundColor: 'var(--bg-surface)',
      }}
    >
      <div style={{ flex: 1, minWidth: '180px' }} className="text-sm">{children}</div>

      <div style={{ display: 'flex', gap: '6px' }}>
        {onAceitar && (
          <BotaoDecisao
            aoDecidir={() => decidir('aceito', onAceitar)}
            icone={<Check size={14} />}
            rotulo={rotuloAceitar}
            destaque
          />
        )}
        {onRecusar && (
          <BotaoDecisao
            aoDecidir={() => decidir('recusado', onRecusar)}
            icone={<X size={14} />}
            rotulo={rotuloRecusar}
          />
        )}
      </div>
    </motion.div>
  );
}

/**
 * Aceitar / recusar uma sugestão.
 *
 * A resposta no toque mora em `ui/BotaoTatil.tsx` — não tinha nada de "IA" nela,
 * e ficar aqui dentro fazia o resto do app não a encontrar.
 */
function BotaoDecisao({ aoDecidir, icone, rotulo, destaque }: {
  aoDecidir: () => void;
  icone: ReactNode;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <BotaoTatil
      onClick={aoDecidir}
      className="btn-chip"
      style={destaque ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
    >
      {icone} {rotulo}
    </BotaoTatil>
  );
}

// ---- Recomendação ----

interface AIRecommendationProps {
  titulo?: string;
  children: ReactNode;
  /** Substitui o conteúdo pelo estado "pensando". */
  carregando?: boolean;
  textoCarregando?: string;
}

/**
 * O bloco onde a IA explica uma conclusão.
 *
 * Fica visivelmente marcado como saída de máquina — borda com gradiente e o
 * ícone — porque quem lê precisa saber que aquilo é sugestão, não fato apurado.
 */
export function AIRecommendation({
  titulo = 'O que a IA sugere',
  children,
  carregando = false,
  textoCarregando = 'Analisando os dados...',
}: AIRecommendationProps) {
  const reduzido = useMovimentoReduzido();

  return (
    <motion.div
      initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={MOLA}
      style={{
        position: 'relative', padding: '14px 16px', borderRadius: '12px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid transparent',
        backgroundImage: `linear-gradient(var(--bg-surface), var(--bg-surface)),
                          linear-gradient(120deg, #9d4edd, #4cc9f0, #f72585)`,
        backgroundOrigin: 'border-box',
        backgroundClip: 'padding-box, border-box',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {carregando ? (
          <motion.div
            key="pensando"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <AIThinking texto={textoCarregando} />
          </motion.div>
        ) : (
          <motion.div
            key="resposta"
            initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={MOLA}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
              <Sparkles size={14} color="#c77dff" />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#c77dff' }}>
                {titulo}
              </span>
            </div>
            <div className="text-sm" style={{ lineHeight: 1.6 }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
