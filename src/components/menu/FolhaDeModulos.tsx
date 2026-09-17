import { Fragment, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useMovimentoReduzido } from '../ui/movimento';

/**
 * O "Mais" do celular: uma folha que sobe, em vez da barra lateral do
 * computador aparecendo por cima da tela.
 *
 * Por que folha, e não a gaveta lateral (decidido com o Lucas em 17/09/2026,
 * sobre a maquete dos menus): quem está no set segura o aparelho com uma mão
 * só. O dedo que tocou em "Mais", no rodapé, já está onde o próximo toque
 * precisa acontecer — uma lista que começa no alto da tela obriga a outra mão.
 *
 * UMA GRADE, SEM TÍTULO DE GRUPO (pedido do Lucas, 17/09/2026). O que separa
 * as áreas é a COR de cada quadro; os títulos abriam um vão a cada grupo e
 * empurravam metade do menu para fora da tela. O que já está na dock também
 * não se repete aqui — a dock está logo embaixo, à vista.
 *
 * A folha se arrasta para baixo para fechar. Arrastar é o que a torna um objeto
 * e não uma tela: dá para começar a abrir, ver o que tem e desistir.
 */

export interface ItemDaFolha {
  nome: string;
  icone: LucideIcon;
  /** A cor da área (SET, CRIATIVO…), ou a de aviso nas duas últimas. */
  cor: string;
  /** Módulo: para onde vai. Sem `path`, é uma ação (`aoTocar`). */
  path?: string;
  exact?: boolean;
  aoTocar?: () => void;
}

export function FolhaDeModulos({ aberta, aoFechar, itens, ativo, rodape }: {
  aberta: boolean;
  aoFechar: () => void;
  itens: ItemDaFolha[];
  ativo: string;
  /** O que não cabe num quadro: busca, sair. */
  rodape?: React.ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  const folha = useRef<HTMLDivElement>(null);
  const [y, setY] = useState(0);
  const arrasto = useRef<{ inicio: number; base: number; ativo: boolean }>({ inicio: 0, base: 0, ativo: false });

  // Esc fecha, e o foco entra na folha para o teclado não ficar atrás dela.
  useEffect(() => {
    if (!aberta) return;
    setY(0);
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); aoFechar(); } };
    window.addEventListener('keydown', aoTeclar);
    const antes = document.activeElement as HTMLElement | null;
    folha.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      antes?.focus?.();
    };
  }, [aberta, aoFechar]);

  if (!aberta) return null;

  const pegar = (e: React.PointerEvent) => {
    arrasto.current = { inicio: e.clientY, base: y, ativo: true };
    // O navegador recusa a captura de um ponteiro que ele não conhece (teste,
    // caneta que saiu da tela). Sem ela o arrasto ainda funciona dentro da área.
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* segue sem captura */ }
  };
  const mover = (e: React.PointerEvent) => {
    if (!arrasto.current.ativo) return;
    setY(Math.max(0, arrasto.current.base + (e.clientY - arrasto.current.inicio)));
  };
  const soltar = () => {
    if (!arrasto.current.ativo) return;
    arrasto.current.ativo = false;
    // Um terço da altura já é intenção de fechar; menos que isso volta ao lugar.
    const alto = folha.current?.offsetHeight ?? 1;
    if (y > alto / 3) aoFechar(); else setY(0);
  };

  return (
    <div className="folha-fundo celular-only" role="presentation" onClick={aoFechar}>
      <div
        ref={folha}
        className={`folha-modulos ${reduzido || arrasto.current.ativo ? '' : 'folha-suave'}`}
        style={{ transform: y ? `translateY(${y}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-label="Mais"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="folha-pegador-area"
          onPointerDown={pegar}
          onPointerMove={mover}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          <span className="folha-pegador" aria-hidden />
        </div>

        <div className="folha-rolagem">
          <div className="folha-malha">
            {itens.map(i => {
              const aqui = Boolean(i.path) && (i.exact ? ativo === i.path : ativo.startsWith(i.path!));
              const dentro = (
                <Fragment>
                  <i.icone size={20} />
                  <span>{i.nome}</span>
                </Fragment>
              );
              const estilo = { '--cor-area': i.cor } as React.CSSProperties;

              return i.path ? (
                <NavLink
                  key={i.nome}
                  to={i.path}
                  end={i.exact}
                  onClick={aoFechar}
                  className={`folha-quadro ${aqui ? 'aqui' : ''}`}
                  style={estilo}
                  aria-current={aqui ? 'page' : undefined}
                >
                  {dentro}
                </NavLink>
              ) : (
                <button
                  key={i.nome}
                  type="button"
                  className="folha-quadro"
                  style={estilo}
                  onClick={() => { aoFechar(); i.aoTocar?.(); }}
                >
                  {dentro}
                </button>
              );
            })}
          </div>

          {rodape && <div className="folha-rodape">{rodape}</div>}
        </div>
      </div>
    </div>
  );
}
