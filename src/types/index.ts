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
  /**
   * Quando foi mandada para a lixeira. Ausente = produção ativa.
   *
   * Fica no próprio registro do projeto de propósito: ele já viaja pelo
   * espelho, então a marca chega sozinha nas duas equipes. Uma lixeira que
   * existisse só num aparelho seria pior que não ter lixeira — a outra equipe
   * continuaria vendo a produção como se nada tivesse acontecido.
   */
  lixeira_em?: number;
  /** Quem mandou para a lixeira (id da conta), para a tela saber dizer. */
  lixeira_por?: string;
  moeda: string;
  campos_obrigatorios?: string[]; // IDs ou nomes dos campos obrigatórios
  creditos?: Credito[]; // Apoios e extras da Fase 3
  /** Categorias de breakdown criadas pelo usuário, além das padrão da indústria. */
  categorias_extras?: CategoriaCustomizada[];
  grupos?: { id: string; nome: string; perfis_ids: string[] }[]; // Fase 4: Times/Grupos reutilizáveis
}

export interface Credito {
  id: string;
  nome: string;
  papel: string; // "Diretor", "Operador de Câmera", "Apoio de Alimentação"...

  // ---- v4.1: créditos organizados por departamento ----
  departamento_id?: string; // vínculo com o departamento do projeto
  perfil_id?: string;       // quando o crédito é um membro da equipe cadastrado
  ordem?: number;           // posição dentro do departamento (chefe primeiro)
  /** true = veio do catálogo padrão da indústria; false = adicionado pelo usuário */
  padrao?: boolean;
}

/** Categoria de breakdown criada pelo usuário (a cor vira o destaque no PDF). */
export interface CategoriaCustomizada {
  chave: string;   // gerado a partir do rótulo, em maiúsculas
  rotulo: string;
  cor: string;     // hex; o fundo translúcido do destaque sai daqui
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
  cor?: string; // Fase 5
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
  reembolsavel?: boolean; // Fase 4: Sinaliza se a despesa foi um adiantamento
}

export interface Aporte {
  id: string;
  projeto_id: string;
  origem: string; // ex: "Sócio", "Patrocínio", ou ID de um perfil
  valor: number;
  data: number; // timestamp
  obs?: string;
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
  gemini_api_key?: string; // Fase 7
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

/**
 * Cópia local de um anexo que vive no Storage.
 *
 * O arquivo em si sai das linhas (um roteiro em base64 passa de 5 MB e viajaria
 * inteiro a cada alteração), mas não pode sair do aparelho: no set, sem sinal,
 * o roteiro precisa abrir. Esta tabela é essa cópia — cache, não dado, e por
 * isso fora do sync: cada aparelho monta a sua conforme abre os arquivos.
 */
export interface ArquivoLocal {
  /** `<projeto_id>/<uuid>-<nome>` — o mesmo caminho lá no Storage. */
  caminho: string;
  projeto_id: string;
  nome: string;
  tipo: string;   // MIME
  tamanho: number;
  blob: Blob;
  /** false enquanto o arquivo ainda não subiu (criado offline). */
  enviado: boolean;
  criado_em: number;
}

/**
 * Caixa de saída do sync: o que este aparelho ainda não mandou para o servidor.
 *
 * Duas escolhas de forma que resolvem o problema da fila antiga (v3), que
 * crescia para sempre porque ninguém a lia:
 *
 * 1. **Uma linha por REGISTRO, não por alteração.** O `id` é `tabela:registro_id`
 *    e gravar de novo sobrescreve. Corrigir o mesmo valor vinte vezes deixa uma
 *    linha, não vinte.
 *
 * 2. **Guarda a chave, não o conteúdo.** A linha é lida do Dexie na hora de
 *    enviar — então o que sobe é sempre a versão atual, e um PDF em base64 não
 *    fica duplicado dentro da fila.
 */
export interface SyncQueue {
  /** `${tabela}:${registro_id}` — é o que faz as alterações repetidas colapsarem. */
  id: string;
  tabela: string;
  registro_id: string;
  projeto_id: string;
  /** Lápide: o registro foi apagado aqui e o outro lado precisa saber. */
  deletado?: boolean;
  atualizado_em: number;
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
  // Dados do hospital confirmados pelo usuário (busca via Overpass/OSM)
  hospital_telefone?: string;
  hospital_distancia?: number; // metros em linha reta a partir da locação
  hospital_coordenadas?: string; // "lat,lng" para montar a rota
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
  comboios?: Comboio[];

  // ---- Fechamento / arquivamento (v4) ----
  fechada?: boolean;
  data_fechamento?: number;
  anexos?: AnexoOD[]; // Roteiro do dia, decupagem, referências (armazenados como data URL, offline)
  confirmacoes?: string[]; // IDs dos perfis que confirmaram presença
  cena_ids?: string[]; // IDs das cenas globais escaladas para o dia
  cenas?: Cena[]; // DEPRECATED: manter para não quebrar antigas
  planos?: Plano[]; // DEPRECATED
}

export interface Comboio {
  id: string;
  veiculo: string; // texto livre (mantido para diárias antigas)
  motorista: string; // texto livre (mantido para diárias antigas)
  saida: string; // HH:MM
  passageiros_ids: string[];
  veiculo_id?: string; // vínculo com o cadastro de Transporte
  motorista_id?: string;
  ponto_encontro?: string;
}

// ---- Logística: cadastro geral de Transporte (v4) ----
export interface Veiculo {
  id: string;
  projeto_id: string;
  nome: string; // "Van Elenco", "Kombi Arte"
  placa?: string;
  tipo?: string; // van, carro, caminhão, moto
  capacidade?: number;
  motorista_id?: string; // motorista padrão
  obs?: string;
}

export interface Motorista {
  id: string;
  projeto_id: string;
  nome: string;
  telefone?: string;
  cnh?: string;
  perfil_id?: string; // quando o motorista também é membro da equipe
  obs?: string;
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
  /**
   * Era a única tabela do app que não sabia dizer a que projeto pertence — só
   * tinha `diaria_id`. O sync escopa tudo por projeto (é assim que a RLS decide
   * quem vê o quê), então sem este campo a tarefa da Ordem do Dia ficaria de
   * fora. Opcional porque as linhas antigas são preenchidas na migração v15.
   */
  projeto_id?: string;
  diaria_id: string;
  departamento_id: string;
  descricao: string;
  status: 'pendente' | 'concluido';
  responsavel_id?: string; // ID do perfil
}

export interface Cena {
  id: string;
  projeto_id: string;
  numero: string;
  descricao: string;
  locacao_id?: string;
  periodo?: 'dia' | 'noite';
  ambiente?: 'int' | 'ext';
  anexos?: string[]; // URLs ou Base64 (Storyboard)

  // ---- Stripboard (v4) ----
  /** true = veio da extração do roteiro (é substituída ao reprocessar o PDF). */
  origem_roteiro?: boolean;
  /**
   * Texto da cena, guardado na importação.
   *
   * É o que permite saber em quais cenas um personagem aparece sem depender de
   * ter uma marcação por ocorrência. As marcações de elenco são únicas por
   * texto (para o destaque valer no roteiro todo), então contar cenas por elas
   * daria "1 dia de trabalho" para o protagonista.
   */
  corpo?: string;
  ordem?: number; // posição na ordem de filmagem
  paginas?: string; // "1 2/8"
  unidade?: 'A' | 'B';
  estimativa?: string; // "45min", "2h"
  elenco_ids?: string[]; // perfis presentes na cena
}

/**
 * Itens do stripboard que NÃO são cena: quebras de diária e banners.
 *
 * Eles dividem e anotam a ordem de filmagem — "aqui acaba o dia 1", "almoço",
 * "mudança de locação". Ficam na mesma linha do tempo das cenas, compartilhando
 * o campo `ordem`, porque a posição relativa entre eles é justamente a
 * informação: um almoço só significa algo entre duas cenas.
 */
export type TipoStripboardItem = 'DAY_BREAK' | 'BANNER_LUNCH' | 'BANNER_MOVE' | 'BANNER_NOTE';

export interface StripboardItem {
  id: string;
  projeto_id: string;
  tipo: TipoStripboardItem;
  ordem: number;
  /** Texto livre do banner. A quebra de diária usa o número calculado. */
  titulo?: string;
  /** Minutos que o evento consome do dia (almoço, deslocamento). */
  duracao_min?: number;
  descricao?: string;
  /** Só para DAY_BREAK: data planejada da diária. */
  data?: string;
  /** Diária do projeto para a qual este dia já foi exportado. */
  diaria_id?: string;
}

export interface Plano {
  id: string;
  projeto_id: string;
  cena_id: string;
  numero: string;
  descricao: string;
  tamanho?: string; // ex: Plano Aberto, Close
  movimento?: string; // ex: Pan, Tilt, Fixo
  lente?: string; // ex: 35mm
  angulo?: string; // normal, plongee, contra-plongee
  equipamento?: string;
  elenco?: string;
  notas?: string;
}

// ---- O que de fato foi gravado (Etapa 3 do PLANO-stripboard-od-ciclo) ----

/**
 * Os quatro estados de uma cena num dia de filmagem.
 *
 * `cortada` NÃO é `nao_gravada`, e a diferença é o que impede o app de cobrar
 * para sempre: cena que a direção abandonou sai da conta de pendências e do
 * total de páginas. Sem esse estado, ela ficaria eternamente na fila de
 * repescagem sem que ninguém pudesse tirá-la de lá honestamente.
 */
export type StatusCena = 'gravada' | 'parcial' | 'nao_gravada' | 'cortada';

/**
 * O que aconteceu com uma cena NUM DIA.
 *
 * ⚠️ Uma linha por cena POR DIÁRIA, e não um campo `status` dentro de `Cena`.
 * O motivo é concreto: uma cena pode ser gravada pela metade no dia 3 e
 * concluída no dia 7. Um campo só na cena apagaria a primeira metade da
 * história — que é exatamente a parte que alguém vai querer consultar depois,
 * numa discussão sobre por que o cronograma estourou.
 *
 * O status ATUAL de uma cena é derivado: a linha mais recente entre as diárias.
 * Nunca guarde o derivado; é assim que os dois divergem.
 */
export interface RegistroCena {
  id: string;
  projeto_id: string;
  diaria_id: string;
  cena_id: string;
  status: StatusCena;
  /** Por que não gravou. É o motivo que orienta a decisão seguinte, não o fato. */
  motivo?: string;
  observacao?: string;
  /** Quanto da cena saiu, em oitavos de página. */
  oitavos_gravados?: number;
  setups?: number;
  registrado_em: number;
  /** `perfil_id` de quem marcou — é o que faz o relatório valer como documento. */
  registrado_por?: string;
  atualizado_em?: number;
}

/**
 * O mesmo, no nível do plano.
 *
 * É daqui que sai o "parcial" de forma honesta: cena com 6 planos e 4 marcados
 * sugere `parcial` sozinha. **Sugere, não decide** — às vezes 4 planos bastam e
 * a cena está fechada, e só quem estava lá sabe.
 */
export interface RegistroPlano {
  id: string;
  projeto_id: string;
  diaria_id: string;
  plano_id: string;
  cena_id: string;
  status: 'ok' | 'pendente';
  takes?: number;
  observacao?: string;
  registrado_em: number;
  registrado_por?: string;
  atualizado_em?: number;
}

export interface RoteiroPDF {
  id: string;
  projeto_id: string;
  nome: string;
  dados: string; // base64 do pdf
  data_upload: number;
  /**
   * Versões do roteiro (v4 §2.7).
   *
   * Trocar o PDF por uma revisão arquivava a versão anterior — e junto ia todo
   * o trabalho de marcação feito em cima dela. Agora a antiga fica guardada com
   * suas tags intactas, e dá para voltar.
   */
  versao?: number;
  arquivado?: boolean;
}

/**
 * A coisa única que a produção precisa providenciar — "Renata", "arma do
 * Marcos", "chuva".
 *
 * Uma RoteiroTag é uma OCORRÊNCIA (este trecho, nesta página). O Elemento é a
 * entidade por trás de várias ocorrências. Essa separação é o que permite
 * contar cenas por ator, dar Cast ID e mesclar "sua mulher" com "Renata".
 */
export interface Elemento {
  id: string;
  projeto_id: string;
  /** Nome canônico, o que aparece nos relatórios. */
  nome: string;
  categoria: string; // chave de DEPARTMENT_THEMES
  /** Numeração de elenco (1, 2, 3...), atribuída por ordem de entrada no roteiro. */
  cast_id?: number;
  /** Outros nomes que o roteiro usa para a mesma coisa ("sua mulher"). */
  aliases?: string[];
  notas?: string;
  /** Referências visuais: data URL ou link. */
  imagens?: string[];
  /** Agrupamento livre ("kit detetive"). */
  grupo?: string;
  /** Vínculo com a equipe, quando o elemento de elenco é alguém cadastrado. */
  perfil_id?: string;
}

export interface RoteiroTag {
  id: string;
  projeto_id: string;
  roteiro_id: string;
  pagina: number;
  texto_selecionado: string;
  categoria: string; // chave de DEPARTMENT_THEMES (ex: 'ELENCO')
  cor: string;
  cena_id?: string;
  /** Elemento a que esta ocorrência pertence (ver Elemento). */
  elemento_id?: string;
  /**
   * true = destaca o trecho em TODAS as páginas do roteiro.
   * Personagem e veículo se repetem em muitas cenas; som e efeito são pontuais.
   */
  global?: boolean;
  pos_x?: number;
  pos_y?: number;
}

// ---- Fase 2: Documentos e Pastas ----
export interface Pasta {
  id: string;
  projeto_id: string;
  nome: string;
  cor: string;
  data_criacao: number;
}

export type OrigemDocumento = 'manual' | 'roteiro' | 'comprovante' | 'diaria' | 'storyboard';

export interface Documento {
  id: string;
  projeto_id: string;
  pasta_id?: string;
  nome: string;
  tipo: 'link' | 'upload';
  url: string; // link do drive ou data URL do arquivo
  preview_url?: string;
  tamanho?: number;
  data_criacao: number;
  // Índice central: o documento nasceu em outro lugar do app e se reflete aqui
  origem?: OrigemDocumento;
  ref_id?: string; // id da entidade de origem (despesa, diária, cena...)
}

// ---- Fase 5D: Kanban de Tasks Gerais ----
export interface Task {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao?: string;
  status: 'todo' | 'doing' | 'done';
  responsavel_id?: string;
  departamento_id?: string; // Fase 5
  subtarefas?: { id: string, titulo: string, concluida: boolean }[];
  depends_on?: string[]; // IDs das tasks de que esta depende
  data_criacao: number;
  data_conclusao?: string; // YYYY-MM-DD (Fase 4/6)
}

// ---- Pesquisas / enquetes para a equipe ----

/**
 * O tipo da pergunta decide como o resultado é lido.
 *
 * Não é detalhe de formulário: contar votos de "escolha única" faz sentido,
 * contar respostas de texto livre não faz nenhum. Por isso cada tipo tem a
 * própria apuração.
 */
export type TipoPergunta = 'escolha_unica' | 'escolha_multipla' | 'texto' | 'sim_nao';

export interface Pergunta {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  /** Só para escolha única/múltipla. */
  opcoes?: string[];
  obrigatoria?: boolean;
}

export interface Pesquisa {
  id: string;
  projeto_id: string;
  titulo: string;
  descricao?: string;
  perguntas: Pergunta[];
  /** Fechada para de aceitar respostas, mas o resultado continua visível. */
  aberta: boolean;
  data_criacao: number;
  /** Recomendação da IA, guardada para não gastar chamada a cada abertura. */
  recomendacao?: string;
  recomendacao_em?: number;
  /** Quantas respostas havia quando a recomendação foi gerada. */
  recomendacao_respostas?: number;
}

export interface RespostaPesquisa {
  id: string;
  pesquisa_id: string;
  projeto_id: string;
  /** Quem respondeu, se quis se identificar. */
  nome?: string;
  perfil_id?: string;
  /** id da pergunta → resposta. Múltipla escolha guarda lista. */
  respostas: Record<string, string | string[]>;
  data: number;
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
