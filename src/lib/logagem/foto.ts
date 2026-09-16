/**
 * A foto de referência do take: encolhida antes de existir.
 *
 * A foto aqui serve para a continuísta reconhecer o enquadramento, não para
 * ampliar em tela cheia. Uma foto de celular tem 3–5 MB; cem takes numa diária
 * seriam meio giga no aparelho, no Storage e — pior — na fila de sincronia, no
 * 3G do set, competindo com os takes de texto, que são o que não pode faltar.
 *
 * 800px no maior lado e JPEG 0.7 é o que o Lumavi fazia, e dá uns 60–120 KB.
 */
export const LADO_MAIOR = 800;
export const QUALIDADE = 0.7;

export async function comprimirFoto(arquivo: Blob, lado = LADO_MAIOR, qualidade = QUALIDADE): Promise<Blob> {
  const imagem = await createImageBitmap(arquivo);
  try {
    const escala = Math.min(1, lado / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * escala));
    const altura = Math.max(1, Math.round(imagem.height * escala));

    const tela = document.createElement('canvas');
    tela.width = largura;
    tela.height = altura;
    const pincel = tela.getContext('2d');
    if (!pincel) return arquivo;
    pincel.drawImage(imagem, 0, 0, largura, altura);

    const menor = await new Promise<Blob | null>(resolve => tela.toBlob(resolve, 'image/jpeg', qualidade));
    // Se a compressão falhou, ou saiu MAIOR que o original (foto minúscula, ou
    // já bem comprimida), a original é a melhor escolha.
    return menor && menor.size < arquivo.size ? menor : arquivo;
  } finally {
    imagem.close();
  }
}

/** As dimensões que a foto TERIA depois de encolher — a conta, sem tocar em canvas. */
export function medidaFinal(largura: number, altura: number, lado = LADO_MAIOR) {
  const escala = Math.min(1, lado / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}
