import { useEffect, useState } from 'react';
import { ShieldCheck, RotateCw, UserCheck } from 'lucide-react';
import { db } from '../db/db';
import { membrosDoProjeto, participacaoLocal, sincronizarParticipacoes, type Participacao, type PapelMembro } from '../lib/membros';
import { DESCRICAO } from '../lib/permissoes';

/**
 * O que mudou no MEU acesso, e o que está esperando quem administra.
 *
 * POR QUE NÃO É O SINO
 * `notificacoes` é do aparelho: não sincroniza (ver `db.ts`). Serve para avisar
 * quem está ali, na hora. Nada que precise atravessar de uma conta para outra
 * pode morar nele — e era o caso de três avisos que faltavam:
 *
 *   1. quem administra não ficava sabendo que alguém pediu uma ficha;
 *   2. quem pediu não ficava sabendo que foi confirmado ou recusado;
 *   3. quem teve o papel trocado continuava com a tela do papel antigo, porque
 *      as telas leem o papel uma vez, na montagem.
 *
 * Tudo aqui sai do servidor (`projeto_membros`), que é onde essas três coisas
 * realmente acontecem. A leitura pega carona no mesmo "voltou para a aba" que o
 * ProjectLayout já usa.
 */

/** O que este aparelho viu por último, para saber o que MUDOU. */
const CHAVE = 'setprod:acesso:';
type Visto = { papel?: string; pedido?: string | null; perfil?: string | null };

function lerVisto(projetoId: string): Visto {
  try { return JSON.parse(localStorage.getItem(CHAVE + projetoId) || '{}'); } catch { return {}; }
}
function gravarVisto(projetoId: string, v: Visto) {
  try { localStorage.setItem(CHAVE + projetoId, JSON.stringify(v)); } catch { /* aba privada */ }
}

const nomeDoPapel = (p?: string) => (p && DESCRICAO[p as PapelMembro]?.nome) || p || '—';

/**
 * `aoAbrirAcesso` abre a janela "Quem tem acesso", que mora no ProjectLayout:
 * navegar para a tela da produção não abria nada, porque ela é uma janela e
 * não uma rota.
 */
export function AvisoDeAcesso({ projetoId, aoAbrirAcesso }: { projetoId: string; aoAbrirAcesso: () => void }) {
  const [recado, setRecado] = useState<{ texto: string; recarregar?: boolean } | null>(null);
  const [pedidos, setPedidos] = useState<{ quem: string; ficha: string }[]>([]);

  useEffect(() => {
    let vivo = true;

    const conferir = async () => {
      const eu = participacaoLocal(projetoId);
      if (!eu || !vivo) return;

      const visto = lerVisto(projetoId);
      const agora: Visto = { papel: eu.papel, pedido: eu.perfil_pedido ?? null, perfil: eu.perfil_id ?? null };

      // 1. Meu papel mudou enquanto eu estava com o app aberto.
      if (visto.papel && visto.papel !== agora.papel) {
        setRecado({
          texto: `Seu acesso mudou: de ${nomeDoPapel(visto.papel)} para ${nomeDoPapel(agora.papel)}.`,
          recarregar: true,
        });
      } else if (visto.pedido && !agora.pedido) {
        // 2. O pedido de ficha foi respondido.
        const ficha = agora.perfil === visto.pedido
          ? await db.perfis.get(visto.pedido)
          : undefined;
        setRecado(
          agora.perfil === visto.pedido
            ? { texto: `Seu pedido foi confirmado: você é ${`${ficha?.nome || ''} ${ficha?.sobrenome || ''}`.trim() || 'a ficha que pediu'} nesta produção.`, recarregar: true }
            : { texto: 'Quem administra não confirmou o seu pedido de ficha. Fale com a produção se achar que é engano.' }
        );
      }

      gravarVisto(projetoId, agora);

      // 3. Para quem administra: os pedidos esperando resposta.
      if (eu.papel === 'dono' || eu.papel === 'admin') {
        try {
          const todos = await membrosDoProjeto(projetoId);
          const esperando = todos.filter((m: Participacao) => m.perfil_pedido);
          const nomes = await Promise.all(esperando.map(async m => ({
            quem: (await db.perfis.get(m.perfil_id || '') )?.nome || m.apelido || 'Alguém',
            ficha: (await db.perfis.get(m.perfil_pedido!))?.nome || 'uma ficha',
          })));
          if (vivo) setPedidos(nomes);
        } catch { /* sem rede: fica para a próxima volta à aba */ }
      }
    };

    conferir();
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') sincronizarParticipacoes().then(conferir).catch(() => {});
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('setprod-participacoes', conferir);
    return () => {
      vivo = false;
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('setprod-participacoes', conferir);
    };
  }, [projetoId]);

  if (!recado && pedidos.length === 0) return null;

  const faixa: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
    padding: '12px 16px', margin: '0 0 16px', borderRadius: '12px',
    background: 'var(--color-warning-bg)',
    border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
  };

  return (
    <>
      {recado && (
        <div style={faixa}>
          <ShieldCheck size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div className="text-sm" style={{ flex: 1, minWidth: '200px', lineHeight: 1.45 }}>
            {recado.texto}
            {recado.recarregar && ' Atualize a página para as telas acompanharem.'}
          </div>
          {recado.recarregar && (
            <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ flexShrink: 0 }}>
              <RotateCw size={14} style={{ marginRight: '6px' }} /> Atualizar
            </button>
          )}
          <button
            onClick={() => setRecado(null)}
            className="text-xs"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            agora não
          </button>
        </div>
      )}

      {pedidos.length > 0 && (
        <div style={faixa}>
          <UserCheck size={18} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div className="text-sm" style={{ flex: 1, minWidth: '200px', lineHeight: 1.45 }}>
            {pedidos.length === 1
              ? <>{pedidos[0].quem} pediu para ser <strong>{pedidos[0].ficha}</strong> nesta produção.</>
              : <>{pedidos.length} pessoas pediram para ser uma ficha da equipe.</>}
            {' '}Confirmar libera os dados protegidos daquela ficha.
          </div>
          <button className="btn btn-primary" onClick={aoAbrirAcesso} style={{ flexShrink: 0 }}>
            Ver em Quem tem acesso
          </button>
        </div>
      )}
    </>
  );
}
