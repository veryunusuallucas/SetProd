import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';
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
 * ⚠️ ELA TEM SAÍDA, E A PRIMEIRA VERSÃO NÃO TINHA — TRAVOU DE VERDADE.
 *
 * Eu escrevi aqui que ela era "o último quadro antes do reload, e por isso não
 * precisa de saída". Estava errado: o reload é feito pelo `vite-plugin-pwa`
 * quando o service worker novo assume, e ele só acontece se o evento
 * `controlling` disparar com `isUpdate`. Quando isso não vem — o worker em
 * espera já tinha ativado, outra aba já estava controlando, qualquer coisa —
 * NADA recarrega, e a tela fica para sempre.
 *
 * Foi o que aconteceu na tela de login. Uma tela sem saída, esperando um evento
 * que pode não vir, é uma armadilha: quem está nela não tem nem como relatar o
 * problema, porque o app inteiro está atrás dela.
 *
 * Agora há duas redes: um botão de recarregar à mão depois de 3s, e o
 * recarregamento automático aos 8s. Recarregar é seguro e repetível — no pior
 * caso a pessoa volta na versão antiga e o aviso reaparece, que é infinitamente
 * melhor que ficar presa olhando uma barra cheia.
 *
 * Não tem botão de CANCELAR, isso continua: a troca começada não se desfaz, e
 * um cancelar que não cancela seria pior que nenhum.
 */

/** Quando aparece a saída manual, e quando o app recarrega sozinho. */
const ESCAPE_MS = 3000;
const DESISTIR_MS = 8000;

export function Atualizando({ versao }: { versao?: string }) {
  const reduzido = useMovimentoReduzido();
  const [demorou, setDemorou] = useState(false);

  useEffect(() => {
    const mostrarSaida = setTimeout(() => setDemorou(true), ESCAPE_MS);

    /*
      A garantia final: se o service worker não recarregou até aqui, recarrego eu.

      Vale mesmo que a troca ainda esteja em andamento — o pior caso é a pessoa
      voltar na versão antiga e o aviso aparecer de novo. Trocar "às vezes
      demora um pouco mais" por "às vezes trava para sempre" é um mau negócio.
    */
    const desistir = setTimeout(() => window.location.reload(), DESISTIR_MS);

    return () => { clearTimeout(mostrarSaida); clearTimeout(desistir); };
  }, []);

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
        A barra acompanha o PRAZO, não o download.

        O service worker não informa progresso, e inventar uma porcentagem seria
        mentir com precisão. O que ela mede é o tempo até eu recarregar por
        conta própria — ou seja, ela é honesta: cheia quer dizer "acabou o meu
        prazo de espera", e é exatamente quando a página vai embora.

        Na primeira versão ela enchia em 3s e ficava parada. Com o prazo em 8s
        isso teria sido pior que não ter barra: cinco segundos de barra cheia e
        nada acontecendo é a definição visual de travado.
      */}
      <div style={{ width: '100%', maxWidth: '220px', height: '4px', borderRadius: '3px', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: '8%' }}
          animate={{ width: '100%' }}
          transition={{ duration: DESISTIR_MS / 1000, ease: 'linear' }}
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

      {/* A saída. Aparece discreta, sem alarme: na maioria das vezes o app
          recarrega antes dela e ninguém vê. */}
      {demorou && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          onClick={() => window.location.reload()}
          className="btn btn-secondary text-xs"
          style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
        >
          <RefreshCw size={13} /> Demorando? Recarregar agora
        </motion.button>
      )}
    </motion.div>,
    document.body
  );
}
