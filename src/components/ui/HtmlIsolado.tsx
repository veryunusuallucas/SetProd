import type { CSSProperties } from 'react';

/**
 * Mostra um HTML que o app não escreveu (o que a IA devolve) sem deixá-lo rodar.
 *
 * `dangerouslySetInnerHTML` punha esse HTML dentro da página do app: um
 * `<img onerror>` vindo da IA — que pode ter lido um texto preparado — rodava
 * com a sessão de quem estava olhando. No iframe sem `allow-scripts` nada
 * executa; `allow-same-origin` só serve para medir a altura e não precisar de
 * barra de rolagem dentro da caixa.
 */
export function HtmlIsolado({ html, style }: { html: string; style?: CSSProperties }) {
  return (
    <iframe
      title="Prévia"
      sandbox="allow-same-origin"
      srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;font-family:Arial,sans-serif;color:#111">${html}</body>`}
      onLoad={e => {
        const corpo = e.currentTarget.contentDocument?.body;
        if (corpo) e.currentTarget.style.height = `${corpo.scrollHeight + 8}px`;
      }}
      style={{ width: '100%', border: 0, display: 'block', ...style }}
    />
  );
}
