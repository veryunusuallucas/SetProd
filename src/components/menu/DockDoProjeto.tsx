import { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';
import { Menu, type LucideIcon } from 'lucide-react';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';

/**
 * A barra de baixo do celular, agora uma dock.
 *
 * Duas mudanças em cima da barra antiga:
 *
 * - **um marcador que desliza** até o módulo aberto, em vez da cor trocando de
 *   lugar num piscar. É o mesmo `layoutId` da faixa de abas da Logagem: ver
 *   qual item o marcador deixou é o que diz de onde você veio;
 * - **flutua**, com o conteúdo passando por baixo do vidro, em vez de terminar
 *   numa faixa colada no rodapé.
 *
 * Ela NÃO some ao rolar (decidido com o Lucas em 17/09/2026): no set ninguém
 * procura o menu, ele tem que estar onde estava da última vez que se olhou.
 *
 * Os três primeiros lugares são fixos e escolhidos por quem usa; o quarto
 * acompanha o último módulo aberto (ver `modulosDaDock.ts`). SEGURAR um fixo
 * abre o editor já nele — o gesto de "quero outro aqui" é no próprio lugar.
 */

export interface ItemDaDock {
  nome: string;
  path: string;
  icone: LucideIcon;
  exact?: boolean;
}

/** Quanto segurar para virar "editar" e não "abrir". */
const SEGURAR_MS = 500;

export function DockDoProjeto({ itens, indiceAtivo, fluido, aoAbrirMais, aberta, aoSegurar, refDaBarra }: {
  itens: ItemDaDock[];
  /** Qual item é o módulo aberto (-1: nenhum). Quem sabe é o layout. */
  indiceAtivo: number;
  /** O lugar que muda sozinho: o conteúdo dele entra com um fade na troca. */
  fluido?: number;
  aoAbrirMais: () => void;
  /** A folha do "Mais" está aberta: o botão fica marcado. */
  aberta: boolean;
  /** Segurou o item `n`: abrir o editor da dock nele. */
  aoSegurar?: (n: number) => void;
  /** Medida pelo menu flutuante, para o "?" não cair em cima da dock. */
  refDaBarra?: (el: HTMLElement | null) => void;
}) {
  const reduzido = useMovimentoReduzido();
  // Com a folha aberta, o marcador vai para o "Mais": ele mostra onde você está.
  const marcado = aberta ? itens.length : indiceAtivo;

  const relogio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inicio = useRef({ x: 0, y: 0 });
  /** Segurou até o fim: o clique que vem junto com o soltar não navega. */
  const segurou = useRef(false);

  const soltar = () => clearTimeout(relogio.current);
  const apertar = (n: number) => (e: React.PointerEvent) => {
    if (!aoSegurar) return;
    segurou.current = false;
    inicio.current = { x: e.clientX, y: e.clientY };
    clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      segurou.current = true;
      navigator.vibrate?.(12);
      aoSegurar(n);
    }, SEGURAR_MS);
  };
  // Dedo que escorregou é rolagem ou arrasto, não "segurar".
  const mover = (e: React.PointerEvent) => {
    if (Math.hypot(e.clientX - inicio.current.x, e.clientY - inicio.current.y) > 10) soltar();
  };

  const marcador = (sim: boolean) => sim && (
    <motion.span
      layoutId="dock-marcador"
      transition={reduzido ? { duration: 0 } : MOLA}
      aria-hidden
      className="dock-marcador"
    />
  );

  return (
    <nav ref={refDaBarra} className="dock-nav celular-only" aria-label="Módulos da produção">
      {itens.map((i, n) => {
        const conteudo = (
          <span className="dock-conteudo">
            <i.icone size={20} />
            <span>{i.nome}</span>
          </span>
        );
        return (
          <NavLink
            key={n}
            to={i.path}
            end={i.exact}
            /*
              `className` como FUNÇÃO de propósito: em string, o NavLink
              acrescenta "active" por conta própria, e aí o item continuava
              dourado com a folha do "Mais" aberta — dois lugares marcados ao
              mesmo tempo. Quem decide aqui é o marcador.
            */
            className={() => `nav-item ${n === marcado ? 'active' : ''}`}
            onPointerDown={apertar(n)}
            onPointerMove={mover}
            onPointerUp={soltar}
            onPointerLeave={soltar}
            onPointerCancel={soltar}
            onClick={e => { if (segurou.current) { e.preventDefault(); segurou.current = false; } }}
            // O menu do Android para links ("abrir em nova aba") não é daqui.
            onContextMenu={e => { if (aoSegurar) e.preventDefault(); }}
          >
            {marcador(n === marcado)}
            {n === fluido && !reduzido ? (
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={i.path}
                  className="dock-fluido"
                  initial={{ opacity: 0, y: 6, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                >
                  {conteudo}
                </motion.span>
              </AnimatePresence>
            ) : conteudo}
          </NavLink>
        );
      })}

      <button
        type="button"
        className={`nav-item ${aberta ? 'active' : ''}`}
        onClick={aoAbrirMais}
        aria-haspopup="dialog"
        aria-expanded={aberta}
      >
        {marcador(aberta)}
        <span className="dock-conteudo">
          <Menu size={20} />
          <span>Mais</span>
        </span>
      </button>
    </nav>
  );
}
