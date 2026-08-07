import { useEffect, useState } from 'react';
import { resolverArquivo } from '../lib/arquivos';

/**
 * Transforma o que está gravado na linha num endereço que o navegador abre.
 *
 * Existe como hook porque resolver virou assíncrono: o arquivo pode estar no
 * aparelho (instantâneo) ou precisar vir do Storage. Quem só quer mostrar uma
 * imagem ou um link não deveria ter que saber disso.
 *
 * Devolve `null` enquanto busca — e também quando não deu (offline e sem cópia
 * local). Quem chama decide o que mostrar nesse caso.
 */
export function useArquivo(valor?: string | null): string | null {
  const [endereco, setEndereco] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    setEndereco(null);

    resolverArquivo(valor)
      .then(r => { if (vivo) setEndereco(r); })
      .catch(() => { if (vivo) setEndereco(null); });

    return () => { vivo = false; };
  }, [valor]);

  return endereco;
}
