import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Projeto, Departamento, Perfil, Despesa, Acerto, Configuracao, AuditLog, SyncQueue, Locacao, Diaria, DiariaTask, Task, Notificacao } from '../types';

export class SetMoneyDB extends Dexie {
  projetos!: Table<Projeto, string>;
  departamentos!: Table<Departamento, string>;
  perfis!: Table<Perfil, string>;
  despesas!: Table<Despesa, string>;
  acertos!: Table<Acerto, string>;
  configuracoes!: Table<Configuracao, string>;
  
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

  constructor() {
    super('SetMoneyDB');
    this.version(7).stores({
      projetos: 'id, data_criacao',
      departamentos: 'id, projeto_id',
      perfis: 'id, projeto_id, departamento_id',
      despesas: 'id, projeto_id, data',
      acertos: 'id, projeto_id, status',
      configuracoes: 'id, projeto_id',
      locacoes: 'id, projeto_id',
      logs: 'id, projeto_id, data_hora',
      sync_queue: 'id, timestamp',
      diarias: 'id, projeto_id, numero, data',
      diaria_tasks: 'id, diaria_id, departamento_id',
      tasks: 'id, projeto_id, status, responsavel_id',
      notificacoes: 'id, projeto_id, lida, data'
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

    const tabelasParaSincronizar = ['projetos', 'departamentos', 'perfis', 'despesas', 'acertos', 'configuracoes', 'locacoes', 'diarias', 'diaria_tasks', 'tasks'];
    
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
