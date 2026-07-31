# Plano de Implementação Faseado — SetProd

> **O que é este documento:** o próximo grande ciclo de implementação do SetProd, organizado em **fases por página/módulo**. Reúne pedidos do Vucas e dos amigos (Vitor, Lages, Lore, Mari), com decisões tomadas em conversa. Complementa os planos v2/v3 e Fase 5 — onde algo altera uma decisão anterior, está marcado.
>
> **Ordem das fases:** montada por dependência + escolha do time. As vitórias rápidas vêm primeiro; o módulo mais pesado (breakdown de roteiro em PDF) vem por último, pra não travar o resto.
>
> **Base que não muda:** diária-first, um projeto com áreas Produção + Financeiro, offline local-first (IndexedDB + sync Supabase), navegação sidebar/bottom sheet, contas por papel funcional. Tudo aqui pendura nessa base.

---

## FASE 1 — Fundação Transversal

### 1.1 Botão de Relatar Bug (em todas as páginas)
- Botão fixo no **canto inferior direito**, presente em **todas as páginas** (o mesmo componente que hoje existe junto do "Criar Projeto").
- Ao abrir, captura **automaticamente, sem print**:
  - **Página/rota atual** (onde o problema está).
  - **Papel logado** (Produção / AC / Fotografia).
  - **Navegador e sistema operacional**, **tamanho da tela**.
  - **Data/hora**.
  - **Últimos erros do console** (console.error/warn recentes) — o que mais ajuda a IA a mapear o bug sem print.
  - O **texto** que o usuário escrever + o tipo (bug / sugestão / dúvida), reaproveitando o modal já especificado.
- **Onde guarda — Supabase.** Cria uma tabela `bug_reports` (uma linha por report). Consulta direto no painel do Supabase; opcionalmente, uma tela de admin no app pra ler os reports. Isso resolve o "conseguir pegar os bugs e trazer pra cá".

### 1.2 Favicon
- Trocar o favicon do site por algo relacionado a produção/cinema (claquete, câmera, ou o símbolo do SetProd).

### 1.3 Central de Ajuda — aba de Versão Atual (changelog)
- Nova aba na central de ajuda mostrando a **versão atual (v3)** e **tudo que foi implementado** nessa versão.
- Formato de "novidades desta versão" — o time acompanha o que mudou.

---

## FASE 2 — Dashboard

### 2.1 Resumo de tudo
Transformar o dashboard num panorama real do projeto:
- **Tasks mais recentes** (e/ou pendentes do papel logado).
- **Diárias** (próxima, progresso "Diária X de Y").
- **Dinheiro total** e **gasto**.
- Atalhos rápidos pras áreas.

### 2.2 Sem sobreposição com o dashboard financeiro
- O dashboard geral dá o **panorama** (um número-chave de cada área + atalhos).
- O aprofundamento com gráficos fica no **dashboard do Financeiro** (Fase 4).
- Evitar repetir a mesma informação detalhada nos dois lugares.

---

## FASE 3 — Produção

### 3.1 Página inteira da pessoa (muda decisão anterior)
- Clicar num membro **abre a ficha completa em uma tela/página própria**, com **todas as informações** — não mais o painel que expande embaixo.
- Resolve também o pedido "quando clico, mostra tudo, não resumido".
- **Mudança em relação ao v2:** o v2 previa painel expansível; agora é página inteira (pedido da Mari, faz mais sentido pra ficha de crew, que tem muita informação).

### 3.2 Construtor de ficha parte do que já existe
- Ao abrir o construtor de ficha (na aba Equipe, ver Fase 5), ele **já mostra os campos que existem hoje** (o formulário atual).
- O usuário **adiciona por cima** o que quiser — não começa da estaca zero.
- Cada campo tem toggle **obrigatório** (pedido do Vitor).
- O **link de cadastro enviado** gera o **formulário completo** (os mesmos campos da ficha atual + os adicionados). Uma definição de campos alimenta ficha + formulário + importação (fonte única).

### 3.3 Filtro transversal por campo (ex: "alergia")
- Escolher um campo da ficha (alergia, tipo sanguíneo, tamanho de camiseta…) e ver **o valor de toda a equipe** de uma vez.
- Relatório rápido e muito útil no set.

### 3.4 Aba Produção/Dados — pessoas e crédito (sem finanças)
- Espaço pra registrar **toda a equipe, quem apoiou, empresas envolvidas, extras**.
- Uma **caixa simples**: quem é a pessoa/entidade + **o que ela fez** pela produção.
- **Sem** questões financeiras ou de diárias aqui — só pessoas e contribuição.

### 3.5 Exportar produção (enxuta ou completa)
- **Enxuta:** só **quem é + o que fez** (apoio, equipe completa, extras) — ideal pra créditos.
- **Completa:** o usuário **escolhe exatamente** os campos (número, email, etc.).

### 3.6 Perguntar função ao entrar (unificado com papéis)
- Ao entrar no projeto, o app **pergunta a função** (Produção / AC / Fotografia) e se adapta (pedido da Mari).
- **Unificar com o sistema de papéis:** a função escolhida na entrada **é** o papel ativo — não criar dois mecanismos paralelos. Conecta com o "Quem está usando?" já existente.

### 3.7 Editar e apagar membros/departamentos
- (Da Fase 5, reforçado aqui) edição e exclusão com confirmação/undo.

---

## FASE 4 — Financeiro

### 4.1 Dashboard financeiro com gráficos
- Panorama completo do dinheiro do filme, com **gráficos** representando **pra onde o dinheiro está indo** (por departamento, por diária, por categoria).

### 4.2 Saldos (de onde vem o dinheiro)
- Novo conceito de **Saldos / aportes**: registrar **de onde o dinheiro vem e de quem**.
- Se essa pessoa **existe na área Produção**, **vincular** ao cadastro dela.
- Fecha o ciclo financeiro: entra (saldos) → é gasto (despesas) → é acertado (acertos).

### 4.3 Comprovantes
- **Salvar comprovantes** anexados à despesa (foto/arquivo, no Supabase Storage). (Pedido do Vitor.)

### 4.4 Despesas reembolsáveis (Uber e gastos individuais)
- Marcação **"reembolsável"** na despesa: gasto que a pessoa adiantou e a produção devolve (ex: Uber). (Pedido do Vitor.)
- Conecta com os acertos — vira "a receber" pra pessoa.

### 4.5 (Herda) dois modos de acerto e sub-abas
- Sub-abas Visão Geral · Despesas · Acertos e os dois modos de acerto (Banco vs Compensado) já definidos na Fase 5 seguem valendo.

---

## FASE 5 — Tasks

### 5.1 Mover task entre colunas
- **Arrastar** (drag) no desktop **E** uma **seta na task** pra avançar de coluna a coluna (melhor no mobile, onde arrastar é chato). Ter os dois.

### 5.2 Cor por departamento
- Escolher **cor** pra diferenciar tasks por departamento (leitura rápida no quadro). (Pedido da Mari.)

### 5.3 "Salvar" em vez de "Fechar"
- Trocar o rótulo do botão de **"Fechar"** para **"Salvar"** — "fechar" é ambíguo (fechar a janela? concluir a task?). (Pedido do Vitor.)

### 5.4 (Herda) Kanban + dependência sequencial
- O Kanban simples e a dependência sequencial (spec já escrita) seguem valendo.

---

## FASE 6 — Decupagem + Breakdown de Roteiro (módulo pesado)

> **Aviso de esforço:** esta é, de longe, a fase mais pesada de todo o projeto. Por isso ficou por último — pra não travar as vitórias rápidas das fases anteriores. Recomenda-se atacá-la em duas partes (decupagem primeiro, PDF depois), mesmo estando na mesma fase.

### 6.1 Decupagem (parte mais leve)
- Tela pra criar **cenas → planos → takes**, com atributos técnicos (**sem imagem**): **shot type/tamanho, lente, movimento**, ângulo, etc. — tudo por seleção rápida.
- Os **shots criados aqui ficam acessíveis na criação da OD** (a OD puxa os planos já decupados). Essa conexão é o grande valor.
- Reaproveita o modelo de shot list já descrito na Fase 5 (§4.3), agora numa tela dedicada.

### 6.2 Breakdown de roteiro em PDF (parte pesada)
Fluxo inspirado em StudioBinder / Scriptation / Final Draft (padrão da indústria):
- **Upload do roteiro em PDF** e abertura dentro do app.
- **Modo de marcação:** selecionar um trecho do texto e **taggear** com uma **categoria** (arte, elenco, objetos, etc.), com **cores** (padrão da indústria, customizáveis).
- Cada elemento marcado vira um **item catalogado**.
- **Vincular a marcação a um departamento e gerar uma task** automaticamente. Exemplo do Lages: marcar "LUVAS AMARELAS" → vincular a **Arte** → gera task **"procurar luvas amarelas"**.
- **Relatórios por categoria** (ex: todos os objetos do roteiro), exportáveis.

**Desafios técnicos a tratar (onde esse módulo quebra):**
- Renderizar PDF no navegador e capturar **seleção de texto** sobre ele.
- **Guardar a posição** da marcação de forma estável (pra reabrir no mesmo lugar).
- Fazer tudo isso **funcionar offline** (coerente com o local-first).
- Lidar com **revisões do roteiro** (se o PDF muda, as marcações antigas).

> **Nota de direção:** este módulo é a "camada de ficção" que o v3 previa como futura (roteiro-first). Ele chegou, mas continua sendo uma camada **por cima** da base diária-first — não muda o centro do app.

---

## FASE 7 — Export de OD com IA (Gemini)

### 7.1 Objetivo
No export da Ordem do Dia, usar IA (a **API do Gemini já disponível**) pra **encaixar os dados da diária num layout de OD profissional** — em vez de um export cru. A IA é a "diagramadora" que transforma os dados soltos numa OD formatada e bonita.

### 7.2 Forma A — template fixo (decisão tomada)
- A IA **encaixa os dados reais** da diária (equipe, horários, cenas, locação, clima — vindos do banco) num **layout de OD pré-definido**.
- O **formato é garantido** (não muda a cada export); os **dados factuais vêm do banco**, não da IA.
- **NÃO** gerar a OD do zero (Forma B foi descartada — risco de layout inconsistente e de inventar informação).

### 7.3 IA sugere, usuário aprova
- Onde a IA agrega valor (resumir a **sinopse do dia**, redigir **observações**, organizar ordem), ela **propõe um rascunho**.
- O usuário **revisa e aprova antes de exportar**. Nada sai sem conferência — elimina o risco de horário/nome inventado passar batido.

### 7.4 Regra crítica de implementação (o que mantém a Forma A segura)
- O Gemini recebe os dados da diária de forma **estruturada** (campos separados: nome, horário, cena, etc.).
- Instrução explícita: **só preencher, nunca inventar**. Campo vazio no banco → fica vazio (ou "a definir") na OD. A IA **não completa com chute** dados factuais.
- A IA só tem liberdade criativa nos campos de **texto redacional** (sinopse, observações), nunca em dados (horários, nomes, endereços, canais de rádio).

### 7.5 Templates
- **Começa com um template** — o modelo do PDF de referência do Vucas (OD brasileira completa: cabeçalho, chegada de equipe, base/camarim, horários alimentação vs filmagem, contatos com rádio/canais, descrição hora a hora, elenco na ordem, cenas do próximo dia, observações, meteorologia).
- **Arquitetura pronta pra múltiplos templates:** cada exemplo de OD que o Vucas mandar vira um **template selecionável** ("publicidade", "ficção", "enxuta pra freela"). Escolhe-se o template no export e a IA preenche aquele.

### 7.6 Campos que o template de referência cobre (checklist do layout)
- Cabeçalho: título, data, horário geral (00h às 00h).
- Chegada de equipe (local + endereço).
- Base e camarim (locações).
- Sets / endereços.
- Produção / Direção.
- Horários de alimentação (café, almoço) **separados** dos horários de filmagem (preparação, corta câmera, desprodução).
- Contatos da equipe (celular + canais de rádio por departamento).
- Mapa de transporte.
- Descrição hora a hora: horário | cena | INT-EXT | DIA-NOITE | locação | sinopse | planos | elenco.
- Total de páginas planejadas / nº de locações.
- Elenco na ordem: cena, personagem, ator, chegada, maq/fig, no set, fim do dia, observações de figurino/maquiagem/arte.
- Cenas do próximo dia (na ordem de filmagem).
- Observações gerais do dia.
- Meteorologia (+ nascer/pôr do sol, coerente com o clima da OD já planejado).



- **Ordem das diárias:** devem aparecer em ordem numérica correta (1, 2, 3…). Hoje não ordenam certo. (Apontado pela Mari.)

---

## Resumo — Fases

| Fase | Página/Módulo | Peso | Destaques |
|------|---------------|------|-----------|
| **1** | Fundação transversal | Leve | Bug report (todas as páginas, console, Supabase), favicon, central de ajuda/changelog |
| **2** | Dashboard | Leve | Resumo de tudo (tasks, diárias, dinheiro) |
| **3** | Produção | Médio | Página inteira da pessoa, construtor parte do existente, filtro transversal, dados/crédito, export enxuto/completo, função na entrada |
| **4** | Financeiro | Médio | Dashboard com gráficos, saldos (de onde vem), comprovantes, reembolsáveis |
| **5** | Tasks | Leve | Arrastar + seta, cor por depto, "salvar" |
| **6** | Decupagem + Breakdown PDF | **Pesado** | Decupagem alimenta OD; marcação de roteiro em PDF → tasks |
| **7** | Export de OD com IA | Médio | Gemini encaixa dados em template fixo; sugere e usuário aprova; começa com 1 template |

---

## Créditos das ideias (desta rodada)

- **Vucas:** bug report, favicon, changelog, dashboard-resumo, filtro transversal, dados/crédito, export enxuto/completo, saldos, financeiro com gráficos, mover task.
- **Vitor:** campos obrigatórios na ficha, salvar comprovantes, despesas reembolsáveis (Uber), "salvar" no lugar de "fechar".
- **Lages e Lore:** análise técnica de roteiro (breakdown em PDF, marcar texto → task por departamento) e decupagem (cena/plano/take → alimenta OD).
- **Mari:** abrir pessoa em página inteira, cor por departamento nas tasks, perguntar função ao entrar, ordem correta das diárias.
