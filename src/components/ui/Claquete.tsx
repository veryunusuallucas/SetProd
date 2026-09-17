import { useEffect } from 'react';

/**
 * A claquete do easter egg.
 *
 * Três cliques no título e ela fecha em cima da tela inteira: braço batendo,
 * clarão, tranco de câmera, e os campos de uma claquete de verdade —
 * produção, cena, take. Um segundo depois, o take "vai para o corte": é
 * quando o vídeo abre.
 *
 * Por que uma claquete, e não a distorção de antes: o aviso continua sendo o
 * próprio efeito subindo a cada clique, mas o estouro passou a ser do SetProd.
 * Escolhido pelo Lucas em 17/09/2026, sobre a maquete da porta.
 *
 * Com movimento reduzido ela não bate: aparece parada, com os mesmos dizeres,
 * e sai no mesmo tempo. Ninguém perde a piada por causa de um ajuste do
 * sistema.
 */

export const DURACAO_DA_CLAQUETE = 1000;

export function Claquete({ take = 3, reduzido = false, diretor }: {
  take?: number;
  reduzido?: boolean;
  /** Quem está dirigindo: o nome da conta de quem cutucou. */
  diretor?: string;
}) {
  // A tela inteira é dela enquanto dura: nada atrás deve rolar junto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  return (
    <div
      aria-hidden
      className={`claquete-egg ${reduzido ? '' : 'batendo'}`}
      style={{ position: 'fixed', inset: 0, zIndex: 4000, pointerEvents: 'none' }}
    >
      <div className="claquete-quadro">
        <div className="claquete-braco" />
        <div className="claquete-corpo">
          <div className="claquete-celula larga">
            <span>Produção</span>
            <b>SETPROD</b>
          </div>
          <div className="claquete-celula">
            <span>Cena</span>
            <b>1</b>
          </div>
          <div className="claquete-celula">
            <span>Take</span>
            <b>{take}</b>
          </div>
          <div className="claquete-celula larga">
            <span>Diretor</span>
            <b>{(diretor || 'você').toUpperCase()}</b>
          </div>
        </div>
      </div>
      <div className="claquete-clarao" />
    </div>
  );
}
