export type ModoProjeto = 'pequeno' | 'grande';
export type ModoAcerto = 'direto' | 'centralizado';

export interface Projeto {
  id: string;
  nome: string;
  modo: ModoProjeto;
  modo_acerto: ModoAcerto;
  diretor?: string;
  produtor?: string;
  produtora?: string;
  produtor_executivo?: string;
  info_equipe?: string;
  saldo_inicial?: number;
  limite_gasto?: number;
  num_diarias?: number;
  modo_diaria?: 'automatico' | 'manual';
  pix_caixa?: string;
  fonte_orcamento?: string;
  local?: string;
  data_inicio?: string;
  data_fim?: string;
  obs?: string;
  campos_customizados?: CampoCustomizado[];
  data_criacao: number;
  moeda: string;
}

export type TipoCampo = 'texto' | 'numero' | 'data' | 'valor' | 'selecao' | 'telefone';

export interface CampoCustomizado {
  id: string;
  nome: string; // Label
  tipo: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: string[]; // Apenas para tipo 'selecao'
}

export interface Departamento {
  id: string;
  projeto_id: string;
  nome: string;
  orcamento_departamento?: number;
}

export interface Perfil {
  id: string;
  projeto_id: string;
  nome: string;
  sobrenome?: string;
  nome_social?: string;
  cpf?: string;
  rg?: string;
  data_nascimento?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  instagram?: string;
  contato_emergencia?: string;
  info_medica?: string;
  tipo_sanguineo?: string;
  alergias?: string;
  medicamentos_continuos?: string;
  restricao_alimentar?: string;
  plano_saude?: string;
  funcao?: string;
  departamento_id?: string;
  drt?: string;
  experiencia?: string;
  valor_diaria?: number;
  tipo_vinculo?: string;
  chave_pix?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  cnpj?: string;
  razao_social?: string;
  custom?: Record<string, string>;
}

export type QuemTipo = 'pessoa' | 'departamento' | 'producao';

export interface QuemValor {
  tipo: QuemTipo;
  id_ref: string;
  valor: number;
}

export type TipoDivisao = 'igual' | 'custom' | 'percentual';

export interface Despesa {
  id: string;
  projeto_id: string;
  descricao: string;
  categoria: string;
  valor_total: number;
  data: number;
  data_ocorrencia?: string;
  diaria?: string;
  diaria_id?: string; // Vínculo com a diária oficial (quando lançada a partir de uma diária)
  pagadores: QuemValor[];
  devedores: QuemValor[];
  tipo_divisao: TipoDivisao;
  comprovante?: string;
}

export type StatusAcerto = 'pendente' | 'confirmado';

export interface Acerto {
  id: string;
  projeto_id: string;
  de: { tipo: QuemTipo; id_ref: string };
  para: { tipo: QuemTipo; id_ref: string };
  valor: number;
  data: number;
  status: StatusAcerto;
}

export interface Configuracao {
  id: string;
  projeto_id: string;
  template_cobranca: string;
  template_pagamento: string;
  template_geral: string;
}

export type AcaoLog = 'criar' | 'editar' | 'deletar';
export type EntidadeLog = 'projeto' | 'perfil' | 'despesa' | 'acerto' | 'departamento' | 'configuracao' | 'diaria' | 'locacao' | 'equipamento' | 'task';

export interface AuditLog {
  id: string;
  projeto_id: string;
  autor_id: string;
  autor_nome: string;
  acao: AcaoLog;
  entidade: EntidadeLog;
  entidade_id: string;
  detalhes: string;
  data_hora: number;
}

export interface SyncQueue {
  id: string;
  tabela: string;
  operacao: 'INSERT' | 'UPDATE' | 'DELETE';
  dados: any;
  timestamp: number;
}

// ---- v3: Locações e Fase 4 (Ordem do Dia) ----

export interface ContatoLocacao {
  id: string;
  nome: string;
  telefone: string;
  papel: string; // dono, produção local, segurança...
}

export interface Locacao {
  id: string;
  projeto_id: string;
  nome: string;
  endereco: string;
  status?: 'conversa' | 'temos' | 'caiu';
  contatos?: ContatoLocacao[];
  coordenadas?: string;
  hospital_proximo?: string;
  contato_seguranca?: string;
  obs?: string;
}

export interface Diaria {
  id: string;
  projeto_id: string;
  numero: number; // Ex: 1 para "Diária 01"
  data: string; // YYYY-MM-DD
  observacoes?: string;
  tem_unidade_b: boolean;
  
  // Relações que poderiam estar em outras tabelas, mas podemos agrupar para simplificar
  equipe_escalada: string[]; // IDs dos perfis escalados para este dia
  locacoes_ids: string[]; // IDs das locações usadas no dia

  // ---- Fase 5C: Clima e Gastos ----
  clima?: { max: number, min: number, text: string, sunrise: string, sunset: string };
  limite_gasto?: number; // Valor MÁXIMO da diária (estouro)
  valor_ideal?: number; // Valor IDEAL da diária (alvo)

  // ---- Blocos da Ordem do Dia ----
  horarios?: HorarioOD[]; // Cronograma do dia (chamada, refeições, wrap...)
  transporte?: string; // Logística: vans, quem vai com quem, pontos de encontro
  anexos?: AnexoOD[]; // Roteiro do dia, decupagem, referências (armazenados como data URL, offline)
  confirmacoes?: string[]; // IDs dos perfis que confirmaram presença
  cenas?: Cena[]; // Cenas do dia
  planos?: Plano[]; // Shot list
}

export interface HorarioOD {
  id: string;
  hora: string; // "07:00"
  evento: string; // "Chamada geral", "Almoço", "Wrap"
}

export interface AnexoOD {
  id: string;
  nome: string;
  tipo: string; // MIME
  dados: string; // data URL (base64)
}

export interface DiariaTask {
  id: string;
  diaria_id: string;
  departamento_id: string;
  descricao: string;
  status: 'pendente' | 'concluido';
  responsavel_id?: string; // ID do perfil
}

export interface Cena {
  id: string;
  numero: string;
  descricao: string;
  locacao_id?: string;
  periodo?: 'dia' | 'noite';
  ambiente?: 'int' | 'ext';
}

export interface Plano {
  id: string;
  cena_id: string;
  numero: string;
  descricao: string;
  tamanho?: string; // plano aberto, plano medio, close...
  angulo?: string; // normal, plongee, contra-plongee
  movimento?: string; // fixo, pan, tilt, tracking...
  lente?: string;
  equipamento?: string;
  elenco?: string;
  notas?: string;
}

// ---- Fase 5D: Kanban de Tasks Gerais ----
export interface Task {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao?: string;
  status: 'todo' | 'doing' | 'done';
  responsavel_id?: string;
  subtarefas?: { id: string, titulo: string, concluida: boolean }[];
  depends_on?: string[]; // IDs das tasks de que esta depende
  data_criacao: number;
}

// ---- Fase 5: Notificações in-app (sino) ----
export interface Notificacao {
  id: string;
  projeto_id: string;
  perfil_id?: string; // responsável alvo (quando houver)
  texto: string;
  task_id?: string; // task relacionada (para navegar)
  lida: boolean;
  data: number;
}
