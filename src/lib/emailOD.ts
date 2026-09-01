import { supabase } from './supabase';

/**
 * Manda a Ordem do Dia por email (spec §7.3).
 *
 * O trabalho de verdade é da Edge Function `enviar-od`: a chave do Resend mora
 * no Supabase e nunca chega ao navegador. Aqui só se monta o pedido.
 */

export interface AnexoEmail {
  filename: string;
  /** Texto puro; a conversão para base64 acontece aqui. */
  conteudo: string;
}

export interface PedidoDeEnvio {
  para: string[];
  assunto: string;
  html: string;
  anexos?: AnexoEmail[];
}

/**
 * base64 de texto com acento, sem quebrar.
 *
 * `btoa` só aceita bytes 0–255, e "Diária" em UTF-8 tem bytes acima disso — o
 * caminho ingênuo estoura com InvalidCharacterError no primeiro acento, que num
 * app em português é sempre.
 */
function paraBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export interface ResultadoDoEnvio {
  ok: boolean;
  enviados?: number;
  erro?: string;
}

export async function enviarOD(pedido: PedidoDeEnvio): Promise<ResultadoDoEnvio> {
  try {
    const { data, error } = await supabase.functions.invoke('enviar-od', {
      body: {
        para: pedido.para,
        assunto: pedido.assunto,
        html: pedido.html,
        anexos: (pedido.anexos || []).map(a => ({
          filename: a.filename,
          content: paraBase64(a.conteudo),
        })),
      },
    });

    /*
      O erro do `functions-js` vem no `error`, e o corpo com a mensagem boa vem
      junto — mas embrulhado. Ler o `context` é o que transforma um
      "FunctionsHttpError" inútil em "falta configurar a chave do Resend".

      É a mesma armadilha que já mordeu em `gemini.ts`: o cliente do Supabase
      não relança o corpo do erro, ele o esconde dentro do objeto.
    */
    if (error) {
      let detalhe = '';
      try {
        const resposta = (error as { context?: Response }).context;
        if (resposta && typeof resposta.json === 'function') {
          const corpo = await resposta.json();
          if (corpo?.error) detalhe = String(corpo.error);
        }
      } catch { /* segue sem o corpo */ }

      /*
        "Failed to send a request to the Edge Function" é o que o Supabase diz
        quando o fetch nem chegou a completar — e sozinho ele não ajuda ninguém.
        Na prática significa uma de três coisas, e vale listar as três em vez de
        escolher uma e errar. Foi a mesma lição de `gemini.ts`: mensagem que
        afirma a causa errada custa mais que mensagem que admite não saber.
      */
      if (!detalhe) {
        const cru = error.message || '';
        detalhe = /failed to send|fetch/i.test(cru)
          ? 'Não consegui falar com o servidor de email. Pode ser falta de internet, '
            + 'ou a função `enviar-od` ainda não estar publicada no Supabase.'
          : cru || 'Não consegui falar com o servidor de email.';
      }

      return { ok: false, erro: detalhe };
    }

    if (data?.error) return { ok: false, erro: String(data.error) };
    return { ok: true, enviados: Number(data?.enviados) || pedido.para.length };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : 'Falha no envio.' };
  }
}

/**
 * O corpo do email.
 *
 * ⚠️ A OD VAI NO CORPO, EM HTML — NÃO COMO PDF ANEXADO.
 *
 * O app nunca produziu um arquivo PDF: `imprimirHtml` abre a caixa de impressão
 * do navegador e quem salva o PDF é a pessoa. Para anexar um PDF de verdade
 * seria preciso uma biblioteca de geração no cliente, e as que existem ou
 * rasterizam o texto (fica borrado e não dá para buscar) ou pesam mais que o
 * app inteiro.
 *
 * O corpo em HTML é melhor do que parece para o caso real: no set as pessoas
 * abrem o email no celular, e ler direto vale mais que baixar um anexo. O .ics
 * vai junto porque esse sim é um arquivo pequeno que o telefone sabe abrir.
 */
export function corpoDoEmail({ conteudoDaOD, nomeDoProjeto, numero, versao, linkReuniao }: {
  conteudoDaOD: string;
  nomeDoProjeto: string;
  numero: number;
  versao: number;
  linkReuniao?: string;
}): string {
  const aviso = versao > 1
    ? `<p style="margin:0 0 18px;padding:12px 14px;background:#fff4e5;border-left:4px solid #f59e0b;border-radius:6px;font-size:14px">
         <b>Esta é a versão ${versao} desta Ordem do Dia.</b> Ela substitui a que você recebeu antes — confira os horários.
       </p>`
    : '';

  const reuniao = linkReuniao
    ? `<p style="margin:0 0 18px;font-size:14px"><b>Reunião:</b> <a href="${linkReuniao}">${linkReuniao}</a></p>`
    : '';

  /*
    Estilo em `style=` inline, e não numa folha.

    Cliente de email não é navegador: o Gmail arranca a tag `<style>` do corpo,
    e o Outlook usa o motor do Word. O que sobrevive nos três é atributo inline.
  */
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111;max-width:760px;margin:0 auto;padding:24px">
    <h1 style="margin:0 0 4px;font-size:22px">${nomeDoProjeto}</h1>
    <p style="margin:0 0 18px;color:#666;font-size:14px">
      Ordem do Dia — Diária ${String(numero).padStart(2, '0')}${versao > 1 ? ` (v${versao})` : ''}
    </p>
    ${aviso}
    ${reuniao}
    ${conteudoDaOD}
    <p style="margin-top:32px;color:#888;font-size:12px">
      Enviado pelo SetProd. A confirmação de presença é feita no app — responder
      este email não confirma nada.
    </p>
  </div>`;
}
