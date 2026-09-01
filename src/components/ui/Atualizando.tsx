import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimationControls } from 'framer-motion';
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
 *
 * QUEM RECARREGA A PÁGINA É ESTA TELA
 * Antes era o `vite-plugin-pwa`, no instante em que o worker novo assumia —
 * quase sempre menos de um segundo. A barra, cronometrada nos 8s do prazo,
 * estava em 10% quando a página sumia: uma barra que nunca chega ao fim parece
 * uma barra interrompida, e "interrompido" é justamente o que a tela existe
 * para desmentir.
 *
 * Agora quem manda trocar avisa por `pronto`, e o recarregamento espera a barra
 * correr até o fim. Não é enfeite: o fim da barra passou a ser verdade, porque é
 * ele que dispara o reload.
 *
 * E EXISTE UM TEMPO MÍNIMO DE TELA — 1,2s
 * A primeira versão disto só encadeava sprint + reload, e o service worker às
 * vezes assume em 80ms: a tela aparecia e sumia em meio segundo. Continuava
 * sendo um piscar, só que com a barra cheia. O que se vê num piscar é "alguma
 * coisa deu errado", não "está trocando de versão".
 *
 * Então o sprint espera a sua vez. O reload nunca acontece antes de 1,2s desde
 * que a tela subiu, e a barra ainda fica `PAUSA_MS` cheia antes de a página ir
 * embora — sem essa pausa, chegar a 100% e sumir no mesmo quadro é
 * indistinguível de ser cortada.
 *
 * O piso vale para o caminho rápido. Se a troca demorar mais que isso, nada
 * espera nada: o sprint começa na hora em que `pronto` chega.
 */

/** Quando aparece a saída manual, e quando o app recarrega sozinho. */
const ESCAPE_MS = 3000;
const DESISTIR_MS = 8000;
/** O sprint final, depois que a versão nova já assumiu. */
const FECHAR_MS = 420;
/** A barra cheia, parada, antes de a página ir embora. */
const PAUSA_MS = 240;
/** Do instante em que a tela sobe até o reload, no caminho rápido. */
const MINIMO_MS = 1200;

export function Atualizando({ versao, pronto = false }: { versao?: string; pronto?: boolean }) {
  const reduzido = useMovimentoReduzido();
  const [demorou, setDemorou] = useState(false);
  const barra = useAnimationControls();
  /** Quando esta tela apareceu. É daqui que o tempo mínimo conta. */
  const [subiuEm] = useState(() => Date.now());

  /*
    A corrida normal: a barra atravessa o prazo inteiro, em ritmo constante.
    Ela só chega ao fim sozinha se nada mais acontecer — e aí o `desistir`
    recarrega no mesmo instante.
  */
  useEffect(() => {
    void barra.start({ width: '100%', transition: { duration: DESISTIR_MS / 1000, ease: 'linear' } });
  }, [barra]);

  /*
    O sprint, o piso e a saída.

    A conta do `atraso` é o piso: se a versão nova assumiu cedo demais, a barra
    segue no ritmo normal mais um tempo, e só então acelera — de modo que o
    conjunto (esperar + correr + pausar) feche os 1,2s. Se ela demorou, o
    `Math.max` zera e o sprint começa imediatamente.

    ⚠️ QUEM MARCA A HORA DO RELOAD É O RELÓGIO, E NÃO O FIM DA ANIMAÇÃO.
    A versão anterior recarregava no `.then()` do framer-motion, o que parecia
    mais honesto. Só que animação anda por `requestAnimationFrame`, e o
    navegador congela isso em aba escondida — quem clicasse em Atualizar e
    trocasse de app no mesmo segundo ficaria com a troca pendurada até o prazo
    de 8s. Os dois começam juntos e duram o mesmo tempo; o relógio é que decide.

    Com movimento reduzido a barra vai a 100% de uma vez, mas o tempo mínimo
    continua valendo: ele é sobre poder ler a tela, não sobre animação.
  */
  useEffect(() => {
    if (!pronto) return;

    const atraso = Math.max(0, MINIMO_MS - PAUSA_MS - FECHAR_MS - (Date.now() - subiuEm));

    const correr = setTimeout(() => {
      void barra.start({
        width: '100%',
        transition: reduzido ? { duration: 0 } : { duration: FECHAR_MS / 1000, ease: 'easeOut' },
      });
    }, atraso);

    const sair = setTimeout(() => window.location.reload(), atraso + FECHAR_MS + PAUSA_MS);

    return () => { clearTimeout(correr); clearTimeout(sair); };
  }, [pronto, reduzido, barra, subiuEm]);

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

        E quando a versão nova assume antes do prazo — que é o caso comum — ela
        acelera até o fim em vez de ser cortada no meio. Ver `pronto` lá em cima.
      */}
      <div style={{ width: '100%', maxWidth: '220px', height: '4px', borderRadius: '3px', backgroundColor: 'var(--bg-surface)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: '8%' }}
          animate={barra}
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
