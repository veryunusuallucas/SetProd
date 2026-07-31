# Plano de Novas Funcionalidades — SetProd (Fase 5)

> **O que é este documento:** o conjunto de novas funcionalidades que não estavam no plano v3, discutidas e decididas em conversa. Complementa o `setprod_plano_v3.md` — não o substitui. Onde algo reforça ou altera uma decisão do v3, está marcado.
>
> **Contexto:** a fundação já está no ar (deploy Vercel/Netlify + Supabase configurado, com Auth e RLS). Esta fase adiciona funcionalidade por cima dessa base.
>
> **Princípio mantido:** leveza com profundidade. Recursos avançados aparecem só quando necessários; o fluxo simples continua simples.

---

## 1. PRODUÇÃO

### 1.1 Área de informação técnica/institucional (sem valores)
A área Produção é sobre **quem faz o filme**, não sobre dinheiro. Contém:
- Quem ajudou, apoio, produção, **produtoras envolvidas**, extras.
- Equipe por departamento (composição, não gasto).
- **Nenhum valor financeiro aqui** — quanto cada departamento gastou vive só no Financeiro. Separação limpa: Produção = pessoas e estrutura; Financeiro = dinheiro.

### 1.2 Construtor de formulário nativo
Criar formulários de cadastro dentro do próprio app:
- Criar quantas caixas de resposta forem necessárias, com **tipos de campo variados** (texto, número, data, seleção, etc.).
- **Salvar como template do projeto** (reutilizar o mesmo formulário depois).
- Gerar um **link público** pra enviar à pessoa.
- Ao preencher, **cria o membro automaticamente** no app.
- **Importação como complemento:** quem preferir usar Google Forms (ou outro) pode **importar** os resultados (CSV/planilha) pra criar membros.

> **Nota de esforço:** o construtor de formulário nativo é a parte **mais trabalhosa** desta fase (campos dinâmicos, tipos de resposta, link público, página de preenchimento, criação automática). Dimensionar tempo com isso em mente. A importação, por contraste, é bem mais simples e entrega valor rápido — pode ser feita em paralelo/antes se quiser destravar o fluxo cedo.

### 1.3 Editar e apagar membros e departamentos
Lacuna essencial: hoje cria mas não edita/apaga. Adicionar edição e exclusão (com undo/confirmação, conforme padrão da v2).

---

## 2. LOCAÇÃO

### 2.1 Contatos por locação
- Cada locação tem uma **lista de contatos** (uma locação pode ter vários).
- Cada contato: **nome + telefone + papel** (dono / responsável / produção local / etc.).
- Exemplos reais: casarão → Rogério; museu → telefone geral + Tay; restaurante → Selma.

### 2.2 Status de confirmação (3 estados)
Semáforo visual por locação:
- **Conversa** — em negociação.
- **Temos a locação** — confirmada.
- **Caiu** — perdemos, não temos a locação.

### 2.3 Busca de endereço
- **OpenStreetMap / Nominatim** — busca de endereço **gratuita de verdade** (sem cartão), que retorna **coordenadas** (essenciais pro clima da OD).
- **Campo de link do Google Maps** — mantido como está hoje (colar o link funciona). Os dois convivem: busca nativa via OSM + link do Maps.

> **Nota:** a API do Google Maps **não é gratuita de fato** (crédito mensal limitado + exige cartão). Por isso a busca nativa usa OpenStreetMap, e o Google entra só como link colável.

---

## 3. FINANCEIRO

### 3.1 Orçamento com origem
- **Fonte do orçamento:** de onde vem o dinheiro / **quem providenciou** o orçamento total (cliente, produtora, financiador).
- **Total de colaboradores** do filme (um lugar pra saber o número).

### 3.2 Sub-abas do Financeiro
Reorganização em três sub-abas:
- **Visão Geral** (o "dashboard" financeiro — nome escolhido pra não confundir com o resumo da Produção).
- **Despesas**.
- **Acertos**.

### 3.3 Visão Geral (raio-x financeiro)
Painel com todas as informações financeiras do filme:
- Quem pagou quem.
- Quanto cada departamento gastou.
- Quem gastou tal dinheiro em tal departamento.

### 3.4 Acertos por usuário
Na aba Acertos, para cada usuário dá pra ver:
- Quanto ele **deve** e quanto ele **vai receber**.
- Botões de **confirmação de recebimento** e de **envio de dinheiro**.

### 3.5 Dois modos de acerto (escolha do produtor executivo em Config)
O produtor executivo escolhe **como o app calcula os acertos**:

**Modo A — Banco do Projeto:**
- Quando um gasto é lançado (ex: Pessoa X pagou a alimentação, dividido igualmente), no fim **todo mundo paga pro Banco do Projeto** e o banco redistribui.
- O membro **paga e recebe** através do banco.
- Bom quando existe um caixa central real.

**Modo B — Compensado (líquido):**
- O app **já compensa** o que a pessoa deve com o que tem a receber.
- Exemplo: Lucas pagou R$ 288 de gasolina mas devia R$ 250 à produção → ele **só paga a diferença, R$ 38**, e não recebe nada.
- Menos transações, resolução direta.

> **Regras importantes deste recurso:**
> - O modo ativo precisa ficar **visível** (um selo/etiqueta na aba Acertos), senão gera confusão sobre por que os números mudaram.
> - O modo deve **travar depois que há despesas lançadas** — ou, se permitir trocar, **recalcular tudo com aviso claro**. Trocar no meio sem recalcular bagunça os valores.

*(Estes dois modos já apareciam no plano v2 — a Fase 5 confirma e detalha o comportamento.)*

---

## 4. OD / DIÁRIA

### 4.1 Clima por diária
- Ao criar a diária com a data de filmagem, clicar nela mostra **a previsão do clima daquele dia específico** (via API de clima + coordenadas da locação — ver §2.3).
- **Adicionar nascer/pôr do sol** (hora dourada) — crucial pra planejar luz natural. A mesma API de clima costuma fornecer.

### 4.2 Escalar equipe por departamento
- Na OD, escolher **quem vai estar** e/ou os **departamentos**.
- Ao escolher um departamento, o app **puxa automaticamente os membros daquele departamento** pra OD. (Seleciono "Fotografia" → entra a equipe de fotografia inteira.)

### 4.3 Cenas e Shot List (modelo StudioBinder)
Na criação da OD, além do checklist de produção, criar **quais cenas vão ser gravadas** e detalhar cada plano. Campos (inspirados em StudioBinder e similares):

**Por cena:**
- Número, descrição, locação, dia/noite, interna/externa.

**Por plano (shot):**
- Número/letra, descrição.
- **Tamanho** (close, médio, plano aberto/wide…).
- **Ângulo** (nível do olho, plongée/alto, contra-plongée/baixo).
- **Movimento** (estático, pan, tilt, dolly, travelling).
- **Lente** (mm) — relevante pro FX30.
- **Equipamento** (tripé, gimbal, drone, steadicam).
- **Elenco** presente no plano.
- **Notas.**

**Regras de UX (padrão dos apps profissionais):**
- Atributos por **seleção rápida** (checkbox/dropdown), **nunca digitação** — não exigir lembrar/soletrar jargão.
- **Colunas configuráveis** (mostrar/esconder) — publicidade usa menos campos que ficção.
- **Começar enxuto:** tamanho, ângulo, movimento, lente, notas. O resto opcional.

### 4.4 Exportar OD (seletivo)
- Exportar a OD escolhendo **o que sai** (tela de "o que incluir": horários sim, shot list não, contatos sim, etc.).

### 4.5 Valor máximo e ideal da diária
- Setar **valor máximo** e **valor ideal** por diária.
- O app avisa se **estourou** o valor ou não. (Mesmo padrão do orçamento, aplicado à diária.)

---

## 5. TASKS

### 5.1 Fase 5 — Kanban simples
- Tasks com **responsável** e **status** (A fazer / Fazendo / Feito).
- **Visão por pessoa** ("minhas tasks") + **visão geral** (o produtor vê o quadro completo).
- **Checklist dentro da task** (subtarefas) — ex: "conferir locações" com itens.

### 5.2 Fase seguinte — Dependência sequencial
Documentado, mas **não** construído agora (evita inchar a Fase 5):
- Uma task pode ter um campo opcional **"depende de: [outra task]"**.
- Se tem dependência, fica **bloqueada** (visualmente travada) até a task-mãe ser concluída.
- Quando a mãe fecha, **desbloqueia** e o responsável é **notificado**.
- Modelo elegante: não são dois tipos de task — é a **mesma task com um campo opcional de dependência**. Isso resolve a dúvida de "como diferenciar sequenciais de únicas": não se diferencia na criação, só se adiciona (ou não) a dependência.

Exemplo do fluxo desejado: Produtor cria "conferir locações" (dele) e "criação OD" (do AC, dependente da primeira). O AC só consegue iniciar a OD quando o Produtor fecha a dele.

---

## 6. PAPÉIS E PERMISSÕES

### 6.1 Papéis funcionais via contas
- Contas de login representam **funções no set**, não pessoas: **PRODUÇÃO, AC, FOTOGRAFIA**.
- Se a pessoa que ocupa a função muda, a nova usa a mesma conta (ex: novo AC usa a conta "AC").

### 6.2 Permissões (enxutas)
- **PRODUÇÃO e AC:** acesso amplo, **mas não alteram Equipamentos** (só veem).
- **FOTOGRAFIA:** **leitura em tudo** (só vê) + **acesso total à página de Equipamentos** (a única área que edita). Equipamentos será melhorada mais pra frente.

### 6.3 Construído pra crescer
- O sistema de papéis **não deve ser chumbado em três** — deve permitir **adicionar papéis novos depois** sem refazer tudo. Nota pra implementação: modelar papéis como **dados**, não como código fixo.

### 6.4 Ponto a decidir (não fechado)
- **Ata por função vs por pessoa:** como as contas são compartilhadas por função, a ata registra "AC fez X", não *quem* pessoalmente. Duas pessoas usando a conta AC não são distinguidas. **Decisão adiada** — a revisar quando o uso amadurecer.

---

## 7. Relação com os planos anteriores

- **Confirma do v2/v3:** os dois modos de acerto, o clima na OD, a separação Produção/Financeiro.
- **Traz de volta (adaptado):** o RBAC, que era "fase futura" no v3, retorna aqui numa versão mínima e sob medida (§6) — porque as Tasks designadas precisam dele.
- **Não altera:** a arquitetura central (diária-first, um projeto com áreas, offline local-first, navegação sidebar/bottom sheet). Tudo aqui pendura nessa base.

---

## 8. Resumo — Checklist da Fase 5

**Produção**
- [ ] Área técnica/institucional sem valores.
- [ ] Construtor de formulário nativo (campos, template, link público, cria membro) — *parte mais pesada*.
- [ ] Importação de membros (Google Forms/CSV) como complemento.
- [ ] Editar e apagar membros/departamentos.

**Locação**
- [ ] Lista de contatos por locação (nome + telefone + papel).
- [ ] Status 3 estados (conversa / temos / caiu).
- [ ] Busca via OpenStreetMap + campo de link do Google Maps.

**Financeiro**
- [ ] Orçamento com fonte + quem providenciou + total de colaboradores.
- [ ] Sub-abas: Visão Geral · Despesas · Acertos.
- [ ] Visão Geral (quem pagou quem, gasto por depto, quem gastou onde).
- [ ] Acertos por usuário (deve/recebe + botões de confirmação).
- [ ] Dois modos de acerto (Banco vs Compensado) em Config, com selo do modo ativo e trava/recalculo.

**OD / Diária**
- [ ] Clima por data+local + nascer/pôr do sol.
- [ ] Escalar por departamento (puxa membros automático).
- [ ] Cenas + shot list (StudioBinder), seleção rápida, colunas configuráveis, enxuto.
- [ ] Exportar OD seletivo.
- [ ] Valor máximo/ideal da diária com aviso de estouro.

**Tasks**
- [ ] Kanban simples (responsável, status, visão pessoa/geral, checklist interno).
- [ ] (Futuro) Dependência sequencial (campo "depende de", bloqueio, notificação).

**Papéis/Permissões**
- [ ] Três papéis funcionais (Produção/AC/Fotografia) via contas.
- [ ] Regras: Produção/AC sem editar Equipamentos; Fotografia só leitura + Equipamentos.
- [ ] Sistema de papéis extensível (adicionar mais depois).
- [ ] (A decidir) Ata por função vs por pessoa.
