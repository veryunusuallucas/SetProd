import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useRole } from '../hooks/useRole';
import { EscolherMinhaFicha } from './EscolherMinhaFicha';
import { sincronizarParticipacoes } from '../lib/membros';

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
  if (!souMembro || perfilId || dispensado) return null;

  return (
    <>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        padding: '12px 16px', margin: '0 0 16px', borderRadius: '12px',
        backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent)',
      }}>
        <UserCheck size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div className="text-sm font-bold">Diga quem você é nesta produção</div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
            Sem isso, “Minhas Tasks” vem vazia e você não enxerga a sua própria ficha.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setEscolhendo(true)} style={{ flexShrink: 0 }}>
          Escolher
        </button>
        <button
          onClick={() => setDispensado(true)}
          className="text-xs"
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
        >
          agora não
        </button>
      </div>

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
