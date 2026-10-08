import { Bug, Star, Share2, Heart } from 'lucide-react';
import { Janela } from './ui/Janela';
import { ApoioAoApp } from './ApoioAoApp';

/**
 * "Apoie o SetProd" — aberta pelo botão Apoiar, em Configurações.
 *
 * Diz por que apoiar sem pedir com culpa: o app é de graça, alguém paga o
 * servidor e a IA, e o apoio é o que segura isso. E lembra que dinheiro não é
 * o único jeito de ajudar — relatar, avaliar e indicar também mantêm o app vivo.
 */
export function PaginaDeApoio({ aoFechar, aoRelatar, aoAvaliar }: {
  aoFechar: () => void;
  aoRelatar: () => void;
  aoAvaliar: () => void;
}) {
  const indicar = async () => {
    const dados = { title: 'SetProd', text: 'O app que organiza a produção inteira — diárias, OD, equipe e acertos.', url: 'https://setprodapp.vercel.app' };
    try {
      if (navigator.share) await navigator.share(dados);
      else { await navigator.clipboard.writeText(dados.url); alert('Link do SetProd copiado.'); }
    } catch { /* a pessoa cancelou o compartilhar */ }
  };

  const outros = [
    { icone: <Bug size={16} />, titulo: 'Relatar um problema', texto: 'Cada relato vira conserto.', acao: aoRelatar },
    { icone: <Star size={16} />, titulo: 'Dar sua opinião', texto: 'É o que decide o que vem depois.', acao: aoAvaliar },
    { icone: <Share2 size={16} />, titulo: 'Indicar para alguém', texto: 'Outra produção usando é o melhor apoio.', acao: indicar },
  ];

  return (
    <Janela titulo="Apoie o SetProd" icone={<Heart size={18} />} aoFechar={aoFechar} largura="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <div className="apoio-topo">
          <span className="apoio-topo-xicara" aria-hidden="true">
            <span className="botao-cafe-vapor"><i /><i /><i /></span>
            <svg viewBox="0 0 32 32" width="56" height="56">
              <path d="M5 12h18v7a7 7 0 0 1-7 7h-4a7 7 0 0 1-7-7z" fill="currentColor" />
              <path d="M23 14h2.5a3.5 3.5 0 0 1 0 7H22.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              <rect x="3" y="27" width="22" height="2.4" rx="1.2" fill="currentColor" opacity="0.55" />
            </svg>
          </span>
          <h2 className="font-bold" style={{ fontSize: 'clamp(20px, 5vw, 26px)', margin: 0 }}>Um café para o set inteiro</h2>
          <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.6, maxWidth: '440px' }}>
            O SetProd é de graça e não tem propaganda. É feito por uma pessoa, para o cinema
            brasileiro, com o código aberto. Quanto mais produções usam, mais custam o
            servidor e a IA — e é o apoio de quem usa que mantém tudo de pé.
          </p>
        </div>

        <ApoioAoApp compacto />

        <div>
          <p className="text-xs text-muted uppercase tracking-widest" style={{ margin: '0 0 10px', fontWeight: 700 }}>Outras formas de ajudar</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {outros.map(o => (
              <button key={o.titulo} type="button" onClick={o.acao} className="apoio-outro">
                <span className="boas-vindas-icone">{o.icone}</span>
                <span style={{ textAlign: 'left' }}>
                  <span className="font-bold text-sm" style={{ display: 'block' }}>{o.titulo}</span>
                  <span className="text-xs text-secondary">{o.texto}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Janela>
  );
}
