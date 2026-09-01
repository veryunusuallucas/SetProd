/**
 * Converte o documento da Ordem do Dia em texto puro.
 *
 * POR QUE ISTO EXISTE
 * A OD tem um gerador só (`montarHtmlOD`), e isso é de propósito: papel e email
 * dizendo a mesma coisa. Mas WhatsApp, Telegram e a caixa de "colar" de
 * qualquer lugar não entendem HTML — e é por ali que a equipe recebe a OD
 * quando a produção não tem domínio próprio para enviar email.
 *
 * A alternativa seria um segundo gerador escrevendo a mesma OD em texto. Seria
 * pior: dois geradores divergem no primeiro campo que alguém acrescenta em um
 * só. Aqui a fonte continua única e a tradução é mecânica.
 */

/** Tags que sempre começam parágrafo novo. */
const BLOCO = new Set(['H1', 'H2', 'H3', 'P', 'DIV', 'UL', 'OL', 'TABLE', 'TR', 'LI', 'BR']);

export function htmlParaTexto(html: string): string {
  const raiz = document.createElement('div');
  raiz.innerHTML = html;

  const partes: string[] = [];

  const percorrer = (no: Node) => {
    if (no.nodeType === Node.TEXT_NODE) {
      // Espaços e quebras do HTML fonte viram um espaço só; o texto do
      // documento é indentado no código-fonte e sairia cheio de buracos.
      const t = (no.textContent || '').replace(/\s+/g, ' ');
      if (t.trim()) partes.push(t);
      return;
    }

    if (no.nodeType !== Node.ELEMENT_NODE) return;
    const el = no as HTMLElement;
    const tag = el.tagName;

    if (tag === 'BR') { partes.push('\n'); return; }

    /*
      Título de seção sai em MAIÚSCULAS, cercado de linha em branco.

      Em texto puro não existe negrito nem borda inferior; a única coisa que
      separa uma seção da outra é o espaço em volta e o caixa-alta. Sem isso a
      OD vira um parágrafo de trinta linhas em que ninguém acha o horário.
    */
    if (tag === 'H1') { partes.push('\n', (el.textContent || '').trim().toUpperCase(), '\n'); return; }
    if (tag === 'H2') { partes.push('\n\n', (el.textContent || '').trim().toUpperCase(), '\n'); return; }

    if (tag === 'LI') {
      partes.push('\n• ');
      el.childNodes.forEach(percorrer);
      return;
    }

    if (tag === 'TR') {
      partes.push('\n');
      const celulas: string[] = [];
      el.childNodes.forEach(c => {
        if (c.nodeType === Node.ELEMENT_NODE && /^T[DH]$/.test((c as HTMLElement).tagName)) {
          celulas.push(((c as HTMLElement).textContent || '').replace(/\s+/g, ' ').trim());
        }
      });
      // Coluna vazia vira nada, e o separador some com ela: a linha do
      // cronograma tem só hora e evento, e "07:00 ·  · Chamada" seria lixo.
      partes.push(celulas.filter(Boolean).join(' · '));
      return;
    }

    if (BLOCO.has(tag)) partes.push('\n');
    el.childNodes.forEach(percorrer);
    if (BLOCO.has(tag)) partes.push('\n');
  };

  raiz.childNodes.forEach(percorrer);

  return partes
    .join('')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    // Três quebras ou mais viram duas: o HTML tem blocos aninhados, e cada
    // nível somava a sua. Sem isto a OD sai com buracos de seis linhas.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
