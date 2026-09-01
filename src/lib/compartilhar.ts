/**
 * Mandar a Ordem do Dia usando o que a pessoa já tem.
 *
 * POR QUE ESTE CAMINHO É O PRINCIPAL, E NÃO O EMAIL
 * Enviar email em nome de uma produção exige um domínio próprio, com DKIM e SPF
 * no DNS — sem isso o Gmail joga em spam ou recusa. Domínio custa dinheiro, e
 * uma produção pequena não tem por que gastar com isso para mandar uma OD.
 *
 * O problema real nunca foi "enviar email": era a OD chegar na equipe. E isso o
 * celular de qualquer pessoa já resolve — WhatsApp, Telegram, o email pessoal.
 * O que faltava era o app entregar a OD num formato que dê para colar em
 * qualquer um deles.
 *
 * O envio pelo Resend (`emailOD.ts`) continua existindo para quando houver um
 * domínio. Ele é o caminho melhor; este é o caminho que funciona hoje.
 */

export type ResultadoCompartilhar = 'compartilhou' | 'copiou' | 'cancelou' | 'falhou';

/**
 * Abre o menu de compartilhamento do sistema, com o arquivo de agenda junto.
 *
 * Cai para a área de transferência quando o navegador não tem `share` — que é o
 * caso de quase todo desktop. Não é consolo: no computador, colar no WhatsApp
 * Web ou no email é exatamente o que a pessoa faria depois de escolher no menu.
 */
export async function compartilharOD({ titulo, texto, ics, nomeDoArquivo }: {
  titulo: string;
  texto: string;
  /** Conteúdo do .ics. Vai como arquivo quando o navegador aceitar. */
  ics?: string;
  nomeDoArquivo: string;
}): Promise<ResultadoCompartilhar> {
  const navegador = navigator as Navigator & {
    canShare?: (dados: ShareData) => boolean;
  };

  if (typeof navigator.share === 'function') {
    /*
      O arquivo só entra se o navegador disser que aceita ESTE arquivo.

      `canShare` com `files` é a única checagem confiável: há navegadores com
      `share` e sem suporte a arquivo, e mandar o arquivo neles rejeita a
      chamada inteira — a pessoa clicaria em compartilhar e não aconteceria
      nada. Sem o arquivo, o texto vai do mesmo jeito.
    */
    let arquivos: File[] | undefined;
    if (ics) {
      const f = new File([ics], `${nomeDoArquivo}.ics`, { type: 'text/calendar' });
      if (navegador.canShare?.({ files: [f] })) arquivos = [f];
    }

    try {
      await navigator.share(arquivos ? { title: titulo, text: texto, files: arquivos } : { title: titulo, text: texto });
      return 'compartilhou';
    } catch (e) {
      // Fechar o menu do sistema dispara AbortError. Isso não é erro: a pessoa
      // desistiu, e mostrar "falhou" para quem desistiu é mentir para ela.
      if (e instanceof Error && e.name === 'AbortError') return 'cancelou';
    }
  }

  return (await copiar(texto)) ? 'copiou' : 'falhou';
}

/** Copia para a área de transferência. */
export async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    /*
      A API de clipboard exige contexto seguro e, em alguns navegadores, um
      gesto recente. Quando ela recusa, o caminho velho ainda funciona: um
      textarea fora da tela e `execCommand`. É obsoleto e é o que salva o
      clique da pessoa em vez de devolver um erro que ela não pode resolver.
    */
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Monta o `mailto:` que abre o email da própria pessoa com a equipe em cópia
 * oculta e o assunto pronto.
 *
 * ⚠️ O CORPO VAI VAZIO DE PROPÓSITO — a OD é copiada para a área de
 * transferência e a pessoa cola.
 *
 * `mailto:` tem limite de tamanho, e ele não é o mesmo em lugar nenhum: alguns
 * clientes cortam em 2000 caracteres, outros antes. Uma OD passa disso fácil, e
 * o corte não avisa: chega uma OD que termina no meio da terceira cena. Colar é
 * um passo a mais e nunca perde nada.
 *
 * Cópia oculta, e não "para": senão cada pessoa recebe a lista de emails de
 * toda a equipe, e um "responder a todos" vira uma thread com a produção
 * inteira dentro.
 */
export function linkDeEmail({ destinatarios, assunto }: {
  destinatarios: string[];
  assunto: string;
}): string {
  const bcc = destinatarios.join(',');
  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(assunto)}`;
}
