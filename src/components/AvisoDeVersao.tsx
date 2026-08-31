import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { MOLA } from './ui/ia';

/**
 * "Tem versão nova. Atualizar?"
 *
 * O QUE ISTO SUBSTITUI
 * O Lucas pedindo no grupo, a cada publicação, que todo mundo apertasse
 * Ctrl+Shift+F5. Não é só chato: quem não lê a mensagem fica num app velho sem
 * saber, relata defeito já corrigido, e o relato consome o tempo de todos duas
 * vezes.
 *
 * POR QUE A PESSOA DECIDE A HORA
 * Atualizar recarrega a página. No meio de uma diária, com a Ordem do Dia
 * aberta e o set esperando, recarregar sozinho é pior que ficar desatualizado.
 * Então o app avisa e espera — menos quando já quebrou (ver o `preloadError`
 * mais abaixo), aí não há nada a preservar.
 */
export function AvisoDeVersao() {
  const {
    needRefresh: [temVersaoNova, setTemVersaoNova],
    updateServiceWorker,
  } = useRegisterSW({
    /*
      Procurar sozinho, de hora em hora.

      Sem isto o app só descobre a versão nova quando a aba é recarregada — e a
      aba de quem está em produção fica aberta o dia inteiro. O aviso chegaria
      justamente para quem não precisava dele.
    */
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      setInterval(() => {
        if (navigator.onLine) registro.update().catch(() => { /* sem rede: tenta na próxima */ });
      }, 60 * 60 * 1000);
    },
  });

  /*
    A REDE DE SEGURANÇA.

    O `prompt` no vite.config resolve o caso normal, mas não cobre quem abriu o
    app pela primeira vez enquanto a publicação acontecia, nem quem está sem
    service worker (aba anônima, navegador que o bloqueia). Nesses casos a tela
    sob demanda ainda pode não vir.

    O Vite avisa disso pelo evento `vite:preloadError`. Aqui a tela JÁ está
    quebrada, então não há estado para preservar e recarregar é a decisão certa
    — mas uma vez só: se o arquivo sumiu de verdade, recarregar em laço deixaria
    o app piscando para sempre em vez de mostrar o erro.
  */
  useEffect(() => {
    const CHAVE = 'setprod:recarreguei-por-chunk';

    const aoFalharPedaco = (e: Event) => {
      e.preventDefault(); // sem isto o Vite ainda lança o erro na tela

      if (sessionStorage.getItem(CHAVE)) {
        console.error('[SetProd] a tela não carregou nem depois de recarregar.', e);
        return;
      }
      sessionStorage.setItem(CHAVE, '1');
      console.warn('[SetProd] tela pedida não existe mais neste servidor — recarregando com a versão nova.');
      window.location.reload();
    };

    window.addEventListener('vite:preloadError', aoFalharPedaco);
    return () => window.removeEventListener('vite:preloadError', aoFalharPedaco);
  }, []);

  return createPortal(
    <AnimatePresence>
      {temVersaoNova && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={MOLA}
          style={{
            position: 'fixed', left: '20px', bottom: '20px', zIndex: 3500,
            // `right` junto com `left` para o aviso ter uma largura de verdade
            // no celular, e `maxWidth` para ele não atravessar a tela inteira no
            // desktop — onde uma faixa de 1400px para três palavras seria um
            // banner, não um aviso.
            right: '20px', maxWidth: '420px',
            // Envolve em vez de espremer: com o texto e dois botões na mesma
            // linha, a tela estreita quebrava o título no meio e o aviso ficava
            // com cara de erro de layout.
            display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 12px',
            padding: '12px 14px', borderRadius: '14px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderLeft: '3px solid var(--accent)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
          }}
        >
          <Sparkles size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />

          <div style={{ flex: '1 1 190px', minWidth: 0 }}>
            <div className="text-sm font-bold">Tem versão nova do SetProd</div>
            <div className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
              Atualiza quando puder — vai recarregar a tela.
            </div>
          </div>

          <button
            onClick={() => updateServiceWorker(true)}
            className="btn btn-primary text-xs"
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>

          {/* Dispensar é possível, mas o aviso volta na próxima verificação:
              ficar para trás não pode ser uma escolha permanente feita sem
              querer, num toque errado. */}
          <button
            onClick={() => setTemVersaoNova(false)}
            className="text-xs text-muted"
            style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
          >
            Agora não
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
