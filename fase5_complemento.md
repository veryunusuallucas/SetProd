# Fase 5 — Complemento de Implementação

> **Para a IA/dev:** este documento cobre duas implementações da Fase 5 do SetProd: (1) o **construtor de ficha de cadastro** na aba Equipe e (2) a **dependência sequencial de tasks**. Implementar exatamente o comportamento descrito, incluindo os casos de borda — eles são onde o recurso quebra se ignorados.

---

# PARTE 1 — Construtor de Ficha de Cadastro (aba Equipe)

## Objetivo
Permitir **definir quais campos** a ficha de cadastro dos membros terá (campos customizáveis). É onde se desenha a estrutura da ficha, não onde se preenche.

## Localização
- Vive na **aba Equipe** (a mesma tela que lista os membros). Não fica em Configurações.

## Comportamento responsivo
- **Desktop:** painel **fixo à direita**, sempre visível, ocupando o espaço ao lado da lista de equipe. Permite desenhar a ficha e ver a equipe ao mesmo tempo.
- **Mobile / tela estreita:** vira **pop-up / bottom sheet**, aberto por um botão (não há espaço lateral no celular).
- É o **mesmo construtor** — só muda a forma de exibição conforme a largura da tela.

## Funcionalidade
- Adicionar/remover/reordenar campos da ficha.
- Cada campo tem: **nome** + **tipo** (texto, número, data, seleção/opções, valor monetário, telefone, etc.) + se é **obrigatório** ou não.
- Os campos definidos aqui são a **fonte única da verdade** da estrutura da ficha.

## Regra de coerência (importante)
Os campos definidos no construtor de ficha devem alimentar **os três lugares**, sem listas duplicadas:
1. A **ficha do membro** (o que se vê/edita em cada pessoa).
2. O **formulário de cadastro nativo** (o formulário público que cria membros).
3. A **importação** (mapear colunas do CSV/Forms para esses campos).

Não criar três listas de campos separadas que não se falam — é o erro a evitar. Uma definição, usada nos três contextos.

## Casos de borda
- **Apagar um campo que já tem dados preenchidos:** avisar que existem membros com valor nesse campo antes de remover; ao confirmar, decidir política (esconder o dado vs apagar). Não deixar dado órfão silencioso.
- **Renomear campo:** manter o vínculo (usar um ID interno estável pro campo, não o nome como chave), pra renomear não quebrar os dados já preenchidos.
- **Campo obrigatório adicionado depois:** membros antigos ficam sem ele; não travar a edição deles por causa disso — sinalizar como "faltando" em vez de bloquear.

---

# PARTE 2 — Dependência Sequencial de Tasks

> Pressupõe que o Kanban simples de tasks (responsável + status A fazer / Fazendo / Feito) já existe.

## Objetivo
Permitir que uma task só possa ser iniciada depois que outra(s) task(s) forem concluídas. Exemplo real: o AC só pode começar a task "Criação da OD" depois que a Produção concluir a task "Conferir locações".

## Modelo de dados
Adicionar à task existente um campo de dependências:
- `depends_on`: lista de IDs de outras tasks (pode ser vazia, uma, ou várias).
- A task é **a mesma entidade** de sempre — dependência é só um campo opcional. Não criar um "tipo especial" de task.

Estados derivados (calculados, não armazenados como verdade absoluta):
- **Bloqueada** quando tem `depends_on` não-vazio E pelo menos uma das tasks das quais depende **não** está concluída.
- **Liberada** quando `depends_on` é vazio OU **todas** as tasks das quais depende estão concluídas.

## Comportamento

### Dependência múltipla (AND)
- Uma task pode depender de **várias** tasks ao mesmo tempo.
- Só **libera quando TODAS** as tasks das quais depende estiverem concluídas (lógica E/AND, não OU).

### Aparência da task bloqueada
- Fica **visível** no quadro (não some).
- Aparência **travada**: esmaecida (cinza) + ícone de **cadeado**.
- Não é possível mudar o status dela (não dá pra arrastar pra "Fazendo"/"Feito") enquanto bloqueada.
- Mostrar de quais tasks ela depende (ex: tooltip ou lista "aguardando: Conferir locações, Aprovar orçamento").

### Desbloqueio
- Quando a última dependência pendente é concluída, a task **desbloqueia automaticamente** (some o cadeado, volta ao normal, fica arrastável).
- Ao desbloquear, **notificar o responsável dentro do app** (sino / badge de notificação). A notificação leva à task.

## Regras críticas (casos de borda — obrigatórios)

### 1. Impedir dependência circular
- **Nunca** permitir criar uma dependência que forme um ciclo. Ex: A depende de B, e tentar fazer B depender de A (direta ou indiretamente: A→B→C→A).
- Ao adicionar uma dependência, **verificar antes** se ela criaria um ciclo. Se criaria, **bloquear a ação** com mensagem clara ("Isso criaria uma dependência circular: a task X já depende desta, direta ou indiretamente").
- Sem essa checagem, as tasks se travam mutuamente pra sempre. É o bug mais grave possível aqui.

### 2. Reabrir uma task concluída
- Se uma task já concluída (e da qual outras dependiam) for **reaberta** (volta pra "A fazer"/"Fazendo"), as tasks que dependiam dela devem **voltar a ficar bloqueadas** automaticamente.
- Notificar os responsáveis afetados ("A task X foi reaberta; sua task Y está bloqueada novamente").

### 3. Apagar uma task da qual outras dependem
- Ao apagar uma task que é dependência de outras, **avisar** que outras dependem dela.
- Ao confirmar, **remover a referência** dessa task do `depends_on` das filhas (não deixar ID órfão apontando pra task inexistente — senão elas ficam bloqueadas por uma dependência fantasma que nunca conclui).

### 4. Task não pode depender de si mesma
- Bloquear no ato de adicionar (caso trivial do ciclo, mas checar explicitamente).

### 5. Consistência offline
- Como o app é local-first (edições offline sincronizadas depois), o estado de bloqueio/liberação deve ser **recalculado** quando as tasks sincronizam — não confiar num flag "bloqueado" gravado que pode ter ficado desatualizado offline. Recalcular a partir do estado real das dependências ao carregar/sincronizar.

## Interface (resumo)
- No editor da task: campo **"Depende de"** onde se selecionam uma ou mais tasks existentes do projeto (a checagem de ciclo roda aqui).
- No quadro Kanban: tasks bloqueadas com cadeado + esmaecidas; ao passar o mouse/tocar, mostrar de que dependem.
- Sino de notificações: avisa desbloqueio e reabertura.

## Fora de escopo (não implementar agora)
- Dependências "pode começar mas não terminar" (só o modelo simples: bloqueada até liberar).
- Datas/prazos automáticos baseados na cadeia de dependências.
- Dependências entre tasks de projetos diferentes (dependência é sempre dentro do mesmo projeto).
