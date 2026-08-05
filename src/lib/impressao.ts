/**
 * Impressão de relatórios sem pop-up.
 *
 * Antes cada tela fazia `window.open('', '_blank')` e escrevia o HTML lá. Isso
 * falha em dois cenários comuns: com bloqueador de pop-up ligado (o padrão em
 * muitos navegadores) e no app instalado como PWA, onde a janela nova
 * simplesmente não abre. O usuário clicava em "Relatório" e não acontecia nada.
 *
 * Aqui o HTML vai para um iframe escondido na própria página e a impressão sai
 * dele. Não é pop-up, então nada bloqueia.
 */

/** Envolve o corpo num documento completo, com o CSS comum dos relatórios. */
export function montarPaginaRelatorio(titulo: string, corpo: string, estiloExtra = ''): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; padding: 32px; max-width: 820px; margin: 0 auto; }
  h1 { margin: 0; font-size: 24px; }
  h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; font-size: 14px; text-transform: uppercase; letter-spacing: .06em; }
  li { margin: 3px 0; font-size: 13px; }
  .muted { color: #666; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
  th { background: #f4f4f4; }
  @media print { body { padding: 0; } }
  ${estiloExtra}
</style></head><body>${corpo}</body></html>`;
}

/**
 * Imprime um HTML completo. Devolve false se o navegador não deixou nem criar
 * o iframe — aí quem chamou decide o que fazer (normalmente, baixar o arquivo).
 */
export function imprimirHtml(html: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  // O conteúdo é escrito de forma síncrona, mas fontes e imagens ainda podem
  // estar carregando; sem o respiro a impressão sai com a página em branco.
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Só remove depois do diálogo: tirar antes cancela a impressão.
      setTimeout(() => iframe.remove(), 60_000);
    }
  }, 350);

  return true;
}

/** Alternativa quando a pessoa prefere o arquivo a mandar para a impressora. */
export function baixarHtml(html: string, nomeArquivo: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo.endsWith('.html') ? nomeArquivo : `${nomeArquivo}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
