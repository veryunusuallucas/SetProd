import { useEffect, useRef, useState } from 'react';

/**
 * Onde o indicador de conexão mora em cada tela.
 *
 * O PROBLEMA
 * O indicador é um só, montado uma vez no `App` — essa parte está certa: um por
 * tela garante que alguma tela fique sem. Mas ele estava **flutuando** no alto
 * à direita, por cima de qualquer coisa que a tela já tivesse naquele canto. No
 * celular, dentro de uma produção, esse canto é o sino de notificações: os dois
 * ficavam um em cima do outro.
 *
 * A SAÍDA
 * A tela que tem um cabeçalho próprio reserva um lugar para ele com
 * `<CantoDaConexao />`, e o indicador se muda para lá — vira mais um item do
 * cabeçalho, lado a lado com o sino, em vez de pairar sobre ele. A tela que não
 * tem cabeçalho (login, criar conta, convite) não reserva nada, e ele continua
 * flutuando no canto, que ali está vazio.
 *
 * Por que um registro global e não um contexto: o indicador é irmão das rotas,
 * não pai delas — não há árvore comum onde um provedor os alcance.
 */
let noAtual: HTMLElement | null = null;
const ouvintes = new Set<(no: HTMLElement | null) => void>();

function anunciar(no: HTMLElement | null) {
  noAtual = no;
  for (const ouvinte of ouvintes) ouvinte(no);
}

/** O lugar reservado, dentro do cabeçalho da tela. */
export function CantoDaConexao() {
  const meuNo = useRef<HTMLElement | null>(null);

  return (
    <span
      style={{ display: 'flex', alignItems: 'center' }}
      ref={no => {
        if (no) { meuNo.current = no; anunciar(no); return; }
        /*
          Ao desmontar, só apaga se o lugar ainda for O MEU. Numa troca de tela
          a nova reserva pode entrar antes de a antiga sair; apagar sem conferir
          deixaria o indicador flutuando de novo, por cima do cabeçalho novo.
        */
        if (noAtual === meuNo.current) anunciar(null);
        meuNo.current = null;
      }}
    />
  );
}

/** Onde desenhar agora — `null` enquanto nenhuma tela reservou lugar. */
export function usarCantoDaConexao() {
  const [no, setNo] = useState<HTMLElement | null>(noAtual);
  useEffect(() => {
    ouvintes.add(setNo);
    setNo(noAtual);
    return () => { ouvintes.delete(setNo); };
  }, []);
  return no;
}
