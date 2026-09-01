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
 *
 * ⚠️ MANUAL DESATUALIZADO É PIOR QUE MANUAL NENHUM. Ele fala com a autoridade
 * de documento oficial: quando erra, a pessoa confia no erro. Ao mudar
 * comportamento no app, mude aqui na mesma leva.
 */

export interface SecaoManual {
  /** Chave estável, para a ajuda contextual apontar sem depender do título. */
  id: string;
  titulo: string;
  texto: string;
  /**
   * Em que telas esta seção é a resposta.
   *
   * Só o pedaço final da rota, sem o `/projeto/:id` que antecede todas. A
   * comparação é por SUFIXO e não por igualdade, porque metade das rotas do app
   * tem parâmetro (`/projeto/abc/diaria/xyz`) — comparar strings inteiras
   * acertaria só na tela sem id, que é justamente a minoria.
   */
  rotas?: string[];
}

/**
 * Qual seção responde pela tela em que a pessoa está.
 *
 * Devolve `undefined` na Home e nas telas públicas, e aí a ajuda mostra o manual
 * inteiro — que é o certo: quem está na porta do app não tem um assunto ainda.
 */
export function secaoDaRota(caminho: string): SecaoManual | undefined {
  const limpo = caminho.replace(/\/+$/, '');

  /*
    O dashboard é o caso especial: a rota dele é `/projeto/:id` e mais nada, e
    qualquer sufixo casaria com ela. Por isso ele é testado primeiro, por forma
    exata, antes de a busca por sufixo começar.
  */
  if (/^\/projeto\/[^/]+$/.test(limpo)) {
    return MANUAL.find(s => s.id === 'dashboard');
  }

  // Do mais específico para o mais genérico: `diaria/` antes de `diarias`,
  // senão a tela de uma diária cairia na seção da lista.
  const candidatas = MANUAL.flatMap(s => (s.rotas || []).map(r => ({ secao: s, rota: r })))
    .sort((a, b) => b.rota.length - a.rota.length);

  return candidatas.find(c => limpo.includes(`/${c.rota}`))?.secao;
}

export const MANUAL: SecaoManual[] = [
  {
    id: 'geral',
    titulo: '🎬 Como o app funciona',
    texto:
      'O SetProd organiza uma produção audiovisual inteira: dinheiro, equipe, roteiro, diárias, locações e transporte. ' +
      'Tudo é salvo primeiro no seu aparelho, então o app funciona sem internet — no set, no porão, no meio do nada. ' +
      'Quando há sinal, o que você fez sobe sozinho e o que a outra pessoa fez desce. ' +
      'A ideia central do financeiro: toda despesa tem QUEM PAGOU e QUEM DEVE, e o app calcula sozinho quem acerta com quem.',
  },
  {
    id: 'acesso',
    titulo: '👥 Quem tem acesso, e o que cada um pode',
    texto:
      'Na barra lateral, em "Quem tem acesso", você cria um link de convite. Quem abrir precisa de uma conta, e a partir daí ' +
      'vocês trabalham na MESMA produção — não são duas cópias. ' +
      'Antes de gerar o link você escolhe o que a pessoa vai poder fazer: DONO faz tudo, inclusive apagar a produção; ' +
      'ADMINISTRA faz tudo e convida gente, mas não apaga; EQUIPE trabalha na produção sem convidar ninguém; SÓ LEITURA vê tudo e não altera nada. ' +
      'O link também pode ser de uma pessoa só (some depois de usado) ou de várias — e o de várias tem um interruptor para desligar quando não quiser mais ninguém entrando. ' +
      'Quem tiver o link entra: mande por canal privado. ' +
      'Nessa mesma tela você diz quem você é na equipe cadastrada — é o que faz "Minhas Tasks" saber o que é seu e o que deixa você ver a sua própria ficha.',
  },
  {
    id: 'conta',
    titulo: '🔐 Sua conta',
    texto:
      'Dá para criar conta sozinho na tela de entrada, e recuperar a senha por e-mail. ' +
      'Quem recebe um convite sem ter conta cria a dele ali mesmo, sem ficar preso na porta. ' +
      'Uma coisa importante: SAIR DA CONTA APAGA OS DADOS DESTE NAVEGADOR. É o que impede a próxima pessoa a usar o computador de abrir a produção sem login. ' +
      'Antes de sair, o app sobe o que faltava e avisa se alguma coisa fosse se perder — espere o rodapé dizer "Salvo".',
  },
  {
    id: 'sync',
    titulo: '🔄 Salvo, Salvando, Offline',
    texto:
      'No pé da barra lateral fica o estado da sincronização. "Salvo" quer dizer que tudo o que você fez já saiu daqui. ' +
      '"Offline" ou "N para enviar" quer dizer que está guardado no aparelho e sobe assim que houver sinal — nada se perde. ' +
      'Clicando ali, você vê a ata: quem mexeu em quê e quando, mais uma estimativa de quanto a produção ocupa. ' +
      'Quando duas pessoas estão online, o que uma altera aparece na tela da outra em segundos. ' +
      'Se alguém mexer no mesmo registro que você estava editando, aparece um aviso no canto — a versão que chegou por último vence.',
  },
  {
    id: 'dashboard',
    titulo: '📊 Dashboard',
    texto:
      'A visão geral: saldo disponível (caixa inicial menos gastos), total gasto, maior gasto e o andamento da produção. ' +
      'O andamento mostra quantas diárias já fecharam e quantas páginas de roteiro já foram gravadas — página gravada é a medida honesta, porque dez diárias de meia página não são metade de um filme. ' +
      'Se alguma cena ficou para trás numa diária fechada, ela aparece aqui no topo, com o motivo e um botão para reencaixar em outro dia. ' +
      'Tem também o calendário da produção, com o clima previsto — escolha de qual locação, no seletor ao lado.',
  },
  {
    id: 'producao',
    titulo: '🎞️ Produção',
    rotas: ['producao'],
    texto:
      'Quatro sub-abas. CRÉDITOS monta a ficha técnica por departamento, na ordem da indústria. ' +
      'DEPTO são os departamentos com orçamento, e GRUPOS são times reutilizáveis para escalar várias pessoas de uma vez. ' +
      'EQUIPE é o cadastro de cada pessoa — clique num membro para ver a ficha, editar e copiar PIX, telefone ou a ficha inteira. ' +
      'Cada pessoa da lista tem um botão "convidar": o link já nasce sabendo quem ela é, e ela entra direto com a função e o departamento certos. ' +
      'Você também pode mandar um link de cadastro para a equipe preencher a própria ficha, sem precisar de conta.',
  },
  {
    id: 'ficha_sensivel',
    titulo: '🔒 CPF, banco e ficha médica',
    texto:
      'Nem todo mundo vê tudo na ficha da equipe. Documento, endereço, cachê e dados bancários, e também a ficha médica, ' +
      'só aparecem para a própria pessoa e para quem é dono ou administra a produção. ' +
      'Quem não pode ver enxerga uma linha explicando por quê, em vez de um campo vazio. ' +
      'O botão "copiar ficha inteira" e a exportação seguem a mesma regra — não adianta esconder na tela e liberar no arquivo. ' +
      'Se você não está vendo os seus próprios dados, é porque o app ainda não sabe que aquela ficha é você: use "diga quem você é nesta produção".',
  },
  {
    id: 'pesquisas',
    titulo: '📋 Pesquisas',
    texto:
      'Pergunte qualquer coisa por link: o que jantar, tamanho de camiseta, disponibilidade de data. ' +
      'Escolha única, múltipla, sim/não ou texto livre. Quem responde não precisa de conta, e não vê o que os colegas responderam. ' +
      'O resultado vira gráfico, e a IA lê o conjunto e recomenda uma decisão — num empate, ela cruza com as outras respostas para desempatar. ' +
      'Apagar uma pesquisa derruba o link para todo mundo e apaga as respostas.',
  },
  {
    id: 'financeiro',
    titulo: '🧾 Despesas e gasto por área',
    rotas: ['financeiro'],
    texto:
      'Cada gasto tem descrição, valor, data, diária, quem pagou e DE QUAL ÁREA ele é. ' +
      'Área e pagador são coisas diferentes: a Arte pode comprar uma lente que é da Fotografia, e o produtor pode pagar a tinta que é da Arte. ' +
      'A área já vem preenchida com o seu departamento, e seguro, taxa e caixa geral ficam em "Da produção". ' +
      'Na visão geral, uma barra por área mostra quanto cada uma gastou do que tinha. ' +
      'Três tipos de despesa: paga pela produção, reembolsável, ou rateio entre a equipe. ' +
      'Dá para anexar o comprovante (foto da nota ou link do Drive), e ele vai junto para quem faz o acerto.',
  },
  {
    id: 'acertos',
    titulo: '🤝 Acertos',
    texto:
      'O coração financeiro. O CAIXA DA PRODUÇÃO é o banco central: todos acertam com ele. ' +
      'Cada pessoa mostra o saldo já compensado (adiantou − deve). Abra um membro para ver despesa por despesa, o PIX, ' +
      'gerar a mensagem de cobrança ou repasse e confirmar o pagamento. Pagamentos confirmados vão para o histórico de PAGAS.',
  },
  {
    id: 'diarias',
    titulo: '📅 Diárias e Eventos',
    rotas: ['diarias', 'diaria/'],
    texto:
      'A LINHA DO DIA é o centro da tela: cenas, refeições, deslocamentos e marcos numa lista só, cada um com o seu horário. ' +
      'Defina a CHAMADA e o app encadeia o resto — cada item empurra o seguinte pelo tempo que consome, e a estimativa de cada cena vem do stripboard. ' +
      'Toque num horário para TRAVÁ-LO: dali em diante a conta recomeça daquele horário, e o resto do dia se ajusta sozinho. Horário calculado é sugestão; travado é decisão. ' +
      'Arraste os itens para reordenar. O botão "Acrescentar ao dia" põe almoço, deslocamento, marco ou nota. ' +
      'A diária tem DOIS MOMENTOS, e não se escolhe entre eles: enquanto é rascunho você monta o plano; quando você EXPORTA a OD, o plano congela e a tela vira registro do que está acontecendo. ' +
      'A exportação é a linha divisória porque, a partir dela, a equipe está com aquele papel na mão — mudar o plano por baixo faria o set seguir um horário e o app mostrar outro. ' +
      'Para mudar depois de exportada: volte a rascunho na faixa do stripboard, edite e reexporte. A nova sai marcada v2, v3, para ninguém seguir o papel velho. ' +
      'No dia da filmagem, quando chega a hora da chamada, aparece sozinho um RELÓGIO GRANDE com "estamos X min atrasados" — verde até 15min, âmbar até 45, vermelho acima disso. Não existe botão de iniciar o dia. ' +
      'Marcar é coisa de AD e produção, e cada anotação fica com o nome de quem fez e a hora. ' +
      'No modo de registro você marca: a hora real de cada item, o estado de cada cena, e no ícone de prancheta os oitavos, os setups, o que exatamente saiu e se houve som wild. ' +
      'Abaixo da linha ficam PRESENÇA E JORNADA (chegou / atrasou / faltou, com chegada, início, refeição e fim de cada pessoa), COBERTURA DO DIA (rolos de câmera e som, figuração e stand-ins) e OCORRÊNCIAS (atraso, equipamento, incidente, clima, com os minutos perdidos). ' +
      'MANDAR PARA A EQUIPE: o botão COMPARTILHAR abre o WhatsApp, o Telegram ou o email do seu aparelho já com a OD escrita e o arquivo de agenda junto; COPIAR deixa a OD pronta para colar em qualquer lugar; ABRIR NO MEU EMAIL abre a sua caixa com a equipe em cópia oculta e o assunto preenchido. Nada disso custa nada nem precisa de configuração. ' +
      'Tem também o arquivo de agenda (.ics, abre no Google, Apple e Outlook — com a diária e cada marco como compromisso) e o campo para colar o link da reunião. ' +
      'Enviar o email EM NOME DA PRODUÇÃO (od@suaprodutora.com.br) é outra coisa: exige um domínio próprio com registros de DNS, senão o Gmail joga em spam. Fica escondido num "ver mais", e o passo a passo está no arquivo LEIA da função enviar-od. ' +
      'Quando algo atrasa, aparece o wrap refeito: "o dia está 40min de atraso — wrap agora às 19:40, planejado 19:00". ' +
      'Ao lado ficam os cartões de apoio. O CARTÃO DE LOCAÇÃO junta tudo do lugar: endereço, previsão do tempo DAQUELE set com nascer e pôr do sol, hospital mais próximo com telefone e rota, e os contatos do local. ' +
      'Mais abaixo, fechados por padrão: transporte e comboios, checklist, confirmação de presença e anexos. ' +
      'DUAS FRENTES NO MESMO DIA: não existe botão de dividir. Escale DOIS GRUPOS e as abas aparecem sozinhas, cada uma com a sua locação, o seu cronograma e a sua equipe — tirou um grupo, volta a ser um dia só. O conceito antigo de "Unidade A/B" acabou. ' +
      'O NÚMERO DA DIÁRIA NÃO SE DIGITA: ele vem da ordem das datas. Criou um dia para amanhã, é a Diária 01; criou um para daqui a um ano com quatro dias antes, é a 05. Ao escolher a data, o app mostra qual vai ser antes de você confirmar. Mudar a data de uma diária, ou apagar uma, renumera o resto sozinho — e se isso mexer no número de uma OD já publicada, aparece um aviso, porque a equipe está com o papel dizendo o número velho. ' +
      'A diária tem QUATRO estados, e a régua deles fica no topo da tela. RASCUNHO acompanha o stripboard (arrastou uma cena lá, muda aqui). TRAVADA congela sem publicar: serve para a diária pronta esperar as outras ficarem, para outra pessoa conferir sem mexer sem querer — e voltar dali não custa nada, porque nada saiu. PUBLICADA é depois de exportar: a equipe está com o PDF na mão, e mudança no stripboard vira aviso em vez de mudar sozinha. FECHADA é depois do relatório. ' +
      'Voltar de PUBLICADA para rascunho mostra um aviso vermelho, e ele é sério: existe um papel circulando que passa a mentir. Corrija e exporte de novo — a nova sai como v2 — e avise a equipe. ' +
      'O botão de MARCAR cena só aparece na diária publicada e no dia da filmagem. Antes disso não quer dizer nada, e um toque por engano sujaria a conta do ritmo do projeto. A lista de cenas continua sempre, porque é ali que você monta o dia. ' +
      'Diária FECHADA não se marca mais: nem cena, nem hora, nem presença, nem checklist. Para mexer, use Reabrir. ' +
      'No fim, exporte a Ordem do Dia em PDF escolhendo o que entra — a linha do dia inteira sai impressa, com horários — ou peça para a IA montar o texto.',
  },
  {
    id: 'gravacao',
    titulo: '🎥 Marcar o que foi gravado',
    texto:
      'Na diária, cada cena tem um botão de estado. Um toque alterna: Gravada → Parcial → Não gravada → Cortada. ' +
      'Sem confirmação, de propósito — no set você está de pé, com pressa, e marcação errada se desfaz com outro toque. ' +
      'Quando não gravou, escolha o motivo nos atalhos (chuva, luz, elenco, equipamento) ou escreva. É o motivo que decide onde a cena cabe depois. ' +
      'CORTADA é diferente de NÃO GRAVADA: cena cortada sai da conta do que falta, e não fica cobrando para sempre. ' +
      'Ao fechar a diária, o app monta o DPR (Relatório Diário de Produção) e destaca as cenas que ninguém marcou — "ninguém marcou" não é "não gravou". ' +
      'O MOTIVO É OBRIGATÓRIO para fechar: cena que não saiu sem explicação vira uma dívida que ninguém entende duas semanas depois. É o único campo do app que tranca um botão. ' +
      'O DPR sai em PDF com os horários planejados contra os reais linha por linha, as cenas filmadas com páginas e setups, as não filmadas com o motivo de cada uma, a jornada de cada pessoa, a figuração, os rolos, as ocorrências e a prestação de contas. ' +
      'Cada anotação sai com o nome de quem a fez e a hora — é a assinatura, e ela vale mais que um campo de assinatura no rodapé. ' +
      'O que ficou para trás vai para a repescagem, no painel, e volta ao stripboard marcado PENDENTE, com contorno vermelho e o número da diária de onde caiu. ' +
      'E no painel aparece o ritmo do projeto: "no ritmo atual, faltam 2 diárias para o filme fechar". Some sozinho quando não há atraso.',
  },
  {
    id: 'decupagem',
    titulo: '🎬 Decupagem & Storyboard',
    rotas: ['decupagem', 'breakdown'],
    texto:
      // A lacuna que a IA da ajuda expôs: perguntaram "como que eu crio uma
      // cena" e ela respondeu "não sei", porque o manual falava do roteiro em
      // PDF e nunca do caminho mais simples. A pergunta que fica sem resposta é
      // a medida do que falta escrever aqui.
      'CRIAR UMA CENA: vá em Decupagem e clique no botão "+ Cena", no topo. Ela nasce com o próximo número, EXT e DIA, e você troca o que precisar. ' +
      'A cena existe no projeto inteiro, não dentro de uma diária: por isso o "Adicionar Cena" da Ordem do Dia só mostra cenas que já existem, e é lá na Decupagem que elas nascem. ' +
      'Suba o roteiro em PDF e a IA lê cena por cena, marcando elenco, objetos, figurino, som e veículos direto no texto. ' +
      'As cenas são separadas pelo padrão de cabeçalho — inclusive 7A e 7B, que são cenas diferentes — e a locação vem sozinha do cabeçalho. ' +
      'Você também marca à mão, selecionando no PDF. Subir uma revisão não apaga o trabalho da versão anterior — dá para voltar. ' +
      'Na aba ELEMENTOS o app junta os nomes repetidos ("Renata" e "sua mulher" viram um só, com Cast ID). ' +
      'No STRIPBOARD você ordena as cenas, insere quebras de diária, almoço e mudança de locação, e manda um dia direto para uma Ordem do Dia. ' +
      'Se mandar para uma diária cuja data já passou, o app pergunta antes — cena num dia morto some do radar.',
  },
  {
    id: 'relatorios',
    titulo: '📄 Relatórios do roteiro',
    texto:
      'Quatro relatórios saem da decupagem: DOOD (Day Out of Days, com os dias de espera de cada ator — aquele que filma no dia 1 e no dia 8 costuma ser pago pelos seis do meio), ' +
      'plano de filmagem, breakdown por cena e lista de elementos. Todos em PDF; os tabulares também em CSV.',
  },
  {
    id: 'locacoes',
    titulo: '📍 Locações e 🚐 Transporte',
    rotas: ['locacoes', 'transporte'],
    texto:
      'Locações guarda endereço, coordenadas, observações e os contatos do lugar — dono, zelador, síndico e, o mais importante, SEGURANÇA, ' +
      'que é o contato que a Ordem do Dia procura numa emergência. É uma lista só: não há campo separado para segurança. ' +
      'A coordenada é o que faz o clima e a rota funcionarem, e o botão de achar hospital próximo depende dela. ' +
      'Transporte é o cadastro de veículos e motoristas da produção, que depois aparecem nos comboios da Ordem do Dia.',
  },
  {
    id: 'documentos',
    titulo: '📁 Documentos e anexos',
    rotas: ['documentos'],
    texto:
      'Todo arquivo do app aparece aqui, organizado em pastas: roteiro, comprovantes, anexos de diária, storyboard. ' +
      'Você também sobe arquivos direto ou cola links do Drive. ' +
      'Os arquivos ficam guardados no servidor e também no seu aparelho — por isso abrem sem internet. ' +
      'Se um anexo aparecer como "indisponível offline", é porque ele foi enviado por outra pessoa e este aparelho ainda não o baixou: abra uma vez com sinal e ele fica.',
  },
  {
    id: 'eventos',
    titulo: '📍 Eventos',
    /*
      SEM `rotas`, de propósito. Eventos é uma aba DENTRO da tela de diárias, e
      as duas dividiriam a rota `diarias` — a ajuda contextual escolheria uma
      das duas pelo desempate da ordenação, ou seja, por acaso. Quem abre a
      ajuda ali está quase sempre na aba de diárias, que é a padrão; esta seção
      continua no manual, logo abaixo, e a IA a lê para responder perguntas.
    */
    texto:
      'Na tela de Ordem do Dia há duas abas: DIÁRIAS e EVENTOS. ' +
      'Evento é o compromisso que não é diária — visita de locação, teste de elenco, reunião, leitura de mesa. ' +
      'Cada um tem data, hora, locação e QUEM VAI: você marca as pessoas da equipe, e assim a pergunta "fui chamado?" deixa de depender de rolar o grupo do WhatsApp. ' +
      'O evento aparece no calendário e na semana à frente do painel, junto das diárias, com a cor do tipo. ' +
      'Escolhendo a locação, o endereço dela aparece dentro do evento — na véspera, o que se quer saber é para onde ir. ' +
      'O que já passou fica guardado embaixo, em "Já aconteceram". ' +
      'Evento NÃO é diária de propósito: diária tem número, cenas e relatório, e é o que mede o quanto do filme foi gravado. Uma visita de locação não move o filme, e se contasse como diária estragaria essa conta.',
  },
  {
    id: 'tasks',
    titulo: '✅ Tasks',
    rotas: ['tasks'],
    texto:
      'Um quadro com três colunas: A FAZER, FAZENDO e FEITO, com a contagem de cada uma no topo. ' +
      'No computador, arraste o cartão de uma coluna para a outra. No celular, o círculo à esquerda do cartão avança o estado num toque — arrastar entre colunas que nem cabem na mesma tela não funciona. ' +
      'O resto do cartão abre a tarefa. ' +
      'Dentro dela você define responsável, departamento, prazo, checklist e DEPENDÊNCIAS: enquanto o que ela espera não estiver feito, ela fica bloqueada e não deixa ser concluída. ' +
      'Tudo é gravado a cada toque — o botão do rodapé só fecha. ' +
      'O filtro "Minhas" usa a pessoa que você escolheu em "Quem tem acesso"; se vier vazio, é porque esse vínculo ainda não foi feito.',
  },
  {
    id: 'equipamento',
    titulo: '📦 Equipamento (SetGear)',
    texto:
      'Se a fotografia usa o SetGear para controlar o equipamento, dá para ligar os dois em "Quem tem acesso". ' +
      'O SetGear passa a ver o nome da produção, as datas das diárias e os veículos — e nada além disso. ' +
      'De volta, a diária mostra as contagens da conferência: "Câmera, 46 de 47 voltaram". ' +
      'A produção nunca vê a lista de equipamento, só os números — inclusive porque boa parte é de terceiros. ' +
      'Desvincular corta o acesso dali para frente; o que já desceu continua no aparelho de quem usa o app.',
  },
  {
    id: 'ia',
    titulo: '🤖 Sobre a IA',
    texto:
      'A IA lê roteiro, resume pesquisas, monta a Ordem do Dia e responde suas dúvidas sobre o app. ' +
      'Ela roda no servidor, com teto de uso — ninguém consegue gastar mais do que o combinado. ' +
      'Como é uma análise por vez para toda a produção, se alguém já estiver rodando você entra na fila e vê o progresso, em vez de atrapalhar os dois. ' +
      'A IA da ajuda responde só a partir deste manual: se a resposta não estiver aqui, ela diz que não sabe em vez de inventar.',
  },
  {
    id: 'config',
    titulo: '⚙️ Configurações e dados',
    rotas: ['config', 'dados'],
    texto:
      'Modelos de mensagem (com variáveis como {{nome}}, {{valor}}, {{pix}}), modo de diária (automático ou manual) e a zona de perigo para apagar a produção. ' +
      'Em GESTÃO DE DADOS você exporta o backup completo da produção — e restaura a partir dele. Vale como cópia de segurança fora do app. ' +
      'A exportação da ficha completa da equipe, que traz CPF, banco e saúde, só está disponível para quem é dono ou administra.',
  },
  {
    id: 'lixeira',
    titulo: '🗑️ Lixeira',
    texto:
      'Apagar uma produção manda ela para a lixeira: some da lista de todo mundo, mas nada é perdido. ' +
      `Dá para restaurar por ${7} dias; depois disso ela é apagada de vez — do servidor, dos aparelhos e os links de pesquisa param. ` +
      'A limpeza roda quando alguém abre o app, então pode demorar um pouco mais que o prazo. ' +
      'Apagar de vez antes do prazo só quem criou a produção pode: destruir o trabalho dos outros não é uma tecla que deva existir.',
  },
];
