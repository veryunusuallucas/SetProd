import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from './movimento';

/**
 * A pergunta de "tem certeza?", feita pelo app e não pelo navegador.
 *
 * ⚠️ POR QUE O `window.confirm` TEVE QUE SAIR DE TODO LUGAR
 *
 * Ele tem um jeito de falhar que ninguém consegue diagnosticar: depois de
 * algumas caixas seguidas, o navegador oferece "impedir que esta página crie
 * mais caixas de diálogo". Quem marca isso — e a caixinha fica marcada — passa a
 * receber `false` na hora, sem ver nada.
 *
 * O efeito é o botão que não faz nada. Não dá erro, não escreve no console, não
 * há o que investigar. Foi assim que "não consigo apagar diárias" apareceu, e
 * depois "o botão de voltar não pergunta nada": o mesmo defeito em dois lugares
 * que pareciam não ter relação.
 *
 * COMO USAR
 * É uma função de módulo, não um hook — assim ela serve também dentro de
 * `lib/`, longe de qualquer componente:
 *
 *     if (!(await confirmar('Apagar esta cena?'))) return;
 *
 * O host `<Confirmacoes />` precisa estar montado uma vez, no App.
 */

export interface OpcoesConfirmacao {
  titulo: string;
  /** O detalhe: o que exatamente vai acontecer, e o que NÃO vai. */
  detalhe?: string;
  /** Rótulo do botão que confirma. "Apagar", "Sair", "Continuar". */
  confirmar?: string;
  cancelar?: string;
  /** Ação destrutiva pinta o botão de vermelho. */
  perigo?: boolean;
}

interface Pedido extends OpcoesConfirmacao {
  resolver: (resposta: boolean) => void;
}

/*
  Uma função de assinatura, guardada no módulo.

  O mesmo padrão do `faiscar`: quem chama não precisa de contexto, de provider
  nem de prop passada de mão em mão até o fundo da árvore.
*/
let abrir: ((p: Pedido) => void) | null = null;

export function confirmar(opcoes: string | OpcoesConfirmacao): Promise<boolean> {
  const o = typeof opcoes === 'string' ? { titulo: opcoes } : opcoes;

  /*
    Sem o host montado, a pergunta VIRA UM SIM.

    Parece perigoso e é o menor dos males: o host está no App e só falta em
    teste ou numa tela que renderiza fora dele. Devolver `false` ali travaria
    ações legítimas exatamente como o `window.confirm` bloqueado fazia — que é o
    defeito que este arquivo existe para matar. E cair de volta no
    `window.confirm` seria voltar para o problema de propósito.
  */
  if (!abrir) return Promise.resolve(true);

  return new Promise<boolean>(resolver => abrir!({ ...o, resolver }));
}

export function Confirmacoes() {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    abrir = p => setPedido(p);
    return () => { abrir = null; };
  }, []);

  const responder = (resposta: boolean) => {
    pedido?.resolver(resposta);
    setPedido(null);
  };

  /*
    Esc cancela, Enter confirma.

    O `window.confirm` fazia isso de graça, e perder o teclado ao trocá-lo seria
    piorar o que se veio consertar — quem trabalha rápido responde a caixa sem
    tirar a mão do teclado.
  */
  useEffect(() => {
    if (!pedido) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); responder(false); }
      if (e.key === 'Enter') { e.preventDefault(); responder(true); }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  return createPortal(
    <AnimatePresence>
      {pedido && (
        <div
          style={{
            position: 'fixed', inset: 0,
            // Acima de tudo: ela é chamada de dentro de modais que já estão no
            // topo, e uma pergunta atrás do que a fez aparecer é uma tela morta.
            zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(3px)',
          }}
          onClick={() => responder(false)}
        >
          <motion.div
            initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={MOLA}
            onClick={e => e.stopPropagation()}
            className="card"
            style={{
              width: '100%', maxWidth: '400px',
              borderLeft: `3px solid ${pedido.perigo ? 'var(--color-danger)' : 'var(--accent)'}`,
              display: 'flex', flexDirection: 'column', gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertTriangle
                size={20}
                style={{ color: pedido.perigo ? 'var(--color-danger)' : 'var(--accent)', flexShrink: 0, marginTop: '2px' }}
              />
              <div style={{ minWidth: 0 }}>
                <div className="text-sm font-bold" style={{ lineHeight: 1.45 }}>{pedido.titulo}</div>
                {pedido.detalhe && (
                  <div className="text-xs text-secondary" style={{ lineHeight: 1.6, marginTop: '5px' }}>
                    {pedido.detalhe}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => responder(false)} className="btn-secondary" style={{ flex: 1 }}>
                {pedido.cancelar || 'Cancelar'}
              </button>
              <button
                onClick={() => responder(true)}
                className="btn-primary"
                autoFocus
                style={{
                  flex: 1,
                  ...(pedido.perigo ? { backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' } : {}),
                }}
              >
                {pedido.confirmar || 'Confirmar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
