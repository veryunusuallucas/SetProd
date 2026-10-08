import { Coffee, CodeXml } from 'lucide-react';

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
 * Sem destaque de propósito (PLANO-APOIO-ONBOARDING): aparece em Configurações e
 * no "obrigado" da avaliação, nunca no meio do trabalho.
 */
export const LINK_KOFI = 'https://ko-fi.com/veryunusuallucas';
export const LINK_GITHUB = 'https://github.com/veryunusuallucas/SetProd';

export function ApoioAoApp({ compacto = false }: { compacto?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {!compacto && (
        <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>
          O SetProd é feito por uma pessoa, para o cinema brasileiro, e o código é aberto.
          Se ele ajudou a sua produção, um café ajuda a mantê-lo de pé.
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: compacto ? 'center' : 'flex-start' }}>
        <a
          href={LINK_KOFI}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', minHeight: '40px' }}
        >
          <Coffee size={16} /> Pagar um café no Ko-fi
        </a>
        <a
          href={LINK_GITHUB}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', minHeight: '40px' }}
        >
          <CodeXml size={16} /> Ver o código no GitHub
        </a>
      </div>
    </div>
  );
}
