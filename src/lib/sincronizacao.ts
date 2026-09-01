import { db, TABELAS_SINCRONIZADAS, marcarTransacaoComoRemota } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import { contaAtual } from './conta';

/**
 * O motor de sincronização: leva o que mudou aqui para o servidor e traz o que
 * mudou lá para cá.
 *
 * Ver `.md/setprod_plano_multiusuario.md` para o desenho e o porquê das escolhas.
 */

export const TABELA_ESPELHO = 'registros';

/**
 * Todas as tabelas viajam.
 *
 * `roteiro_pdfs` e `documentos` ficaram de fora por um tempo porque carregavam
 * o arquivo em base64 dentro da linha — um roteiro de 18 páginas passa de 5 MB,
 * e cada alteração empurraria isso de novo para cada pessoa conectada. Agora o
 * arquivo mora no Storage (`arquivos.ts`) e a linha guarda só a referência, que
 * cabe em algumas dezenas de bytes.
 */
export const TABELAS_EM_SINCRONIA = TABELAS_SINCRONIZADAS;

/**
 * Quantas linhas por requisição.
 *
 * Baixo de propósito: enquanto os anexos forem base64 dentro da linha (um PDF
 * de roteiro passa de 5 MB), um lote grande estoura o limite da requisição.
 * Sobe quando os binários saírem para o Storage.
 */
const LOTE = 20;

/** Teto de bytes por lote — o freio que pega quando uma única linha é enorme. */
const TETO_BYTES = 3_000_000;

type Linha = { id: string; projeto_id?: string; atualizado_em?: number };

/**
 * Uma edição local que perdeu para uma versão mais nova do servidor.
 *
 * O motor não resolve o conflito — o LWW já decidiu, e por linha inteira. O que
 * ele faz é parar de resolver *em silêncio*: quem estava com a tela aberta
 * merece saber que o que digitou foi substituído.
 */
export const EVENTO_CONFLITO = 'setprod-conflito';

export interface Conflito {
  projeto_id: string;
  tabela: string;
  id: string;
}

interface LinhaEspelho {
  projeto_id: string;
  tabela: string;
  id: string;
  dados: Linha | null;
  atualizado_em: number;
  deletado: boolean;
}

/**
 * Só o que o motor conhece e não está adiada entra no Dexie.
 *
 * A checagem vale para os dois lados: o nome da tabela chega do servidor, e
 * escrever no Dexie a partir de um nome que veio de fora sem conferir é abrir a
 * porta para gravar em qualquer lugar.
 */
const conhecida = (t: string) => (TABELAS_EM_SINCRONIA as readonly string[]).includes(t);

// ---------------------------------------------------------------------------
// Cursor
// ---------------------------------------------------------------------------

/**
 * Até onde já lemos o servidor, por projeto.
 *
 * Guarda o `recebido_em` (relógio do SERVIDOR), nunca o `atualizado_em` (relógio
 * do cliente). Se fosse o do cliente, um aparelho com a hora adiantada gravaria
 * um cursor no futuro e simplesmente pararia de receber mudanças — sem erro,
 * sem aviso, só silêncio.
 *
 * E é por conta, não só por projeto: o `localStorage` é do navegador, então duas
 * contas no mesmo Chrome brigariam pelo mesmo cursor — uma marca "li até aqui"
 * e a outra pula tudo o que já passou. Ver `conta.ts`.
 */
const chaveCursor = (projetoId: string) => `setprod_cursor_${contaAtual()}_${projetoId}`;

/** Como a chave era antes de existir separação por conta. */
const chaveCursorAntiga = (projetoId: string) => `setprod_cursor_${projetoId}`;

export function cursorDe(projetoId: string): string | null {
  // Um cursor da chave antiga é de dono desconhecido: foi escrito por quem
  // estivesse logado na época. Herdá-lo poderia fazer esta conta pular linhas
  // que nunca leu — exatamente o bug que a separação veio consertar. Então ele
  // é descartado, e o projeto desce inteiro mais uma vez. Baixar de novo é
  // barato e idempotente (o LWW resolve); perder linha em silêncio, não.
  localStorage.removeItem(chaveCursorAntiga(projetoId));
  return localStorage.getItem(chaveCursor(projetoId));
}

export function gravarCursor(projetoId: string, recebidoEm: string) {
  localStorage.setItem(chaveCursor(projetoId), recebidoEm);
}

/** Esquece o que já foi lido — a próxima leitura traz o projeto inteiro. */
export function reiniciarCursor(projetoId: string) {
  localStorage.removeItem(chaveCursor(projetoId));
}

// ---------------------------------------------------------------------------
// Subida
// ---------------------------------------------------------------------------

/**
 * Monta as linhas a enviar a partir da caixa de saída.
 *
 * A fila guarda só a chave; o conteúdo é lido aqui, agora — então o que sobe é
 * sempre a versão atual, mesmo que a linha tenha sido editada dez vezes desde
 * que entrou na fila.
 */
async function montarEnvio(projetoId: string) {
  const pendentes = await db.sync_queue.where('projeto_id').equals(projetoId).toArray();

  const linhas: LinhaEspelho[] = [];
  const enviadas: string[] = [];

  for (const p of pendentes) {
    if (!conhecida(p.tabela)) continue;

    if (p.deletado) {
      linhas.push({
        projeto_id: projetoId, tabela: p.tabela, id: p.registro_id,
        dados: null, atualizado_em: p.atualizado_em, deletado: true,
      });
      enviadas.push(p.id);
      continue;
    }

    const registro = await db.table(p.tabela).get(p.registro_id) as Linha | undefined;
    if (!registro) {
      // A linha sumiu sem passar pelo hook de apagar — o caso real é a
      // transação que gravou ter sido abortada depois de enfileirar. Não há o
      // que enviar, e insistir seria empurrar um registro que não existe.
      enviadas.push(p.id);
      continue;
    }

    linhas.push({
      projeto_id: projetoId, tabela: p.tabela, id: p.registro_id,
      dados: registro,
      atualizado_em: registro.atualizado_em ?? p.atualizado_em,
      deletado: false,
    });
    enviadas.push(p.id);
  }

  return { linhas, enviadas };
}

/** Fatia por contagem E por tamanho: uma linha só já pode encher o lote. */
function* emLotes(linhas: LinhaEspelho[]): Generator<LinhaEspelho[]> {
  let atual: LinhaEspelho[] = [];
  let bytes = 0;

  for (const linha of linhas) {
    const peso = JSON.stringify(linha).length;
    if (atual.length && (atual.length >= LOTE || bytes + peso > TETO_BYTES)) {
      yield atual;
      atual = [];
      bytes = 0;
    }
    atual.push(linha);
    bytes += peso;
  }
  if (atual.length) yield atual;
}

/**
 * Manda para o servidor o que este aparelho alterou.
 *
 * Devolve quantas linhas subiram. A fila só é limpa depois do envio confirmado:
 * se a rede cair no meio, a pendência continua lá e vai junto na próxima vez.
 */
export async function empurrar(projetoId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;

  const { linhas, enviadas } = await montarEnvio(projetoId);
  if (!linhas.length) {
    if (enviadas.length) await db.sync_queue.bulkDelete(enviadas);
    return 0;
  }

  let subiram = 0;
  for (const lote of emLotes(linhas)) {
    const { error } = await supabase
      .from(TABELA_ESPELHO)
      .upsert(lote, { onConflict: 'projeto_id,tabela,id' });

    if (error) throw error;
    subiram += lote.length;
  }

  await db.sync_queue.bulkDelete(enviadas);
  return subiram;
}

// ---------------------------------------------------------------------------
// Descida
// ---------------------------------------------------------------------------

/**
 * Grava no Dexie o que veio do servidor.
 *
 * Esta função é o único caminho de entrada — tanto para o que chega ao vivo pelo
 * Realtime quanto para o que chega no lote da reconexão. É o que faz "voltar da
 * internet caindo" não ser um caso especial no código: é o caso normal rodando
 * com o cursor atrasado.
 */
export async function aplicarLinhas(linhas: LinhaEspelho[]): Promise<number> {
  const usaveis = linhas.filter(l => conhecida(l.tabela));
  if (!usaveis.length) return 0;

  const tabelas = [...new Set(usaveis.map(l => l.tabela))];
  let aplicadas = 0;
  const perdidas: Conflito[] = [];

  await db.transaction('rw', [...tabelas.map(t => db.table(t)), db.sync_queue], async () => {
    // Sem esta marca, os hooks do Dexie carimbam cada linha recebida com a hora
    // daqui e a devolvem para a caixa de saída como se fosse alteração local —
    // e ela sobe de novo, e volta, sem fim. Ver `marcarTransacaoComoRemota`.
    marcarTransacaoComoRemota();

    for (const linha of usaveis) {
      const tabela = db.table(linha.tabela);
      const local = await tabela.get(linha.id) as Linha | undefined;
      const naFila = await db.sync_queue.get(`${linha.tabela}:${linha.id}`);

      /*
        ⚠️ O QUE ESTÁ NA FILA CONTA COMO "O DAQUI", MESMO SEM LINHA NO BANCO.

        Este é o buraco que fazia diária apagada VOLTAR sozinha.

        Apagar deixa o Dexie sem linha nenhuma — só o túmulo na fila de saída.
        A comparação abaixo olhava apenas `local`, que nesse caso é
        `undefined`: sem nada para comparar, a linha viva que ainda estava no
        servidor era gravada de volta e a diária reaparecia na tela. Se a
        subida do túmulo demorasse (sem internet, aba fechada antes de subir),
        ela ficava.

        O carimbo da pendência é o carimbo do que a pessoa acabou de fazer.
        Ele é quem deve enfrentar o LWW quando a linha local não existe mais.
      */
      const carimboDaqui = Math.max(local?.atualizado_em ?? 0, naFila?.atualizado_em ?? 0);
      if (carimboDaqui >= linha.atualizado_em) continue;

      if (linha.deletado) await tabela.delete(linha.id);
      else if (linha.dados) await tabela.put({ ...linha.dados, atualizado_em: linha.atualizado_em });
      aplicadas++;

      // Se havia uma alteração nossa esperando para subir e a versão do
      // servidor é mais nova, a nossa já perdeu o LWW — o conteúdo dela nem
      // existe mais aqui. Tirar da fila poupa uma subida que o servidor
      // recusaria de qualquer jeito.
      //
      // Chegar aqui já garante que a pendência é mais velha (o `continue`
      // acima barrou o contrário), então ela sai da fila sem nova comparação.
      if (naFila) {
        await db.sync_queue.delete(naFila.id);
        // Aqui alguém perdeu trabalho. O LWW já decidiu e não há o que desfazer,
        // mas perder em silêncio é o pior aspecto disto: a pessoa vê o próprio
        // texto mudar sozinho na tela e não entende. Ver §10.A do ROADMAP.
        perdidas.push({ projeto_id: linha.projeto_id, tabela: linha.tabela, id: linha.id });
      }
    }
  });

  // Depois da transação, não dentro: se ela abortar, nada foi sobrescrito e o
  // aviso teria sido mentira.
  if (perdidas.length) {
    window.dispatchEvent(new CustomEvent(EVENTO_CONFLITO, { detail: perdidas }));
  }

  return aplicadas;
}

/**
 * Traz o que mudou no servidor desde a última leitura.
 *
 * Pagina pelo próprio cursor: cada página avança o `recebido_em`, então uma
 * primeira carga de um projeto grande atravessa em várias voltas sem precisar
 * de `offset` — e uma queda no meio retoma de onde parou.
 */
export async function puxar(projetoId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;

  const PAGINA = 200;
  let total = 0;

  for (;;) {
    const cursor = cursorDe(projetoId);
    let consulta = supabase
      .from(TABELA_ESPELHO)
      .select('projeto_id, tabela, id, dados, atualizado_em, deletado, recebido_em')
      .eq('projeto_id', projetoId)
      .order('recebido_em', { ascending: true })
      .limit(PAGINA);

    if (cursor) consulta = consulta.gt('recebido_em', cursor);

    const { data, error } = await consulta;
    if (error) throw error;
    if (!data?.length) break;

    total += await aplicarLinhas(data as unknown as LinhaEspelho[]);

    // O cursor avança para o `recebido_em` da última linha aplicada, não para
    // "agora": o relógio daqui não tem nada a ver com o do servidor.
    gravarCursor(projetoId, (data[data.length - 1] as any).recebido_em);

    if (data.length < PAGINA) break;
  }

  return total;
}

// ---------------------------------------------------------------------------
// A volta completa
// ---------------------------------------------------------------------------

/**
 * Empurra e depois puxa.
 *
 * Nessa ordem porque o que é nosso deve chegar ao servidor antes de recebermos
 * a versão dele: assim uma edição local nunca perde para uma cópia mais velha
 * que ainda estava vindo.
 */
export async function sincronizar(projetoId: string) {
  const enviadas = await empurrar(projetoId);
  const recebidas = await puxar(projetoId);
  return { enviadas, recebidas };
}

/** Quantas alterações ainda não subiram — alimenta o "Salvando…" do rodapé. */
export function pendencias(projetoId: string) {
  return db.sync_queue.where('projeto_id').equals(projetoId).count();
}

/**
 * Tamanho aproximado do projeto (§3.5 da spec).
 *
 * Mede o que está no Dexie, somando o JSON de cada linha. É aproximado e a tela
 * diz isso: o número oficial mora no painel do Supabase, que mede a conta
 * inteira e não daria para separar por projeto sem acesso de admin.
 */
export async function tamanhoAproximado(projetoId: string): Promise<{ dados: number; anexos: number; total: number }> {
  let dados = 0;

  for (const tabela of TABELAS_SINCRONIZADAS) {
    const linhas = tabela === 'projetos'
      ? await db.table(tabela).where('id').equals(projetoId).toArray()
      : await db.table(tabela).where('projeto_id').equals(projetoId).toArray().catch(() => []);

    for (const linha of linhas) dados += JSON.stringify(linha).length;
  }

  // Os anexos contam à parte porque quase sempre SÃO o número: um roteiro
  // sozinho pesa mais que todo o resto da produção somado. Juntar os dois num
  // total só esconderia onde o espaço está indo.
  const arquivos = await db.arquivos.where('projeto_id').equals(projetoId).toArray().catch(() => []);
  const anexos = arquivos.reduce((soma, a) => soma + (a.tamanho || 0), 0);

  return { dados, anexos, total: dados + anexos };
}
