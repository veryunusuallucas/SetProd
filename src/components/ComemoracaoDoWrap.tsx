import { useState } from 'react';
import { ChevronDown, Eye, PartyPopper } from 'lucide-react';
import { FRASES_FIM, FRASES_WRAP, MIDIAS_WRAP } from '../lib/comemoracao';
import { CartaDeWrap } from './CartaDeWrap';

/**
 * O que a equipe vê no wrap — e de onde isso vem.
 *
 * ⚠️ ESTE CARD NÃO EDITA NADA, E ISSO É A MUDANÇA.
 *
 * Ele era um formulário: uma caixinha por frase, um upload por gif, tudo
 * gravado no projeto. Virou isto a pedido do Lucas, e a troca é boa — escrever
 * vinte frases num formulário é trabalho, num arquivo de texto é escrever; e
 * arrastar cinco gifs para uma pasta é um gesto, contra cinco uploads.
 *
 * A lista de verdade agora são dois lugares no repositório:
 *
 *     src/conteudo/wrap/frases.md
 *     src/conteudo/wrap/gifs/
 *
 * UMA FONTE SÓ. Não existe lista no banco por baixo — se existisse, apagar uma
 * frase do arquivo não a faria sumir da tela, e nada faz desistir mais rápido
 * de um arquivo do que ele se recusar a obedecer.
 *
 * O que sobrou aqui é o que o formulário tinha de melhor: **ver como fica**.
 * Ninguém escreve dez frases sem conferir como a primeira aparece na tela.
 */
export function ComemoracaoDoWrap() {
  const [aberto, setAberto] = useState(false);
  const [ensaiando, setEnsaiando] = useState(false);

  const total = FRASES_WRAP.length + FRASES_FIM.length;

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: aberto ? '14px' : 0 }}>
        <button
          onClick={() => setAberto(a => !a)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <PartyPopper size={15} style={{ color: 'var(--accent)' }} /> Comemoração do wrap
          </h2>
          {!aberto && (
            <span className="text-xs text-muted">
              {total} {total === 1 ? 'frase' : 'frases'}
              {MIDIAS_WRAP.length > 0 ? ` · ${MIDIAS_WRAP.length} ${MIDIAS_WRAP.length === 1 ? 'gif' : 'gifs'}` : ''}
            </span>
          )}
          <ChevronDown size={16} className="text-muted" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {aberto && (
          <>
            <div className="text-xs text-secondary" style={{ lineHeight: 1.7 }}>
              No fim de cada diária o app mostra os números do dia com uma frase sorteada —
              sem repetir a do dia anterior — e um gif, quando há algum. No <b>último dia da
              filmagem</b> a carta é outra, com o total da produção inteira.
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Contagem valor={FRASES_WRAP.length} rotulo="frases de fim de dia" />
              <Contagem valor={FRASES_FIM.length} rotulo="frases de fim de filme" />
              <Contagem valor={MIDIAS_WRAP.length} rotulo={MIDIAS_WRAP.length === 1 ? 'gif' : 'gifs'} />
            </div>

            {/*
              O caminho do arquivo aparece porque quem lê este card é quem mexe
              no app. Numa tela que a equipe inteira vê, dizer "fale com a
              produção" seria mais educado e menos útil: quem quer trocar a
              frase é justamente quem tem o repositório aberto.
            */}
            <div
              className="text-xs"
              style={{
                lineHeight: 1.8, padding: '12px', borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
              }}
            >
              As frases e os gifs moram no código, e não aqui:
              <div style={{ margin: '6px 0', fontFamily: 'ui-monospace, monospace', color: 'var(--text-primary)' }}>
                src/conteudo/wrap/frases.md<br />
                src/conteudo/wrap/gifs/
              </div>
              Escreva as frases no arquivo, jogue os arquivos na pasta — aceita <b>gif</b>,
              webp, png, jpg e <b>mp4</b> (que pesa bem menos). <b>Só aparece depois de
              publicar</b>: a leitura acontece quando o app é montado, não quando ele é
              aberto. Em troca, tudo funciona no set sem sinal.
            </div>

            <button
              onClick={() => setEnsaiando(true)}
              className="btn-icon"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: '1px solid var(--border-light)', width: 'auto', fontSize: '13px' }}
            >
              <Eye size={14} /> Ver como fica
            </button>
          </>
        )}
      </div>

      {/*
        O ensaio usa a carta DE VERDADE, com números de mentira.

        Uma prévia desenhada à parte seria outra tela para manter em pé, e ela
        divergiria da real no primeiro ajuste — que é exatamente o problema que
        este app acabou de resolver na Ordem do Dia.
      */}
      {ensaiando && (
        <CartaDeWrap
          projetoId="ensaio"
          numero={3}
          totalDiarias={12}
          dados={{
            gravadas: 6, parciais: 1, naoGravadas: 0,
            oitavosGravados: 35, setups: 14,
            wrapReal: '19:20', wrapPlanejado: '19:32', diferencaMin: -12,
          }}
          aoFechar={() => setEnsaiando(false)}
        />
      )}
    </>
  );
}

function Contagem({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <div
      style={{
        flex: '1 1 110px', minWidth: '100px', padding: '10px',
        borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div className="font-bold" style={{ fontSize: '20px', lineHeight: 1.1, color: valor === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}>
        {valor}
      </div>
      <div className="text-xs text-muted" style={{ marginTop: '2px', lineHeight: 1.3 }}>{rotulo}</div>
    </div>
  );
}
