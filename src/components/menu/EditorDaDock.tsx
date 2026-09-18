import { useState } from 'react';
import { History } from 'lucide-react';
import {
  FIXOS_PADRAO, MODULOS, moduloPorId, salvarFixos, useFixosDaDock, type IdModulo,
} from './modulosDaDock';

/**
 * O editor da dock, dentro da folha do "Mais".
 *
 * Toque num dos três lugares de cima e depois no módulo que vai morar nele. Se
 * o módulo já estava em outro lugar, os dois trocam, e a dock nunca fica com
 * um repetido. Depois de escolher, o lugar seguinte já fica marcado: dá para
 * montar os três em três toques.
 *
 * Cada troca vale na hora. Não existe "salvar": fechar a folha é concordar.
 */
export function EditorDaDock({ vagaInicial = 0, aoConcluir }: {
  vagaInicial?: number;
  aoConcluir: () => void;
}) {
  const fixos = useFixosDaDock();
  const [vaga, setVaga] = useState(vagaInicial);

  const escolher = (id: IdModulo) => {
    const novos = [...fixos];
    const onde = novos.indexOf(id);
    if (onde !== vaga) {
      if (onde >= 0) novos[onde] = novos[vaga];
      novos[vaga] = id;
      salvarFixos(novos);
    }
    setVaga((vaga + 1) % 3);
  };

  const ehPadrao = fixos.every((f, n) => f === FIXOS_PADRAO[n]);

  return (
    <div className="editor-dock">
      <div>
        <h3 className="editor-dock-titulo">Sua barra de baixo</h3>
        <p className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
          Toque num lugar e depois no módulo que vai ficar nele. O quarto lugar
          acompanha a última tela que você abriu.
        </p>
      </div>

      <div className="editor-dock-vagas" role="radiogroup" aria-label="Lugares da barra">
        {fixos.map((id, n) => {
          const m = moduloPorId(id);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === vaga}
              className={`editor-vaga ${n === vaga ? 'escolhida' : ''}`}
              style={{ '--cor-area': m.cor } as React.CSSProperties}
              onClick={() => setVaga(n)}
            >
              <m.icone size={18} />
              <span>{m.nome}</span>
            </button>
          );
        })}
        <div className="editor-vaga fluida" aria-label="O quarto lugar acompanha a última tela aberta">
          <History size={18} />
          <span>A última</span>
        </div>
      </div>

      <div className="folha-malha">
        {MODULOS.map(m => {
          const lugar = fixos.indexOf(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`folha-quadro ${lugar >= 0 ? 'na-dock' : ''}`}
              style={{ '--cor-area': m.cor } as React.CSSProperties}
              onClick={() => escolher(m.id)}
              aria-label={lugar >= 0 ? `${m.nome}, no lugar ${lugar + 1}` : m.nome}
            >
              {lugar >= 0 && <span className="editor-selo" aria-hidden>{lugar + 1}</span>}
              <m.icone size={20} />
              <span>{m.nome}</span>
            </button>
          );
        })}
      </div>

      <div className="editor-dock-acoes">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={ehPadrao}
          onClick={() => { salvarFixos(FIXOS_PADRAO); setVaga(0); }}
        >
          Voltar ao padrão
        </button>
        <button type="button" className="btn btn-primary" onClick={aoConcluir}>
          Pronto
        </button>
      </div>
    </div>
  );
}
