import Dexie from 'dexie';
import { carimbarMudancasDaEscala } from '../lib/escalaMesclada';
import type { Table } from 'dexie';

import type { ConflitoGuardado, Projeto, Departamento, Perfil, Despesa, Acerto, Configuracao, AuditLog, SyncQueue, Locacao, Diaria, DiariaTask, Task, Notificacao, Aporte, Cena, Plano, RoteiroPDF, RoteiroTag, Pasta, Documento, Veiculo, Motorista, Elemento, StripboardItem, Pesquisa, RespostaPesquisa, ArquivoLocal, RegistroCena, RegistroPlano, Evento, Take, EstadoDaLogagem, KitDeLogagem, HdDeBackup, BackupDeCartao, ChecksumDeCartao } from '../types';

/**
 * As tabelas que viajam para o servidor.
 *
 * `logs` SAIU em 18/09/2026 (ROADMAP, Etapa 7): viajando pelo espelho, quem
 * apagava o próprio log apagava para todo mundo. A ata agora sobe para uma
 * tabela só de inserção no servidor (`auditoria`), pela fila própria
 * `fila_auditoria` — ver `lib/audit.ts`. `notificacoes` fica de fora: é o sino de
 * cada um, não dado do projeto. `pesquisas` e `respostas_pesquisa` já têm
 * caminho próprio no Supabase, com leitura pública.
 */
export const TABELAS_SINCRONIZADAS = [
  'projetos', 'departamentos', 'perfis', 'despesas', 'acertos', 'configuracoes',
  'locacoes', 'diarias', 'diaria_tasks', 'tasks', 'aportes', 'cenas', 'planos',
  'roteiro_pdfs', 'roteiro_tags', 'pastas', 'documentos', 'veiculos',
  'motoristas', 'elementos', 'stripboard_itens',
  'registros_cena', 'registros_plano', 'eventos',
  'log_takes', 'log_estado', 'log_kits', 'log_hds', 'log_backups', 'log_checksums',
] as const;

/**
 * Marca que uma transação está gravando o que veio do servidor.
 *
 * Sem isto, os hooks abaixo carimbam a linha recebida com a hora DAQUI. Ela
 * volta para a caixa de saída parecendo alteração local e mais nova, sobe de
 * novo, o outro lado recebe e faz o mesmo — ping-pong infinito, com o carimbo
 * subindo a cada volta e o dado nunca estabilizando.
 *
 * A marca vive na transação, não numa variável global de "estou aplicando
 * remoto". Faz diferença: uma trava global engoliria em silêncio qualquer
 * edição que a pessoa fizesse durante a aplicação — e edição engolida é dado
 * perdido, bem pior que um eco. Escritas do usuário rodam em outra transação e
 * não enxergam esta marca.
 */
/**
 * Disparado sempre que algo entra na caixa de saída.
 *
 * É o gatilho que faz a alteração subir logo, em vez de esperar o relógio.
 * Quem escuta precisa segurar um pouco antes de agir: digitar um nome dispara
 * um evento por tecla, e subir a cada tecla seria bater no servidor à toa.
 */
export const EVENTO_ALTERACAO = 'setprod-alteracao';

export const MARCA_REMOTA = 'setprodEscritaRemota';

export function marcarTransacaoComoRemota() {
  const tx = Dexie.currentTransaction as any;
  if (tx) tx[MARCA_REMOTA] = true;
}

/**
 * A trava de escrita local — quem pode gravar o quê. Instalada de fora
 * (`lib/travaDeEscrita.ts`) para o banco não depender da regra de acesso, que
 * depende do banco. Lança para barrar; o Dexie aborta a escrita.
 */
type TravaDeEscrita = (tabela: string, antes: any | undefined, depois: any | undefined) => void;
let travaDeEscrita: TravaDeEscrita | null = null;

export function definirTravaDeEscrita(trava: TravaDeEscrita) {
  travaDeEscrita = trava;
}

/**
 * O carimbo mínimo desta escrita — para desfazer um LWW perdido.
 *
 * Quando a pessoa traz de volta a versão dela (ConflitosPanel), a escrita
 * precisa ganhar do carimbo que está valendo no servidor. `Date.now()` quase
 * sempre ganha, mas não quando o relógio do outro aparelho está adiantado — e aí
 * a versão dela seria descartada outra vez, em silêncio, que é exatamente o que
 * este plano existe para acabar.
 */
let carimboMinimo = 0;

export function escreverGanhandoDe(carimboDoServidor: number) {
  carimboMinimo = carimboDoServidor;
}

function carimboDeAgora(): number {
  const agora = Math.max(Date.now(), carimboMinimo + 1);
  carimboMinimo = 0; // vale para a próxima escrita, uma só
  return agora;
}

function escritaVindaDoServidor(): boolean {
  return Boolean((Dexie.currentTransaction as any)?.[MARCA_REMOTA]);
}

export class SetMoneyDB extends Dexie {
  projetos!: Table<Projeto, string>;
  departamentos!: Table<Departamento, string>;
  perfis!: Table<Perfil, string>;
  despesas!: Table<Despesa, string>;
  acertos!: Table<Acerto, string>;
  configuracoes!: Table<Configuracao, string>;
  aportes!: Table<Aporte, string>; // Fase 4
  
  // v3 Sync and Audit
  /** Cópia local da ata — o que se lê offline. Não viaja pelo espelho. */
  logs!: Table<AuditLog, string>;
  /** A caixa de saída da auditoria: o que foi registrado e ainda não subiu. */
  fila_auditoria!: Table<AuditLog, string>;
  /** Conflitos vistos NESTE aparelho — fora do sync, como as notificações. */
  conflitos!: Table<ConflitoGuardado, string>;
  sync_queue!: Table<SyncQueue, string>;
  locacoes!: Table<Locacao, string>;
  
  // v3 Fase 4
  diarias!: Table<Diaria, string>;
  diaria_tasks!: Table<DiariaTask, string>;
  
  // v3 Fase 5D
  tasks!: Table<Task, string>;

  // Fase 5: Notificações
  notificacoes!: Table<Notificacao, string>;

  // Fase 6: Decupagem e Breakdown
  cenas!: Table<Cena, string>;
  planos!: Table<Plano, string>;
  roteiro_pdfs!: Table<RoteiroPDF, string>;
  roteiro_tags!: Table<RoteiroTag, string>;
  elementos!: Table<Elemento, string>;
  stripboard_itens!: Table<StripboardItem, string>;
  pesquisas!: Table<Pesquisa, string>;
  respostas_pesquisa!: Table<RespostaPesquisa, string>;

  // Fase 2 v4: Documentos e Pastas
  pastas!: Table<Pasta, string>;
  documentos!: Table<Documento, string>;

  // v4: Logística / Transporte
  veiculos!: Table<Veiculo, string>;
  motoristas!: Table<Motorista, string>;

  /** Cópia local dos anexos que vivem no Storage. Cache, não dado — não sincroniza. */
  arquivos!: Table<ArquivoLocal, string>;

  // v4.4: o que de fato foi gravado, dia a dia
  registros_cena!: Table<RegistroCena, string>;
  registros_plano!: Table<RegistroPlano, string>;

  /** v4.7: compromissos que não são diária — visita de locação, teste, reunião. */
  eventos!: Table<Evento, string>;

  /** Logagem: o boletim de câmera que veio do Lumavi. */
  log_takes!: Table<Take, string>;
  log_estado!: Table<EstadoDaLogagem, string>;
  log_kits!: Table<KitDeLogagem, string>;
  log_hds!: Table<HdDeBackup, string>;
  log_backups!: Table<BackupDeCartao, string>;
  log_checksums!: Table<ChecksumDeCartao, string>;

  constructor() {
    super('SetMoneyDB');
    this.version(10).stores({
      projetos: 'id, data_criacao',
      departamentos: 'id, projeto_id',
      perfis: 'id, projeto_id, departamento_id',
      despesas: 'id, projeto_id, data',
      acertos: 'id, projeto_id, status',
      configuracoes: 'id, projeto_id',
      aportes: 'id, projeto_id, data',
      locacoes: 'id, projeto_id',
      logs: 'id, projeto_id, data_hora',
      sync_queue: 'id, timestamp',
      diarias: 'id, projeto_id, numero, data',
      diaria_tasks: 'id, diaria_id, departamento_id',
      tasks: 'id, projeto_id, status, responsavel_id',
      notificacoes: 'id, projeto_id, lida, data',
      cenas: 'id, projeto_id',
      planos: 'id, projeto_id, cena_id',
      roteiro_pdfs: 'id, projeto_id',
      roteiro_tags: 'id, projeto_id, pagina',
      pastas: 'id, projeto_id',
      documentos: 'id, projeto_id, pasta_id'
    });

    // v11: cadastro geral de Transporte (veículos e motoristas) + índice de origem
    // dos documentos. Dexie migra sozinho os dados existentes das outras tabelas.
    this.version(11).stores({
      veiculos: 'id, projeto_id',
      motoristas: 'id, projeto_id',
      documentos: 'id, projeto_id, pasta_id, origem, ref_id'
    });

    // v12: inventário de elementos do breakdown. As marcações continuam sendo
    // ocorrências no PDF; o elemento é a entidade única por trás delas, e é o
    // que permite merge ("sua mulher" = Renata), Cast ID e contagem por cena.
    this.version(12).stores({
      elementos: 'id, projeto_id, categoria, nome',
      roteiro_tags: 'id, projeto_id, pagina, elemento_id'
    });

    // v13: quebras de diária e banners do stripboard. Ficam em tabela própria
    // (e não como "cena falsa") para nunca poluírem contagem de cenas,
    // relatórios ou o vínculo com o roteiro.
    this.version(13).stores({
      stripboard_itens: 'id, projeto_id, ordem'
    });

    // v14: pesquisas para a equipe. As respostas chegam pelo link público (via
    // Supabase) e são puxadas para cá, como já acontece com os cadastros.
    this.version(14).stores({
      pesquisas: 'id, projeto_id, data_criacao',
      respostas_pesquisa: 'id, pesquisa_id, projeto_id'
    });

    // v15: a caixa de saída do sync.
    //
    // A fila antiga guardava uma linha por ALTERAÇÃO, com o objeto inteiro
    // dentro — e nenhum código jamais a leu. Crescia desde a v3 com cópias de
    // PDFs em base64. Aqui ela é esvaziada de vez e passa a guardar só chaves
    // (ver `SyncQueue` em types).
    //
    // O `projeto_id` em diaria_tasks é preenchido pela diária correspondente:
    // era a única tabela que não sabia dizer a que projeto pertence.
    this.version(15).stores({
      sync_queue: 'id, projeto_id, atualizado_em',
      diaria_tasks: 'id, diaria_id, departamento_id, projeto_id'
    }).upgrade(async tx => {
      await tx.table('sync_queue').clear();

      const diarias = await tx.table('diarias').toArray();
      const projetoPorDiaria = new Map(diarias.map(d => [d.id, d.projeto_id]));
      await tx.table('diaria_tasks').toCollection().modify(t => {
        t.projeto_id = projetoPorDiaria.get(t.diaria_id);
      });
    });

    // v16: cópia local dos arquivos que vivem no Storage.
    //
    // Sem ela, tirar os anexos de dentro das linhas custaria o offline: hoje o
    // roteiro abre no set sem sinal porque está no IndexedDB. O Storage passa a
    // ser o transporte entre as equipes; esta tabela é o que mantém o arquivo à
    // mão no aparelho.
    //
    // Fora do sync de propósito — é cache, não dado. Cada aparelho monta o seu.
    this.version(16).stores({
      arquivos: 'caminho, projeto_id'
    });

    /*
      v17: o que de fato foi gravado.

      Uma linha por cena POR DIÁRIA, não um campo dentro de `Cena`. Uma cena
      pode sair pela metade no dia 3 e fechar no dia 7 — um campo só na cena
      apagaria a primeira metade da história, que é justamente a parte que
      alguém vai querer consultar quando o cronograma estourar.

      O índice composto `[diaria_id+cena_id]` é o que a tela do set consulta a
      cada toque: "qual o estado desta cena nesta diária?". Sem ele, marcar uma
      cena varreria a tabela inteira.
    */
    this.version(17).stores({
      registros_cena: 'id, projeto_id, diaria_id, cena_id, [diaria_id+cena_id]',
      registros_plano: 'id, projeto_id, diaria_id, plano_id, [diaria_id+plano_id]'
    });

    /*
      Eventos: visita de locação, teste de elenco, reunião, leitura de mesa.

      Índice composto [projeto_id+data] porque a pergunta do calendário é sempre
      "o que tem NESTE dia, NESTA produção" — sem ele, cada célula do mês varre a
      tabela inteira, e um mês tem trinta e cinco células.
    */
    this.version(18).stores({
      eventos: 'id, projeto_id, data, locacao_id, [projeto_id+data]'
    });

    /*
      v19: Logagem. Ver .md/PLANO-logagem.md, §4.

      `[diaria_id+ordem]` porque a tabela de takes é sempre lida NA ORDEM EM QUE
      FORAM LOGADOS dentro de uma diária — e é essa ordem que diz quais são os
      takes "seguintes" de uma cascata.

      `log_estado` tem `diaria_id` indexado porque é uma linha por diária, e a
      tela chega nela pela diária, nunca pelo id.

      `log_backups` indexa `[diaria_id+cartao]`: a pergunta da matriz é "em quais
      HDs ESTE cartão já está".
    */
    /*
      v20: a fila da auditoria (ROADMAP, Etapa 7). Separada da `sync_queue`
      porque o destino é outro — uma tabela só de inserção — e porque a regra
      é outra: log não tem LWW nem lápide, só chega.
    */
    this.version(20).stores({
      fila_auditoria: 'id, projeto_id'
    });

    /*
      v21: o que o LWW ia jogar fora (PLANO-conflitos-sync, passo 2). Local e
      fora do sync, pelo mesmo motivo das `notificacoes`: é do aparelho que viu.
      Sem índice em `resolvido_em` de propósito — Dexie não indexa `undefined`,
      e "ainda não resolvido" é justamente a ausência dele.
    */
    this.version(21).stores({
      conflitos: 'id, projeto_id, detectado_em'
    });

    this.version(19).stores({
      log_takes: 'id, projeto_id, diaria_id, [diaria_id+ordem], camera_id',
      log_estado: 'id, projeto_id, diaria_id',
      log_kits: 'id, projeto_id, tipo',
      log_hds: 'id, projeto_id',
      log_backups: 'id, projeto_id, diaria_id, [diaria_id+cartao]',
      log_checksums: 'id, projeto_id, diaria_id, cartao'
    });

    /**
     * Descobre de que projeto a linha é.
     *
     * `projetos` é o caso especial: nela o próprio `id` é o id do projeto.
     */
    const donoDaLinha = (tabela: string, obj: any): string | undefined =>
      tabela === 'projetos' ? obj?.id : obj?.projeto_id;

    const enfileirar = (tabela: string, obj: any, deletado: boolean, carimbo: number) => {
      const projeto_id = donoDaLinha(tabela, obj);
      // Sem dono não há como escopar no servidor (a RLS decide por projeto), e
      // sem id não há o que sincronizar. Ficar só no local é melhor que subir
      // um registro que ninguém consegue enxergar depois.
      if (!projeto_id || !obj?.id) return;

      // Fora da transação: escrever na fila de dentro dela travaria o Dexie
      // esperando por ela mesma.
      Dexie.ignoreTransaction(() => {
        this.sync_queue.put({
          id: `${tabela}:${obj.id}`,
          tabela,
          registro_id: obj.id,
          projeto_id,
          ...(deletado ? { deletado: true } : {}),
          atualizado_em: carimbo,
        })
          .then(() => {
            // Avisa que há coisa nova para subir. Sem isto, a alteração só
            // saía daqui no próximo tique do relógio — a outra equipe recebe
            // em menos de um segundo, mas só depois de o dado enfim subir.
            window.dispatchEvent(new CustomEvent(EVENTO_ALTERACAO, { detail: { projeto_id } }));
          })
          .catch(e => console.error('[SetProd] Falha ao enfileirar para o sync', e));
      });
    };

    TABELAS_SINCRONIZADAS.forEach(tabela => {
      // O carimbo de hora nasce aqui, num lugar só, para as 22 tabelas. Nenhum
      // módulo do app precisa lembrar de datar o que grava — e é esse carimbo
      // que decide quem vence quando A e B editam o mesmo campo (LWW).
      this.table(tabela).hook('creating', function (_primKey, obj: any) {
        if (escritaVindaDoServidor()) return;
        travaDeEscrita?.(tabela, undefined, obj);
        const carimbo = carimboDeAgora();
        obj.atualizado_em = carimbo;
        // A escala nasce carimbada, pessoa a pessoa (ROADMAP §10.A).
        if (tabela === 'diarias' && obj.equipe_escalada?.length) {
          obj.escala_carimbos = carimbarMudancasDaEscala([], obj.equipe_escalada, obj.escala_carimbos, carimbo);
        }
        enfileirar(tabela, obj, false, carimbo);
      });

      this.table(tabela).hook('updating', function (mods, _primKey, obj: any) {
        if (escritaVindaDoServidor()) return;
        travaDeEscrita?.(tabela, obj, { ...obj, ...(mods as object) });
        const carimbo = carimboDeAgora();
        enfileirar(tabela, { ...obj, ...(mods as object) }, false, carimbo);

        // Quem entrou e quem saiu da escala ganha o próprio carimbo — é o que
        // a mescla usa quando dois aparelhos escalam ao mesmo tempo (§10.A).
        const m = mods as Record<string, unknown>;
        if (tabela === 'diarias' && 'equipe_escalada' in m) {
          return {
            atualizado_em: carimbo,
            escala_carimbos: carimbarMudancasDaEscala(
              obj.equipe_escalada, m.equipe_escalada as string[] | undefined,
              { ...(obj.escala_carimbos || {}), ...((m.escala_carimbos as object) || {}) }, carimbo,
            ),
          };
        }
        return { atualizado_em: carimbo };
      });

      this.table(tabela).hook('deleting', function (_primKey, obj: any) {
        if (escritaVindaDoServidor()) return;
        travaDeEscrita?.(tabela, obj, undefined);
        // Vai como lápide, não some da fila: se a Equipe A apagar uma cena
        // enquanto a B está offline, a B não tem como saber que ela sumiu —
        // e a cena ressuscitaria no próximo pull dela.
        enfileirar(tabela, obj, true, Date.now());
      });
    });
  }
}

export const db = new SetMoneyDB();
