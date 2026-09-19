import { db, TABELAS_SINCRONIZADAS, marcarTransacaoComoRemota } from '../db/db';
import { mesclarEscala, mesmaEscala } from './escalaMesclada';
import { supabase, supabaseConfigurado } from './supabase';
import { contaAtual } from './conta';
import {
  aplicarParteDaFicha, ehParteDaFicha, fundirPublica, partesQuePossoApagar, partirParaEnviar,
} from './fichaEmCamadas';

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

/**
 * Uma escrita que não pode acontecer — recusada pelo servidor (RLS) ou barrada
 * antes, aqui, pela mesma regra (ver `travaDeEscrita.ts`).
 *
 * Mesmo formato do conflito: quem mostra os dois avisos é o mesmo componente.
 */
export const EVENTO_RECUSA = 'setprod-recusa';

export type Recusa = Conflito & {
  /** A frase do porquê, quando quem avisa já sabe (a trava local sabe). */
  motivo?: string;
};

/** Código do Postgres para "a política de RLS barrou esta linha". */
const RECUSADO_PELA_RLS = '42501';

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
      // A ficha apagada leva junto as camadas que esta conta pode apagar. As
      // outras ficam para quem pode — a RLS recusaria de qualquer jeito.
      if (p.tabela === 'perfis') {
        for (const parte of partesQuePossoApagar(projetoId, p.registro_id)) {
          linhas.push({
            projeto_id: projetoId, tabela: parte, id: p.registro_id,
            dados: null, atualizado_em: p.atualizado_em, deletado: true,
          });
        }
      }
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

    const carimbo = registro.atualizado_em ?? p.atualizado_em;

    // A ficha sobe em três linhas: o crachá e, se esta conta pode ver, as duas
    // camadas protegidas. Ver `fichaEmCamadas.ts`.
    if (p.tabela === 'perfis') {
      const { publica, partes } = partirParaEnviar(projetoId, registro as never);
      linhas.push({
        projeto_id: projetoId, tabela: 'perfis', id: p.registro_id,
        dados: publica as Linha, atualizado_em: carimbo, deletado: false,
      });
      for (const parte of partes) {
        linhas.push({
          projeto_id: projetoId, tabela: parte.tabela, id: p.registro_id,
          dados: parte.dados as Linha, atualizado_em: carimbo, deletado: false,
        });
      }
      enviadas.push(p.id);
      continue;
    }

    linhas.push({
      projeto_id: projetoId, tabela: p.tabela, id: p.registro_id,
      dados: registro,
      atualizado_em: carimbo,
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

const subir = (lote: LinhaEspelho[]) =>
  supabase.from(TABELA_ESPELHO).upsert(lote, { onConflict: 'projeto_id,tabela,id' });

/**
 * Manda para o servidor o que este aparelho alterou.
 *
 * Devolve quantas linhas subiram. A fila só é limpa depois do envio confirmado:
 * se a rede cair no meio, a pendência continua lá e vai junto na próxima vez.
 *
 * QUANDO O SERVIDOR RECUSA (18/09/2026). Antes, um lote barrado pela RLS
 * lançava erro e a fila parava ali — a linha recusada nunca saía, era reenviada
 * a cada volta e recusada de novo, e NADA mais daquele aparelho subia. Um só
 * clique de quem é "leitura" travava a sincronização dele para sempre.
 *
 * Agora o lote recusado é reenviado linha a linha, para achar QUAL foi barrada.
 * A barrada sai da fila (reenviar não muda a resposta), o dado daqui volta a ser
 * o do servidor, e a pessoa é avisada. O resto do lote sobe normalmente.
 *
 * Só a recusa de RLS é tratada assim. Rede caída, servidor fora e afins
 * continuam lançando erro: aí a pendência TEM que ficar, porque vai passar.
 */
export async function empurrar(projetoId: string): Promise<number> {
  if (!supabaseConfigurado) return 0;

  const { linhas, enviadas } = await montarEnvio(projetoId);
  if (!linhas.length) {
    if (enviadas.length) await db.sync_queue.bulkDelete(enviadas);
    return 0;
  }

  let subiram = 0;
  const recusadas: LinhaEspelho[] = [];

  for (const lote of emLotes(linhas)) {
    const { error } = await subir(lote);
    if (!error) { subiram += lote.length; continue; }
    if (error.code !== RECUSADO_PELA_RLS) throw error;

    for (const linha of lote) {
      const { error: sozinha } = await subir([linha]);
      if (!sozinha) { subiram++; continue; }
      if (sozinha.code !== RECUSADO_PELA_RLS) throw sozinha;
      recusadas.push(linha);
    }
  }

  await db.sync_queue.bulkDelete(enviadas);
  if (recusadas.length) await desfazerRecusadas(projetoId, recusadas);
  return subiram;
}

/**
 * Devolve ao estado do servidor o que ele recusou, e avisa.
 *
 * Sem isto, a alteração recusada ficaria aqui para sempre — a tela mostrando
 * uma coisa que ninguém mais vê, e que a próxima edição de outra pessoa
 * sobrescreveria sem aviso. Linha que só existia aqui (criação recusada) some.
 */
async function desfazerRecusadas(projetoId: string, recusadas: LinhaEspelho[]) {
  const doDexie = recusadas.filter(l => conhecida(l.tabela));
  const noServidor: LinhaEspelho[] = [];

  for (const tabela of new Set(doDexie.map(l => l.tabela))) {
    const ids = doDexie.filter(l => l.tabela === tabela).map(l => l.id);
    const { data } = await supabase
      .from(TABELA_ESPELHO)
      .select('projeto_id, tabela, id, dados, atualizado_em, deletado')
      .eq('projeto_id', projetoId).eq('tabela', tabela).in('id', ids);
    noServidor.push(...((data || []) as unknown as LinhaEspelho[]));
  }

  const tabelas = [...new Set(doDexie.map(l => l.tabela))];
  if (tabelas.length) {
    await db.transaction('rw', tabelas.map(t => db.table(t)), async () => {
      // É o servidor falando: a volta não pode entrar na fila de saída.
      marcarTransacaoComoRemota();
      for (const linha of doDexie) {
        const tabela = db.table(linha.tabela);
        const oficial = noServidor.find(l => l.tabela === linha.tabela && l.id === linha.id);
        if (!oficial || oficial.deletado || !oficial.dados) await tabela.delete(linha.id);
        else if (linha.tabela === 'perfis') {
          // A versão do servidor que a conta enxerga é só o crachá: as camadas
          // daqui ficam.
          const local = await tabela.get(linha.id);
          await tabela.put({ ...fundirPublica(local, oficial.dados), atualizado_em: oficial.atualizado_em });
        }
        else await tabela.put({ ...oficial.dados, atualizado_em: oficial.atualizado_em });
      }
    });
  }

  // As camadas da ficha acompanham a linha pública; o aviso é sobre a ficha.
  const avisar = recusadas.filter(l => !ehParteDaFicha(l.tabela));
  if (!avisar.length) return;
  window.dispatchEvent(new CustomEvent<Recusa[]>(EVENTO_RECUSA, {
    detail: avisar.map(l => ({ projeto_id: l.projeto_id, tabela: l.tabela, id: l.id })),
  }));
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
/**
 * Guarda a NOSSA versão antes de o LWW passar por cima dela.
 *
 * É o passo 2 do PLANO-conflitos-sync, e o que faz o dado parar de sumir. No
 * instante em que o conflito era detectado, a versão local JÁ tinha sido
 * destruída pelo `put` — não dava para oferecer escolha entre duas versões
 * quando uma delas deixou de existir. Agora dá.
 *
 * Um conflito por registro: se a mesma diária brigar de novo antes de alguém
 * decidir, vale a disputa mais recente — a anterior está contida nela.
 */
async function guardarConflito(linha: LinhaEspelho, local: Record<string, unknown> | undefined) {
  if (!local) return;
  const remota = (linha.dados ?? null) as Record<string, unknown> | null;

  // Carimbo não é disputa: ele muda SEMPRE, e listá-lo faria toda briga parecer
  // briga de tudo.
  const ignorar = new Set(["atualizado_em", "criado_em", "escala_carimbos"]);
  const chaves = new Set([...Object.keys(local), ...Object.keys(remota || {})]);
  const campos_em_disputa = [...chaves].filter(k =>
    !ignorar.has(k) && JSON.stringify(local[k]) !== JSON.stringify(remota?.[k]));

  await db.conflitos.put({
    id: `${linha.tabela}:${linha.id}`,
    tabela: linha.tabela,
    registro_id: linha.id,
    projeto_id: linha.projeto_id,
    versao_local: local,
    versao_remota: remota,
    campos_em_disputa,
    detectado_em: Date.now(),
  });
}

export async function aplicarLinhas(linhas: LinhaEspelho[]): Promise<number> {
  // As camadas da ficha não são tabela do Dexie — viram campos do `perfis`.
  // A pública vem antes delas na mesma leva, para a camada achar a ficha.
  const usaveis = linhas
    .filter(l => conhecida(l.tabela) || ehParteDaFicha(l.tabela))
    .sort((a, b) => Number(ehParteDaFicha(a.tabela)) - Number(ehParteDaFicha(b.tabela)));
  if (!usaveis.length) return 0;

  const tabelas = [...new Set(usaveis.map(l => (ehParteDaFicha(l.tabela) ? 'perfis' : l.tabela)))];
  let aplicadas = 0;
  const perdidas: Conflito[] = [];

  await db.transaction('rw', [...tabelas.map(t => db.table(t)), db.sync_queue, db.conflitos], async () => {
    // Sem esta marca, os hooks do Dexie carimbam cada linha recebida com a hora
    // daqui e a devolvem para a caixa de saída como se fosse alteração local —
    // e ela sobe de novo, e volta, sem fim. Ver `marcarTransacaoComoRemota`.
    marcarTransacaoComoRemota();

    for (const linha of usaveis) {
      if (ehParteDaFicha(linha.tabela)) {
        if (await aplicarParteDaFicha({ ...linha, tabela: linha.tabela, dados: linha.dados as never })) aplicadas++;
        continue;
      }

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

      /*
        A ESCALA MESCLA POR PESSOA (§10.A). O resto da diária segue o LWW da
        linha inteira; a escala não, porque é onde dois assistentes mexem ao
        mesmo tempo e onde perder metade dói. Ver `escalaMesclada.ts`.
      */
      const escalaDeLa = linha.tabela === 'diarias' && local && linha.dados && !linha.deletado;

      if (carimboDaqui >= linha.atualizado_em) {
        // A nossa versão ganha — mas quem o outro escalou entra nela, e sobe
        // junto quando a nossa pendência subir.
        if (escalaDeLa) {
          const m = mesclarEscala(local as never, linha.dados as never);
          if (!mesmaEscala(m.equipe_escalada, (local as { equipe_escalada?: string[] }).equipe_escalada)) {
            await tabela.put({ ...local, ...m });
          }
        }
        continue;
      }

      // A do servidor ganha — mas quem ESTE aparelho escalou não se perde: a
      // escala mesclada fica aqui com um carimbo novo e volta para a fila.
      if (escalaDeLa && naFila) {
        const m = mesclarEscala(linha.dados as never, local as never);
        if (!mesmaEscala(m.equipe_escalada, (linha.dados as { equipe_escalada?: string[] }).equipe_escalada)) {
          const novo = linha.atualizado_em + 1;
          await tabela.put({ ...linha.dados, ...m, atualizado_em: novo });
          await db.sync_queue.put({ ...naFila, atualizado_em: novo });
          aplicadas++;
          // O resto da diária daqui perdeu para a do servidor: continua sendo
          // conflito, e a pessoa é avisada — só a escala foi salva.
          await guardarConflito(linha, local as Record<string, unknown> | undefined);
          perdidas.push({ projeto_id: linha.projeto_id, tabela: linha.tabela, id: linha.id });
          continue;
        }
      }

      // A nossa versão está a um `put` de deixar de existir. Guarda antes.
      if (naFila) await guardarConflito(linha, local as Record<string, unknown> | undefined);

      if (linha.deletado) await tabela.delete(linha.id);
      else if (linha.dados && linha.tabela === 'perfis') {
        await tabela.put({ ...fundirPublica(local as never, linha.dados), atualizado_em: linha.atualizado_em });
      }
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
