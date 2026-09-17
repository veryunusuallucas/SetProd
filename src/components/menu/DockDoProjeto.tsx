import { motion } from 'framer-motion';
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
 */

export interface ItemDaDock {
  nome: string;
  path: string;
  icone: LucideIcon;
  exact?: boolean;
}

export function DockDoProjeto({ itens, ativo, aoAbrirMais, aberta, refDaBarra }: {
  itens: ItemDaDock[];
  /** O caminho de agora, para saber onde o marcador para. */
  ativo: string;
  aoAbrirMais: () => void;
  /** A folha do "Mais" está aberta: o botão fica marcado. */
  aberta: boolean;
  /** Medida pelo menu flutuante, para o "?" não cair em cima da dock. */
  refDaBarra?: (el: HTMLElement | null) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const daqui = (i: ItemDaDock) => (i.exact ? ativo === i.path : ativo.startsWith(i.path));
  // Com a folha aberta, o marcador vai para o "Mais": ele mostra onde você está.
  const indiceAtivo = aberta ? itens.length : itens.findIndex(daqui);

  const marcador = (marcado: boolean) => marcado && (
    <motion.span
      layoutId="dock-marcador"
      transition={reduzido ? { duration: 0 } : MOLA}
      aria-hidden
      className="dock-marcador"
    />
  );

  return (
    <nav ref={refDaBarra} className="dock-nav celular-only" aria-label="Módulos da produção">
      {itens.map((i, n) => (
        <NavLink
          key={i.path}
          to={i.path}
          end={i.exact}
          /*
            `className` como FUNÇÃO de propósito: em string, o NavLink
            acrescenta "active" por conta própria, e aí o item continuava
            dourado com a folha do "Mais" aberta — dois lugares marcados ao
            mesmo tempo. Quem decide aqui é o marcador.
          */
          className={() => `nav-item ${!aberta && n === indiceAtivo ? 'active' : ''}`}
        >
          {marcador(!aberta && n === indiceAtivo)}
          <span className="dock-conteudo">
            <i.icone size={20} />
            <span>{i.nome}</span>
          </span>
        </NavLink>
      ))}

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
