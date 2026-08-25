import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { participacaoLocal } from '../lib/membros';
import { pode, type Acao, type Papel } from '../lib/permissoes';

export type Role = Papel;

/**
 * O que eu posso fazer neste projeto.
 *
 * Antes isto era um dropdown de simulação no rodapé da sidebar: a pessoa
 * escolhia "sou da fotografia" e o app acreditava. Agora vem da participação
 * real, que mora no servidor com RLS por cima.
 *
 * A decisão de o que cada papel pode NÃO mora aqui — mora em `permissoes.ts`,
 * numa tabela só. Espalhar `if (role === 'dono')` pelas telas é como o app
 * volta a ficar inconsistente, e é justamente o que este hook existe para
 * evitar.
 *
 * SOBRE FALHAR ABRINDO
 * Quando não dá para saber o papel — sem internet, sem Supabase configurado, ou
 * um projeto que só existe neste navegador e nunca foi compartilhado — as ações
 * de EDITAR ficam liberadas, em vez de trancadas.
 *
 * Isso é decisão consciente, não descuido. O que realmente protege dado
 * compartilhado é a RLS do Postgres: sem participação, o servidor não entrega
 * nem aceita nada, aconteça o que acontecer no cliente. Travar aqui não
 * protegeria nada e trancaria a pessoa para fora do trabalho dela no avião.
 *
 * As ações de ADMINISTRAR (convidar, mexer em papel, destruir) falham fechando,
 * porque dependem do servidor de qualquer jeito — mostrá-las sem saber quem é a
 * pessoa só produziria um clique que termina em erro.
 */
export function useRole() {
  const { id: projetoId } = useParams<{ id: string }>();
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const recarregar = () => setVersao(v => v + 1);
    // O evento próprio cobre esta aba; o `storage` do navegador cobre as outras.
    window.addEventListener('setprod-participacoes', recarregar);
    window.addEventListener('storage', recarregar);
    return () => {
      window.removeEventListener('setprod-participacoes', recarregar);
      window.removeEventListener('storage', recarregar);
    };
  }, []);

  const participacao = projetoId ? participacaoLocal(projetoId) : undefined;
  void versao; // só força a releitura quando a participação muda

  const role: Role = participacao?.papel ?? 'desconhecido';
  const perfilId = participacao?.perfil_id ?? '';

  const podeAqui = (acao: Acao) => pode(role, acao);

  return {
    role,
    perfilId,
    apelido: participacao?.apelido ?? '',
    souMembro: Boolean(participacao),
    /** A pergunta única. Toda decisão de tela deveria passar por aqui. */
    podeAqui,

    // Atalhos para o que as telas já usavam. Continuam sendo `podeAqui` por
    // baixo — existem para não obrigar uma reescrita em cada componente.
    canEditProducao: podeAqui('editar_producao'),
    canEditEquipamentos: podeAqui('editar_equipamentos'),
    canEditFinanceiro: podeAqui('editar_financeiro'),
  };
}
