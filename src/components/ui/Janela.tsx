import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { MOLA } from './ia';
import { useMovimentoReduzido } from './movimento';

/**
 * A base de toda janela do app.
 *
 * O QUE ISTO CONSERTA (leva de UI 3, item 3)
 * Em 20/09/2026 o app tinha **34 janelas feitas à mão**. Dessas, 10 fechavam no
 * Esc, 15 fechavam clicando fora e **uma** travava a rolagem do fundo. Ou seja:
 * a mesma tela respondia diferente conforme a janela que você abriu — e o
 * "fechar" que funcionou na anterior falha na seguinte. Ninguém relata isso
 * como bug; a pessoa só aprende a desconfiar do app.
 *
 * O QUE TODA JANELA GANHA AQUI
 * · portal no `body` — nenhum `overflow` de pai corta a janela;
 * · Esc fecha;
 * · clique fora fecha (no fundo, não no conteúdo);
 * · a página atrás para de rolar enquanto a janela está aberta;
 * · o foco entra na janela ao abrir e VOLTA para onde estava ao fechar;
 * · `aria-modal`, para quem usa leitor de tela saber que o resto está suspenso.
 *
 * O que ela NÃO faz: decidir o conteúdo. Cabeçalho, corpo e rodapé são da tela.
 */
export function Janela({
  titulo, icone, aoFechar, children, rodape, largura = '560px', fecharClicandoFora = true,
}: {
  titulo: React.ReactNode;
  icone?: React.ReactNode;
  aoFechar: () => void;
  children: React.ReactNode;
  /** Os botões do fim, quando houver. Ficam grudados na base da janela. */
  rodape?: React.ReactNode;
  largura?: string;
  /**
   * `false` em formulário longo: clique fora com meia ficha preenchida apaga
   * trabalho, e "tem certeza?" em cima de um clique errado é pior ainda.
   */
  fecharClicandoFora?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<Element | null>(null);
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    focoAnterior.current = document.activeElement;

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); aoFechar(); }
    };
    document.addEventListener('keydown', aoTeclar);

    // A rolagem do fundo: sem isto, rolar dentro da janela leva a página atrás
    // junto, e no celular a pessoa perde o lugar onde estava.
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // O foco entra na janela — no primeiro campo, se houver, senão nela mesma.
    const alvo = caixa.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button:not([data-fechar])'
    );
    (alvo ?? caixa.current)?.focus?.();

    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = antes;
      // Devolve o foco para o botão que abriu: sem isto, quem navega por
      // teclado volta para o começo da página a cada janela fechada.
      (focoAnterior.current as HTMLElement | null)?.focus?.();
    };
  }, [aoFechar]);

  return createPortal(
    <div
      onClick={fecharClicandoFora ? aoFechar : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 3900, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', width: `min(${largura}, 100%)`,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)', outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 18px 12px' }}>
          {icone && <span style={{ display: 'flex', color: 'var(--accent)' }}>{icone}</span>}
          <h2 style={{ margin: 0, fontSize: '18px', flex: 1, minWidth: 0 }}>{titulo}</h2>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar" data-fechar>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0 18px 18px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {rodape && (
          <div style={{
            display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap',
            padding: '12px 18px', borderTop: '1px solid var(--border-light)',
          }}>
            {rodape}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
