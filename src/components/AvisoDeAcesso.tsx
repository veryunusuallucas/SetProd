import { useEffect, useState } from 'react';
import { usarAviso, URGENCIA } from './avisos/CentralDeAvisos';
import { FaixaDeAviso } from './avisos/FaixaDeAviso';
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

/** Pedidos de acesso já lidos — a dispensa é deste aparelho, como o resto. */
const CHAVE_LIDOS = 'setprod:acesso:lidos';
function dispensados(): string[] {
  try { return JSON.parse(localStorage.getItem(CHAVE_LIDOS) || '[]'); } catch { return []; }
}
function dispensar(id: string) {
  try { localStorage.setItem(CHAVE_LIDOS, JSON.stringify([...dispensados(), id].slice(-50))); } catch { /* aba privada */ }
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
  /** Pedidos de ACESSO (o botão da área bloqueada), que chegam pela ata. */
  const [pedidosDeAcesso, setPedidosDeAcesso] = useState<string[]>([]);

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
        /*
          Pedido de acesso a uma área (ui/Acesso.tsx) vem pela ATA, e não pelo
          sino: o sino é do aparelho e não sincroniza, então morreria no celular
          de quem pediu. Sete dias é o quanto um pedido ainda é notícia.
        */
        const desde = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const naAta = await db.logs.where('projeto_id').equals(projetoId).toArray();
        const recentes = naAta
          .filter(l => l.entidade === 'acesso' && l.data_hora >= desde && !dispensados().includes(l.id))
          .sort((a, b) => b.data_hora - a.data_hora);
        if (vivo) setPedidosDeAcesso(recentes.map(l => l.id + '|' + l.detalhes));

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

  /*
    Três avisos, três urgências diferentes — e a central decide qual aparece
    primeiro (leva de UI 3). Antes eles saíam empilhados, os três com o mesmo
    fundo âmbar, competindo entre si.
  */
  usarAviso('acesso-recado', URGENCIA.meuAcessoMudou, recado?.texto ?? null, () => (
    <FaixaDeAviso
      icone={<ShieldCheck size={18} />}
      aoDispensar={() => setRecado(null)}
      acao={recado?.recarregar && (
        <button className="btn btn-primary" onClick={() => window.location.reload()} style={{ flexShrink: 0 }}>
          <RotateCw size={14} style={{ marginRight: '6px' }} /> Atualizar
        </button>
      )}
    >
      {recado?.texto}
      {recado?.recarregar && ' Atualize a página para as telas acompanharem.'}
    </FaixaDeAviso>
  ));

  const pedidoDeAcesso = pedidosDeAcesso[0];
  const idDoPedido = pedidoDeAcesso?.slice(0, pedidoDeAcesso.indexOf('|'));
  usarAviso('acesso-pedido', URGENCIA.esperandoPorMim, pedidoDeAcesso ?? null, () => (
    <FaixaDeAviso
      icone={<UserCheck size={18} />}
      acao={<button className="btn btn-primary" onClick={aoAbrirAcesso} style={{ flexShrink: 0 }}>Ver em Quem tem acesso</button>}
      aoDispensar={() => {
        if (!idDoPedido) return;
        dispensar(idDoPedido);
        setPedidosDeAcesso(a => a.filter(l => !l.startsWith(idDoPedido)));
      }}
    >
      {pedidoDeAcesso?.slice(pedidoDeAcesso.indexOf('|') + 1)}
      {pedidosDeAcesso.length > 1 && ` (e mais ${pedidosDeAcesso.length - 1})`}
    </FaixaDeAviso>
  ));

  usarAviso('ficha-pedido', URGENCIA.esperandoPorMim, pedidos.length ? `${pedidos.length}` : null, () => (
    <FaixaDeAviso
      icone={<UserCheck size={18} />}
      acao={<button className="btn btn-primary" onClick={aoAbrirAcesso} style={{ flexShrink: 0 }}>Ver em Quem tem acesso</button>}
    >
      {pedidos.length === 1
        ? <>{pedidos[0].quem} pediu para ser <strong>{pedidos[0].ficha}</strong> nesta produção.</>
        : <>{pedidos.length} pessoas pediram para ser uma ficha da equipe.</>}
      {' '}Confirmar libera os dados protegidos daquela ficha.
    </FaixaDeAviso>
  ));

  // Quem desenha é a central; aqui só se publica.
  return null;
}
