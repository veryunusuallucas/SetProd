import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from './movimento';

/**
 * A tela do instante em que o app troca de versão.
 *
 * POR QUE ELA EXISTE
 * Clicar em "Atualizar" recarrega a página. Sem nada no meio, o que se vê é a
 * tela sumir e voltar — indistinguível de um travamento, ou de um clique que
 * não pegou. O recarregamento pode levar um segundo ou cinco, dependendo da
 * rede do set, e é nesse vão que a pessoa clica de novo.
 *
 * O que ela faz é converter uma interrupção em um acontecimento: em vez de
 * "sumiu", "está trocando de versão, e vai voltar".
 *
 * ⚠️ ELA É O ÚLTIMO QUADRO ANTES DO RELOAD, e por isso não precisa de saída —
 * a página inteira vai embora. Também não tem botão: uma vez começada, a troca
 * não se cancela, e oferecer um cancelar que não cancela é pior que não ter.
 */
export function Atualizando({ versao }: { versao?: string }) {
  const reduzido = useMovimentoReduzido();

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '20px', padding: '24px',
        // Opaco, não translúcido: o que está atrás vai deixar de existir em um
        // segundo, e deixá-lo visível por baixo sugere que dá para voltar.
        backgroundColor: 'var(--bg-default, #0d0d0d)',
      }}
    >
      {/*
        O anel que gira NÃO é um spinner de espera indefinida.

        Ele acompanha uma barra que enche de verdade abaixo — o giro dá vida, a
        barra dá progresso. Spinner sozinho tem o defeito de girar igual tendo
        passado um segundo ou trinta, e por isso vira ansiedade.
      */}
      <div style={{ position: 'relative', width: '76px', height: '76px' }}>
        <motion.div
          animate={reduzido ? undefined : { rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid var(--border-light)',
            borderTopColor: 'var(--accent)',
          }}
        />
        <motion.div
          animate={reduzido ? { opacity: [0.6, 1, 0.6] } : { scale: [1, 1.14, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}
        >
          <Sparkles size={26} />
        </motion.div>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div className="text-lg font-bold">Atualizando o SetProd</div>
        <div className="text-sm text-muted" style={{ marginTop: '6px', lineHeight: 1.5 }}>
          {versao ? <>Trazendo a versão {versao}. </> : null}
          Um instante — o app volta sozinho.
        </div>
      </div>

      {/*
        A barra vai até o fim em três segundos e PARA lá.

        Ela não mede o download de verdade: o service worker não informa
        progresso, e inventar uma porcentagem falsa seria mentir com precisão.
        O que ela mede é honesto no que promete — "está acontecendo, e não
        travou". Se a troca demorar mais que isso, a barra fica cheia esperando,
        em vez de reiniciar e sugerir que voltou ao começo.
      */}
      <div style={{ width: '100%', maxWidth: '220px', height: '4px', borderRadius: '3px', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: '8%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 3, ease: 'easeOut' }}
          style={{ height: '100%', backgroundColor: 'var(--accent)' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...MOLA, delay: 0.4 }}
        className="text-xs text-muted"
        style={{ textAlign: 'center', maxWidth: '260px', lineHeight: 1.5 }}
      >
        O que você fez continua salvo — a atualização só troca o programa, não os
        dados.
      </motion.div>
    </motion.div>,
    document.body
  );
}
