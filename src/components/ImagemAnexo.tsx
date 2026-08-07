import { useArquivo } from '../hooks/useArquivo';

/**
 * Uma imagem anexada — referência de cena, storyboard, miniatura.
 *
 * Existe porque o endereço do arquivo passou a ser resolvido de forma
 * assíncrona (aparelho ou Storage), e hook não pode ser chamado dentro de um
 * `.map`. Toda grade de referências vira uma lista destes.
 */
interface Props {
  valor?: string | null;
  alt: string;
  estiloLink?: React.CSSProperties;
  estiloImagem?: React.CSSProperties;
}

export function ImagemAnexo({ valor, alt, estiloLink, estiloImagem }: Props) {
  const endereco = useArquivo(valor);

  // Sem endereço: ou ainda está buscando, ou o arquivo está no Storage e não há
  // sinal. Um retângulo com o aviso é mais honesto que uma imagem quebrada.
  if (!endereco) {
    return (
      <div
        style={{
          ...estiloLink,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)',
          fontSize: '10px', textAlign: 'center', padding: '4px',
        }}
      >
        sem sinal
      </div>
    );
  }

  return (
    <a href={endereco} target="_blank" rel="noopener noreferrer" style={estiloLink}>
      <img
        src={endereco}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', ...estiloImagem }}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
    </a>
  );
}
