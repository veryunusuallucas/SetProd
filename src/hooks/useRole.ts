import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { participacaoLocal, type PapelMembro } from '../lib/membros';

export type Role = PapelMembro | 'desconhecido';

/**
 * O que eu posso fazer neste projeto.
 *
 * Antes isto era um dropdown de simulação no rodapé da sidebar: a pessoa
 * escolhia "sou da fotografia" e o app acreditava. Agora vem da participação
 * real, que mora no servidor com RLS por cima.
 *
 * SOBRE FALHAR ABRINDO
 * Quando não dá para saber o papel — sem internet, sem Supabase configurado, ou
 * um projeto que só existe neste navegador e nunca foi compartilhado — o hook
 * libera tudo, em vez de trancar.
 *
 * Isso é decisão consciente, não descuido. O que realmente protege dado
 * compartilhado é a RLS do Postgres: sem participação, o servidor não entrega
 * nem aceita nada, aconteça o que acontecer no cliente. Travar aqui não
 * protegeria nada e trancaria a pessoa para fora do trabalho dela no avião.
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

  // A e B são do mesmo nível — é o desenho da spec, e não um esquecimento.
  // 'leitura' existe para o dia em que precisar limitar alguém.
  const podeEditar = role !== 'leitura';

  return {
    role,
    perfilId,
    apelido: participacao?.apelido ?? '',
    souMembro: Boolean(participacao),
    canEditProducao: podeEditar,
    canEditEquipamentos: podeEditar,
    canEditFinanceiro: podeEditar,
  };
}
