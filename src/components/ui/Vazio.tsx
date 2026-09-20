import { useEdicao } from './Acesso';

/**
 * A lista que ainda não tem nada — dita de um jeito só, no app inteiro.
 *
 * O QUE ESTAVA ERRADO
 * Cada lista escrevia a própria frase, e quase todas paravam no primeiro
 * terço: "Nenhuma despesa registrada." Isso responde o que a pessoa já vê (a
 * lista está vazia) e deixa as duas perguntas que ela tem de verdade — isto
 * está vazio porque ninguém preencheu ou porque quebrou? e o que eu faço
 * agora? A diferença entre uma tela vazia e uma tela quebrada é essa frase.
 *
 * TRÊS PARTES, NESTA ORDEM
 *   1. o que não existe ainda ("Nenhuma despesa lançada");
 *   2. por que isso é normal, em uma linha;
 *   3. o caminho — o mesmo botão que a tela usaria.
 *
 * QUEM NÃO PODE CRIAR NÃO VÊ BOTÃO. O `ModoLeitura` da semana passada já
 * publica isso; aqui é só respeitar, senão a tela oferece uma saída que termina
 * em recusa do servidor.
 */
export function Vazio({
  icone, titulo, ajuda, acao,
}: {
  icone?: React.ReactNode;
  /** O que não existe ainda. Curto, e no vocabulário da produção. */
  titulo: string;
  /** Por que está vazio, ou o que aparece aqui quando houver algo. */
  ajuda?: string;
  /** O botão que resolve. Some sozinho para quem só acompanha. */
  acao?: React.ReactNode;
}) {
  const { somenteLeitura, motivo } = useEdicao();

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '8px', padding: '40px 24px', textAlign: 'center',
      }}
    >
      {icone && <span style={{ color: 'var(--text-muted)', display: 'flex' }}>{icone}</span>}

      <div className="text-sm font-bold">{titulo}</div>

      {(ajuda || somenteLeitura) && (
        <p className="text-xs text-muted" style={{ margin: 0, maxWidth: '360px', lineHeight: 1.5 }}>
          {somenteLeitura ? motivo : ajuda}
        </p>
      )}

      {acao && !somenteLeitura && <div style={{ marginTop: '6px' }}>{acao}</div>}
    </div>
  );
}
