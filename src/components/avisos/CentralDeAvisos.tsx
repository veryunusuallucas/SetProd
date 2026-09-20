import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { MOLA } from '../ui/ia';

/**
 * Um lugar só para os avisos do topo da produção.
 *
 * O PROBLEMA QUE ISTO RESOLVE (leva de UI 3, item 1)
 * Em uma semana o topo juntou seis faixas possíveis — acesso alterado, pedido
 * de ficha, pedido de acesso, conflito de edição, "diga quem você é" e modo
 * administrador —, todas com o mesmo fundo âmbar, uma embaixo da outra. Seis
 * avisos empilhados não são seis avisos: são um bloco que a pessoa aprende a
 * pular, e aí o único que importava passa junto com o resto.
 *
 * A REGRA
 * Aparece **um** — o mais urgente —, e os outros viram uma linha ("+2 avisos")
 * que abre. Nada some: o que muda é quem está competindo por atenção.
 *
 * PRIORIDADE, do mais para o menos urgente:
 *   100 dado em risco (conflito de edição)
 *    80 alguém esperando por mim (pedido de ficha ou de acesso)
 *    60 o meu acesso mudou
 *    40 falta você dizer quem é
 *
 * Empate não existe de propósito: dois avisos com o mesmo número virariam uma
 * ordem que depende de qual componente montou primeiro, e isso muda sozinho.
 */

export const URGENCIA = {
  dadoEmRisco: 100,
  esperandoPorMim: 80,
  meuAcessoMudou: 60,
  faltaSeApresentar: 40,
} as const;

interface Publicado {
  id: string;
  urgencia: number;
  render: () => React.ReactNode;
}

interface Central {
  publicar: (p: Publicado) => void;
  retirar: (id: string) => void;
}

const Ctx = createContext<Central | null>(null);

/**
 * Publica um aviso na central.
 *
 * `chave` é o que diz "mudou de verdade": ela entra na comparação, e o JSX não
 * — JSX é objeto novo a cada render, e compará-lo faria a central se redesenhar
 * para sempre. Passe `null` quando não há nada a dizer.
 */
export function usarAviso(
  id: string,
  urgencia: number,
  chave: string | null,
  render: () => React.ReactNode,
) {
  const central = useContext(Ctx);
  const ultimoRender = useRef(render);
  ultimoRender.current = render;

  useEffect(() => {
    if (!central) return;
    if (!chave) { central.retirar(id); return; }
    central.publicar({ id, urgencia, render: () => ultimoRender.current() });
    return () => central.retirar(id);
  }, [central, id, urgencia, chave]);
}

export function ProvedorDeAvisos({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = useState<Publicado[]>([]);

  const publicar = useCallback((p: Publicado) => {
    setItens(atuais => [...atuais.filter(x => x.id !== p.id), p]);
  }, []);
  const retirar = useCallback((id: string) => {
    setItens(atuais => atuais.filter(x => x.id !== id));
  }, []);

  const central = useMemo(() => ({ publicar, retirar }), [publicar, retirar]);

  return (
    <Ctx.Provider value={central}>
      <Pilha itens={itens} />
      {children}
    </Ctx.Provider>
  );
}

function Pilha({ itens }: { itens: Publicado[] }) {
  const [abertos, setAbertos] = useState(false);
  const ordenados = [...itens].sort((a, b) => b.urgencia - a.urgencia);

  // Fecha sozinho quando sobra um: manter "ver todos" aberto com um item só
  // deixaria um botão que não faz nada.
  useEffect(() => { if (ordenados.length <= 1) setAbertos(false); }, [ordenados.length]);

  if (!ordenados.length) return null;
  const visiveis = abertos ? ordenados : ordenados.slice(0, 1);
  const escondidos = ordenados.length - visiveis.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
      <AnimatePresence initial={false}>
        {visiveis.map(item => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={MOLA}
          >
            {item.render()}
          </motion.div>
        ))}
      </AnimatePresence>

      {escondidos > 0 && (
        <button
          type="button"
          onClick={() => setAbertos(true)}
          className="text-xs text-secondary"
          style={{
            alignSelf: 'flex-start', background: 'none', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 0',
          }}
        >
          <ChevronDown size={14} />
          {escondidos === 1 ? 'mais 1 aviso' : `mais ${escondidos} avisos`}
        </button>
      )}
    </div>
  );
}
