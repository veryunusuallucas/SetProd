import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, X } from 'lucide-react';

/**
 * Linguagem visual dos momentos de IA.
 *
 * Escopo deliberado: este capricho vale só onde a IA aparece. É ali que ele tem
 * significado — a pessoa está esperando uma máquina pensar, e a animação
 * transforma espera em expectativa. Espalhar isso pelo app inteiro custaria
 * caro e deixaria tudo barulhento.
 *
 * Três regras que valem para todos os componentes daqui:
 *
 *  1. Mola, não duração fixa. Movimento com física é interrompível: se a
 *     pessoa mexer no meio, a animação acompanha em vez de terminar sozinha.
 *  2. Resposta no toque (pointer-down), não no soltar. É o que faz o botão
 *     parecer instantâneo mesmo quando a ação leva tempo.
 *  3. Movimento reduzido é respeitado. Quem marcou isso no sistema tem motivo
 *     — enjoo, vertigem. A informação continua, o deslocamento some.
 */

// ---- Fundamentos ----

/**
 * Molas do sistema, em física explícita (rigidez e amortecimento).
 *
 * Medi as alternativas no app: `duration` conta até a mola assentar por
 * completo, não até o movimento parecer pronto, e `visualDuration` não teve
 * efeito aqui. Com stiffness/damping o comportamento é previsível e igual em
 * qualquer versão da biblioteca.
 *
 * O que importa é a razão de amortecimento ζ = damping / (2·√stiffness):
 * ζ = 1 chega ao destino sem passar dele; abaixo disso, repica.
 */

/** Entrada e saída: ζ = 1, sem repique, porque não houve gesto do usuário. */
export const MOLA = { type: 'spring', stiffness: 400, damping: 40 } as const;

/** Resposta a gesto: ζ ≈ 0,75 — rápida, com um repique leve que devolve o toque. */
export const MOLA_GESTO = { type: 'spring', stiffness: 900, damping: 45 } as const;

/** Intervalo entre itens que entram em sequência. */
export const PASSO_STAGGER = 0.05;

/** O sistema pede menos movimento? Reage se a pessoa mudar isso com o app aberto. */
export function useMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aoMudar = () => setReduzido(mq.matches);
    mq.addEventListener('change', aoMudar);
    return () => mq.removeEventListener('change', aoMudar);
  }, []);

  return reduzido;
}

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
 * Botão que responde no pointer-down.
 *
 * O clique só dispara no soltar, o que dá uns 100ms de silêncio entre o dedo
 * encostar e a tela reagir — tempo suficiente para a pessoa achar que não
 * funcionou e apertar de novo. Aqui o afundamento é imediato; a ação continua
 * no clique, para arrastar para fora ainda cancelar.
 */
function BotaoDecisao({ aoDecidir, icone, rotulo, destaque }: {
  aoDecidir: () => void;
  icone: ReactNode;
  rotulo: string;
  destaque?: boolean;
}) {
  const [pressionado, setPressionado] = useState(false);

  return (
    <motion.button
      type="button"
      onPointerDown={() => setPressionado(true)}
      onPointerUp={() => setPressionado(false)}
      onPointerLeave={() => setPressionado(false)}
      onClick={aoDecidir}
      animate={{ scale: pressionado ? 0.94 : 1 }}
      transition={MOLA_GESTO}
      className="btn-chip"
      style={destaque ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : undefined}
    >
      {icone} {rotulo}
    </motion.button>
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
