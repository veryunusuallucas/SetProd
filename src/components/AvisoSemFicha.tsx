import { useState } from 'react';
import { usarAviso, URGENCIA } from './avisos/CentralDeAvisos';
import { FaixaDeAviso } from './avisos/FaixaDeAviso';
import { UserCheck } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { EscolherMinhaFicha } from './EscolherMinhaFicha';
import { sincronizarParticipacoes, participacaoLocal } from '../lib/membros';

/**
 * "Diga quem você é nesta produção."
 *
 * O convite nominal (`convites.perfil_id`) resolve quem entra de agora em
 * diante. Este aviso existe para quem JÁ entrou antes disso: nenhum fluxo de
 * convite conserta retroativamente uma participação sem vínculo, e essas
 * pessoas ficariam presas num estado em que nada parece quebrado — só não
 * funciona. Sem vínculo, "Minhas Tasks" vem vazia e a pessoa não vê nem a
 * própria ficha.
 *
 * NÃO É MODAL À FORÇA. Aparece como uma faixa que dá para dispensar; o vínculo
 * é útil, não obrigatório, e travar a tela de alguém que só quer consultar a
 * diária seria pior que o problema.
 *
 * A dispensa é de sessão, não gravada: o aviso volta na próxima vez que a
 * pessoa abrir a produção. Guardar "não quero" para sempre esconderia o único
 * caminho que existe para consertar isso.
 */
export function AvisoSemFicha({ projetoId, meuEmail }: { projetoId: string; meuEmail?: string | null }) {
  const { perfilId, souMembro } = useRole();
  const [escolhendo, setEscolhendo] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  // Quem não é membro não tem `projeto_membros` para vincular — é o projeto que
  // só existe neste navegador, e ali a pergunta não faz sentido nenhum.
  // Quem já pediu uma ficha está esperando quem administra — perguntar de
  // novo só faria a pessoa pedir outra.
  const pediu = !!participacaoLocal(projetoId)?.perfil_pedido;

  /*
    A condição vira a CHAVE do aviso, e não um `return` antes dele: hook que às
    vezes roda e às vezes não é o jeito mais fácil de quebrar um componente
    React — e a janela de escolher a ficha precisa continuar montada mesmo
    depois de a faixa sumir, senão ela fecharia sozinha no meio.
  */
  const faltaResponder = souMembro && !perfilId && !pediu && !dispensado;

  /*
    O menos urgente dos três: é útil, não é urgente, e quem só quer consultar a
    diária pode seguir sem responder. Por isso ele cede a vez na central.
  */
  usarAviso('sem-ficha', URGENCIA.faltaSeApresentar, faltaResponder ? 'falta' : null, () => (
    <FaixaDeAviso
      tom="neutro"
      icone={<UserCheck size={18} />}
      aoDispensar={() => setDispensado(true)}
      acao={<button className="btn btn-primary" onClick={() => setEscolhendo(true)} style={{ flexShrink: 0 }}>Escolher</button>}
    >
      <strong>Diga quem você é nesta produção.</strong>{' '}
      <span className="text-muted">Sem isso, “Minhas Tasks” vem vazia e você não enxerga a sua própria ficha.</span>
    </FaixaDeAviso>
  ));

  return (
    <>
      {escolhendo && (
        <EscolherMinhaFicha
          projetoId={projetoId}
          meuEmail={meuEmail}
          aoResolver={async () => {
            // Recarrega a participação para o `useRole` enxergar o vínculo novo
            // e a faixa sumir sozinha, sem a pessoa precisar recarregar a página.
            await sincronizarParticipacoes();
            setEscolhendo(false);
          }}
          aoPular={() => setEscolhendo(false)}
        />
      )}
    </>
  );
}
