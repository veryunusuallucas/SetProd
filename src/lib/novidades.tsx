import {
  Sparkles, HelpCircle,
  UserPlus, ShieldCheck, Lock, IdCard, Clapperboard, ClipboardCheck,
  RotateCcw, GitCompare, PieChart, CloudSun, Trash2, GitMerge, MapPin, Clock,
  RefreshCw, MessageCircleQuestion, Undo2, DollarSign, ListChecks,
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
