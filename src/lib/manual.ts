/**
 * O manual do usuário.
 *
 * Fica em arquivo próprio, e não dentro do componente, por um motivo prático:
 * é texto que muda a cada versão do app, enquanto o modal que o exibe quase
 * nunca muda. Separar evita mexer no componente para corrigir uma frase.
 *
 * Regra ao escrever aqui: descreva o que a pessoa VÊ e FAZ, não como o app é
 * feito por dentro. Ninguém abre o manual para saber o que é uma lápide de
 * sincronização — abre para saber por que o roteiro não apareceu no celular.
 */

export interface SecaoManual {
  titulo: string;
  texto: string;
}

export const MANUAL: SecaoManual[] = [
  {
    titulo: '🎬 Como o app funciona',
    texto:
      'O SetProd organiza uma produção audiovisual inteira: dinheiro, equipe, roteiro, diárias, locações e transporte. ' +
      'Tudo é salvo primeiro no seu aparelho, então o app funciona sem internet — no set, no porão, no meio do nada. ' +
      'Quando há sinal, o que você fez sobe sozinho e o que a outra equipe fez desce. ' +
      'A ideia central do financeiro: toda despesa tem QUEM PAGOU e QUEM DEVE, e o app calcula sozinho quem acerta com quem.',
  },
  {
    titulo: '👥 Trabalhar com outra equipe',
    texto:
      'Na barra lateral, em "Quem tem acesso", você cria um link de convite e manda para a outra equipe. ' +
      'Quem abrir precisa entrar com uma conta, e a partir daí vocês trabalham na MESMA produção — não são duas cópias. ' +
      'O link vale 7 dias e serve uma vez só; quem tiver o link entra, então mande por canal privado. ' +
      'As duas equipes têm o mesmo poder: ninguém manda em ninguém. ' +
      'Nessa mesma tela você diz quem você é na equipe cadastrada — é o que faz "Minhas Tasks" saber o que é seu.',
  },
  {
    titulo: '🔄 Salvo, Salvando, Offline',
    texto:
      'No pé da barra lateral fica o estado da sincronização. "Salvo" quer dizer que tudo o que você fez já saiu daqui. ' +
      '"Offline" ou "N para enviar" quer dizer que está guardado no aparelho e sobe assim que houver sinal — nada se perde. ' +
      'Clicando ali, você vê a ata: quem mexeu em quê e quando, mais uma estimativa de quanto a produção ocupa. ' +
      'Quando as duas equipes estão online, o que uma altera aparece na tela da outra em segundos.',
  },
  {
    titulo: '📊 Dashboard',
    texto:
      'A visão geral: saldo disponível (caixa inicial menos gastos), total gasto, maior gasto e a faixa de diárias. ' +
      'Clique numa diária da faixa para focar nela. Tem também o calendário da produção, com o clima previsto para as diárias que têm locação com coordenadas.',
  },
  {
    titulo: '🎞️ Produção',
    texto:
      'Quatro sub-abas. CRÉDITOS monta a ficha técnica por departamento, na ordem da indústria. ' +
      'DEPTO são os departamentos com orçamento. EQUIPE é o cadastro de cada pessoa — clique num membro para ver a ficha, editar e copiar PIX, telefone ou a ficha inteira. ' +
      'Você pode mandar um link de cadastro para a equipe preencher a própria ficha, sem precisar de conta. ' +
      'PESQUISAS está descrita mais abaixo.',
  },
  {
    titulo: '📋 Pesquisas',
    texto:
      'Pergunte qualquer coisa por link: o que jantar, tamanho de camiseta, disponibilidade de data. ' +
      'Escolha única, múltipla, sim/não ou texto livre. Quem responde não precisa de conta, e não vê o que os colegas responderam. ' +
      'O resultado vira gráfico, e a IA lê o conjunto e recomenda uma decisão — num empate, ela cruza com as outras respostas para desempatar. ' +
      'Apagar uma pesquisa derruba o link para todo mundo e apaga as respostas.',
  },
  {
    titulo: '🧾 Despesas',
    texto:
      'Cada gasto tem descrição, valor, data, diária e quem pagou. Escolha dividir com todos ou só com algumas pessoas. ' +
      'Três tipos: pago pela produção, reembolsável, ou rateio entre a equipe. ' +
      'Dá para anexar o comprovante (foto da nota ou link do Drive) — o comprovante vai junto para a outra equipe, que é quem costuma fazer o acerto. ' +
      'Na lista você apaga com opção de desfazer, e edita.',
  },
  {
    titulo: '🤝 Acertos',
    texto:
      'O coração financeiro. O CAIXA DA PRODUÇÃO é o banco central: todos acertam com ele. ' +
      'Cada pessoa mostra o saldo já compensado (adiantou − deve). Abra um membro para ver despesa por despesa, o PIX, ' +
      'gerar a mensagem de cobrança ou repasse e confirmar o pagamento. Pagamentos confirmados vão para o histórico de PAGAS.',
  },
  {
    titulo: '📅 Diárias / Ordem do Dia',
    texto:
      'Cada diária tem horários, equipe escalada, locações, comboios com veículo e motorista, checklist e anexos. ' +
      'O clima entra sozinho quando a locação tem coordenadas, e o hospital mais próximo aparece na OD. ' +
      'Escale uma pessoa, um departamento inteiro ou um grupo salvo. ' +
      'No fim, exporte a Ordem do Dia em PDF escolhendo o que entra — ou peça para a IA montar o texto.',
  },
  {
    titulo: '🎬 Decupagem & Storyboard',
    texto:
      'Suba o roteiro em PDF e a IA lê cena por cena, marcando elenco, objetos, figurino, som e veículos direto no texto. ' +
      'As cenas são separadas pelo padrão de cabeçalho, e a locação de cada uma vem sozinha do cabeçalho. ' +
      'Você também marca à mão, selecionando no PDF. Subir uma revisão não apaga o trabalho da versão anterior — dá para voltar. ' +
      'Na aba ELEMENTOS o app junta os nomes repetidos ("Renata" e "sua mulher" viram um só, com Cast ID). ' +
      'No STRIPBOARD você ordena as cenas, insere quebras de diária, almoço e mudança de locação, e manda um dia direto para uma Ordem do Dia.',
  },
  {
    titulo: '📄 Relatórios do roteiro',
    texto:
      'Quatro relatórios saem da decupagem: DOOD (Day Out of Days, com os dias de espera de cada ator — aquele que filma no dia 1 e no dia 8 costuma ser pago pelos seis do meio), ' +
      'plano de filmagem, breakdown por cena e lista de elementos. Todos em PDF; os tabulares também em CSV.',
  },
  {
    titulo: '📍 Locações e 🚐 Transporte',
    texto:
      'Locações guarda endereço, contatos, coordenadas e observações — e é de onde vêm o clima e a rota. ' +
      'Transporte é o cadastro de veículos e motoristas da produção, que depois aparecem nos comboios da Ordem do Dia.',
  },
  {
    titulo: '📁 Documentos e anexos',
    texto:
      'Todo arquivo do app aparece aqui, organizado em pastas: roteiro, comprovantes, anexos de diária, storyboard. ' +
      'Você também sobe arquivos direto ou cola links do Drive. ' +
      'Os arquivos ficam guardados no servidor e também no seu aparelho — por isso abrem sem internet. ' +
      'Se um anexo aparecer como "indisponível offline", é porque ele foi enviado por outra pessoa e este aparelho ainda não o baixou: abra uma vez com sinal e ele fica.',
  },
  {
    titulo: '✅ Tasks',
    texto:
      'Um quadro de tarefas da produção, com responsável, prazo e a cor do departamento. ' +
      'O filtro "Minhas" usa a pessoa que você escolheu em "Quem tem acesso".',
  },
  {
    titulo: '🤖 Sobre a IA',
    texto:
      'A IA lê roteiro, resume pesquisas e monta a Ordem do Dia. Ela roda no servidor, com teto de uso — ninguém consegue gastar mais do que o combinado. ' +
      'Como é uma análise por vez para toda a produção, se alguém já estiver rodando você entra na fila e vê o progresso, em vez de atrapalhar os dois.',
  },
  {
    titulo: '⚙️ Configurações e dados',
    texto:
      'Modelos de mensagem (com variáveis como {{nome}}, {{valor}}, {{pix}}), modo de diária (automático ou manual) e a zona de perigo para apagar a produção. ' +
      'Em GESTÃO DE DADOS você exporta tudo em TXT, CSV ou JSON — vale como cópia de segurança fora do app. ' +
      'Apagar uma produção apaga também no servidor, para as duas equipes, e derruba os links de pesquisa dela. Não tem volta.',
  },
];
