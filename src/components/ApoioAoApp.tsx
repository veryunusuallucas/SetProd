import { CodeXml, Heart } from 'lucide-react';

/**
 * Apoiar o SetProd: Ko-fi e o código no GitHub.
 *
 * POR QUE NÃO O WIDGET DO KO-FI
 * O Ko-fi oferece um script (overlay-widget.js) que desenha o botão flutuante.
 * Ele não entra aqui de propósito: um script de outro site rodando na página do
 * app enxerga tudo o que o app enxerga — inclusive a sessão de quem está logado
 * e a ficha da equipe. A política de segurança do app (vercel.json) também o
 * bloquearia. Um link comum leva para a mesma página de apoio, sem nada de fora
 * rodando aqui dentro.
 *
 * O BOTÃO DO CAFÉ (pedido do Lucas: "mais bonitinho"): uma xícara com vapor
 * subindo, degradê quente e um brilho que atravessa ao passar o mouse. Tudo em
 * CSS (`.botao-cafe` em index.css); com movimento reduzido, o vapor fica parado.
 *
 * Sem destaque de propósito (PLANO-APOIO-ONBOARDING): aparece em Configurações e
 * no "obrigado" da avaliação, nunca no meio do trabalho.
 */
export const LINK_KOFI = 'https://ko-fi.com/veryunusuallucas';
export const LINK_GITHUB = 'https://github.com/veryunusuallucas/SetProd';

export function ApoioAoApp({ compacto = false }: { compacto?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: compacto ? 'center' : 'stretch' }}>
      {!compacto && (
        <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>
          O SetProd é feito por uma pessoa, para o cinema brasileiro, e o código é aberto.
          Se ele ajudou a sua produção, um café ajuda a mantê-lo de pé.
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: compacto ? 'center' : 'flex-start' }}>
        <a href={LINK_KOFI} target="_blank" rel="noopener noreferrer" className="botao-cafe">
          <span className="botao-cafe-xicara" aria-hidden="true">
            <span className="botao-cafe-vapor"><i /><i /><i /></span>
            <svg viewBox="0 0 32 32" width="30" height="30">
              {/* xícara */}
              <path d="M5 12h18v7a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z" fill="currentColor" />
              {/* alça */}
              <path d="M23 14h2.5a3.5 3.5 0 0 1 0 7H22.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              {/* pires */}
              <rect x="3" y="27" width="22" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />
            </svg>
            <Heart className="botao-cafe-coracao" size={10} fill="currentColor" strokeWidth={0} />
          </span>
          <span className="botao-cafe-texto">
            <strong>Pagar um café</strong>
            <small>no Ko-fi · mantém o SetProd de pé</small>
          </span>
        </a>

        {/* Mesmo formato do café, em tom neutro: o café é o pedido, o código é o convite. */}
        <a href={LINK_GITHUB} target="_blank" rel="noopener noreferrer" className="botao-cafe botao-codigo">
          <span className="botao-cafe-xicara" aria-hidden="true">
            {/* A marca do GitHub (Simple Icons, CC0) — o lucide não traz marcas. */}
            <svg viewBox="0 0 24 24" width="22" height="22" style={{ marginTop: 0 }}>
              <path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 0-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.4 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.5.4.9 1.1.9 2.2v3.3c0 .3.1.7.8.6A12 12 0 0 0 12 .3" />
            </svg>
            <CodeXml className="botao-codigo-sinal" size={10} strokeWidth={3} />
          </span>
          <span className="botao-cafe-texto">
            <strong>Ver o código</strong>
            <small>no GitHub · é aberto, dá para ajudar</small>
          </span>
        </a>
      </div>
    </div>
  );
}
