import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { HelpCircle, X, Info, Sparkles, Send, MessageCircleQuestion, ChevronDown, ChevronRight } from 'lucide-react';
import { MANUAL, secaoDaRota, type SecaoManual } from '../lib/manual';
import { responderDuvida } from '../lib/gemini';
import { iaDisponivel } from '../lib/gemini';
import { MOLA } from './ui/ia';

/**
 * A ajuda do app.
 *
 * Duas coisas mudaram em relação à versão que só existia na tela inicial:
 *
 *   ELA SABE ONDE VOCÊ ESTÁ. Abrindo na Decupagem, a seção da Decupagem já vem
 *   aberta e primeiro. Antes eram 20 seções fechadas em ordem fixa, e achar a
 *   sua era rolar até topar com ela.
 *
 *   ELA RESPONDE PERGUNTA. Um campo de texto que consulta a IA — e a IA lê SÓ o
 *   manual. Se a resposta não estiver lá, ela diz que não sabe e oferece mandar
 *   a dúvida, em vez de inventar uma funcionalidade que o app não tem.
 */

interface Props {
  style?: React.CSSProperties;
  /** Controle externo — o menu flutuante abre a ajuda sem renderizar o botão. */
  abertoExterno?: boolean;
  aoFechar?: () => void;
  mostrarBotao?: boolean;
  /** Para o "não achei minha resposta" abrir o formulário de dúvida. */
  aoPerguntarAoDev?: (pergunta: string) => void;
}

export function HelpButton({ style, abertoExterno, aoFechar, mostrarBotao = true, aoPerguntarAoDev }: Props) {
  const [abertoInterno, setAbertoInterno] = useState(false);
  const aberto = abertoExterno ?? abertoInterno;

  const fechar = () => {
    setAbertoInterno(false);
    aoFechar?.();
  };

  const daTela = typeof window !== 'undefined' ? secaoDaRota(window.location.pathname) : undefined;

  /** Quais seções estão abertas. A da tela já nasce aberta; o resto, fechado. */
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (aberto) setExpandidas(new Set(daTela ? [daTela.id] : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, daTela?.id]);

  const alternar = (id: string) => setExpandidas(atual => {
    const p = new Set(atual);
    if (p.has(id)) p.delete(id); else p.add(id);
    return p;
  });

  // ---- a pergunta ----
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<string | null>(null);
  const [pensando, setPensando] = useState(false);
  const [erroIA, setErroIA] = useState('');

  /*
    O campo de pergunta some sem internet, de propósito.

    O app é offline-first e a IA não é. Um campo que aceita texto e falha depois
    é pior que campo nenhum: a pessoa digita a dúvida, espera, e leva um erro —
    quando o manual inteiro estava ali do lado o tempo todo.
  */
  const podePerguntar = iaDisponivel() && navigator.onLine;

  const perguntar = async () => {
    const p = pergunta.trim();
    if (!p) return;

    setPensando(true);
    setErroIA('');
    setResposta(null);
    try {
      const texto = await responderDuvida({
        pergunta: p,
        manual: MANUAL.map(s => `## ${s.titulo}\n${s.texto}`).join('\n\n'),
        tela: daTela?.titulo,
      });
      setResposta(texto);
    } catch (e: any) {
      setErroIA(e?.message || 'Não consegui responder agora. O manual está logo abaixo.');
    } finally {
      setPensando(false);
    }
  };

  // Seção da tela primeiro, o resto na ordem original. Reordenar o manual todo
  // confundiria quem já sabe onde as coisas ficam.
  const ordenadas: SecaoManual[] = daTela
    ? [daTela, ...MANUAL.filter(s => s.id !== daTela.id)]
    : MANUAL;

  return (
    <>
      {mostrarBotao && (
        <button
          onClick={() => setAbertoInterno(true)}
          className="btn-icon"
          title="Ajuda / Como funciona"
          style={{ padding: 0, ...style }}
        >
          <HelpCircle size={20} />
        </button>
      )}

      {/*
        Vai para o `body` por portal, e não fica onde o componente mora.

        O botão de ajuda vive dentro do cabeçalho, que tem `position: relative` e
        `z-index: 1` — e isso cria um contexto de empilhamento. Dentro dele, o
        `z-index: 3000` do modal só disputa com irmãos do próprio cabeçalho: o
        cabeçalho inteiro continua valendo 1, e o título e os cards, que vêm
        depois no DOM, desenhavam por cima do manual.
      */}
      {aberto && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={fechar}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={MOLA}
            onClick={e => e.stopPropagation()}
            className="card"
            style={{ width: '100%', maxWidth: '620px', maxHeight: '86vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
          >
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <h2 className="font-bold text-lg" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={18} color="var(--accent)" /> Como funciona
              </h2>
              <button onClick={fechar} className="btn-icon" aria-label="Fechar"><X size={20} /></button>
            </div>

            <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* ---- perguntar ---- */}
              {podePerguntar && (
                <div style={{ padding: '14px', borderRadius: '12px', border: '1px solid var(--border-light)', background: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '9px' }}>
                    <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-bold uppercase tracking-widest text-secondary">Pergunte</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={pergunta}
                      onChange={e => setPergunta(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') perguntar(); }}
                      placeholder="Como faço para a outra equipe ver minha produção?"
                      style={{ flex: 1, minWidth: 0 }}
                      disabled={pensando}
                    />
                    <button className="btn btn-primary" onClick={perguntar} disabled={pensando || !pergunta.trim()}>
                      <Send size={15} /> {pensando ? '…' : 'Ir'}
                    </button>
                  </div>

                  {erroIA && <div className="text-xs" style={{ marginTop: '8px', color: 'var(--color-danger)' }}>{erroIA}</div>}

                  {resposta && (
                    <div style={{ marginTop: '12px' }}>
                      <p className="text-sm" style={{ margin: 0, lineHeight: 1.6 }}>{resposta}</p>

                      {/*
                        A escada de saída.

                        Quando a IA não sabe, o caminho já existia: o formulário
                        de problema tem o tipo "dúvida" desde sempre, escondido
                        atrás de um ícone de inseto que ninguém associava a
                        perguntar. Aqui ele aparece na hora certa, já com a
                        pergunta digitada.

                        E isso fecha um ciclo útil: as dúvidas que a IA não soube
                        responder viram a lista do que falta no manual.
                      */}
                      {aoPerguntarAoDev && (
                        <button
                          onClick={() => { aoPerguntarAoDev(pergunta); fechar(); }}
                          className="text-xs"
                          style={{ marginTop: '10px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '5px' }}
                        >
                          <MessageCircleQuestion size={13} /> Não era isso — mandar a dúvida para o Viol
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ---- o manual ---- */}
              {daTela && (
                <div className="text-xs text-muted">
                  Você está em <strong>{daTela.titulo}</strong> — esta seção vem primeiro.
                </div>
              )}

              {ordenadas.map(s => {
                const expandida = expandidas.has(s.id);
                return (
                  <div key={s.id} style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
                    <button
                      onClick={() => alternar(s.id)}
                      style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', padding: 0 }}
                    >
                      {expandida ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      <span className="font-bold text-sm">{s.titulo}</span>
                    </button>
                    {expandida && (
                      <p className="text-sm text-secondary" style={{ lineHeight: 1.65, margin: '8px 0 0 23px' }}>
                        {s.texto}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={fechar} className="btn btn-primary">Entendi</button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </>
  );
}
