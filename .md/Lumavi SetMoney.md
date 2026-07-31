# SetSplit — Controle Financeiro para Set de Cinema

> Plano de produto e documento de referência para construção com IA.
> Versão 0.1 — documento vivo, atualize conforme decidir coisas novas.

---

## 1. Visão

App para controlar despesas em produções de cinema/audiovisual. Resolve dois cenários com o **mesmo motor**:

- **Cenário A — set informal:** ninguém tem verba, todo mundo adianta gastos (transporte, comida, moradia) e no fim se acerta entre si. É "split de despesas" com **simplificação de dívidas** (mínimo de transações).
- **Cenário B — set profissional:** existe **orçamento da produção** por departamento. As despesas saem contra esse orçamento; o que se controla é reembolso de quem adiantou + saldo de verba por departamento.

Princípio de arquitetura: **toda despesa tem "quem pagou" e "quem deve"**. O "quem deve" pode ser uma pessoa, um departamento, ou a própria produção. Isso cobre A e B sem mudar o modelo.

**Modo de uso principal:** local-first / offline-first. O produtor registra tudo offline durante o dia (dados no dispositivo). Ao ter internet, sincroniza. (Sync é fase posterior; a v1 funciona 100% offline.)

---

## 2. Referências de mercado

| App | Preço | O que aproveitar | O que falta pro nosso caso |
|-----|-------|------------------|----------------------------|
| **Splitwise** | Freemium | Lógica central: lançar gasto, marcar quem divide, definir quem pagou, calcular saldos, **"simplify debts"** (mínimo de transações), marcar quitado | Não tem projetos/produções, nem função (operador/arte), nem departamentos, nem orçamento |
| **Tricount** | Grátis | Grupos de despesas, saldos | Mesmas ausências |
| **Settle Up** | Grátis | Igual, com foco em grupos | Mesmas ausências |

**Conclusão:** o motor de cálculo é problema resolvido (copiamos a lógica do Splitwise). O **diferencial** do nosso app é a camada de organização — projeto → departamento → função → orçamento — que nenhum deles faz.

---

## 3. Conceitos e modelo de dados

### Entidades

- **Projeto (Produção)**
  - `id`, `nome`, `modo` (`pequeno` | `grande`), `orçamento_total` (opcional), `data_criação`, `moeda` (default BRL)
  - Tem muitos: perfis, departamentos, despesas, acertos.
  - **`modo` controla a interface (não o motor):**
    - `pequeno` (rateio entre pessoas): as pessoas pagam entre si. Foco na aba "quem paga pra quem". Orçamento oculto.
    - `grande` (produção com verba): aparece orçamento (total e por departamento); foco em "gasto vs disponível" por departamento; adiantamento de pessoa vira reembolso da produção.
  - Escolhido na criação do projeto; pode ser trocado depois.

- **Departamento**
  - `id`, `projeto_id`, `nome` (ARTE, PRODUÇÃO, FOTOGRAFIA...), `orçamento_departamento` (opcional)
  - **Dupla função (flexibilidade pedida):**
    1. **Atalho de seleção** — marcar "ARTE" num gasto seleciona todos os perfis do departamento (depois dá pra tirar/adicionar individualmente).
    2. **Entidade própria** — o departamento pode ser o pagador ou o devedor de uma despesa (o rateio fica no nome do departamento, não das pessoas).

- **Perfil (Pessoa)**
  - `id`, `projeto_id`, `nome` (Lucas, Maíra...), `função` (operador, arte, direção...), `departamento_id` (opcional)
  - `contato` (opcional): `telefone` (pro WhatsApp) e/ou `email` — usado na geração de mensagens.
  - Criável em dois lugares: rápido, na hora de lançar despesa ("+ nova pessoa"), e com calma na aba Pessoas & Departamentos.

- **Despesa**
  - `id`, `projeto_id`, `descrição`, `categoria` (transporte / alimentação / moradia / equipamento / outro), `valor`, `data`
  - `pagadores`: lista de `{ quem, valor }` — **quem adiantou** (1+ pessoas, ou departamento, ou produção)
  - `devedores`: lista de `{ quem, valor }` — **quem deve** (marcados na caixinha)
  - `tipo_divisão`: `igual` | `custom` (valores manuais) | `percentual`
  - `comprovante` (opcional, imagem/arquivo — fase futura)

- **Acerto (Pagamento)**
  - `id`, `projeto_id`, `de` (quem paga), `para` (quem recebe), `valor`, `data`, `status` (pendente/confirmado)
  - Serve pra registrar "fulano já me pagou os R$38".

### "Quem" é um tipo genérico
Um pagador ou devedor pode ser: `pessoa:id`, `departamento:id`, ou `produção`. Assim o mesmo motor serve os dois cenários.

---

## 4. O motor de cálculo (coração do app)

### Passo 1 — Saldo líquido de cada participante
Para cada participante (pessoa ou departamento):

```
saldo = (total que pagou) − (total que deve)
```

- saldo **positivo** → tem a receber
- saldo **negativo** → tem a pagar

**Exemplo real do usuário:**
- Você pagou transporte (gasolina + limpeza) → tem a receber **R$288**
- Você deve (comida + moradia) → **−R$250**
- Saldo líquido = **+R$38** (a receber)
- Em vez de "eles te pagam 288 e você devolve 250", o app resolve: **te devem R$38 líquidos.**

### Passo 2 — Simplificação de dívidas (mínimo de transações)
Algoritmo clássico (o "simplify debts" do Splitwise):

1. Separe quem tem saldo negativo (devedores) e positivo (credores).
2. Pegue o maior devedor e o maior credor.
3. Gere uma transação do menor dos dois valores absolutos entre eles.
4. Abata dos dois saldos. Quem zerar, sai.
5. Repita até todos zerarem.

Resultado: o **menor número de pagamentos** que quita tudo. Ex.: em vez de 10 pagamentos cruzados, "Maíra → Lucas R$38; João → Lucas R$120".

> Observação: existe versão "ótima exata" (NP-difícil) e a versão gulosa acima (rápida e boa o suficiente). Usar a gulosa — é o padrão da indústria.

### Passo 3 — Controle de quitação
Cada transação sugerida vira um **Acerto** que pode ser marcado como pago/confirmado. O resumo separa **pendente** de **quitado**.

### Cenário B — orçamento
Além dos saldos entre pessoas, calcular por departamento:
```
consumido_departamento = soma das despesas do departamento
saldo_orçamento = orçamento_departamento − consumido
```
Mostrar % consumido, alertar quando passar de X%.

---

## 4.5. Mensagens geradas (WhatsApp / email)

Em qualquer lugar que mostre saldo — seu perfil, a linha de uma pessoa no resumo, ou o painel de um departamento — tem um botão **"gerar mensagem"**. O app monta um texto com os dados reais e o usuário **copia** pra colar onde quiser (WhatsApp, email, Telegram...).

**Como funciona (100% offline):**
- Botão **copiar** usando a Clipboard API do navegador, com feedback "copiado!".
- Sem integração externa (nada de `wa.me` ou `mailto`) — o usuário decide onde colar.

**Três templates (editáveis antes de enviar):**
1. **Cobrança / acerto** (modo pequeno) — ex.: "Oi Maíra! No set do [projeto], seu saldo ficou em R$38 a pagar pro Lucas. Detalhe: transporte R$X, comida R$Y."
2. **Prestação de conta** — o que foi gasto e por quê.
3. **Status de orçamento do departamento** (modo grande, pro head) — ex.: "Depto ARTE — orçamento R$5.000, gasto R$3.200, disponível R$1.800. Gastos de hoje: tinta R$420, objetos R$680."

Templates ficam com variáveis (`{nome}`, `{projeto}`, `{saldo}`, `{disponivel}`...) que o app preenche; o usuário ajusta o tom e envia.

---

## 5. Telas (fluxo de UI)

1. **Lista de Projetos** — criar/abrir produção; mostra orçamento e status.
2. **Dentro do Projeto — abas:**
   - **Pessoas & Departamentos** — cadastrar perfis (nome + função), criar departamentos, agrupar.
   - **Despesas** — lançar gasto: descrição, categoria, valor, **quem pagou**, caixinhas de **quem deve**, tipo de divisão. Botão rápido "selecionar departamento inteiro".
   - **Acertos / Resumo** — a aba-chave:
     - Saldo de cada pessoa (a receber / a pagar)
     - Lista simplificada "quem paga pra quem" (mínimo de transações)
     - Marcar como pago
     - (Cenário B) Orçamento por departamento: consumido vs disponível
3. **Configuração do projeto** — orçamento, moeda, exportar dados.

**Registro rápido (buffer offline):** um botão de "lançamento rápido" bem acessível, pensado pra uso corrido no set. Tudo salva local na hora.

---

## 6. Escopo por fases

### Fase 1 — MVP (offline, local)
- Projetos, perfis, departamentos
- Lançar despesas com quem pagou / quem deve / divisão igual
- Motor de saldo + simplificação de dívidas
- Aba de resumo com "quem paga pra quem" e marcar quitado
- Orçamento por departamento (cenário B básico)
- Persistência local (IndexedDB) — funciona sem internet
- PWA instalável

### Fase 2 — Sincronização em nuvem + backup (Supabase)

O app continua offline-first; o Supabase entra como camada de sync/backup.

**Por que Supabase:** dá banco Postgres + login + regras de segurança prontos, e fala direto com React via SDK JavaScript — **não precisa de servidor Node próprio no meio** (o SDK é o "backend"). Encaixa com stack que o usuário já pretende usar em outro projeto.

**Organização de conta (importante):** hierarquia é conta → organização → projetos. No plano **grátis** são até **2 projetos ativos por organização** (cada projeto = um Postgres separado). Se outro app já usa um, sobra um pro SetSplit. Precisando de mais grátis, cria-se outra organização na mesma conta. No plano Pro o limite some.

**As 3 peças do Supabase usadas:**
1. **Postgres** — recriar as mesmas tabelas do modelo (seção 3) na nuvem. É o backup: dados salvos fora do dispositivo.
2. **Auth** — login por email/senha ou magic link. Só necessário para sincronizar; uso offline dispensa login.
3. **RLS (Row Level Security)** — cada usuário só enxerga os próprios dados. Prepara o multiusuário da Fase 3.

**Modelo de sync (simples, adequado ao caso):**
- Produtor registra offline o dia todo → aperta **"sincronizar"** ao conectar.
- Cada registro tem `id` único (UUID) + `updated_at`. Na sincronização, o mais recente vence (last-write-wins).
- Sem resolução de conflito complexa, porque normalmente só uma pessoa registra. (Sync em tempo real fica pra depois, se necessário.)

### Fase 3 — Multiusuário e extras
- Cada pessoa acessa e vê o próprio saldo
- Papéis/permissões (produtor edita, elenco só visualiza)
- Comprovantes (foto de nota), exportar PDF/planilha
- Divisão percentual e por valor custom refinada
- Múltiplas moedas

---

## 7. Stack recomendada (para construir com IA)

**Duas escolhas centrais: React (frontend) + Supabase (nuvem/backend).** Ambos gratuitos e open source.

- **Frontend:** React (Vite) + TypeScript
- **Estado:** Zustand ou Context
- **Persistência offline:** IndexedDB via **Dexie.js** (banco no próprio navegador, 100% offline)
- **PWA:** service worker (instalável, funciona sem rede)
- **Estilo:** Tailwind CSS
- **Nuvem/backend (Fase 2):** **Supabase** — Postgres + Auth + RLS, conversa direto com React via SDK (sem servidor Node próprio). Pode ser auto-hospedado por ser open source.

Por que web/PWA primeiro: roda em qualquer celular sem instalar, é o que as IAs geram melhor, e vira app instalável depois sem reescrever.

### Custo zero e open source

Todo o stack é **gratuito** e **de código aberto** — alinhado com o objetivo de publicar o projeto como open source.

| Peça | Licença | Custo |
|------|---------|-------|
| React | MIT (open source) | Grátis |
| Vite | MIT | Grátis |
| TypeScript | Apache 2.0 | Grátis |
| Dexie.js (IndexedDB) | Apache 2.0 | Grátis |
| Tailwind CSS | MIT | Grátis |
| Supabase | Apache 2.0 (open source) | Plano grátis (ver limites abaixo) |
| Hospedagem (GitHub Pages / Vercel / Netlify) | — | Plano grátis |

**Limites do plano grátis do Supabase** (suficientes pra este app — dados são texto/números, muito leves):
- Até 2 projetos ativos por organização.
- ~500 MB de banco Postgres e ~5 GB de banda/mês.
- Projeto grátis "dorme" após ~1 semana sem uso (reativa ao acessar) — irrelevante pro uso do produtor.
- Sem cartão de crédito.

**Nota sobre o Supabase e open source:** o Supabase pode ser **auto-hospedado** (self-hosted) gratuitamente por qualquer pessoa, já que é open source. Ou seja, quem usar/forkar seu projeto pode rodar o backend na própria máquina/servidor sem depender da nuvem do Supabase — bom argumento de projeto aberto.

**Licença sugerida pro repositório:** MIT (permissiva, comum em projetos JS) ou Apache 2.0. Definir ao publicar.

---

## 8. Roteiro de prompts para construir com IA

Construa em pedaços pequenos e testáveis:

1. **Modelagem:** "Crie os tipos TypeScript para Projeto, Departamento, Perfil, Despesa e Acerto conforme este modelo [colar seção 3]."
2. **Persistência:** "Configure Dexie.js (IndexedDB) com essas tabelas, funcionando offline."
3. **Motor:** "Implemente uma função `calcularSaldos(despesas, participantes)` e uma `simplificarDividas(saldos)` usando o algoritmo guloso [colar seção 4]. Escreva testes com o exemplo: pago 288, devo 250, resultado +38."
4. **UI base:** "Tela de lista de projetos + criar projeto."
5. **UI pessoas:** "Aba de perfis e departamentos, com agrupamento."
6. **UI despesas:** "Formulário de despesa com quem pagou, caixinhas de quem deve e botão 'selecionar departamento inteiro'."
7. **UI resumo:** "Aba de acertos: saldos, lista simplificada quem-paga-pra-quem, marcar quitado, e orçamento por departamento."
8. **PWA:** "Transforme em PWA instalável com service worker."

> Dica: peça testes automatizados no motor de cálculo antes de mexer na UI — é onde bugs de dinheiro doem.

---

## 9. Decisões já tomadas

- Departamento = **atalho E entidade** (flexível).
- Despesa pode ter **múltiplos pagadores** (rachar adiantamento).
- Primeira versão faz **cenário A e B**.
- Começar **offline/local**; nuvem depois.
- Uso principal: **produtor registra offline, sincroniza no fim do dia**.
- Plataforma: **web app / PWA** (React).
- Projeto tem **modo pequeno/grande** escolhido na criação (muda a UI, não o motor).
- Perfil pode ter **contato** (telefone/email) pra gerar mensagens.
- App **gera mensagens** de cobrança / prestação de conta / status de orçamento, e o usuário **copia** o texto pra colar onde quiser (sem integração externa).

## 10. Decisões pendentes (definir depois)

- Nome do app (placeholder: "SetSplit").
- Categorias de despesa fixas ou personalizáveis por projeto?
- No cenário B, adiantamento de pessoa vira "a produção deve à pessoa" automaticamente?
- Precisa de histórico/log de alterações?
- Exportação (PDF de prestação de contas?).
- Licença do repositório (MIT ou Apache 2.0) — definir ao publicar.
