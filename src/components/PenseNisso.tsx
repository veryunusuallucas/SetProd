import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Quote } from 'lucide-react';
import { MOLA, MOLA_GESTO, useMovimentoReduzido } from './ui/ia';

/**
 * O aviso do J. Martins.
 *
 * Aparece de vez em quando no canto superior direito com uma frase, e só sai
 * quando alguém aperta PENSE NISSO. É piada interna, então segue duas regras
 * que piada interna costuma quebrar:
 *
 *   uma por vez  — duas empilhadas viram spam, não graça
 *   nunca some sozinha — a frase espera ser lida; fechar é escolha de quem lê
 *
 * Fica fora das telas públicas (cadastro, pesquisa, convite): quem abre aquilo
 * é gente de fora respondendo um formulário, e a piada não é com ela.
 */

/*
  RARIDADE É O QUE FAZ A PIADA FUNCIONAR.

  Os números eram 40–90s para a primeira e 4–9min entre uma e outra. Numa tarde
  de trabalho isso dá dezenas de aparições, e aí a frase deixa de ser um achado
  e vira uma notificação: a pessoa fecha no automático, sem ler. Veio como
  sugestão de quem estava testando — "mais raras e mais valiosas" —, e é a
  crítica certa.

  Agora a primeira demora alguns minutos (quem abriu o app foi fazer alguma
  coisa; ser interrompido no primeiro minuto é atrapalhar), e o intervalo é de
  vinte a quarenta minutos — algumas por jornada, não algumas por hora.
*/

/** Quanto tempo até a primeira aparecer, depois de o app abrir. */
const PRIMEIRA_MIN_MS = 4 * 60_000;
const PRIMEIRA_MAX_MS = 8 * 60_000;

/** E o intervalo entre uma e outra, depois que a anterior é fechada. */
const INTERVALO_MIN_MS = 20 * 60_000;
const INTERVALO_MAX_MS = 40 * 60_000;

const aoAcaso = (min: number, max: number) => min + Math.random() * (max - min);

export function PenseNisso() {
  const [frase, setFrase] = useState<string | null>(null);
  const ultima = useRef<string | undefined>(undefined);
  const relogio = useRef<number | undefined>(undefined);
  const reduzido = useMovimentoReduzido();

  const agendar = useCallback((min: number, max: number) => {
    window.clearTimeout(relogio.current);
    relogio.current = window.setTimeout(async () => {
      // Carregada só agora: 419 frases não precisam pesar no início do app.
      const { sortearFrase } = await import('../lib/frasesJMartins');
      const nova = sortearFrase(ultima.current);
      ultima.current = nova;
      setFrase(nova);
    }, aoAcaso(min, max));
  }, []);

  useEffect(() => {
    agendar(PRIMEIRA_MIN_MS, PRIMEIRA_MAX_MS);
    return () => window.clearTimeout(relogio.current);
  }, [agendar]);

  const fechar = () => {
    setFrase(null);
    agendar(INTERVALO_MIN_MS, INTERVALO_MAX_MS);
  };

  // Portal: o aviso é da janela inteira, e nascer dentro de um cabeçalho ou de
  // uma barra lateral o prenderia no contexto de empilhamento daquele pedaço.
  return createPortal(
    <AnimatePresence>
      {frase && (
        <motion.div
          key={frase}
          initial={reduzido ? { opacity: 0 } : { opacity: 0, x: 40, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduzido ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
          transition={MOLA}
          style={{
            position: 'fixed', top: '20px', right: '20px', zIndex: 4000,
            width: 'min(340px, calc(100vw - 40px))',
            borderRadius: '18px', overflow: 'hidden',
            // Vidro: deixa o fundo do app viver atrás do aviso, para ele
            // parecer pousado na tela e não colado por cima.
            background: 'linear-gradient(150deg, rgba(32,28,52,0.94), rgba(18,16,30,0.94))',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.4)',
          }}
        >
          {/* Fio de luz no topo: o mesmo truque do card de IA, para o aviso
              ter um "lado de cima" claro sem precisar de título. */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
            opacity: 0.85,
          }} />

          <div style={{ padding: '18px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <Quote size={13} style={{ color: 'var(--accent)' }} />
              <span style={{
                fontSize: '10px', fontWeight: 800, letterSpacing: '0.14em',
                textTransform: 'uppercase', color: 'var(--accent)',
              }}>
                J. Martins
              </span>
            </div>

            <p style={{
              margin: 0, fontSize: '14px', lineHeight: 1.55,
              color: 'var(--text-primary)', fontStyle: 'italic',
            }}>
              {frase}
            </p>

            <motion.button
              onClick={fechar}
              whileTap={reduzido ? undefined : { scale: 0.96, transition: MOLA_GESTO }}
              whileHover={reduzido ? undefined : { y: -1, transition: MOLA_GESTO }}
              style={{
                marginTop: '16px', width: '100%', padding: '10px',
                borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, var(--accent), #ffd166)',
                color: '#1a1508', fontWeight: 800, fontSize: '12px',
                letterSpacing: '0.12em', textTransform: 'uppercase',
              }}
            >
              Pense nisso!
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
