import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, FileText, Settings2 } from 'lucide-react';
import { Fogos } from './ui/Fogos';
import { resolverArquivo } from '../lib/arquivos';
import {
  FRASES_FIM_PADRAO, FRASES_WRAP_PADRAO, lembrar, numerosDoWrap, ondeEstamos, sortear, ultima,
  type DadosDoWrap,
} from '../lib/comemoracao';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * A carta de wrap — o fim do dia, na tela.
 *
 * ⚠️ ELA NÃO É SÓ UM "PARABÉNS". Uma comemoração genérica envelhece: o mesmo
 * gif, a mesma explosão, todo dia, por trinta dias. Os NÚMEROS não envelhecem,
 * porque são outros todo dia — e são a parte que alguém vai querer ler de novo,
 * ou mandar para o grupo.
 *
 * A ÚLTIMA DIÁRIA É OUTRA COISA. Terminar uma filmagem não é terminar um dia, e
 * o app sabe a diferença: no último dia a carta muda de frase, ganha o total da
 * produção inteira e fica mais tempo na tela.
 */

export interface CartaDeWrapProps {
  projetoId: string;
  numero: number;
  /** Quantas diárias a produção tem ao todo, quando dá para saber. */
  totalDiarias?: number;
  /** Esta é a última diária: o filme acabou. */
  ultimaDoFilme?: boolean;
  dados: DadosDoWrap;
  /** Total da produção inteira, só na última diária. */
  totaisDoFilme?: { diarias: number; cenas: number; paginas: string };
  /** As frases desta produção. Vazio = usa as de partida. */
  frases?: string[];
  /** Os gifs desta produção, como referências de arquivo. */
  gifs?: string[];
  aoFechar: () => void;
  /** Abre o relatório do dia. É a ação seguinte natural do wrap. */
  aoVerRelatorio?: () => void;
  /** Leva para onde se editam as frases e os gifs. */
  aoEditar?: () => void;
}

export function CartaDeWrap({
  projetoId, numero, totalDiarias, ultimaDoFilme, dados, totaisDoFilme,
  frases, gifs, aoFechar, aoVerRelatorio, aoEditar,
}: CartaDeWrapProps) {
  const reduzido = useMovimentoReduzido();
  const [gif, setGif] = useState<string | null>(null);

  /*
    Frase e gif são sorteados UMA vez, na montagem.

    Num `useMemo` sem dependências e não no corpo do componente: a carta
    re-renderiza quando o gif termina de carregar, e sortear de novo ali trocaria
    a frase debaixo dos olhos de quem está lendo.
  */
  const { frase, refDoGif } = useMemo(() => {
    /*
      ⚠️ LISTA VAZIA NÃO É LISTA AUSENTE.

      `undefined` é a produção que nunca mexeu: entram as frases de partida.
      `[]` é a produção que apagou todas — e aí a carta sai só com os números,
      que é o que a pessoa pediu ao apagar. Tratar as duas igual faria as frases
      de fábrica voltarem depois de apagadas, e nada faz desistir mais rápido
      de uma lista do que ela se recusar a ficar vazia.
    */
    const lista = (ultimaDoFilme
      ? [...FRASES_FIM_PADRAO, ...(frases || [])]
      : (frases ?? [...FRASES_WRAP_PADRAO])
    // Linha em branco na lista de edição não vira frase em branco na tela.
    ).filter(f => f.trim());

    const escolhida = sortear(lista, ultima(projetoId, 'frase')) || '';
    if (escolhida) lembrar(projetoId, 'frase', escolhida);

    const escolhidoGif = sortear(gifs || [], ultima(projetoId, 'gif'));
    if (escolhidoGif) lembrar(projetoId, 'gif', escolhidoGif);

    return { frase: escolhida, refDoGif: escolhidoGif };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let vivo = true;
    resolverArquivo(refDoGif).then(url => { if (vivo) setGif(url); });
    return () => { vivo = false; };
  }, [refDoGif]);

  const numeros = numerosDoWrap(dados);

  /*
    Esc fecha. A carta cobre a tela inteira e aparece sem ninguém pedir — ela
    precisa sair pelo caminho que a mão já conhece, e não só pelo X.
  */
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <>
      <Fogos
        duracaoMs={ultimaDoFilme ? 5200 : 2600}
        quantidade={ultimaDoFilme ? 11 : 5}
      />

      <div
        onClick={aoFechar}
        style={{
          position: 'fixed', inset: 0, zIndex: 9990, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
          backgroundColor: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
        }}
      >
        <motion.div
          onClick={e => e.stopPropagation()}
          initial={reduzido ? undefined : { opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={MOLA}
          className="card"
          style={{
            width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
            textAlign: 'center', padding: '28px 24px 22px', position: 'relative',
            border: `1px solid ${ultimaDoFilme ? 'var(--accent)' : 'var(--border-color)'}`,
          }}
        >
          <button
            onClick={aoFechar}
            className="btn-icon"
            aria-label="Fechar"
            style={{ position: 'absolute', top: '12px', right: '12px', width: 'auto' }}
          >
            <X size={18} />
          </button>

          <div className="text-xs text-muted uppercase tracking-widest">
            {ultimaDoFilme ? 'Fim da filmagem' : ondeEstamos(numero, totalDiarias)}
          </div>

          {frase && <h2
            className="font-bold"
            style={{
              fontSize: ultimaDoFilme ? 'clamp(28px, 6vw, 40px)' : 'clamp(22px, 5vw, 30px)',
              lineHeight: 1.15, margin: '8px 0 0',
              // O texto é o protagonista; os fogos só acontecem em volta dele.
              color: ultimaDoFilme ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {frase}
          </h2>}

          {/* O gif entra DEPOIS do texto e com altura limitada. Ele é o tempero,
              e um gif de tela cheia empurraria os números para fora da vista —
              que são a parte que a pessoa vai querer ler. */}
          {gif && (
            <img
              src={gif}
              alt=""
              style={{
                maxWidth: '100%', maxHeight: '200px', objectFit: 'contain',
                borderRadius: '10px', margin: '16px auto 0', display: 'block',
              }}
            />
          )}

          {numeros.length > 0 && (
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', justifyContent: 'center',
                gap: '10px', margin: '20px 0 0',
              }}
            >
              {numeros.map((n, i) => (
                <div
                  key={i}
                  style={{
                    flex: '1 1 120px', minWidth: '104px', padding: '12px 10px',
                    borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div
                    className="font-bold"
                    style={{
                      fontSize: '24px', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums',
                      color: n.tom === 'bom' ? 'var(--color-success)'
                        : n.tom === 'atencao' ? 'var(--color-warning)'
                        : 'var(--text-primary)',
                    }}
                  >
                    {n.valor}
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: '3px', lineHeight: 1.3 }}>
                    {n.rotulo}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* O fechamento da produção inteira. Só existe uma vez por filme, e é
              o número que ninguém tem à mão quando alguém pergunta. */}
          {ultimaDoFilme && totaisDoFilme && (
            <div
              className="text-sm"
              style={{
                marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border-light)',
                lineHeight: 1.7, color: 'var(--text-secondary)',
              }}
            >
              <b style={{ color: 'var(--text-primary)' }}>{totaisDoFilme.diarias}</b> diárias ·{' '}
              <b style={{ color: 'var(--text-primary)' }}>{totaisDoFilme.cenas}</b> cenas ·{' '}
              <b style={{ color: 'var(--text-primary)' }}>{totaisDoFilme.paginas}</b> de roteiro
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '22px' }}>
            {aoVerRelatorio && (
              <button
                onClick={() => { aoVerRelatorio(); aoFechar(); }}
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px' }}
              >
                <FileText size={16} /> Relatório do dia
              </button>
            )}
            <button
              onClick={aoFechar}
              className="btn-icon"
              style={{ padding: '10px 18px', border: '1px solid var(--border-light)', width: 'auto' }}
            >
              Fechar
            </button>
          </div>

          {/* ⚠️ O CAMINHO PARA EDITAR MORA AQUI, e não só numa tela de ajustes.
              É lendo a frase que a pessoa pensa "essa eu trocaria" — e um
              atalho a dois toques do pensamento é o que faz a lista virar dela
              de verdade em vez de continuar sendo a que veio de fábrica. */}
          {aoEditar && (
            <button
              onClick={() => { aoEditar(); aoFechar(); }}
              className="text-xs text-muted"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '14px',
                background: 'none', border: 'none', cursor: 'pointer',
              }}
            >
              <Settings2 size={12} /> escrever as frases e escolher os gifs desta produção
            </button>
          )}
        </motion.div>
      </div>
    </>,
    document.body
  );
}
