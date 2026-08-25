/**
 * Quem está usando este navegador, agora.
 *
 * Existe porque o IndexedDB e o `localStorage` são do NAVEGADOR, não da conta.
 * Duas contas no mesmo Chrome — o que acontece o tempo todo no notebook de
 * produção, e sempre durante o desenvolvimento — dividem o mesmo armazenamento.
 * Sem separar por conta, uma grava "já li até aqui" e a outra pula essas linhas.
 * Não dá erro: o sync só fica incompleto, em silêncio.
 *
 * O id fica em memória E no `localStorage`. Os dois, porque `getSession()` é
 * assíncrono e `cursorDe()` é chamado de dentro do `puxar()`, sem await — na
 * primeira volta depois de abrir a aba, a sessão ainda não voltou. A cópia
 * gravada responde na hora e é a mesma conta em 99% das vezes; quando não for,
 * `registrarConta` corrige antes de qualquer leitura valer.
 */

const CHAVE = 'setprod_conta_atual';

/** Para quem usa o app sem Supabase: não há conta, e o Dexie é o banco de verdade. */
export const CONTA_LOCAL = 'local';

let emMemoria: string | null = null;

/** O id da conta logada, ou `CONTA_LOCAL`. Síncrono de propósito. */
export function contaAtual(): string {
  return emMemoria || localStorage.getItem(CHAVE) || CONTA_LOCAL;
}

/**
 * Anota quem entrou e diz se é outra pessoa.
 *
 * Só aceita conta de verdade. "Sem sessão" NÃO apaga o registro, e isso é o
 * ponto: se sair sem sessão zerasse a memória, uma sessão que simplesmente
 * expirou faria o app esquecer quem estava aqui — e a próxima pessoa a entrar
 * herdaria os dados da anterior sem ninguém perceber a troca. Enquanto está
 * deslogado nada sincroniza, então guardar o id antigo não faz mal nenhum.
 *
 * Quem apaga o registro é `esquecerConta()`, e só depois de limpar os dados.
 */
export function registrarConta(id: string | null | undefined): { anterior: string; trocou: boolean } {
  const anterior = contaAtual();
  if (!id) return { anterior, trocou: false };

  emMemoria = id;
  localStorage.setItem(CHAVE, id);
  return { anterior, trocou: anterior !== id };
}

/**
 * Esquece quem estava aqui.
 *
 * Chame DEPOIS de apagar os dados locais, nunca antes: é o registro de que este
 * navegador está limpo, e apagá-lo com dados ainda dentro faria a próxima conta
 * achar que o armazenamento é dela.
 */
export function esquecerConta(): void {
  emMemoria = null;
  localStorage.removeItem(CHAVE);
}
