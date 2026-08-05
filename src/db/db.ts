import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Projeto, Departamento, Perfil, Despesa, Acerto, Configuracao, AuditLog, SyncQueue, Locacao, Diaria, DiariaTask, Task, Notificacao, Aporte, Cena, Plano, RoteiroPDF, RoteiroTag, Pasta, Documento, Veiculo, Motorista, Elemento } from '../types';

export class SetMoneyDB extends Dexie {
  projetos!: Table<Projeto, string>;
  departamentos!: Table<Departamento, string>;
  perfis!: Table<Perfil, string>;
  despesas!: Table<Despesa, string>;
  acertos!: Table<Acerto, string>;
  configuracoes!: Table<Configuracao, string>;
  aportes!: Table<Aporte, string>; // Fase 4
  
  // v3 Sync and Audit
  logs!: Table<AuditLog, string>;
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

  // Fase 2 v4: Documentos e Pastas
  pastas!: Table<Pasta, string>;
  documentos!: Table<Documento, string>;

  // v4: Logística / Transporte
  veiculos!: Table<Veiculo, string>;
  motoristas!: Table<Motorista, string>;

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

    // Middlewares para capturar modificações e jogar na sync_queue
    const trackChange = (tabela: string, operacao: 'INSERT' | 'UPDATE' | 'DELETE', dados: any) => {
      Dexie.ignoreTransaction(() => {
        this.sync_queue.add({
          id: crypto.randomUUID(),
          tabela,
          operacao,
          dados,
          timestamp: Date.now()
        }).catch(e => console.error("Erro ao registrar no sync_queue", e));
      });
    };

    const tabelasParaSincronizar = ['projetos', 'departamentos', 'perfis', 'despesas', 'acertos', 'configuracoes', 'locacoes', 'diarias', 'diaria_tasks', 'tasks', 'aportes', 'cenas', 'planos', 'roteiro_pdfs', 'roteiro_tags', 'pastas', 'documentos', 'veiculos', 'motoristas', 'elementos'];
    
    tabelasParaSincronizar.forEach(tabela => {
      this.table(tabela).hook('creating', function(_primKey, obj) {
        trackChange(tabela, 'INSERT', obj);
      });
      this.table(tabela).hook('updating', function(mods, _primKey, obj) {
        trackChange(tabela, 'UPDATE', { ...obj, ...(mods as object) });
      });
      this.table(tabela).hook('deleting', function(_primKey, obj) {
        trackChange(tabela, 'DELETE', obj);
      });
    });
  }
}

export const db = new SetMoneyDB();
