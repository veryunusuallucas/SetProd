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
 * A folha se arrasta para baixo para fechar. Arrastar é o que a torna um objeto
 * e não uma tela: dá para começar a abrir, ver o que tem e desistir.
 */

export interface ModuloDaFolha {
  nome: string;
  path: string;
  icone: LucideIcon;
  exact?: boolean;
}

export interface GrupoDaFolha {
  titulo: string;
  /** A cor da área (SET, CRIATIVO…). É ela que separa os grupos, no lugar do espaço. */
  cor: string;
  itens: ModuloDaFolha[];
}

export function FolhaDeModulos({ aberta, aoFechar, grupos, ativo, rodape }: {
  aberta: boolean;
  aoFechar: () => void;
  grupos: GrupoDaFolha[];
  ativo: string;
  /** Busca, dados, config, voltar ao início: o que não é módulo. */
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
    <div className="folha-fundo mobile-only" role="presentation" onClick={aoFechar}>
      <div
        ref={folha}
        className={`folha-modulos ${reduzido || arrasto.current.ativo ? '' : 'folha-suave'}`}
        style={{ transform: y ? `translateY(${y}px)` : undefined }}
        role="dialog"
        aria-modal="true"
        aria-label="Mais módulos"
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
          {/*
            Uma grade só, e a cor da área separando os grupos — não o espaço.
            Em seções empilhadas, cada grupo abria um vão e a folha virava
            rolagem só para caber cinco títulos (pedido do Lucas, 17/09/2026).
          */}
          <div className="folha-malha">
            {grupos.map(g => (
              <Fragment key={g.titulo}>
                <h2 className="folha-titulo" style={{ color: g.cor }}>{g.titulo}</h2>
                {g.itens.map(m => {
                  const aqui = m.exact ? ativo === m.path : ativo.startsWith(m.path);
                  return (
                    <NavLink
                      key={m.path}
                      to={m.path}
                      end={m.exact}
                      onClick={aoFechar}
                      className={`folha-quadro ${aqui ? 'aqui' : ''}`}
                      style={{ '--cor-area': g.cor } as React.CSSProperties}
                      aria-current={aqui ? 'page' : undefined}
                    >
                      <m.icone size={20} />
                      <span>{m.nome}</span>
                    </NavLink>
                  );
                })}
              </Fragment>
            ))}
          </div>

          {rodape && <div className="folha-rodape">{rodape}</div>}
        </div>
      </div>
    </div>
  );
}
