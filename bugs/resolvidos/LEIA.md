# Relatos já resolvidos

Arquivo de relatos vem para cá quando **todo item dentro dele** foi tratado —
consertado, ou respondido com uma decisão explícita ("não vamos fazer", "não dá
para reproduzir"). Arquivo com um item em aberto fica em `bugs/`, mesmo que o
resto já esteja pronto.

O motivo é o mesmo dos planos em `.md/feitos/`: meio-resolvido no lugar de
resolvido é como um relato some. E some justamente o difícil, porque o fácil já
foi feito.

Ao mover, acrescente aqui a lista do que o arquivo continha e o que foi feito de
cada item. Sem isso o arquivo vira um `.json` com data no nome, e ninguém sabe se
ele foi lido.

---

## `bug_reports_rows.03.09.json` — 02 a 03/09/2026, 4 relatos

Arquivado em 03/09/2026, na v4.8.1.

- **[bug] "escrever alguma coisa entre palavras na shotlist escreve no final da
  linha"** — corrigido. Cada tecla gravava no banco, e a tela voltava com o
  texto de um instante atrás; o navegador, ao receber um valor diferente do que
  estava na tela, jogava o cursor para o fim. O campo agora segura o texto
  enquanto se digita e grava depois de uma pausa. Verificado: cursor na posição
  8 de "Assalto banco", digitado "ao " → "Assalto ao banco".
- **[bug] "acentos não funcionam no shotlist"** — mesma causa, mesmo conserto. O
  redesenho no meio da composição de ´ + a cancelava o acento. Verificado:
  "invasão à noite, ação e pânico" inteiro.
- **[sugestão] "aumentar o tamanho da fonte da data no menu das diárias"** —
  feito. Ela era 10px em cinza claro; agora é 14px, em negrito, com o dia da
  semana junto ("qui, 03/09/26").
- **[sugestão] "adicionar outras refeições no stripboard"** — feito. O chip
  "Almoço" virou "Refeição", com café da manhã (30min), almoço (60), jantar (60)
  e lanche (20). Café e lanche viram `coffee` na linha do dia; os outros dois,
  `almoco`.

## `bug_reports_rows.json` — 11 a 12/08/2026, 4 relatos

Arquivado em 03/09/2026. Os dois primeiros já estavam corrigidos há semanas — os
comentários no código citam os relatos palavra por palavra.

- **[sugestão] "inverter símbolos de ficha e filtro"** — feito em agosto.
  `PessoasList.tsx`: "Controles = filtrar; documento = ficha. Estavam trocados."
- **[bug] "clicamos em Despesa Reembolsável e não apareceu a pessoa da equipe"**
  — feito em agosto. A lista não estava com defeito: estava vazia, e não dizia.
  Agora ela avisa quando não há ninguém cadastrado.
- **[bug] "no mozila o título não aparece"** e **[bug] "WebGL context was
  lost"** — corrigidos juntos, na v4.8.1. Havia caminho alternativo para quem
  não tem WebGL, mas não para quem TEM e perde o contexto depois — que é o caso
  do Firefox. Agora o título escuta `webglcontextlost` e cai no texto comum.
  Verificado forçando a perda de contexto: o canvas some e "SETPROD" aparece.
  A parte do `Cookie "__cf_bm" has been rejected` é aviso da Cloudflare no
  domínio do Supabase — não é do app e não há o que fazer nele.

## `sugestoes 28.08.json` — 28/08/2026, 2 sugestões

Arquivado em 03/09/2026. As duas entraram na v4.8.0.

- **"o horário e cronograma pode pegar junto com o stripboard e puxar o almoço,
  mudança de locação e tals"** — é o "O dia chega pronto do Stripboard": mandar
  um dia para a diária traz o bloco inteiro, com as pausas e os deslocamentos.
- **"aumenta o tempo entre as frases motivacionais"** — a primeira agora demora
  de 4 a 8 minutos, e as seguintes de 20 a 40. Eram algumas por hora; viraram
  algumas por jornada.

---

## Ainda em `bugs/`

**`bug_reports_rows 27.08.json`** (26–28/08) — 5 relatos, com itens em aberto:

- *"na primeira vez que acessei, nenhum projeto apareceu; na segunda, apareceu"*
  — **em aberto**. Cheira a primeira sincronia chegando depois da tela, mas não
  foi reproduzido, e sem reproduzir não há o que consertar com honestidade.
- *"tá bugado"* (no /login, Firefox) — sem informação para agir. Pode ser o
  título que sumia, corrigido na v4.8.1; pode não ser.
- três sugestões de cor e de botões — **adiadas de propósito**, entram na
  mudança grande de design. A v4.8.0 andou parte do caminho ("Cor com
  significado", estados da diária com cor própria), mas os botões de criar
  diária continuam cinzas.
