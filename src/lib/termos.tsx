/**
 * Os termos e condições do SetProd.
 *
 * ⚠️ RASCUNHO (02/10/2026). O Lucas pediu para ver como os termos vão aparecer
 * antes de o texto existir. O que está aqui é a ESTRUTURA — as seções que um
 * app como este precisa ter — com o que já é verdade hoje escrito, e o que
 * falta decidir marcado com [a definir]. Enquanto `RASCUNHO` for true, a tela
 * avisa que o texto ainda não vale.
 *
 * Antes de valer: o app guarda CPF, PIX e ficha médica (alergias, tipo
 * sanguíneo) — dado de saúde é "dado sensível" pela LGPD. Este texto precisa
 * passar por alguém da área jurídica antes de `RASCUNHO` virar false.
 *
 * Texto novo: mude a `VERSAO_DOS_TERMOS` e a `ATUALIZADO_EM`. Quando houver
 * aceite no cadastro, é por elas que o app vai saber quem aceitou qual versão.
 */

export const RASCUNHO = true;
export const VERSAO_DOS_TERMOS = '0.1';
export const ATUALIZADO_EM = '02/10/2026';

export interface SecaoDosTermos {
  id: string;
  titulo: string;
  corpo: React.ReactNode;
}

export const SECOES_DOS_TERMOS: SecaoDosTermos[] = [
  {
    id: 'o-que-e',
    titulo: '1. O que é o SetProd',
    corpo: <>
      <p>O SetProd é um aplicativo para organizar produções audiovisuais: equipe, diárias, roteiro, ordem do dia, financeiro e acertos. Ao criar uma conta ou usar o app, você concorda com estes termos.</p>
      <p>O SetProd está em <strong>versão beta</strong>: funciona e é usado em sets de verdade, mas ainda muda toda semana e pode ter erros.</p>
    </>,
  },
  {
    id: 'conta',
    titulo: '2. Sua conta',
    corpo: <>
      <p>Você é responsável pelo acesso à sua conta e pelo que é feito com ela. Não compartilhe sua senha.</p>
      <p>Idade mínima para usar o app: [a definir].</p>
    </>,
  },
  {
    id: 'producoes',
    titulo: '3. Produções e quem vê o quê',
    corpo: <>
      <p>Cada produção tem quem a administra. Quem administra convida a equipe, define o papel de cada pessoa e decide o que cada uma pode ver e editar.</p>
      <p>Os dados de uma produção — inclusive as fichas da equipe — pertencem a ela. Quem administra é responsável por pedir à equipe só o que a produção precisa.</p>
    </>,
  },
  {
    id: 'dados',
    titulo: '4. Seus dados',
    corpo: <>
      <p><strong>O que guardamos:</strong> os dados da sua conta (nome e e-mail) e o que você e a sua produção cadastram — como CPF, chave PIX, contato de emergência e informações de saúde da ficha (alergias, tipo sanguíneo).</p>
      <p><strong>Para quê:</strong> só para o app funcionar para a sua produção. Seus dados não são vendidos nem usados para publicidade.</p>
      <p><strong>Onde ficam:</strong> no seu aparelho e num servidor contratado para guardar os dados das produções [nome do serviço e país: a definir].</p>
      <p><strong>Seus direitos (LGPD):</strong> você pode pedir para ver, corrigir ou apagar seus dados. Como pedir: [a definir].</p>
    </>,
  },
  {
    id: 'uso',
    titulo: '5. O que não pode',
    corpo: <>
      <p>Usar o app para algo ilegal, cadastrar dados de outra pessoa sem ela saber, tentar acessar produções de que você não faz parte, ou atrapalhar o funcionamento do app para os outros.</p>
    </>,
  },
  {
    id: 'beta',
    titulo: '6. Beta: sem garantia',
    corpo: <>
      <p>Por ser beta, o SetProd é oferecido como está. Fazemos o possível para não perder nada, mas recomendamos guardar uma cópia do que for importante (relatórios, ordem do dia, acertos).</p>
      <p>Os cálculos do Financeiro ajudam a organizar o dinheiro da produção, mas não substituem a contabilidade nem a conferência de quem administra.</p>
      <p>Limite de responsabilidade: [a definir].</p>
    </>,
  },
  {
    id: 'gratuito',
    titulo: '7. Gratuidade',
    corpo: <>
      <p>O SetProd é gratuito hoje. Se isso mudar, você será avisado com antecedência de [a definir], e nada que já está cadastrado ficará preso.</p>
    </>,
  },
  {
    id: 'encerrar',
    titulo: '8. Sair e apagar',
    corpo: <>
      <p>Você pode sair de uma produção ou deixar de usar o app quando quiser. Como apagar a conta e o que acontece com os dados depois: [a definir].</p>
    </>,
  },
  {
    id: 'mudancas',
    titulo: '9. Mudanças nestes termos',
    corpo: <>
      <p>Quando estes termos mudarem, o app avisa — e mudança importante pede que você leia e aceite de novo.</p>
    </>,
  },
  {
    id: 'contato',
    titulo: '10. Contato',
    corpo: <>
      <p>Dúvidas sobre estes termos ou sobre seus dados: [e-mail de contato: a definir]. Problemas no app: botão "Relatar problema", nas Configurações.</p>
    </>,
  },
];
