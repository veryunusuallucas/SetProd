import { db } from '../db/db';
import { VERSOES } from './novidades';

/**
 * O sino avisa quando o app mudou de versão.
 *
 * O QUE ISTO RESOLVE
 * Até aqui, quem descobria o que tinha de novo era quem calhava de abrir a
 * tela inicial e ver o modal de novidades. Quem entrava direto numa diária pelo
 * link, ou quem trabalha o dia inteiro dentro do Financeiro, não via nada — e
 * continuava sem saber que a coisa que ele reclamou tinha sido consertada.
 *
 * ⚠️ A NOTIFICAÇÃO É LOCAL, DE PROPÓSITO. A tabela `notificacoes` não viaja
 * para o servidor (é "o sino de cada um"), e é exatamente isso que faz este
 * aviso funcionar direito: cada pessoa recebe quando O APARELHO DELA atualiza,
 * e não quando o Lucas publicou. Avisar "temos a v4.8" para quem ainda está na
 * v4.7 seria anunciar novidade que a pessoa não tem.
 *
 * Roda uma vez por versão, por aparelho.
 */

const CHAVE = 'setprod:versao-avisada';

export async function avisarNovidadeSePreciso(): Promise<void> {
  let anterior: string | null = null;
  try {
    anterior = localStorage.getItem(CHAVE);
    localStorage.setItem(CHAVE, __VERSAO_APP__);
  } catch {
    return; // navegador sem armazenamento: segue sem o aviso
  }

  // Primeira vez neste aparelho: não há "novidade" — há o app inteiro. Marcar e
  // sair evita dar as boas-vindas com um aviso de atualização.
  if (anterior === null) return;
  if (anterior === __VERSAO_APP__) return;

  const entrada = VERSOES.find(v => v.versao === __VERSAO_APP__);
  const quantos = entrada ? (entrada.grupos?.flatMap(g => g.itens).length ?? entrada.itens?.length ?? 0) : 0;

  const texto = quantos > 0
    ? `SetProd v${__VERSAO_APP__}: ${quantos} novidade(s). Toque no selo da versão, na tela inicial, para ver.`
    : `SetProd atualizado para a v${__VERSAO_APP__}.`;

  /*
    Uma notificação POR PRODUÇÃO, porque o sino é por produção.

    Parece exagero e não é: quem tem três produções abertas vê o aviso na que
    estiver usando, em vez de não ver em nenhuma. E como a tabela é local, isso
    não gera nada para os outros.
  */
  const projetos = await db.projetos.toArray();
  const agora = Date.now();

  await db.notificacoes.bulkAdd(
    projetos.map(p => ({
      id: crypto.randomUUID(),
      projeto_id: p.id,
      texto,
      lida: false,
      data: agora,
    }))
  );
}
