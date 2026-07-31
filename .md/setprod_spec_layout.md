# Spec de Layout — SetProd (correção de largura + master-detail)

> **Para a IA/dev:** especificação de duas mudanças de layout que valem pra **todas as páginas** do app. O objetivo é corrigir o "layout mobile esticado no desktop" e aproveitar o espaço à direita com um padrão master-detail. Aplicar de forma consistente em todo o app.

---

## Problema atual

Em todas as páginas (Dashboard, Produção, Diárias/OD, Financeiro, Locações, Tasks, Configurações), o conteúdo ocupa apenas a **metade/terço esquerdo** da tela, com uma **faixa preta vazia enorme à direita**. Causa: o conteúdo tem largura máxima travada (pensada pra mobile) e fica alinhado à esquerda, desperdiçando a tela larga do desktop.

---

## Mudança 1 — Corrigir a largura em todas as páginas

- O conteúdo deve **aproveitar a largura disponível** do desktop, sem a faixa preta morta à direita.
- **Não** significa esticar texto de ponta a ponta (linha muito larga cansa de ler). Significa: usar o espaço com inteligência — cards maiores, grids com mais colunas onde fizer sentido, margens equilibradas dos **dois** lados (não tudo empurrado pra esquerda).
- **Responsivo de verdade:** o layout se reorganiza conforme a largura (desktop largo → mais colunas / painel lateral; mobile → coluna única). Não é o mesmo layout espremido em todo tamanho.
- Definir uma largura de conteúdo confortável e **centralizar** quando não houver painel de detalhe aberto, em vez de alinhar tudo à esquerda deixando vácuo à direita.

### Colunas por página (decidir caso a caso — recomendação inicial)
- **Diárias / OD:** lista pode ir a **2 colunas** em telas largas (hoje é 1, sobra muito espaço).
- **Locações:** **2-3 colunas** de cards (hoje 1 card sozinho num mar de preto).
- **Equipe (Produção):** já usa 2 colunas — manter/ajustar conforme a largura.
- **Tasks (Kanban):** as 3 colunas devem **preencher a largura** (hoje começam espremidas à esquerda).
- **Dashboard / Financeiro Visão Geral:** os cards de resumo podem ocupar melhor a largura; a faixa de diárias idem.
- **Configurações:** conteúdo centralizado numa coluna larga e legível (formulários não precisam de largura total).

*(São recomendações — o Vucas ajusta por página conforme o teste.)*

---

## Mudança 2 — Padrão Master-Detail (aproveitar o lado direito)

Em vez do vazio à direita, usar um padrão **master-detail**: **lista à esquerda, detalhe à direita**.

### Comportamento
- **Desktop:** ao clicar num item (ex: um membro da equipe), o detalhe abre num **painel à direita**, na área que hoje é preta. A lista continua visível à esquerda. Vê-se lista + detalhe ao mesmo tempo.
- **Mobile / tela estreita:** como não existe espaço lateral, o detalhe abre em **tela cheia** (com botão de voltar). Mesmo conteúdo, exibição adaptada.

### Onde aplicar o master-detail
- **Ficha do usuário (Equipe):** clicar no membro → ficha completa **no painel direito** (desktop) / tela cheia (mobile).
- **Construtor de ficha / formulário:** abre **no painel direito** (desktop) / pop-up ou tela cheia (mobile).
- Pode ser estendido a outras listas onde um "detalhe" faz sentido (ex: detalhe de uma locação, de uma diária), sempre com o mesmo padrão.

### Mudança consciente em relação a decisão anterior
- Antes (pedido da Mari) tínhamos definido que a ficha do usuário abriria em **página inteira**. **Esta spec substitui isso** pelo master-detail (painel à direita no desktop, tela cheia no mobile). Motivo: aproveitar o espaço à direita que hoje fica vazio, sem perder a boa experiência no mobile (onde continua tela cheia). Não é esquecimento da decisão anterior — é uma evolução dela.

---

## Regras gerais (valem pro app todo)
- **Nada cortado:** o conteúdo nunca deve ficar cortado ou escondido por causa da largura. Se não couber, reorganiza (empilha, quebra em colunas), não corta.
- **Consistência:** o mesmo padrão de margens, larguras e comportamento master-detail em todas as páginas — não cada tela de um jeito.
- **Transições suaves:** abrir/fechar o painel direito com transição (herda o padrão de animações já definido).
- **Sem quebrar o mobile:** toda mudança precisa continuar funcionando em coluna única no celular (o app é usado no set).

---

## Checklist
- [ ] Remover a largura travada que causa a faixa preta à direita.
- [ ] Layout responsivo real (reorganiza por largura, não espreme).
- [ ] Centralizar conteúdo quando não há painel aberto (margens dos dois lados).
- [ ] Master-detail: ficha do usuário no painel direito (desktop) / tela cheia (mobile).
- [ ] Master-detail: construtor de ficha idem.
- [ ] Ajustar colunas por página (OD 2, Locações 2-3, Kanban preenche largura, etc.).
- [ ] Garantir que nada fica cortado em nenhuma largura.
- [ ] Transições suaves ao abrir/fechar o painel.
