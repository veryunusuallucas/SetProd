# SetProd (SetMoney App)

Bem-vindo ao **SetProd**, uma aplicação web focada no gerenciamento de produções audiovisuais (cinema, publicidade, TV, etc.). O objetivo do app é centralizar todas as etapas de pré-produção e produção em um só lugar, permitindo que a equipe planeje gravações, acompanhe gastos, defina o fluxo de tarefas e extraia informações do roteiro de forma inteligente.

## 🚀 Principais Funcionalidades

### 1. Decupagem e Breakdown de Roteiro
- **Upload de PDF:** Carregue o roteiro diretamente na plataforma.
- **Extração de Elementos (Tags):** Selecione textos do roteiro (ex: atores, objetos de cena, figurino) e categorize-os para criar uma lista de necessidades.
- **Master Shot List:** Crie sua lista de Cenas e desdobre em Planos (tamanho do plano, equipamento, movimento, lente, ângulo).
- **Geração de Tasks:** Converta elementos identificados no Breakdown diretamente em tarefas acionáveis para a equipe.

### 2. Ordem do Dia (OD) / Diárias
- **Planejamento de Gravação:** Crie diárias de gravação e associe locais, cenas, equipe e horários.
- **Controle Financeiro da Diária:** Monitore gastos diários em tempo real.
- **Gestão de Equipe:** Visualize facilmente quantas e quais pessoas estão escaladas para cada diária.

### 3. Gestão de Tarefas (Kanban)
- Controle de tarefas estilo Kanban (*A Fazer*, *Fazendo*, *Feito*).
- **Dependências:** Tarefas podem depender de outras. O sistema bloqueia a execução de uma task se as dependências dela ainda não estiverem concluídas.
- **Subtarefas e Departamentos:** Atribua tarefas para departamentos específicos ou membros da equipe com checklists de subtarefas.

### 4. Locações
- **Banco de Dados de Sets:** Registre endereços, status de negociação, informações sobre hospital próximo e base de segurança.
- **Mapas:** Integração com OpenStreetMap (OSM) para busca de endereços e links diretos para rotas.
- **Contatos Locais:** Gerencie os contatos dos donos ou responsáveis de cada locação.

### 5. Financeiro e Acertos
- Controle de despesas da produção (separadas por departamento ou categorias).
- Fechamento de contas (quem pagou e quem deve).

### 6. Equipe e Departamentos
- Cadastro completo de membros da equipe (Elenco, Direção, Fotografia, Arte, etc.), organizando funções, dados para pagamento (PIX/Nota) e informações médicas importantes.

## 🛠 Tecnologias Utilizadas

Este projeto foi construído com foco em performance e uso *offline-first* (para funcionar em sets de filmagem sem internet).

- **Framework:** React + TypeScript + Vite
- **Banco de Dados Local:** IndexedDB via [Dexie.js](https://dexie.org/) para armazenamento no próprio navegador sem depender de rede constante.
- **Estilização:** CSS Customizado (uso de variáveis CSS para temas e design de interface limpo).
- **Leitura de PDF:** `react-pdf`
- **Ícones:** `lucide-react`

## 🏃 Como rodar o projeto localmente

1. Certifique-se de ter o Node.js instalado.
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Abra o navegador no link fornecido (geralmente `http://localhost:5173`).

---

**Nota:** Como a aplicação utiliza IndexedDB (Dexie), todos os dados criados (tasks, diárias, locações) ficarão salvos no armazenamento local do navegador (no seu próprio dispositivo). Se você limpar os dados do navegador ou abrir em aba anônima, iniciará com um banco de dados em branco.
