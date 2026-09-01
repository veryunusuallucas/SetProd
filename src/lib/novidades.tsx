import {
  Sparkles, HelpCircle,
  UserPlus, ShieldCheck, Lock, IdCard, Clapperboard, ClipboardCheck,
  RotateCcw, GitCompare, PieChart, CloudSun, Trash2, GitMerge, MapPin, Clock,
  RefreshCw, MessageCircleQuestion, Undo2, DollarSign, ListChecks, CalendarDays,
  Bell, LogIn, Bug, Send, Mail, Film, Share2,
} from 'lucide-react';

/**
 * O histórico de novidades do app, versão por versão.
 *
 * POR QUE ISTO SAIU DE DENTRO DO MODAL
 * A v4.4 estava escrita no meio do componente que a desenha. Funciona uma vez.
 * Na segunda versão, alguém teria que editar JSX de layout para acrescentar uma
 * frase — e é assim que changelog para de ser atualizado: o custo de escrever
 * uma linha fica alto demais para uma correção pequena.
 *
 * Aqui é uma lista. Versão nova é um objeto novo no topo, e mais nada.
 *
 * A REGRA COMBINADA COM O LUCAS
 * Todo push que muda o app entra aqui. Mesmo os pequenos — 4.4.1, 4.4.2 — e é
 * justamente por causa deles que a lista existe: quem está usando percebe a
 * mudança pequena e não sabe se foi ele que fez algo diferente.
 *
 * O `verifica-novidades.mjs` impede o push que esquece isto. Ver `.githooks/`.
 *
 * COMO ESCREVER
 * O texto é para quem usa o app, não para quem escreve o código. Diga o que
 * mudou na tela e por quê — nunca o nome do arquivo. Se a frase não fizer
 * sentido para alguém que nunca viu o repositório, ela não está pronta.
 */

export type Tipo = 'novo' | 'melhor' | 'corrigido';

export interface Item {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  tipo: Tipo;
}

export interface Grupo {
  id: string;
  titulo: string;
  resumo: string;
  cor: string;
  itens: Item[];
}

export interface Versao {
  /** Tem que bater com a `version` do package.json quando esta for a atual. */
  versao: string;
  /** Uma frase sobre o conjunto. Some nas versões pequenas, e tudo bem. */
  resumo?: React.ReactNode;
  /**
   * Versão grande separa por assunto; correção pequena não precisa — ninguém
   * agrupa dois itens. Com `grupos` vazio, os `itens` aparecem numa lista só.
   */
  grupos?: Grupo[];
  itens?: Item[];
}

export const ETIQUETA: Record<Tipo, { texto: string; cor: string; fundo: string }> = {
  novo: { texto: 'novo', cor: '#4cc9f0', fundo: 'rgba(76,201,240,0.12)' },
  melhor: { texto: 'melhor', cor: 'var(--accent)', fundo: 'rgba(255,209,102,0.12)' },
  corrigido: { texto: 'consertado', cor: '#4ade80', fundo: 'rgba(74,222,128,0.12)' },
};

const GRUPOS_4_4: Grupo[] = [
  {
    id: 'set',
    titulo: 'O set finalmente responde',
    resumo: 'O app planejava e nunca ficava sabendo o que aconteceu. Agora fecha o ciclo.',
    cor: '#4cc9f0',
    itens: [
      {
        tipo: 'novo',
        icone: <Clapperboard size={20} />,
        titulo: 'Marcar o que foi gravado, cena por cena',
        texto: 'Na diária, um toque na cena alterna Gravada → Parcial → Não gravada → Cortada. Sem confirmação, porque no set você está de pé, no escuro, com o rádio na outra mão. Quando não gravou, aparecem os motivos por atalho: chuva, luz, elenco, equipamento.',
      },
      {
        tipo: 'novo',
        icone: <ClipboardCheck size={20} />,
        titulo: 'Fechar a diária virou o relatório do dia',
        texto: 'Antes era só arquivar. Agora mostra o que saiu, quantas páginas de roteiro foram gravadas do previsto, e destaca as cenas que ninguém marcou — porque "ninguém marcou" não é "não gravou", e tratar como se fosse encheria a repescagem de cena que talvez tenha saído.',
      },
      {
        tipo: 'novo',
        icone: <RotateCcw size={20} />,
        titulo: 'O que ficou para trás volta na fila',
        texto: 'Cena que não saiu numa diária fechada aparece no topo do painel, com o motivo e de que dia veio — e um botão para reencaixar em outro dia. Sem isso, "cena 42 não gravada" morria dentro de uma diária que ninguém mais abre.',
      },
      {
        tipo: 'novo',
        icone: <GitCompare size={20} />,
        titulo: 'O stripboard alimenta a Ordem do Dia — até você publicar',
        texto: 'Enquanto a diária é rascunho, arrastar uma cena na linha do tempo atualiza a OD sozinho. Ao publicar, ela congela: mudança no stripboard vira aviso com "aplicar" ou "ignorar". A equipe já está com o PDF na mão — a OD não pode mudar por baixo dela.',
      },
      {
        tipo: 'corrigido',
        icone: <Clapperboard size={20} />,
        titulo: 'A shot list voltava vazia na OD impressa',
        texto: 'A caixinha existia, você marcava, e não saía nada: o bloco lia campos que o app parou de usar há duas versões. Agora imprime os planos de cada cena, em ordem — com 3, 3A e 3B no lugar certo, em vez do 10 antes do 2.',
      },
    ],
  },
  {
    id: 'contas',
    titulo: 'Contas, papéis e privacidade',
    resumo: 'Quem entra, o que pode fazer, e o que cada um enxerga da ficha dos outros.',
    cor: '#a29bfe',
    itens: [
      {
        tipo: 'novo',
        icone: <UserPlus size={20} />,
        titulo: 'Dá para criar conta sozinho',
        texto: 'As contas nasciam no painel do Supabase, uma por uma, na mão. Agora tem tela de cadastro e "esqueci a senha" — e quem recebe um convite sem ter conta cria a dele ali mesmo, sem ficar preso na porta.',
      },
      {
        tipo: 'novo',
        icone: <ShieldCheck size={20} />,
        titulo: 'Papel deixou de ser enfeite',
        texto: 'Dono, Administra, Equipe e Só leitura. Ao criar o link de convite você escolhe qual — e a regra vale no servidor, não só na tela: quem entrou como leitura não escreve nada, nem pelo console do navegador.',
      },
      {
        tipo: 'novo',
        icone: <Lock size={20} />,
        titulo: 'CPF, banco e ficha médica saem da vista de todo mundo',
        texto: 'Qualquer convidado enxergava o CPF, o remédio de uso contínuo e o cachê de toda a equipe — inclusive o figurante chamado para uma diária. Agora só a própria pessoa e quem administra veem, e o "copiar ficha inteira" respeita a mesma regra.',
      },
      {
        tipo: 'novo',
        icone: <IdCard size={20} />,
        titulo: 'A conta sabe quem você é na equipe',
        texto: 'Na ficha da equipe, cada pessoa ganhou um botão "convidar": o link já nasce sabendo quem ela é, e ela entra como "Maira, da Arte" sem escolher nada. Quem já estava dentro vê um aviso para se vincular — é isso que faz "Minhas Tasks" funcionar e você enxergar a própria ficha.',
      },
      {
        tipo: 'melhor',
        icone: <IdCard size={20} />,
        titulo: '"Equipe A" e "Equipe B" acabaram',
        texto: 'Era herança de quando o app tinha duas máquinas, e ainda roubava o nome do A/B que existe de verdade no set: a segunda unidade. Agora a ata diz "Maira mexeu em Financeiro", e a lista de acesso mostra nome e função.',
      },
      {
        tipo: 'novo',
        icone: <Trash2 size={20} />,
        titulo: 'Sair da conta limpa o aparelho',
        texto: 'A produção inteira fica no navegador para funcionar offline — e continuava lá depois de você sair, aberta para a próxima pessoa que usasse o computador. Agora sair apaga, mas só depois de subir o que faltava e avisar se algo se perderia.',
      },
    ],
  },
  {
    id: 'dinheiro',
    titulo: 'Dinheiro por área',
    resumo: 'A pergunta de toda reunião de produção passou a ter resposta.',
    cor: '#00b894',
    itens: [
      {
        tipo: 'novo',
        icone: <PieChart size={20} />,
        titulo: 'Cada gasto tem uma área, e cada área tem um quanto',
        texto: 'Ao lançar, você diz de qual área é o gasto — e ele já vem preenchido com o seu setor. No Financeiro, uma barra por área mostra quanto gastou do que tinha. É de QUEM é o gasto, não de quem pagou: a Arte pode comprar uma lente da Fotografia.',
      },
    ],
  },
  {
    id: 'consertos',
    titulo: 'Coisas que estavam quebradas em silêncio',
    resumo: 'Nada aqui dava erro. Só não fazia o que parecia fazer.',
    cor: '#f87171',
    itens: [
      {
        tipo: 'corrigido',
        icone: <CloudSun size={20} />,
        titulo: 'A previsão do tempo era de um set só, e não dizia qual',
        texto: 'Com dois sets no dia, o app buscava o clima de um deles e mostrava sem identificar. Numa diária que atravessa a cidade, isso é pior que não ter previsão. Agora mostra todos, com o nome de cada um — e junta num cartão só quando a previsão é a mesma.',
      },
      {
        tipo: 'corrigido',
        icone: <Trash2 size={20} />,
        titulo: 'Apagar uma produção não chegava na outra equipe',
        texto: 'Você mandava para a lixeira e ela continuava na lista da outra conta, para sempre. Eram dois problemas: o que você fazia na tela inicial nunca saía do aparelho, e destruir de vez não tinha como ser avisado do outro lado.',
      },
      {
        tipo: 'corrigido',
        icone: <Clock size={20} />,
        titulo: 'O "Andamento do Projeto" mostrava Diária 1 para sempre',
        texto: 'Ele lia um valor que nada no app jamais escreveu, e a barra ficava parada em zero. Agora mostra diárias fechadas e páginas de roteiro gravadas — dez diárias de meia página não são metade de um filme.',
      },
      {
        tipo: 'novo',
        icone: <GitMerge size={20} />,
        titulo: 'Aviso quando duas pessoas mexem na mesma coisa',
        texto: 'Quando a outra equipe altera algo que você estava editando, a versão dela vence — e antes isso acontecia em silêncio, com o seu texto mudando sozinho na tela. Agora aparece um aviso no canto dizendo o que mudou.',
      },
      {
        tipo: 'melhor',
        icone: <MapPin size={20} />,
        titulo: 'Contato da locação num lugar só',
        texto: 'Havia um campo solto de "segurança" e uma lista de contatos — dois lugares para a mesma coisa, e você preenchia um e procurava no outro. Agora é uma lista só, com atalhos para Segurança, Dono, Zelador e Síndico.',
      },
    ],
  },
];

/**
 * As versões, da mais nova para a mais antiga.
 *
 * ⚠️ VERSÃO NOVA ENTRA NO TOPO. A ordem daqui é a ordem da tela, e o modal
 * assume que o primeiro item é o atual.
 */
export const VERSOES: Versao[] = [
  {
    versao: '4.9.0',
    resumo: <>A diária deixou de ser só um plano: agora ela registra o dia acontecendo.</>,
    grupos: [
      {
        id: 'ciclo',
        titulo: 'Exportar virou a linha divisória',
        resumo: 'Antes o plano continuava editável depois de a equipe receber o PDF. Agora não.',
        cor: '#4cc9f0',
        itens: [
          {
            tipo: 'novo',
            icone: <Send size={20} />,
            titulo: 'Exportar a OD congela o plano',
            texto: 'No momento em que você exporta, todo mundo está com aquele documento na mão — e o app para de deixar mudar o plano por baixo. Precisou mudar? Volte a rascunho, edite e reexporte: a nova sai marcada v2, v3, para ninguém seguir o papel velho.',
          },
          {
            tipo: 'novo',
            icone: <Clock size={20} />,
            titulo: 'O dia começa sozinho na hora da chamada',
            texto: 'Sem botão de "iniciar o dia" — quem está no set às 6h com café na mão não vai lembrar de apertar nada. Chegou a hora da chamada, a tela vira registro. Saiu também o seletor "Montar / No set": o modo é do dia, não de quem está olhando.',
          },
        ],
      },
      {
        id: 'set',
        titulo: 'O relógio do set',
        resumo: 'A informação mais valiosa do dia, numa linha só.',
        cor: 'var(--accent)',
        itens: [
          {
            tipo: 'novo',
            icone: <Clock size={20} />,
            titulo: 'Relógio grande com o atraso do dia',
            texto: '"09:53 · estamos 45min de atraso · wrap agora às 16:15, planejado 15:30". Verde até 15min, âmbar até 45, vermelho acima — porque meia hora ainda se recupera e uma hora significa que alguma cena vai cair.',
          },
          {
            tipo: 'novo',
            icone: <ClipboardCheck size={20} />,
            titulo: 'Presença, jornada e ocorrências',
            texto: 'Chegou, atrasou ou faltou — e os horários de cada um: chegada, início, saída e volta da refeição, fim. Importa para pagamento e jornada. Ao lado entram figuração e stand-ins, rolos de câmera e som, e as ocorrências do dia com os minutos que cada uma custou.',
          },
          {
            tipo: 'novo',
            icone: <Film size={20} />,
            titulo: 'O que exatamente saiu de cada cena',
            texto: 'No ícone de prancheta da cena: oitavos filmados, setups e uma linha para o detalhe — "só a primeira metade da cena, do plano 3 em diante". É o que impede a cena parcial de virar um mistério na hora de reagendar.',
          },
          {
            tipo: 'novo',
            icone: <IdCard size={20} />,
            titulo: 'Cada anotação fica com o nome de quem fez',
            texto: 'A indústria assina o relatório no rodapé. Como cada pessoa entra com a conta dela, dá para fazer melhor: "Cena 4 — filmada · Carla, 09h53". A autoria é por anotação, não por documento.',
          },
        ],
      },
      {
        id: 'distribuir',
        titulo: 'A OD sai do app',
        resumo: 'Agenda e email, sem ninguém precisar autorizar nada.',
        cor: '#38bdf8',
        itens: [
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'Adicionar à agenda',
            texto: 'Baixa um arquivo que Google, Apple e Outlook abrem — com a diária inteira e cada marco (chamada, refeição, wrap) como compromisso separado. Cena não vira evento, senão a agenda de todo mundo vira uma parede. Tem também o link direto para o Google Agenda.',
          },
          {
            tipo: 'novo',
            icone: <Share2 size={20} />,
            titulo: 'Mandar a OD para a equipe, de graça',
            texto: 'COMPARTILHAR abre o WhatsApp, o Telegram ou o email do seu aparelho já com a OD escrita e o arquivo de agenda junto. COPIAR deixa a OD pronta para colar em qualquer lugar. ABRIR NO MEU EMAIL abre a sua caixa com a equipe já em cópia oculta e o assunto preenchido — ninguém recebe a lista de emails dos outros.',
          },
          {
            tipo: 'novo',
            icone: <Mail size={20} />,
            titulo: 'E, para quem tiver domínio, o envio em nome da produção',
            texto: 'Aí o email sai de od@suaprodutora.com.br em vez da conta pessoal de quem clicou. Isso exige um domínio próprio com os registros de DNS certos — sem eles o Gmail joga em spam, e não há como contornar: é regra de quem recebe, não limitação do app. Fica escondido num "ver mais" até você querer.',
          },
          {
            tipo: 'novo',
            icone: <MessageCircleQuestion size={20} />,
            titulo: 'Link da reunião',
            texto: 'Cole o link do Meet, Zoom ou Teams e ele entra no evento da agenda e no email. Colado à mão de propósito: criar a sala sozinho exigiria autorização de cada pessoa da equipe no Google.',
          },
        ],
      },
      {
        id: 'dpr2',
        titulo: 'O DPR ficou completo',
        resumo: 'Plano contra realidade, campo por campo.',
        cor: '#f87171',
        itens: [
          {
            tipo: 'melhor',
            icone: <ClipboardCheck size={20} />,
            titulo: 'O relatório do dia agora traz tudo',
            texto: 'Horário previsto contra real linha por linha, cenas filmadas com páginas e setups, as não filmadas com o motivo, a jornada de cada pessoa, figuração, rolos, ocorrências com os minutos perdidos, e quem preencheu cada coisa.',
          },
          {
            tipo: 'melhor',
            icone: <Lock size={20} />,
            titulo: 'Cena que não saiu agora pede a etiqueta E a frase',
            texto: 'Só a etiqueta ("chuva") diz a categoria e perde o caso. Agora o app pede também a explicação em uma linha — "adiada por problema de iluminação, será filmada amanhã de manhã" — e é ela que vai decidir o dia seguinte. Escrever agora, no wrap, é a única hora em que alguém ainda lembra.',
          },
          {
            tipo: 'melhor',
            icone: <PieChart size={20} />,
            titulo: 'O ritmo agora fala em páginas também',
            texto: 'O aviso de "faltam N diárias" passou a dizer quantas páginas saíram por dia, quando o roteiro está decupado. Cinco páginas por dia é a referência da indústria, e o número faz o AD reconhecer o ritmo do próprio filme.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.8.0',
    resumo: <>A tela da diária foi refeita em volta de uma coisa só: a linha do dia.</>,
    grupos: [
      {
        id: 'linha',
        titulo: 'O dia inteiro numa lista só',
        resumo: 'Cronograma e cenas eram duas caixas que não se falavam. No set elas sempre foram a mesma coisa.',
        cor: '#4cc9f0',
        itens: [
          {
            tipo: 'novo',
            icone: <Clock size={20} />,
            titulo: 'A Linha do Dia',
            texto: 'Cenas, refeições, deslocamentos e marcos numa lista só, cada um com o seu horário. Antes as cenas não tinham horário nenhum, e o cronograma era uma lista de texto à parte que ninguém conseguia manter em pé quando o dia mudava.',
          },
          {
            tipo: 'novo',
            icone: <Clock size={20} />,
            titulo: 'Os horários se calculam sozinhos',
            texto: 'Você define a chamada e o app encadeia o resto: cada item empurra o seguinte pelo tempo que consome, usando a estimativa que a cena já tem no stripboard. Toque num horário para travá-lo — dali em diante a conta recomeça dele, e o resto do dia se ajusta. Horário calculado é sugestão; travado é decisão.',
          },
          {
            tipo: 'novo',
            icone: <ClipboardCheck size={20} />,
            titulo: 'Dois modos: Montar e No set',
            texto: 'Montar é planejar na véspera. No set é marcar o dia acontecendo — a hora real de cada item e o estado de cada cena, com um toque. Quando algo atrasa, o app refaz a conta na hora: "o dia está 40min de atraso, wrap agora às 19:40, planejado 19:00".',
          },
          {
            tipo: 'melhor',
            icone: <GitMerge size={20} />,
            titulo: 'O dia chega pronto do Stripboard',
            texto: 'Mandar um dia do stripboard para a diária agora traz o bloco inteiro — cenas na ordem, almoço e company move com a duração de cada um. O cronograma se monta praticamente sozinho. Se você já tinha montado a linha à mão, ela não é tocada.',
          },
        ],
      },
      {
        id: 'tela',
        titulo: 'A tela parou de ser doze caixas iguais',
        resumo: 'Tudo tinha o mesmo tamanho e a mesma cor, e o olho não sabia onde pousar.',
        cor: 'var(--accent)',
        itens: [
          {
            tipo: 'melhor',
            icone: <MapPin size={20} />,
            titulo: 'Um cartão por locação, com tudo do lugar',
            texto: 'Endereço, previsão do tempo daquele set com nascer e pôr do sol, hospital mais próximo com telefone e rota, e os contatos do local — tudo junto. Eram três caixas separadas falando do mesmo lugar, e numa diária que atravessa a cidade dava para ler a previsão de um set e o hospital de outro sem perceber.',
          },
          {
            tipo: 'melhor',
            icone: <ListChecks size={20} />,
            titulo: 'O cronograma virou o protagonista',
            texto: 'A tela agora tem duas colunas: a linha do dia grande de um lado, os cartões de apoio do outro. Transporte, checklist, presença e anexos ficam fechados no rodapé, com o número do lado — "2 comboios", "3/8" — para você saber se vale abrir.',
          },
          {
            tipo: 'melhor',
            icone: <PieChart size={20} />,
            titulo: 'Cor com significado',
            texto: 'Cada área do app tem a sua cor: amarelo é set, verde é dinheiro, azul é logística, ciano é equipe, roxo é criativo. Cor de área diz onde você está; cor de status (vermelho, verde, âmbar) diz como as coisas estão. Nunca as duas no mesmo lugar.',
          },
        ],
      },
      {
        id: 'frentes',
        titulo: 'Duas equipes no mesmo dia',
        resumo: 'O conceito de "Unidade A/B" acabou. Quem divide o dia é a escalação.',
        cor: '#2dd4bf',
        itens: [
          {
            tipo: 'novo',
            icone: <GitCompare size={20} />,
            titulo: 'Escalou dois grupos, o dia se divide',
            texto: 'Não existe botão de dividir diária. Escale dois grupos e as abas aparecem sozinhas, cada uma com a sua locação, o seu cronograma e a sua equipe. Tirou um grupo, volta a ser um dia só. Cena que ainda não está em nenhuma frente aparece num aviso, para não sumir em silêncio.',
          },
          {
            tipo: 'melhor',
            icone: <Trash2 size={20} />,
            titulo: 'A Unidade A/B saiu do app',
            texto: 'A caixa "Unidade Única (A)" ocupava lugar em quase toda diária para avisar que nada de especial estava acontecendo, e o seletor A/B de cada tira do stripboard dizia a mesma coisa num segundo lugar. Eram dois conceitos fazendo o trabalho de um, e a produção escalava a equipe duas vezes. O que você já tinha marcado continua guardado.',
          },
        ],
      },
      {
        id: 'dpr',
        titulo: 'O relatório do dia ficou sério',
        resumo: 'O que o dia deixou de fazer é a metade que decide o dia seguinte.',
        cor: '#f87171',
        itens: [
          {
            tipo: 'novo',
            icone: <ClipboardCheck size={20} />,
            titulo: 'O DPR sai em PDF de verdade',
            texto: 'Horário planejado contra horário real linha por linha, cenas filmadas, cenas agendadas e não filmadas com o motivo de cada uma, quem não confirmou presença e a prestação de contas do dia. É o Relatório Diário de Produção que a indústria pede.',
          },
          {
            tipo: 'novo',
            icone: <Lock size={20} />,
            titulo: 'O motivo virou obrigatório',
            texto: 'Não dá mais para fechar a diária deixando uma cena sem explicação. "Cena 12 não gravada" não serve para decidir nada — chuva reagenda para o mesmo set, elenco reagenda para a agenda da pessoa. É o único campo do app que tranca um botão, e é de propósito.',
          },
          {
            tipo: 'novo',
            icone: <RotateCcw size={20} />,
            titulo: 'A cena volta ao stripboard marcada PENDENTE',
            texto: 'Ela mantém a cor de sempre (a informação de INT/EXT e dia/noite não se perde) e ganha contorno vermelho com a etiqueta e o número da diária de onde caiu. Uma cena que caiu ontem e uma que caiu há três semanas pedem decisões diferentes.',
          },
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'O app avisa quando o filme não cabe mais',
            texto: '"No ritmo atual, faltam 2 diárias para o filme fechar." Ele compara as cenas que saíram por dia com o que ainda falta e com os dias que sobraram. Aparece no painel e na tela da diária, e some sozinho quando não há atraso — um aviso que aparece sempre é um aviso que ninguém lê.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.7.2',
    itens: [
      {
        tipo: 'corrigido',
        icone: <RefreshCw size={20} />,
        titulo: 'A tela de atualização podia travar para sempre',
        texto: 'Ela esperava um sinal do navegador que às vezes não vem — e aí ficava parada, com o app inteiro atrás dela. Quem caísse nisso não tinha nem como relatar o problema. Agora aparece um "Recarregar agora" em 3 segundos, e se nada acontecer o app se recarrega sozinho em 8.',
      },
    ],
  },
  {
    versao: '4.7.1',
    resumo: <>Agora dá para saber que o app mudou sem precisar adivinhar.</>,
    itens: [
      {
        tipo: 'novo',
        icone: <Bell size={20} />,
        titulo: 'O sino avisa quando o app é atualizado',
        texto: 'Quem entra direto numa diária pelo link, ou passa o dia no Financeiro, nunca via a tela de novidades — e continuava sem saber que a coisa de que reclamou tinha sido consertada. O aviso chega no sino de cada um, quando o aparelho da pessoa atualiza.',
      },
      {
        tipo: 'novo',
        icone: <RefreshCw size={20} />,
        titulo: 'Atualizar deixou de parecer travamento',
        texto: 'Clicar em Atualizar recarrega a tela, e sem nada no meio o que se via era o app sumir e voltar. Agora tem uma tela dizendo que a troca está acontecendo — com o lembrete de que os seus dados continuam salvos.',
      },
      {
        tipo: 'novo',
        icone: <LogIn size={20} />,
        titulo: 'A versão aparece na tela de entrada',
        texto: '"Qual versão você está?" é a primeira pergunta de todo suporte, e a resposta exigia entrar no app. Quem está travado no login não conseguia — e é justamente quem mais precisa responder.',
      },
      {
        tipo: 'melhor',
        icone: <Bug size={20} />,
        titulo: 'Relatar problema ficou mais bonito e mais claro',
        texto: 'O tipo vem primeiro e muda o rótulo do campo — quem marca "dúvida" pergunta, quem marca "bug" conta o que aconteceu. E o "vai junto" agora lista em etiquetas legíveis o que será enviado, em vez de uma frase corrida.',
      },
      {
        tipo: 'corrigido',
        icone: <MapPin size={20} />,
        titulo: 'As diárias apareciam embaixo da aba de Eventos',
        texto: 'A lista não sumia ao trocar de aba. E a tela virou "Diárias & Eventos", que é o que ela é.',
      },
      {
        tipo: 'melhor',
        icone: <Bug size={20} />,
        titulo: 'O relato de problema agora diz quem relatou',
        texto: 'Sem isso, "não consegui salvar" virava um beco: não havia como voltar e perguntar o que a pessoa estava fazendo.',
      },
    ],
  },
  {
    versao: '4.7.0',
    resumo: <>A produção tem mais coisa marcada além das diárias — e agora o app sabe disso.</>,
    itens: [
      {
        tipo: 'novo',
        icone: <MapPin size={20} />,
        titulo: 'Eventos: visita de locação, teste, reunião',
        texto: 'Nova aba dentro da Ordem do Dia. Cada evento tem data, hora, locação e QUEM VAI — você marca as pessoas da equipe, e a pergunta "fui chamado?" deixa de depender de rolar o grupo do WhatsApp. Escolhendo a locação, o endereço dela aparece dentro do evento: na véspera, o que se quer saber é para onde ir.',
      },
      {
        tipo: 'novo',
        icone: <CalendarDays size={20} />,
        titulo: 'O evento aparece no calendário e na semana à frente',
        texto: 'Junto das diárias e dos prazos, com a cor e o ícone do tipo. É ali que ele importa: visita marcada para quinta só serve se aparecer antes de quinta.',
      },
      {
        tipo: 'melhor',
        icone: <RefreshCw size={20} />,
        titulo: 'O aviso de versão nova ficou legível na tela estreita',
        texto: 'O texto e os dois botões disputavam a mesma linha, e o título quebrava no meio. Agora o aviso quebra em duas linhas quando precisa.',
      },
    ],
  },
  {
    versao: '4.6.1',
    resumo: <>As colunas voltaram — foi eu que exagerei na versão passada.</>,
    itens: [
      {
        tipo: 'melhor',
        icone: <ListChecks size={20} />,
        titulo: 'O quadro de colunas está de volta',
        texto: 'O pedido era tirar a palavra "Kanban" do título, e na 4.6.0 eu troquei o formato inteiro por uma lista. O quadro era o certo. Só a palavra saiu: ela nomeia o formato para quem já conhece o formato, e não diz nada para o resto.',
      },
      {
        tipo: 'melhor',
        icone: <Sparkles size={20} />,
        titulo: 'E voltou melhor do que era',
        texto: 'Cada coluna mostra quantas tarefas tem. A coluna que vai receber o cartão se destaca enquanto você arrasta — antes o alvo era um chute até soltar. O cartão ganhou uma alça, porque sem sinal visível a única forma de descobrir que dava para arrastar era tentar por acaso. E tarefa bloqueada não arrasta, em vez de arrastar e ser recusada no fim.',
      },
    ],
  },
  {
    versao: '4.6.0',
    resumo: <>As tarefas deixaram de ser um quadro de colunas e viraram uma lista.</>,
    itens: [
      {
        tipo: 'melhor',
        icone: <ListChecks size={20} />,
        titulo: 'Tasks virou uma lista, sem o quadro de colunas',
        texto: 'Agrupada por A fazer, Fazendo e Feito. (Durou uma versão: as colunas voltaram na 4.6.1.)',
      },
      {
        tipo: 'corrigido',
        icone: <ListChecks size={20} />,
        titulo: 'As tarefas vazavam para fora da coluna',
        texto: 'Passando da altura da tela, os cartões apareciam soltos embaixo da moldura, sem barra de rolagem que os alcançasse. A altura das colunas era travada na da tela; agora cada uma cresce com o que tem dentro e quem rola é a página.',
      },
      {
        tipo: 'corrigido',
        icone: <ListChecks size={20} />,
        titulo: 'A subtarefa criada não aparecia, e o nome dela não mudava',
        texto: 'A janela da tarefa trabalhava com uma cópia congelada do momento em que abriu: o item novo era gravado e não aparecia ali dentro, e o nome voltava ao valor antigo a cada tecla. Agora ela lê a tarefa de verdade. O item novo já nasce com o cursor dentro, e o Enter cria o próximo.',
      },
      {
        tipo: 'melhor',
        icone: <Sparkles size={20} />,
        titulo: 'A janela da tarefa ficou organizada',
        texto: 'Cada campo com o seu próprio rótulo, checklist com barra de progresso, dependências mostrando o que já foi concluído, e o rodapé dizendo Pronto em vez de Salvar — porque tudo já é gravado a cada toque.',
      },
      {
        tipo: 'melhor',
        icone: <MessageCircleQuestion size={20} />,
        titulo: 'A ajuda passou a saber como se cria uma cena',
        texto: 'Perguntaram e ela respondeu que não sabia: o manual falava do roteiro em PDF e nunca do caminho simples. Agora explica o botão de nova cena na Decupagem, e por que a Ordem do Dia só oferece cenas que já existem.',
      },
    ],
  },
  {
    versao: '4.5.3',
    resumo: <>Tudo no formato brasileiro — dinheiro e data.</>,
    itens: [
      {
        tipo: 'corrigido',
        icone: <HelpCircle size={20} />,
        titulo: 'O botão de ajuda ficava em cima do menu "Mais"',
        texto: 'No celular e na janela estreita ele caía por cima da barra de baixo, tapando o último botão. Agora ele pousa acima do que estiver ali — a barra no celular, o botão de criar na tela inicial, ou o próprio canto quando não há nada.',
      },
      {
        tipo: 'corrigido',
        icone: <DollarSign size={20} />,
        titulo: 'O dinheiro estava em notação inglesa no app inteiro',
        texto: 'Eram 51 lugares escrevendo "R$ 1234.56" — ponto no lugar da vírgula e sem separador de milhar. E o campo de digitar despesa já usava "R$ 1.234,56": dava para teclar certo e ver errado na linha seguinte. Agora é um formato só, do painel ao CSV exportado.',
      },
      {
        tipo: 'corrigido',
        icone: <Clock size={20} />,
        titulo: 'A data da despesa aparecia um dia antes',
        texto: 'No extrato, uma despesa lançada no dia 28 aparecia como 27 — e uma lançada no dia 1º pulava para o mês anterior. Era o fuso: a data sem hora era lida como se fosse de Londres, e o Brasil está três horas atrás.',
      },
      {
        tipo: 'corrigido',
        icone: <Clock size={20} />,
        titulo: 'A data de ocorrência saía sem formatação',
        texto: 'Na lista de despesas ela aparecia como 2026-08-28, do jeito que o computador guarda, em vez de 28/08/26. Só acontecia na despesa que tinha data de ocorrência preenchida.',
      },
    ],
  },
  {
    versao: '4.5.1',
    itens: [
      {
        tipo: 'corrigido',
        icone: <DollarSign size={20} />,
        titulo: 'O dinheiro estava escrito em notação inglesa',
        texto: 'A tela mostrava "R$ 1234.56" — ponto no lugar da vírgula e sem separador de milhar. Você digitava a despesa como "R$ 1.234,56" e via outra coisa na linha seguinte. Nos números de resumo isso acabou.',
      },
      {
        tipo: 'melhor',
        icone: <DollarSign size={20} />,
        titulo: 'Saldo e total gasto sobem até o valor',
        texto: 'Número que aparece pronto é lido como rótulo; número que sobe é lido como resultado de uma conta. E ele para de tremer enquanto conta — os algarismos agora têm largura fixa. Só nos números de resumo: em lista de despesa, valor em movimento atrapalha quem está conferindo.',
      },
      {
        tipo: 'corrigido',
        icone: <DollarSign size={20} />,
        titulo: 'Um aporte novo não mexia no saldo do painel',
        texto: 'O contador do painel da produção só se atualizava quando alguma despesa mudava. Lançar dinheiro e não ver o saldo mexer fazia parecer que o lançamento não pegou.',
      },
      {
        tipo: 'melhor',
        icone: <Clapperboard size={20} />,
        titulo: 'Marcar uma cena como gravada solta uma faísca no dedo',
        texto: 'A confirmação acontece onde você tocou, não num aviso que sobe do rodapé. Só em "gravada": passar por parcial ou cortada é atravessar o ciclo, não confirmar nada.',
      },
      {
        tipo: 'melhor',
        icone: <Sparkles size={20} />,
        titulo: 'Detalhes de acabamento',
        texto: 'Os cards da tela inicial ganharam um brilho que segue o cursor, e os rótulos da IA um brilho que atravessa o texto — o único lugar do app onde brilho quer dizer alguma coisa: aquilo foi uma máquina que escreveu.',
      },
    ],
  },
  {
    versao: '4.5.0',
    resumo: (
      <>
        Nada mudou de lugar. O que mudou é como o app <strong>responde</strong> —
        e dois botões que estavam quebrados sem ninguém ter reclamado.
      </>
    ),
    itens: [
      {
        tipo: 'melhor',
        icone: <Sparkles size={20} />,
        titulo: 'O app responde no dedo, não quando você solta',
        texto: 'Havia um silêncio de uns 100ms entre encostar e a tela reagir — o bastante para achar que não funcionou e apertar de novo. Agora o botão afunda na hora, com física de mola, e arrastar o dedo para fora ainda cancela. Os cards também: eles tinham a mola amassada por uma regra de CSS antiga e ninguém tinha percebido.',
      },
      {
        tipo: 'corrigido',
        icone: <MapPin size={20} />,
        titulo: 'O "Cancelar" transbordava do card, em várias telas',
        texto: 'No formulário de departamento ele saía por fora da borda, com o texto cortado. E o botão secundário de outras seis telas estava cru — cinza, com a fonte do navegador, de altura diferente do vizinho — porque o estilo dele nunca existiu. Agora o par tem largura honesta e altura de toque de verdade.',
      },
      {
        tipo: 'melhor',
        icone: <PieChart size={20} />,
        titulo: 'A cor do departamento ficou legível',
        texto: 'As amostras viraram círculos, a escolhida ganhou um ✓ dentro dela, e o ✓ escolhe entre preto e branco pelo contraste real da cor. Sobre o verde-água e os amarelos da paleta, um ✓ branco praticamente sumia.',
      },
      {
        tipo: 'melhor',
        icone: <ClipboardCheck size={20} />,
        titulo: 'Os painéis nascem de onde você tocou',
        texto: 'A ajuda e as novidades cresciam do centro da tela, sem ligação com o botão apertado. Agora crescem dali. Confirmação de apagar continua vindo do centro de propósito — ali a interrupção é o ponto.',
      },
      {
        tipo: 'corrigido',
        icone: <Clock size={20} />,
        titulo: 'Relatar um problema não prende mais por dois segundos',
        texto: 'Depois de enviar, o modal fechava sozinho — e só sozinho. Quem já tinha lido "Enviei!" ficava olhando uma tela que já havia terminado.',
      },
      {
        tipo: 'melhor',
        icone: <CloudSun size={20} />,
        titulo: 'A barra de baixo virou vidro de verdade',
        texto: 'Ela se chamava "glass" e era uma faixa opaca: o conteúdo terminava nela em vez de passar por baixo. Quem pediu menos transparência no sistema continua vendo ela sólida.',
      },
    ],
  },
  {
    versao: '4.4.2',
    itens: [
      {
        tipo: 'melhor',
        icone: <Undo2 size={20} />,
        titulo: 'Dá para tirar a marcação de uma cena',
        texto: 'Marcou a cena errada e não havia volta: o toque girava entre Gravada, Parcial, Não gravada e Cortada, e nenhum desses quatro significa "eu não sei". Agora, depois de Cortada, mais um toque limpa e a cena volta a ficar sem marcação — que não é a mesma coisa que "não gravada", e o relatório do dia trata as duas de forma diferente.',
      },
    ],
  },
  {
    versao: '4.4.1',
    itens: [
      {
        tipo: 'corrigido',
        icone: <RefreshCw size={20} />,
        titulo: 'Publicar uma versão nova quebrava a tela de quem estava com o app aberto',
        texto: 'O app trocava de versão por baixo de quem já estava usando: as telas que ele carrega sob demanda sumiam no meio do caminho, e clicar numa aba não abria nada. Parecia problema de internet e não era. Agora o app avisa que tem versão nova e espera você aceitar — e passa a atualizar num toque, sem aquele Ctrl+Shift+F5.',
      },
      {
        tipo: 'corrigido',
        icone: <Sparkles size={20} />,
        titulo: 'A tela de novidades engolia o fim de cada grupo',
        texto: 'Os cartões se espremiam para caber na altura da janela em vez de virar rolagem, e o que passava disso era cortado — sem barra para descer até ele. Você lia metade de um grupo e o resto simplesmente não existia.',
      },
      {
        tipo: 'corrigido',
        icone: <MessageCircleQuestion size={20} />,
        titulo: 'A ajuda dizia que a IA estava fora do ar quando ela só estava devagar',
        texto: 'A pergunta esperava trinta segundos e desistia — só que a resposta costuma levar isso, e o app anunciava falha de rede. Agora espera o suficiente, o servidor desiste antes de você, e quando dá errado a tela diz o que fazer em vez de mostrar código de erro.',
      },
      {
        tipo: 'melhor',
        icone: <Clock size={20} />,
        titulo: 'As frases do PENSE NISSO ficaram raras',
        texto: 'Apareciam a cada poucos minutos e viravam notificação — a pessoa fechava no automático sem ler. Agora são algumas por jornada. Sugestão de quem estava testando, e estava certa.',
      },
      {
        tipo: 'corrigido',
        icone: <HelpCircle size={20} />,
        titulo: 'O botão de ajuda flutuava no meio do nada',
        texto: 'Dentro da produção ele ficava parado na altura de quem tem um botão embaixo, com um vão vazio embaixo. Agora ancora no canto quando o canto está livre.',
      },
    ],
  },
  {
    versao: '4.4.0',
    resumo: (
      <>
        A v4.3 fez duas equipes trabalharem na mesma produção. A v4.4 fecha o
        ciclo do set: o app deixa de só <strong>planejar</strong> e passa a
        saber <strong>o que de fato aconteceu</strong> — e a usar isso.
      </>
    ),
    grupos: GRUPOS_4_4,
  },
];

/** Todos os itens de uma versão, agrupada ou não. */
export function itensDa(v: Versao): Item[] {
  return v.grupos ? v.grupos.flatMap(g => g.itens) : (v.itens ?? []);
}
