import {
  Sparkles, HelpCircle,
  UserPlus, Users, ShieldCheck, Lock, IdCard, Clapperboard, ClipboardCheck, Scissors,
  RotateCcw, GitCompare, PieChart, CloudSun, Trash2, GitMerge, MapPin, Clock,
  RefreshCw, MessageCircleQuestion, Undo2, DollarSign, ListChecks, CalendarDays,
  Bell, LogIn, Bug, Send, Mail, Film, Share2, AlertTriangle, CheckSquare, CalendarClock, CalendarPlus,
  FileText, FolderOpen, PartyPopper, Copy, Columns3, Home, Timer, Pencil, Settings,
  Rows3, MousePointerClick, Smartphone, Tablet, LayoutGrid,
  Camera, HardDrive, FileInput, Target, Image, Save,
  Archive, Crown, BadgeCheck, HeartPulse,
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
 * A REGRA COMBINADA COM O LUCAS (mudou na v4.8)
 * Uma entrada por PUBLICAÇÃO, e não por mudança. Enquanto o trabalho está aqui
 * no computador, cada coisa pronta vai sendo anotada em `.md/novidades-pendentes.md`.
 * Na hora do push, aquilo tudo vira UMA versão aqui, e o arquivo de pendências
 * é esvaziado.
 *
 * POR QUE ASSIM
 * Antes era uma versão por mudança, e o app publicado ficou na v4.7 enquanto
 * aqui já corria a 4.13. Quem usa ia abrir as Novidades e ver seis versões de
 * uma vez, várias delas correções de coisas que nunca chegaram a sair — a lista
 * fica comprida e confusa justamente por ser detalhada demais. Versão é o que a
 * pessoa recebe, não o que a gente fez.
 *
 * Uma consequência prática: correção de bug introduzido e resolvido antes de
 * publicar NÃO entra. Para quem está lendo, aquele bug nunca existiu.
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
    versao: '4.13.0',
    resumo: <>Um menu novo em cada aparelho, e a produção com regras claras de quem mexe em quê — com os dados sensíveis da equipe protegidos de verdade.</>,
    grupos: [
      {
        id: 'menu',
        titulo: 'Um menu para cada aparelho',
        resumo: 'O celular ganhou uma barra que é sua; o computador, um trilho que não atrapalha.',
        cor: '#a78bfa',
        itens: [
          {
            tipo: 'novo',
            icone: <Smartphone size={20} />,
            titulo: 'A barra de baixo do celular é sua',
            texto: 'A barra virou uma dock flutuante, com um marcador dourado que desliza até o módulo aberto. Os três primeiros lugares você escolhe: segure um item, toque no lápis do "Mais" ou vá em Config → Barra de baixo. O quarto acompanha você: abriu Eventos, ele vira Eventos e continua lá, a um toque. A escolha vale para todas as produções do aparelho.',
          },
          {
            tipo: 'melhor',
            icone: <LayoutGrid size={20} />,
            titulo: 'O "Mais" virou uma folha',
            texto: 'Em vez de abrir a barra lateral por cima da tela, sobe uma folha com os módulos em ícones grandes, cada um na cor da sua área. Fecha arrastando para baixo, tocando fora ou no Esc. No fim ficam Configurações, Busca e Sair, e os quadros "Como funciona" e "Relatar problema" — que antes moravam no botão do canto.',
          },
          {
            tipo: 'melhor',
            icone: <Tablet size={20} />,
            titulo: 'Tablet e computador: um trilho',
            texto: 'No tablet, a barra lateral começa só com os ícones e abre no botão, empurrando o conteúdo. No computador, começa aberta; soltando o alfinete, encolhe e abre quando o mouse para sobre ela — clicar num ícone nunca abre, e ela não pisca. O iPad de pé usa a barra de baixo do celular; deitado, a lateral completa.',
          },
          {
            tipo: 'melhor',
            icone: <Sparkles size={20} />,
            titulo: 'A porta do app mudou de luz',
            texto: 'O fundo roxo de ondas deu lugar a um contraluz: um feixe frio de cima, poeira atravessando devagar e grão de filme — em qualquer aparelho, parado para quem pede menos movimento. O nome SETPROD se abre uma vez na chegada e depois fica quieto; a busca e os cards ficaram de vidro, e sobrou um "?" só.',
          },
          {
            tipo: 'novo',
            icone: <Clapperboard size={20} />,
            titulo: 'O segredo do título tem final novo',
            texto: 'No terceiro cutucão, uma claquete fecha em cima da tela, bate e marca "SetProd · cena 1 · take 3" — com o seu nome no lugar do diretor.',
          },
        ],
      },
      {
        id: 'acesso',
        titulo: 'Cada um mexe no que é seu',
        resumo: 'Quem pode o quê, dito na tela — e valendo também no servidor.',
        cor: '#ffd700',
        itens: [
          {
            tipo: 'novo',
            icone: <ShieldCheck size={20} />,
            titulo: 'Departamento cuida do seu',
            texto: 'Quem é da equipe edita as tasks e as fichas do próprio departamento, e a própria ficha. Diárias, despesas e configuração da produção são de quem administra. Onde você não pode, o botão some e fica uma linha dizendo quem pode.',
          },
          {
            tipo: 'novo',
            icone: <Lock size={20} />,
            titulo: 'CPF, conta e ficha médica protegidos',
            texto: 'Esses dados agora só chegam ao aparelho da própria pessoa e de quem administra a produção — antes, iam para o celular de toda a equipe.',
          },
          {
            tipo: 'novo',
            icone: <HeartPulse size={20} />,
            titulo: 'Ficha médica de emergência no set',
            texto: 'No dia de filmagem, quem está escalado abre a ficha médica de emergência de quem está com ele no set — tipo sanguíneo, alergias, contato. Fica registrado na ata quem abriu.',
          },
          {
            tipo: 'melhor',
            icone: <ClipboardCheck size={20} />,
            titulo: 'A ata não se apaga',
            texto: 'Nem o dono da produção apaga o registro do que aconteceu. Convites, trocas de papel e remoções de acesso agora entram nela.',
          },
          {
            tipo: 'novo',
            icone: <Crown size={20} />,
            titulo: 'Passar a posse e dizer quem é quem',
            texto: 'O dono pode passar a produção para outra pessoa e ligar cada membro à ficha certa. Abrir um convite logado com outro e-mail avisa antes de aceitar.',
          },
          {
            tipo: 'novo',
            icone: <BadgeCheck size={20} />,
            titulo: 'Seu crachá no painel',
            texto: 'O painel mostra você, sua função e seu departamento, na cor da sua área.',
          },
        ],
      },
      {
        id: 'confianca',
        titulo: 'Contas que fecham',
        resumo: 'Dinheiro no centavo, escala sem atropelo, histórico sem buraco.',
        cor: '#4ade80',
        itens: [
          {
            tipo: 'corrigido',
            icone: <DollarSign size={20} />,
            titulo: 'O rateio fecha no centavo',
            texto: 'R$ 100 entre 7 pessoas dá R$ 100,00, e não R$ 100,03 — inclusive nas despesas que já estavam lançadas.',
          },
          {
            tipo: 'corrigido',
            icone: <GitMerge size={20} />,
            titulo: 'Dois escalando ao mesmo tempo',
            texto: 'Duas pessoas mexendo na escala da mesma diária, em aparelhos diferentes, não apagam mais o trabalho uma da outra: quem cada uma escalou fica.',
          },
          {
            tipo: 'corrigido',
            icone: <RefreshCw size={20} />,
            titulo: 'A sincronização não trava',
            texto: 'Quando o servidor recusa uma alteração, ela volta como estava, aparece "Não deu para alterar" com o motivo, e o resto continua subindo.',
          },
          {
            tipo: 'melhor',
            icone: <Archive size={20} />,
            titulo: 'Arquivar em vez de apagar',
            texto: 'Tirar da equipe alguém que aparece em despesas, diárias ou créditos arquiva a pessoa: ela sai das listas e o nome continua no histórico. Dá para restaurar em Pessoas → Arquivados. Departamento em uso diz onde aparece antes de ser apagado.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.12.0',
    resumo: <>O boletim de câmera entrou no app: cada take, cada cartão e cada HD da diária, no celular do set ou no notebook do DIT — e sem internet.</>,
    grupos: [
      {
        id: 'logagem',
        titulo: 'Logagem: o boletim de câmera',
        resumo: 'A claquete, os takes e o dia acontecendo, dentro da diária que já existe.',
        cor: '#a78bfa',
        itens: [
          {
            tipo: 'novo',
            icone: <Clapperboard size={20} />,
            titulo: 'Registrar take em um toque',
            texto: 'Cena, plano e take em números grandes, o nome do arquivo embaixo e os quatro botões colados neles: OK, NG, HERO e REC invertido. O plano anda sozinho no alfabeto de claquete (sem I, O, Q, S e Z), o arquivo é numerado em sequência, e a mesma claquete duas vezes vira um aviso com saída. No computador, Espaço registra OK e Shift+Espaço, NG.',
          },
          {
            tipo: 'novo',
            icone: <Target size={20} />,
            titulo: 'Três visões, num interruptor no alto',
            texto: 'Foco para o celular no set, Detalhada para o notebook na mesa e Acompanhamento para quem não loga e só quer saber o que está rolando. A troca é um interruptor de dois ícones ao lado da diária, e o aparelho lembra a escolha.',
          },
          {
            tipo: 'novo',
            icone: <CalendarClock size={20} />,
            titulo: 'O dia da Ordem do Dia, no alto da tela',
            texto: 'A hora, o que está rodando, e o que vem depois — cena, refeição, ensaio — já com o atraso real do dia somado. Do lado, o próximo plano da decupagem: um toque põe cena, plano, lente e descrição na claquete. Depois de um take OK ou HERO, esse botão acende sozinho.',
          },
          {
            tipo: 'novo',
            icone: <Camera size={20} />,
            titulo: 'Kits de câmera e de lente',
            texto: 'Cada câmera com a letra, o cartão e o clipe dela; cada lente com a faixa que alcança, em f-stop ou em T-stop, do jeito que está escrito no anel. A abertura da claquete nunca passa do que a lente faz, e dá para copiar o kit de outra produção. A câmera e a lente se editam no lápis da caixinha.',
          },
          {
            tipo: 'novo',
            icone: <Image size={20} />,
            titulo: 'Foto de referência e anotações rápidas',
            texto: 'Uma foto por take, que encolhe antes de ser guardada para não disputar a internet do set, e pílulas de frase pronta embaixo da observação — "Vazou boom", "MOS", "Foco cravado" —, editáveis na Config. Take já registrado se corrige, e a correção pode seguir para os próximos takes da mesma câmera.',
          },
        ],
      },
      {
        id: 'cartoes',
        titulo: 'Cartão nenhum se formata no escuro',
        resumo: 'O backup, o ingest e os relatórios que o set precisa entregar.',
        cor: '#ffd700',
        itens: [
          {
            tipo: 'novo',
            icone: <HardDrive size={20} />,
            titulo: 'Safe to Format, com prova',
            texto: 'Cada cartão vira uma lista de passos: copiar para cada HD e anexar o comprovante de verificação daquele cartão. O verde só aparece com cópia em todos os HDs e comprovante anexado, e o app diz exatamente o que falta. Trocar um cartão com take e sem backup pergunta antes.',
          },
          {
            tipo: 'novo',
            icone: <FileInput size={20} />,
            titulo: 'Ingest: ler o cartão no computador',
            texto: 'Escolha a pasta do cartão e o app lê os XML da Sony, confere se cada vídeo abre, aproveita o manifesto do DaVinci para quem não tem XML, separa os clipes de outro dia e importa o que ninguém logou. Nada sai do computador: o cartão é lido no lugar.',
          },
          {
            tipo: 'novo',
            icone: <FileText size={20} />,
            titulo: 'Camera report em PDF, e a planilha',
            texto: 'O relatório da diária com as colunas do boletim, a faixa de formato a cada mudança, a foto de referência e quem logou; o relatório de integridade com cartão × HD × comprovante; e o CSV com as 43 colunas para abrir no Excel. Tudo fica guardado em Documentos, na pasta Camera Reports.',
          },
          {
            tipo: 'novo',
            icone: <Save size={20} />,
            titulo: 'Cópia de segurança em um arquivo',
            texto: 'A diária inteira num JSON para guardar no HD, com as fotos e os comprovantes dentro. Trazer de volta aceita esse arquivo e também o backup do antigo Lumavi, mostra antes o que vai entrar e só acrescenta o que falta.',
          },
          {
            tipo: 'melhor',
            icone: <Smartphone size={20} />,
            titulo: 'Feita para o set sem sinal',
            texto: 'Tudo funciona offline e sobe quando o sinal volta — os takes primeiro, as fotos depois. O app pede ao navegador para não apagar os dados do aparelho, e a Config mostra se está guardado, o que falta subir e se há internet. Quem registra é a Fotografia, quem administra, e quem o dono liberar; o resto acompanha.',
          },
        ],
      },
      {
        id: 'fora',
        titulo: 'Fora da Logagem',
        resumo: 'A tela inicial e o menu.',
        cor: '#4ade80',
        itens: [
          {
            tipo: 'melhor',
            icone: <Home size={20} />,
            titulo: 'A tela inicial não mostra mais o saldo do filme',
            texto: 'O cartão de cada produção agora diz em que fase ela está — pré-produção, filmando hoje, em filmagem, encerrada —, qual é a próxima diária e quanto falta para ela, quantas diárias já rodaram e qual é o seu papel na produção. O dinheiro continua no Financeiro, de quem administra.',
          },
          {
            tipo: 'melhor',
            icone: <LayoutGrid size={20} />,
            titulo: 'Equipamentos saiu do menu',
            texto: 'Era um item que só dizia "Em breve". Volta quando for a vez dele. O resumo de equipamento do SetGear dentro da diária continua onde estava.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.11.0',
    resumo: <>A primeira leva de melhorias de tela: o calendário se lê no celular, e o app inteiro para de escapar pelas bordas.</>,
    grupos: [
      {
        id: 'calendario',
        titulo: 'Um calendário que se lê',
        resumo: 'Três jeitos de ver, o dia inteiro num toque, e a cor dizendo o que importa.',
        cor: '#4ade80',
        itens: [
          {
            tipo: 'novo',
            icone: <Rows3 size={20} />,
            titulo: 'Dias, Semana e Mês',
            texto: 'O calendário do Dashboard ganhou três jeitos de ver. Em Dias aparecem só os dias que têm alguma coisa, um cartão por dia com o texto inteiro, e uma faixa com o mês em miniatura em cima: tocar num dia leva até ele. Semana mostra os sete dias com tudo escrito. Mês é a grade de sempre. O app lembra a escolha, e no celular abre em Dias.',
          },
          {
            tipo: 'novo',
            icone: <MousePointerClick size={20} />,
            titulo: 'Toque no dia para ver o que tem nele',
            texto: 'Como no Google Agenda: tocar num dia abre um cartão com a diária (e o botão de abrir), os eventos com hora e observação, e os prazos de tasks. No mês do celular, onde o texto virava "C…", agora há pontinhos coloridos, e o que está escrito fica a um toque.',
          },
          {
            tipo: 'melhor',
            icone: <CalendarDays size={20} />,
            titulo: 'A cor diz o que importa, e hoje é verde',
            texto: 'Dia de diária fica amarelo, e dia com prazo de task ainda em aberto fica laranja. Hoje é verde, no calendário e nos Próximos 7 dias, para não se confundir com o amarelo da diária. As sete colunas do mês ficaram iguais: uma tarefa de nome comprido alargava o dia dela e empurrava o sábado para fora da tela, até no computador.',
          },
        ],
      },
      {
        id: 'celular',
        titulo: 'O celular deixou de ser o computador encolhido',
        resumo: 'Nada escapa pelas bordas, e sobra mais tela para o que interessa.',
        cor: '#38bdf8',
        itens: [
          {
            tipo: 'corrigido',
            icone: <Smartphone size={20} />,
            titulo: 'Nenhuma tela rola mais de lado',
            texto: 'Financeiro, Produção, Diárias, Locações e a linha do dia empurravam a página para fora da tela no celular, e o app inteiro deslizava para o lado. As abas do Financeiro e da Produção agora deslizam sozinhas, e na ficha de créditos a pessoa aparece embaixo da função, com a largura toda.',
          },
          {
            tipo: 'melhor',
            icone: <LayoutGrid size={20} />,
            titulo: 'Mais tela para o conteúdo',
            texto: 'As telas da produção tinham margem dobrada dos lados. O nome da produção aparecia duas vezes no Dashboard, e o fim da página ficava atrás da barra de baixo. Os atalhos do Dashboard viraram duas colunas de botões baixos, os três números do Financeiro cabem num cartão só, e os Próximos 7 dias ficaram legíveis. O cabeçalho ficou com um "?" só.',
          },
          {
            tipo: 'melhor',
            icone: <Tablet size={20} />,
            titulo: 'Tablet, celular deitado e dedo',
            texto: 'No tablet em pé, Diárias e Locações mostram os cartões em duas colunas, e os atalhos ficam numa linha só. Com o celular deitado, o cabeçalho sai do caminho e a barra de baixo mostra só os ícones. Os botões de ícone ficaram um pouco maiores em tela de toque, e a barra de baixo não espreme mais os ícones em cima da faixa de gestos do iPhone.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.10.0',
    resumo: <>A Ordem do Dia virou papel de verdade, o set ganhou o "a seguir", e o fim do dia agora tem festa.</>,
    grupos: [
      {
        id: 'od-papel',
        titulo: 'A Ordem do Dia virou papel de verdade',
        resumo: 'Um PDF montado pelo app, no formato que a produção já usa — e guardado.',
        cor: '#fca311',
        itens: [
          {
            tipo: 'novo',
            icone: <FileText size={20} />,
            titulo: 'A OD agora é um PDF feito pelo app',
            texto: 'Não é mais a impressão do navegador. O documento sai em paisagem, com a grade hora a hora — horário, cena, I/E, D/N, locação, sinopse, planos, páginas e elenco —, cabeçalho e rodapé em toda página, e uma linha de total com as páginas e as horas do dia somadas. Sai igual em qualquer computador.',
          },
          {
            tipo: 'novo',
            icone: <FolderOpen size={20} />,
            titulo: 'O papel exportado fica guardado',
            texto: 'Toda OD exportada vai para Documentos → Ordens do Dia, uma entrada por versão. Precisar de outra cópia não obriga mais a exportar de novo — e exportar de novo era o que subia a versão da diária e fazia a equipe receber aviso de uma mudança que não houve.',
          },
          {
            tipo: 'melhor',
            icone: <MapPin size={20} />,
            titulo: 'O hospital ao lado do endereço',
            texto: 'Na tabela de locações, cada set traz o seu endereço e o seu hospital mais próximo na mesma linha, com telefone e distância. Antes o hospital ficava numa seção separada, longe do endereço a que se referia.',
          },
          {
            tipo: 'novo',
            icone: <Users size={20} />,
            titulo: 'Equipe em duas colunas, com o canal de rádio',
            texto: 'A equipe sai agrupada por departamento, em duas colunas, com o telefone de cada um — cabe o dobro de gente na mesma página. O canal de rádio de cada pessoa agora é um campo da ficha, e aparece na OD quando está preenchido.',
          },
          {
            tipo: 'novo',
            icone: <Home size={20} />,
            titulo: 'Base e camarim, e os horários do elenco',
            texto: 'Na diária, em "Base e elenco na OD": onde a equipe se concentra e troca de roupa, com endereço próprio, e a chegada, maquiagem e figurino, hora no set e liberação de cada personagem. Os personagens do dia aparecem sozinhos, a partir da decupagem. Tudo opcional — o que não for preenchido não sai no papel.',
          },
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'As cenas do dia seguinte',
            texto: 'A OD traz as cenas da próxima diária, com locação, páginas e sinopse — para quem se prepara na véspera. E cada refeição da linha do dia ganhou um campo de local ("almoço 12h às 13h · sob a tenda").',
          },
          {
            tipo: 'novo',
            icone: <Settings size={20} />,
            titulo: 'Logo e avisos fixos da produção',
            texto: 'Em Configurações, "Padrão da Ordem do Dia": o logo da produtora e as observações que se repetem em todo papel ("hidrate-se", "celular no silencioso"). Configurados uma vez, saem em toda OD.',
          },
          {
            tipo: 'melhor',
            icone: <Sparkles size={20} />,
            titulo: 'A inteligência artificial saiu do caminho',
            texto: 'A OD é montada e desenhada pelo app, do começo ao fim — não há nada entre os seus dados e o papel. "Diagramar com IA" continua existindo num botão ao lado, para quem quiser outro visual, com a conferência da v4.9.0 intacta.',
          },
        ],
      },
      {
        id: 'no-set',
        titulo: 'No set',
        resumo: 'Quanto falta, o que corrigir, e como o dia termina.',
        cor: '#4cc9f0',
        itens: [
          {
            tipo: 'novo',
            icone: <Timer size={20} />,
            titulo: 'Quanto falta para o próximo item',
            texto: 'Ao lado do relógio aparece "A seguir — Almoço, em 12min", e a linha do dia marca qual é o item. A conta usa o plano mais o atraso do dia: num dia 50min atrasado, o papel diria que o almoço é em 10min, e a tela diz que é em uma hora. Passou da hora e ninguém marcou, ela avisa: "era para ter começado há 8min".',
          },
          {
            tipo: 'melhor',
            icone: <Clock size={20} />,
            titulo: 'Corrigir a hora em que algo começou',
            texto: 'Tocar em "começou" continua marcando a hora de agora — e abre um campo "Começou às" para corrigir. Esqueceu de marcar o café das 7h? Um toque em "começou no previsto" devolve o item ao horário do plano, e o atraso que só existia por falta de marcação some. Tocar numa hora já marcada abre o ajuste, e não apaga mais o registro.',
          },
          {
            tipo: 'novo',
            icone: <PartyPopper size={20} />,
            titulo: 'O fim do dia tem festa',
            texto: 'Marcar a desprodução solta fogos. Fechar a diária abre a carta de wrap, com uma frase e os números do dia — cenas gravadas, páginas, e o wrap real contra o previsto. Na última diária do filme ela é outra: frase própria, mais fogos, e o total da produção inteira.',
          },
          {
            tipo: 'melhor',
            icone: <FileText size={20} />,
            titulo: 'O relatório do dia não abre mais sozinho',
            texto: 'Fechar a diária abria a caixa de impressão do relatório sem aviso, no meio do wrap. Agora ele é o botão principal da carta de wrap — a mesma ação, na hora em que você escolhe.',
          },
        ],
      },
      {
        id: 'diarias-eventos',
        titulo: 'Diárias e Eventos',
        resumo: 'Duas páginas, duas formas de ver, e dias que se copiam.',
        cor: '#1dd1a1',
        itens: [
          {
            tipo: 'melhor',
            icone: <CalendarClock size={20} />,
            titulo: 'Eventos tem página própria',
            texto: 'Visita de locação, teste e reunião saíram de dentro das Diárias, onde eram uma terceira aba, e viraram um item próprio do menu. No celular, ficam no "Mais".',
          },
          {
            tipo: 'melhor',
            icone: <Columns3 size={20} />,
            titulo: 'Diárias: Simplificada e Detalhada',
            texto: 'A simplificada é a lista de cartões de sempre. A detalhada é o antigo Plano da semana, com os dias lado a lado e a linha do dia inteira de cada um — e agora com "editar" em cada coluna. O app lembra a sua escolha neste aparelho.',
          },
          {
            tipo: 'novo',
            icone: <Copy size={20} />,
            titulo: 'Duplicar uma diária',
            texto: 'No lápis de editar, o botão de copiar cria uma diária igual numa data que você escolhe, e abre a cópia. Vem o plano — linha do dia, cenas, equipe, locações, transporte, base, elenco e a checklist desmarcada. Não vem o que aconteceu: presença, cenas gravadas, gastos e a OD publicada. A cópia nasce como rascunho.',
          },
          {
            tipo: 'melhor',
            icone: <Pencil size={20} />,
            titulo: 'Os ajustes foram para Configurações',
            texto: 'O padrão da Ordem do Dia e a comemoração do wrap ficavam no topo da lista de diárias, empurrando os dias para baixo. Agora estão em Configurações, onde se mexe uma vez por produção.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.9.0',
    resumo: <>A Ordem do Dia parou de inventar — e o dia passou a se montar sem trocar de tela.</>,
    grupos: [
      {
        id: 'od-verdade',
        titulo: 'A Ordem do Dia diz a verdade',
        resumo: 'Se você exportou alguma OD antes desta versão, confira o papel que circulou.',
        cor: '#e84118',
        itens: [
          {
            tipo: 'corrigido',
            icone: <AlertTriangle size={20} />,
            titulo: 'A OD exportada era inventada pela inteligência artificial',
            texto: 'A exportação pedia à IA, com estas palavras, "crie uma Ordem do Dia profissional" — e mandava só o nome do projeto, o número da diária e uma lista de nomes. As cenas, os horários, as locações e o transporte ela inventava, porque foi mandada inventar. Agora o app monta a Ordem do Dia com os dados reais da sua diária, e a IA só a rediagrama: ela está proibida de alterar, acrescentar ou remover qualquer coisa.',
          },
          {
            tipo: 'novo',
            icone: <ShieldCheck size={20} />,
            titulo: 'O documento é conferido antes de você imprimir',
            texto: 'Proibir não é garantir. Depois de diagramar, o app confere se cada horário, cena, pessoa escalada e locação continua no papel — e se apareceu algum horário que não existe na diária. Não batendo, ele barra a impressão, diz exatamente o que sumiu ou foi inventado, e oferece o documento do próprio app no lugar.',
          },
          {
            tipo: 'novo',
            icone: <FileText size={20} />,
            titulo: 'Imprimir sem passar pela IA',
            texto: 'O mesmo conteúdo, direto do app, sem depender de inteligência artificial nenhuma. Serve para quando não há internet, para quando a diagramação não convenceu, ou simplesmente por preferência.',
          },
        ],
      },
      {
        id: 'montar-o-dia',
        titulo: 'Montar o dia sem trocar de tela',
        resumo: 'Cada ida e volta entre telas é onde o erro acontece — e onde o tempo vai.',
        cor: '#4cc9f0',
        itens: [
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'Plano da semana: todas as ODs lado a lado',
            texto: 'Uma aba nova em Diárias e Eventos com os dias em colunas — chamada, wrap previsto, páginas e a linha do dia inteira de cada um. Dá para ver de relance onde está o buraco, onde o dia estourou e qual dia ainda não tem nada. A tela abre já no dia de hoje, e um toque na coluna abre a diária para mexer.',
          },
          {
            tipo: 'novo',
            icone: <CalendarPlus size={20} />,
            titulo: 'Criar a diária direto do stripboard',
            texto: 'Ao clicar em "Virar OD", o modal agora oferece criar a diária ali mesmo: a data já vem sugerida (o dia seguinte ao da última) e ele mostra que número ela vai ter antes de você confirmar. A diária nasce e recebe as cenas no mesmo gesto. Sem diária nenhuma no projeto, o modal deixava de ter saída — agora convida a criar a primeira.',
          },
          {
            tipo: 'novo',
            icone: <Scissors size={20} />,
            titulo: 'Partir uma cena no plano exato',
            texto: 'A tesoura na linha do dia pergunta até que plano vai a primeira parte, e a cena passa a aparecer duas vezes: "Cena 5 · planos 1–3", o lanche, "Cena 5 · planos 4–6". Cena sem decupagem é partida ao meio e vira 5A e 5B. A cena continua sendo uma só na decupagem, nas páginas e no registro do que foi gravado — o que se parte é a agenda. O trecho vai impresso na OD, e a estimativa é repartida entre as partes para o wrap previsto não andar sozinho.',
          },
          {
            tipo: 'corrigido',
            icone: <ListChecks size={20} />,
            titulo: 'A lista de diárias mostrava a 02 acima da 01',
            texto: 'Era de propósito: as que já passaram iam para o fim, para o próximo dia ficar no topo. Só que o efeito era uma lista de dias numerados fora de ordem, que lê como defeito e nada explicava. Agora elas ficam na ordem em que acontecem, do primeiro ao último. Para saber onde você está, o Plano da semana abre no dia de hoje.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.8.2',
    resumo: <>Trocar a versão do roteiro parou de custar o stripboard, a Ordem do Dia deixou de obrigar a ir e voltar de tela, e o app passou a medir sozinho quanto de roteiro cada cena ocupa.</>,
    grupos: [
      {
        id: 'roteiro',
        titulo: 'O roteiro muda, o trabalho fica',
        resumo: 'Roteirista manda versão nova toda semana. Até agora, cada versão apagava o que a produção tinha construído em cima da anterior.',
        cor: '#a4de6c',
        itens: [
          {
            tipo: 'corrigido',
            icone: <RefreshCw size={20} />,
            titulo: 'Reanalisar o roteiro apagava tudo que estava em cima dele',
            texto: 'As cenas eram destruídas e recriadas com identidade nova. Iam junto a ordem do stripboard, as quebras de diária, as estimativas e o elenco marcado — e as diárias já montadas ficavam apontando para cenas que não existiam mais, sem um aviso. Agora a cena 42 continua sendo a mesma cena 42: a versão nova atualiza o cabeçalho, o local e o texto, e não encosta no que é da produção.',
          },
          {
            tipo: 'novo',
            icone: <GitCompare size={20} />,
            titulo: 'Versão nova ou outro roteiro?',
            texto: 'Analisando um roteiro num projeto que já tem cenas, o app pergunta — e sugere a resposta contando quantos números de cena batem ("112 das 128 cenas são as mesmas"). Versão nova reconcilia com o que já existe; outro roteiro começa um stripboard próprio, sem apagar o anterior.',
          },
          {
            tipo: 'novo',
            icone: <Undo2 size={20} />,
            titulo: 'Cena cortada não some',
            texto: 'Ela sai da ordem de filmagem e fica numa lista "fora do roteiro atual", logo abaixo do stripboard. Cena cortada pode já ter sido gravada, e roteirista volta atrás: se ela reaparecer numa versão seguinte, volta com estimativa, elenco e locação intactos. E voltar para uma versão antiga do roteiro devolve o stripboard daquela versão, não só o PDF.',
          },
          {
            tipo: 'novo',
            icone: <FileText size={20} />,
            titulo: 'As páginas de cada cena são medidas no próprio roteiro',
            texto: 'O campo era digitado à mão, cena por cena. Ninguém preenche 128 campos — e sem eles a conta de quanto do filme já saiu ficava zerada, com a barra do painel parada mesmo depois de meia produção gravada. Agora a análise do PDF mede quanto de página cada cena ocupa, e a versão nova do roteiro atualiza a medida: cena que encolheu de duas páginas para meia encolheu de verdade.',
          },
          {
            tipo: 'corrigido',
            icone: <Film size={20} />,
            titulo: 'Num roteiro de 128 cenas, três não eram reconhecidas',
            texto: 'E sumiam sem aviso nenhum. Eram três causas diferentes: período qualificado ("INÍCIO DA MANHÃ"), período que não é hora do dia ("MONTAGEM", "FLASHBACK") e cabeçalho sem INT./EXT. nenhum ("123. MONTAGEM DE JORNAIS"). A terceira agora é procurada pelo buraco na numeração — se o app achou a 122 e a 124 e não achou a 123, então existe uma cena 123 —, e a tira dela vem marcada CONFIRA, porque ali o interno/externo é chute.',
          },
        ],
      },
      {
        id: 'stripboard',
        titulo: 'Organizar o stripboard',
        resumo: 'Reagrupar a ordem de filmagem é a primeira coisa que um assistente de direção faz. Havia um jeito só.',
        cor: '#8e44ad',
        itens: [
          {
            tipo: 'novo',
            icone: <ListChecks size={20} />,
            titulo: 'Quatro formas de organizar',
            texto: 'O chip "Agrupar por locação" virou um menu: ordem do roteiro, por locação, por INT/EXT e por dia/noite. A ordem do roteiro é o desfazer de quem experimentou um agrupamento e não gostou. Nenhuma delas atravessa uma quebra de diária — reorganizar embaralha as cenas dentro de cada dia, e nunca muda uma cena de dia.',
          },
          {
            tipo: 'novo',
            icone: <Trash2 size={20} />,
            titulo: 'Apagar uma cena direto na tira',
            texto: 'Com a confirmação dizendo o que vai junto — a estimativa, o elenco marcado, a locação. Cena que veio do roteiro volta na próxima análise, porque quem manda nela é o PDF, e a confirmação avisa disso em vez de deixar você descobrir sozinho que "apagou e voltou".',
          },
        ],
      },
      {
        id: 'od',
        titulo: 'A Ordem do Dia sem ir e voltar',
        resumo: 'Três pedidos de um mesmo assistente de direção, na mesma tarde, que eram a mesma dor: ficar preso trocando de tela.',
        cor: '#4cc9f0',
        itens: [
          {
            tipo: 'corrigido',
            icone: <AlertTriangle size={20} />,
            titulo: 'Mandar cenas para a diária errada apagava a OD dela',
            texto: 'Sem perguntar nada. Enquanto a diária é rascunho ela espelha um dia do stripboard, e apontá-la para outro dia não era acrescentar cenas: era trocar o dia inteiro dela. Agora isso pede confirmação dizendo o que se perde, uma diária travada ou publicada avisa antes de receber cena, e a lista de escolha mostra "espelha o Dia 3" e o estado de cada diária antes do clique.',
          },
          {
            tipo: 'novo',
            icone: <Clapperboard size={20} />,
            titulo: 'Escalar uma cena dentro da própria diária',
            texto: 'Sem ir ao stripboard e voltar. Ela entra no fim do dia e, se a diária estiver seguindo o stripboard, aparece lá também — no dia certo, para não sumir na próxima vez que a tela abrir.',
          },
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'Passar da Diária 01 para a 02 sem voltar para a lista',
            texto: 'Duas setas ao lado do título, que dizem para onde levam antes de você clicar. Elas param na primeira e na última: cair de uma ponta na outra é o tipo de salto que só se percebe depois de editar a diária errada.',
          },
          {
            tipo: 'corrigido',
            icone: <PieChart size={20} />,
            titulo: 'O andamento dizia "— de — páginas gravadas" sem roteiro nenhum',
            texto: 'Quem monta o dia sem decupagem via uma frase que parece defeito, e não ausência. Agora a linha de páginas só aparece quando existe roteiro medido — o resto do card (cenas prontas, cenas a gravar) continua valendo para quem trabalha sem roteiro.',
          },
          {
            tipo: 'novo',
            icone: <MapPin size={20} />,
            titulo: 'O deslocamento agora tem destino',
            texto: 'Deslocamento, refeição e marco podem apontar para uma locação. O endereço aparece na linha do dia, sai impresso ao lado da hora na OD e vira o endereço do evento no arquivo de calendário — quem abre no celular já tem a rota. "Company move" sem endereço obrigava quem estava dirigindo a procurar o lugar em outra parte do papel.',
          },
        ],
      },
      {
        id: 'equipe',
        titulo: 'A equipe e a ficha técnica',
        resumo: 'O app já sabia a função de cada pessoa. Só não estava usando o que sabia — e insistia que cada função tem um dono só.',
        cor: '#ffd166',
        itens: [
          {
            tipo: 'melhor',
            icone: <IdCard size={20} />,
            titulo: 'A ficha técnica se preenche pelo cadastro da equipe',
            texto: 'Quem preencheu a função de cada pessoa ao montar a equipe chegava nos créditos e via tudo vazio, tendo que dizer de novo o que já tinha dito. Agora cada função mostra quem a ficha diz que a ocupa, e um botão no topo preenche todas de uma vez. Ele não adivinha quando há duas pessoas com a mesma função no mesmo departamento, nem quando a função existe em mais de um departamento — nesses casos a lista de escolha continua ali.',
          },
          {
            tipo: 'corrigido',
            icone: <Users size={20} />,
            titulo: 'Duas pessoas na mesma função — a segunda ficava invisível',
            texto: 'Uma produção com duas câmeras tem dois operadores, e a tela mostrava um só: o segundo ficava gravado no projeto e não aparecia em lugar nenhum. Agora o "＋" na linha da função abre uma vaga a mais, e as duas ganham a marca que as distingue — Operador de Câmera A e B. Dá para trocar a letra por "principal" e "complementar", ou o que fizer sentido no seu set.',
          },
          {
            tipo: 'melhor',
            icone: <IdCard size={20} />,
            titulo: 'O campo de função sugere, em vez de esperar você lembrar',
            texto: 'Era um campo em branco, e cada um escrevia o que lembrava: "Dir. Fotografia", "Diretor de fotografia", "DOP". A mesma função virava três na ficha técnica — e, pior, era esse texto que ligava a pessoa ao crédito, então uma letra de diferença fazia a ligação não acontecer. Agora ele filtra o catálogo do audiovisual conforme você digita, mostra a que área cada função pertence, e escolher "Microfonista" já preenche Som no campo de baixo. Se alguém da produção já tem aquela função, ele avisa antes de você salvar.',
          },
          {
            tipo: 'melhor',
            icone: <Users size={20} />,
            titulo: 'A ficha de créditos ficou legível',
            texto: 'Ela é um documento — vai no papel timbrado e no fim do rolo — e estava desenhada como formulário: trinta campos iguais em que não dava para conferir nada. Agora tem a inicial de cada pessoa na cor do departamento, o DRT ao lado do nome, uma barra de quanto falta em cada área e o total de gente creditada no topo.',
          },
          {
            tipo: 'novo',
            icone: <CheckSquare size={20} />,
            titulo: 'Mais de uma pessoa na mesma task',
            texto: 'Bater a OD com a produção é de quem monta e de quem aprova — e com um dono só, uma das duas não via a tarefa em "Minhas". O campo de responsável virou uma lista que abre: marque quem entra, com busca por nome, função ou área. Todos recebem o aviso quando a tarefa destrava, todos a veem em "Minhas", e a exportação sai com os nomes.',
          },
        ],
      },
      {
        id: 'locacao',
        titulo: 'Locações',
        resumo: 'O serviço de mapas é de graça, e de vez em quando cobra por isso ficando fora do ar.',
        cor: '#fd79a8',
        itens: [
          {
            tipo: 'corrigido',
            icone: <MapPin size={20} />,
            titulo: '"Achar Hospital Próximo" falhava com um erro incompreensível',
            texto: 'O serviço de mapas é gratuito e compartilhado, e quando está congestionado ele recusa a consulta de um jeito que o navegador bloqueia antes do app conseguir ler — o resultado era um alerta dizendo "Failed to fetch". Agora ele diz o que aconteceu, que costuma ser passageiro, e lembra que dá para escrever o hospital à mão, que funciona igual na Ordem do Dia. E tenta um segundo servidor antes de desistir.',
          },
        ],
      },
    ],
  },
  {
    versao: '4.8.1',
    resumo: <>Os campos de texto pararam de brigar com quem digita, e o stripboard passou a alimentar a linha do dia.</>,
    itens: [
      {
        tipo: 'corrigido',
        icone: <FileText size={20} />,
        titulo: 'Escrever no meio de uma palavra jogava o cursor para o fim',
        texto: 'E o acento não saía. Eram o mesmo defeito, e não dois: cada tecla gravava no banco, a tela voltava com o texto de um instante atrás, e o navegador — vendo na tela um valor diferente do que ele tinha — mandava o cursor para o fim e cancelava a composição do acento no meio. Agora o campo segura o texto enquanto se digita e grava depois da pausa. Vale para o Master Shot List, o stripboard, os elementos, as tarefas e os eventos.',
      },
      {
        tipo: 'melhor',
        icone: <GitMerge size={20} />,
        titulo: 'O que entra no stripboard entra na linha do dia',
        texto: 'Antes só as cenas chegavam: refeição ou deslocamento acrescentado depois tinha que ser posto de novo, à mão, em cada diária. Agora ele aparece sozinho e na posição certa — logo depois da cena que vem antes dele —, e some quando é apagado lá. Dá para mexer nos dois lugares: enquanto ninguém tocou no item dentro da diária, o stripboard manda; a partir do momento em que alguém muda o nome ou a duração ali, quem manda é a diária. O que você criou à mão na diária nunca é mexido, e nada disso acontece com a diária travada ou publicada.',
      },
      {
        tipo: 'melhor',
        icone: <ClipboardCheck size={20} />,
        titulo: 'No stripboard, o nome do marcador aparecia duas vezes',
        texto: 'A tarja dizia "CAFÉ DA MANHÃ" e, logo ao lado, uma caixa de texto repetia "Café da manhã" — a segunda parecendo um campo vazio esperando outra informação. Agora o título é o próprio campo, como na linha do dia: o que está escrito é o que se edita. Vale só para o que foi acrescentado; o nome da cena continua vindo da decupagem, e não se muda ali.',
      },
      {
        tipo: 'novo',
        icone: <CalendarDays size={20} />,
        titulo: 'As outras refeições do dia',
        texto: 'O chip "Almoço" do stripboard virou "Refeição", com café da manhã, almoço, jantar e lanche — cada um com a sua duração típica. Café e lanche entram na linha do dia como pausa curta; almoço e jantar, como a parada que para o dia.',
      },
      {
        tipo: 'melhor',
        icone: <CalendarDays size={20} />,
        titulo: 'A data do cartão da diária ficou legível',
        texto: 'Ela era a menor coisa da tela num celular — dez pixels, em cinza claro — competindo com o número da diária logo ao lado. Agora vem maior, em negrito, e com o dia da semana junto: "qui, 03/09/26". Numa lista de diárias, a data é justamente o que se procura, e o dia da semana é metade da pergunta.',
      },
      {
        tipo: 'corrigido',
        icone: <Sparkles size={20} />,
        titulo: 'No Firefox, o título SETPROD sumia da tela de entrada',
        texto: 'O app já sabia desenhar o título sem os efeitos, para quem não tem placa de vídeo compatível. O que ele não sabia era o que fazer quando o navegador tira esse suporte DEPOIS de a tela já estar montada — que é o que o Firefox faz. Agora ele percebe e cai no título comum, em vez de deixar um espaço em branco onde deveria estar o nome do app.',
      },
    ],
  },
  {
    versao: '4.8.0',
    resumo: <>A tela da diária foi refeita em volta de uma coisa só: a linha do dia. E o dia deixou de ser um plano — agora ele se registra acontecendo.</>,
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
            tipo: 'melhor',
            icone: <GitMerge size={20} />,
            titulo: 'O dia chega pronto do Stripboard',
            texto: 'Mandar um dia do stripboard para a diária agora traz o bloco inteiro — cenas na ordem, almoço e company move com a duração de cada um. O cronograma se monta praticamente sozinho. Se você já tinha montado a linha à mão, ela não é tocada.',
          },
          {
            tipo: 'novo',
            icone: <Film size={20} />,
            titulo: 'As categorias são de cinema, não genéricas',
            texto: 'Pré-light, maquiagem e figurino, ensaio, coffee break e desprodução, junto com marco, refeição, deslocamento e nota — cada uma com a sua cor, o seu ícone e a duração típica já preenchida. Com quatro categorias genéricas, metade do dia virava "marco" escrito à mão, e a linha passava a ser lida palavra por palavra em vez de de relance.',
          },
          {
            tipo: 'novo',
            icone: <ClipboardCheck size={20} />,
            titulo: 'A tela vira registro sozinha na hora da chamada',
            texto: 'Até a véspera ela é de montar; chegada a hora da chamada, ela passa a marcar o dia acontecendo — a hora real de cada item e o estado de cada cena, com um toque. Sem botão de "iniciar o dia", porque quem está no set às 6h com café na mão não vai lembrar de apertar nada. E sem seletor: o modo é do dia, não de quem está olhando, senão dois assistentes de direção veem a mesma diária de jeitos diferentes sem saber.',
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
            texto: '"09:53 · estamos 45min de atraso · wrap agora às 16:15, planejado 15:30". Verde até 15min, âmbar até 45, vermelho acima — porque meia hora ainda se recupera e uma hora significa que alguma cena vai cair. Ele aparece junto com a OD publicada e muda de conteúdo sozinho: contagem regressiva antes da chamada, atraso do dia depois dela.',
          },
          {
            tipo: 'novo',
            icone: <ClipboardCheck size={20} />,
            titulo: 'Presença e jornada, com o atraso se calculando sozinho',
            texto: 'Chegou ou faltou — "atrasou" deixou de ser botão. Tocar em "chegou" carimba a hora, o app compara com a chamada da pessoa e a etiqueta de atraso aparece sozinha; apertar "atrasou" exigia saber a chamada de cabeça às 7h da manhã com trinta pessoas chegando juntas, e na prática todo mundo ficava marcado como "chegou". A jornada também parou de pedir o que já está na linha do dia: chamada, saída para a refeição e fim vêm de lá em cinza, e só ficam brancos quando alguém digita por cima. Ao lado entram figuração e stand-ins, rolos de câmera e som, e as ocorrências do dia com os minutos que cada uma custou.',
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
          {
            tipo: 'melhor',
            icone: <Clapperboard size={20} />,
            titulo: 'Marcar cena só aparece no dia, e diária fechada não se marca',
            texto: 'O botão estava lá até numa diária de daqui a três semanas — e um toque por engano entrava na conta do ritmo do projeto, número errado num painel que decide se você marca mais um dia. Depois de fechada também não se mexe em nada: nem cena, nem hora real, nem presença, nem checklist, senão o relatório impresso diverge da tela sem ninguém perceber. Para alterar, o botão Reabrir — explícito e registrado na ata.',
          },
        ],
      },
      {
        id: 'estados',
        titulo: 'Rascunho, travada, publicada',
        resumo: 'Faltava o degrau entre "mexendo" e "a equipe já recebeu".',
        cor: '#a78bfa',
        itens: [
          {
            tipo: 'novo',
            icone: <Lock size={20} />,
            titulo: 'TRAVADA: congela sem publicar',
            texto: 'Uma diária pronta esperando as outras ficarem. Travada, ela não deixa mexer em nada: todo campo e todo botão ficam desligados, e a linha do dia não se reordena mais. Voltar para rascunho não custa nada — porque nada saiu. Antes, quem só queria proteger o dia de um clique errado tinha que publicar, e depois pagar o preço de despublicar.',
          },
          {
            tipo: 'melhor',
            icone: <ClipboardCheck size={20} />,
            titulo: 'Cada estado mostra o que aquele momento pede',
            texto: 'No rascunho ficam linha do dia, locações, transporte, financeiro, equipe e anexos — o que se decide na véspera. Na diária publicada ficam linha do dia, presença e jornada, transporte, checklist e anexos — o que se preenche no set. Antes tudo aparecia sempre, e o resultado era pedir confirmação de presença numa OD que ninguém tinha recebido. "Cenas programadas" saiu de vez, porque quem marca cena é a linha do dia; "confirmação de presença" também, porque presença e jornada pergunta a mesma coisa, com hora.',
          },
          {
            tipo: 'melhor',
            icone: <Send size={20} />,
            titulo: 'Um botão só para exportar, e ele é o da IA',
            texto: 'Eram dois — "Gerar OD com IA" e "Exportar e publicar", que montava o documento por modelo fixo. O segundo ficava sofrível ao lado do primeiro, e dois caminhos para a mesma coisa obrigam a escolher sem ter como saber qual escolher. E publicar passou a acontecer quando o papel sai, não quando a janela abre: dá para abrir, olhar e fechar sem congelar o plano de ninguém.',
          },
          {
            tipo: 'novo',
            icone: <Send size={20} />,
            titulo: 'Publicar é exportar, e exportar congela o plano',
            texto: 'Acabou o "Publicar OD" que publicava sem gerar documento nenhum. No momento em que você exporta, todo mundo está com aquele papel na mão — e o app para de deixar mudar o plano por baixo. Precisou mudar? Volte a rascunho, edite e reexporte: a nova sai marcada v2, v3, para ninguém seguir a versão velha.',
          },
          {
            tipo: 'novo',
            icone: <AlertTriangle size={20} />,
            titulo: 'Sair de PUBLICADA agora avisa, em vermelho',
            texto: '"Esta OD já pode estar circulando pela equipe." Porque pode mesmo: existe um PDF impresso, no WhatsApp ou na caixa de entrada de todo mundo, e ele passa a mentir no instante do clique. O aviso lembra de exportar de novo depois e avisar a equipe.',
          },
          {
            tipo: 'melhor',
            icone: <GitMerge size={20} />,
            titulo: 'O controle de estado saiu de dentro da faixa do stripboard',
            texto: 'Ele morava num lugar que só existe quando a diária veio de uma quebra — diária montada à mão nunca conseguia sair de rascunho. Agora fica no topo da tela, sempre.',
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
            icone: <Share2 size={20} />,
            titulo: 'Mandar a OD para a equipe, de graça',
            texto: 'COMPARTILHAR abre o WhatsApp, o Telegram ou o email do seu aparelho já com a OD escrita e o arquivo de agenda junto. COPIAR deixa a OD pronta para colar em qualquer lugar. ABRIR NO MEU EMAIL abre a sua caixa com a equipe já em cópia oculta e o assunto preenchido — ninguém recebe a lista de emails dos outros.',
          },
          {
            tipo: 'novo',
            icone: <CalendarDays size={20} />,
            titulo: 'Adicionar à agenda',
            texto: 'Baixa um arquivo que Google, Apple e Outlook abrem — com a diária inteira e cada marco (chamada, refeição, wrap) como compromisso separado. Cena não vira evento, senão a agenda de todo mundo vira uma parede. Tem também o link direto para o Google Agenda.',
          },
          {
            tipo: 'novo',
            icone: <MessageCircleQuestion size={20} />,
            titulo: 'Link da reunião',
            texto: 'Cole o link do Meet, Zoom ou Teams e ele entra no evento da agenda e no email. Colado à mão de propósito: criar a sala sozinho exigiria autorização de cada pessoa da equipe no Google.',
          },
          {
            tipo: 'novo',
            icone: <Mail size={20} />,
            titulo: 'E, para quem tiver domínio, o envio em nome da produção',
            texto: 'Aí o email sai de od@suaprodutora.com.br em vez da conta pessoal de quem clicou. Isso exige um domínio próprio com os registros de DNS certos — sem eles o Gmail joga em spam, e não há como contornar: é regra de quem recebe, não limitação do app. Fica escondido num "ver mais" até você querer.',
          },
        ],
      },
      {
        id: 'numero',
        titulo: 'O número da diária, e a lista',
        resumo: '"Diária 01" nunca quis dizer "a primeira que eu cadastrei".',
        cor: '#2dd4bf',
        itens: [
          {
            tipo: 'melhor',
            icone: <CalendarDays size={20} />,
            titulo: 'O número vem da data, e você não digita mais',
            texto: 'Ele quer dizer o primeiro dia de filmagem. Agora criar um dia para amanhã faz dele a 01; criar um para daqui a um ano, com quatro dias antes, faz dele a 05. Ao escolher a data o app já mostra "vai ser a Diária 03" antes de você confirmar. Remarcou um dia para antes do começo? Ele vira a 01 e os outros andam. Apagou a 02? Some o buraco na sequência.',
          },
          {
            tipo: 'novo',
            icone: <AlertTriangle size={20} />,
            titulo: 'E avisa quando isso mexe numa OD que já saiu',
            texto: 'Renumerar é invisível enquanto tudo é rascunho — ninguém viu aqueles números. Mas se uma diária publicada mudar de número, aparece o aviso: "Diária 03 → 04. A equipe está com a OD antiga, que diz o número velho." Aí é reexportar e avisar.',
          },
          {
            tipo: 'melhor',
            icone: <ListChecks size={20} />,
            titulo: 'A lista em ordem de data, e o próximo dia primeiro',
            texto: 'Era ordenada por número. Numa produção real os dois divergem o tempo todo — a Diária 07 remarcada para antes da 05 ficava no meio da lista. Agora as que já passaram vão para o fim, sem sumir, e a de hoje aparece marcada. O formulário de criar também ganhou Cancelar, para quem clicou sem querer.',
          },
          {
            tipo: 'corrigido',
            icone: <CheckSquare size={20} />,
            titulo: '"Tasks (em breve)" virou o número de verdade',
            texto: 'Era um lugar reservado desde que a tela nasceu, para um número que já estava no banco. Agora cada card mostra quantas tarefas da checklist já foram feitas.',
          },
        ],
      },
      {
        id: 'tela',
        titulo: 'A tela parou de ser doze caixas iguais',
        resumo: 'Tudo tinha o mesmo tamanho e a mesma cor, e o olho não sabia onde pousar.',
        cor: '#f0abfc',
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
            titulo: 'Escalar a equipe ganhou "selecionar todo mundo"',
            texto: 'Em curta e em publicidade quase todo mundo vai em quase todo dia, e eram vinte toques para dizer isso — depois três para tirar quem não vai. O mesmo botão limpa a seleção quando já está todo mundo marcado.',
          },
          {
            tipo: 'melhor',
            icone: <DollarSign size={20} />,
            titulo: 'O financeiro do dia parou de parecer o caixa do filme',
            texto: '"Máximo" e "Saldo" se liam como o dinheiro da produção inteira. Agora são "Limite do dia" e "Resta do limite", com uma linha lembrando que aqueles números são só daquela diária — o orçamento do filme continua no módulo Financeiro.',
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
        cor: '#4cc9f0',
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
            titulo: 'O DPR sai em PDF de verdade, e traz tudo',
            texto: 'Horário previsto contra real linha por linha, cenas filmadas com páginas e setups, as não filmadas com o motivo de cada uma, a jornada de cada pessoa, figuração, rolos, ocorrências com os minutos perdidos, quem não confirmou presença, a prestação de contas do dia e quem preencheu cada coisa. É o Relatório Diário de Produção que a indústria pede.',
          },
          {
            tipo: 'novo',
            icone: <Lock size={20} />,
            titulo: 'Cena que não saiu pede a etiqueta E a frase',
            texto: 'Não dá mais para fechar a diária deixando uma cena sem explicação. "Cena 12 não gravada" não serve para decidir nada — chuva reagenda para o mesmo set, elenco reagenda para a agenda da pessoa. E só a etiqueta perde o caso, então o app pede a linha inteira: "adiada por problema de iluminação, será filmada amanhã de manhã". É o único campo do app que tranca um botão, e é de propósito: escrever agora, no wrap, é a única hora em que alguém ainda lembra.',
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
            texto: '"No ritmo atual, faltam 2 diárias para o filme fechar." Ele compara as cenas que saíram por dia com o que ainda falta e com os dias que sobraram, e fala em páginas por dia quando o roteiro está decupado — cinco páginas é a referência da indústria, e o número faz o assistente de direção reconhecer o ritmo do próprio filme. Some sozinho quando não há atraso: um aviso que aparece sempre é um aviso que ninguém lê.',
          },
        ],
      },
      {
        id: 'tasks',
        titulo: 'As tarefas, o manual e o relato de bug',
        resumo: 'Fora da diária, três telas que estavam pedindo.',
        cor: '#fbbf24',
        itens: [
          {
            tipo: 'melhor',
            icone: <CalendarClock size={20} />,
            titulo: 'As tarefas se organizam pelo prazo',
            texto: 'A coluna era ordenada pela ordem em que as tarefas foram criadas, e o prazo era uma data pequena no rodapé do cartão. Numa coluna com quinze, a que vence amanhã podia estar em décimo lugar. Agora a mais próxima do prazo sobe, e as sem prazo vão para o fim. No topo do cartão entra a etiqueta — ATRASADA 3 DIAS, É HOJE, PRAZO CURTO · AMANHÃ —, vermelha para o que já venceu e âmbar para os dois dias seguintes. Acima de uma semana não ganha etiqueta: etiqueta em todo cartão é o mesmo que etiqueta em nenhum.',
          },
          {
            tipo: 'novo',
            icone: <ListChecks size={20} />,
            titulo: 'As subtarefas abrem no próprio cartão',
            texto: 'O "2/5" era só um número: para ver o que faltava era preciso abrir a tarefa, e para marcar um item também. Agora ele abre ali mesmo, com as caixinhas — marcar item de checklist é o gesto mais repetido desta tela, e um modal por marcação transformava cinco toques em vinte. E concluir com item em aberto pergunta: mostra quais faltaram e oferece "Fiz tudo — marcar e concluir" ou "Concluir assim mesmo". É pergunta, não bloqueio.',
          },
          {
            tipo: 'melhor',
            icone: <AlertTriangle size={20} />,
            titulo: 'O painel mostra o que está atrasado',
            texto: 'Ele mostrava as três tarefas escritas por último — a criada há um mês que venceu ontem nunca aparecia, e a anotada hoje de manhã para daqui a três semanas aparecia sempre. Agora mostra as mais urgentes, na mesma ordem da tela de Tasks: atrasadas primeiro, depois as de hoje, com a etiqueta acima do título e a contagem no alto (2 atrasadas · 1 vence hoje). Havendo atraso, o cartão ganha borda vermelha e cresce para cinco linhas.',
          },
          {
            tipo: 'melhor',
            icone: <HelpCircle size={20} />,
            titulo: 'O "como funciona esta tela" parou de ser um paredão',
            texto: 'A seção das diárias tinha quase cinco mil caracteres num parágrafo só — três vezes a segunda maior. Quem abria com uma dúvida específica desistia na terceira linha, e a resposta estava lá dentro. Agora ela abre numa lista de assuntos curtos ("O número vem da data", "Travar um horário", "Os quatro estados da OD") e você abre só o que interessa. O texto não encolheu: ficou achável. A IA da ajuda ganhou os títulos junto, e por isso acha melhor a resposta certa.',
          },
          {
            tipo: 'melhor',
            icone: <Bug size={20} />,
            titulo: 'Relatar um problema ficou mais claro',
            texto: 'Bug, sugestão e dúvida agora têm cor — vermelho, verde e azul, as mesmas do resto do app; antes os três acendiam em amarelo, então a cor só dizia "este está selecionado", que a borda já dizia. E a lista do que segue junto com a mensagem, que ocupava um terço da janela, virou Informações avançadas recolhida, com o número do lado. Ela não some nunca: mandar diagnóstico sem dizer o que é seria coletar às escondidas.',
          },
        ],
      },
      {
        id: 'corrigidos',
        titulo: 'Corrigidos',
        resumo: 'Dois problemas antigos, e nenhum dos dois era onde parecia.',
        cor: '#94a3b8',
        itens: [
          {
            tipo: 'corrigido',
            icone: <Trash2 size={20} />,
            titulo: 'Diária apagada podia voltar sozinha',
            texto: 'Apagar deixava um "túmulo" esperando para subir, e o aparelho não tinha como saber que aquele dia foi apagado enquanto ele não subisse. Se a sincronia trouxesse a versão antiga antes disso, a diária reaparecia na tela. Agora o que está esperando para subir conta como o mais recente, e o apagar vence. Valia para tudo — cena, despesa, ficha — não só para diária.',
          },
          {
            tipo: 'corrigido',
            icone: <MessageCircleQuestion size={20} />,
            titulo: 'As perguntas de confirmação eram engolidas pelo navegador',
            texto: 'Este era o "não consigo apagar diárias". Quando o navegador vê várias caixas de confirmação seguidas, ele oferece "impedir que esta página crie mais diálogos" — e a partir daí toda pergunta seguinte responde "cancelar" sozinha, sem aparecer nada na tela. O clique em apagar simplesmente não fazia nada, sem erro nenhum. As 31 perguntas do app saíram da caixa cinza do navegador: agora têm título, dizem o que acontece depois, e o botão tem o nome da ação ("Apagar", "Sair do projeto") em vez de OK e Cancelar.',
          },
          {
            tipo: 'corrigido',
            icone: <CalendarDays size={20} />,
            titulo: 'Os campos de data apareciam em inglês',
            texto: 'Vinha "mm/dd/yyyy" no meio de um app inteiro em português, porque aquele campo se escreve no idioma do navegador e não no do site. E não é só feio: 03/09 e 09/03 são dois dias diferentes, então quem digitasse 09/03 esperando setembro marcava a diária em março. Agora é sempre dd/mm/aaaa, nos nove campos do app, com o calendário do sistema ainda ali no ícone ao lado.',
          },
          {
            tipo: 'corrigido',
            icone: <DollarSign size={20} />,
            titulo: 'O cartão da diária dizia R$ 0,00 mesmo com gastos',
            texto: 'A lista mostrava zero enquanto a tela de dentro da mesma diária mostrava o valor certo. A despesa guarda o vínculo com a diária e também o nome dela ("Diária 3"), escrito só para aparecer na lista — e o cartão comparava um com o outro. Nunca bateu, em diária nenhuma. Agora a lista, a tela da diária e a exportação perguntam isso no mesmo lugar.',
          },
          {
            tipo: 'corrigido',
            icone: <RefreshCw size={20} />,
            titulo: 'A tela de atualização sumia com a barra pela metade',
            texto: 'Ela era cronometrada nos 8 segundos do prazo de desistência, mas a versão nova costuma assumir em menos de um segundo — e a página ia embora com a barra em 10%. Agora a barra acelera até o fim, é o fim dela que recarrega a página, e a tela fica no ar pelo menos 1,2 segundo: meio segundo seria um piscar, que se lê como "deu errado" e não como "está trocando de versão".',
          },
          {
            tipo: 'melhor',
            icone: <Undo2 size={20} />,
            titulo: 'O voltar sobe um nível de cada vez',
            texto: 'Diária → Diárias e Eventos → painel do projeto → sair. Quem estava dentro de uma diária perdia o projeto inteiro com um clique e gastava três para voltar. E sair do projeto, que é a única parada da navegação sem volta fácil, pergunta antes.',
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
