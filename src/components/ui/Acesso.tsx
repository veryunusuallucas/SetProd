import { createContext, useContext, useState } from 'react';
import { Lock, Send, Check } from 'lucide-react';
import { useAcesso } from '../../hooks/useAcesso';
import { useRole } from '../../hooks/useRole';
import { logAction } from '../../lib/audit';
import { DESCRICAO } from '../../lib/permissoes';
import { SoQuemPode } from './SoQuemPode';

/**
 * O acesso na tela, num lugar só (PLANO-acesso-na-tela, itens 1 a 3).
 *
 * POR QUE UM COMPONENTE, E NÃO UM `if` EM CADA TELA
 * A regra já tem dono único — `escopo.ts`, lido por `useAcesso()`. O que estava
 * espalhado era a TRADUÇÃO dela em tela: sete páginas decidindo à mão se
 * escondem o botão, se explicam o motivo e onde colocam o aviso. É assim que uma
 * regra muda em seis telas e fica esquecida na sétima.
 *
 * Três estados moram aqui (o quarto, "oculto", é só não renderizar):
 *
 *   normal      → `ModoLeitura` deixa passar, nada aparece
 *   só leitura  → faixa no topo, e os `SeEdita` somem
 *   bloqueado   → `AreaProtegida` troca o conteúdo pelo cadeado e o caminho
 */

interface Modo {
  somenteLeitura: boolean;
  /** A frase de `escopo.ts`. Vazia quando dá para editar. */
  motivo: string;
}

const CtxModo = createContext<Modo>({ somenteLeitura: false, motivo: '' });

/** Para quem precisa do booleano na mão. Dentro do JSX, prefira `SeEdita`. */
export function useEdicao(): Modo {
  return useContext(CtxModo);
}

/**
 * Envolve uma página. Calcula o acesso UMA vez, mostra a faixa e publica o modo.
 *
 * `registro` é opcional: sem ele, a pergunta é "posso editar coisas desta tabela
 * em geral?" — que é o que uma página inteira quer saber. A tela que edita um
 * registro específico (a task de outro departamento) continua perguntando com o
 * registro na mão.
 */
export function ModoLeitura({
  tabela, registro, children, faixa = true, complemento,
}: {
  tabela: string;
  registro?: object;
  children: React.ReactNode;
  /** `false` quando a página já tem um aviso próprio no lugar certo. */
  faixa?: boolean;
  /** Uma frase a mais depois do motivo: "Aqui você acompanha." */
  complemento?: string;
}) {
  const { podeEscrever, motivo } = useAcesso();
  const pode = podeEscrever(tabela, registro);
  const frase = pode ? '' : motivo(tabela, registro);

  return (
    <CtxModo.Provider value={{ somenteLeitura: !pode, motivo: frase }}>
      {!pode && faixa && (
        <SoQuemPode
          motivo={`Somente leitura. ${frase}${complemento ? ` ${complemento}` : ''}`}
          style={{ marginBottom: '16px' }}
        />
      )}
      {children}
    </CtxModo.Provider>
  );
}

/**
 * O botão que só existe para quem pode editar.
 *
 * Some, não fica cinza: botão desabilitado sem explicação vira pergunta no grupo
 * da produção, e vinte deles numa tela viram ruído. Quem explica é a faixa, uma
 * vez, no topo.
 */
export function SeEdita({ children }: { children: React.ReactNode }) {
  const { somenteLeitura } = useEdicao();
  return somenteLeitura ? null : <>{children}</>;
}

/**
 * A seção inteira que o papel não alcança: a página abre, o conteúdo não.
 *
 * ⚠️ O BLOQUEIO AQUI É VISUAL. O app espelha a produção inteira no aparelho e a
 * leitura no servidor é por produção, não por papel — então o dado já está no
 * banco local de quem é 'leitura'. Para ser bloqueio de verdade, o financeiro
 * teria de sair da linha comum e virar camada com política própria, como
 * `perfis_restritos` (ver `ideias-futuras.md`). Não finja o que não é.
 */
export function AreaProtegida({
  titulo, children, projetoId,
}: {
  /** O nome da área, do jeito que a pessoa chama: "Financeiro". */
  titulo: string;
  children: React.ReactNode;
  /** Necessário para o pedido de acesso entrar na ata. */
  projetoId?: string;
}) {
  const { podeVer, motivo } = useAcessoDaArea();
  if (podeVer) return <>{children}</>;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
      padding: '48px 24px', textAlign: 'center',
    }}>
      <Lock size={28} style={{ color: 'var(--color-warning)' }} />
      <h2 style={{ margin: 0, fontSize: '18px' }}>{titulo}</h2>
      <p className="text-sm text-secondary" style={{ margin: 0, maxWidth: '420px', lineHeight: 1.5 }}>
        {motivo}
      </p>
      {projetoId && <PedirAcesso projetoId={projetoId} area={titulo} />}
    </div>
  );
}

/**
 * Quem VÊ uma área. Hoje só `leitura` fica de fora do que é restrito: quem é
 * equipe acompanha o dinheiro da produção sem poder lançar, e é assim que uma
 * produção funciona — o assistente confere a diária dele.
 */
function useAcessoDaArea(): { podeVer: boolean; motivo: string } {
  const { role } = useRole();
  if (role !== 'leitura') return { podeVer: true, motivo: '' };
  return {
    podeVer: false,
    motivo: `Esta área é da produção. Seu acesso nesta produção é ${DESCRICAO.leitura.nome.toLowerCase()} — você acompanha o trabalho, sem abrir o que é da administração.`,
  };
}

/**
 * "Pedir acesso", pela ata.
 *
 * O sino (`notificacoes`) não serve: é do aparelho e não sincroniza, então o
 * pedido morreria no celular de quem pediu. A ata sobe, não se apaga, e é onde
 * quem administra já olha — e o `AvisoDeAcesso` mostra o pedido na tela dela.
 */
function PedirAcesso({ projetoId, area }: { projetoId: string; area: string }) {
  const { role, apelido } = useRole();
  const [estado, setEstado] = useState<'parado' | 'indo' | 'feito'>('parado');

  const pedir = async () => {
    setEstado('indo');
    await logAction(projetoId, 'editar', 'acesso', 'pedido',
      `${apelido || 'Alguém'} pediu acesso a ${area} (hoje: ${DESCRICAO[role as 'leitura']?.nome ?? role}).`);
    setEstado('feito');
  };

  if (estado === 'feito') {
    return (
      <p className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success, #4ade80)' }}>
        <Check size={16} /> Pedido enviado. Quem administra a produção vê na tela e na ata.
      </p>
    );
  }

  return (
    <button className="btn btn-primary" onClick={pedir} disabled={estado === 'indo'}>
      <Send size={14} style={{ marginRight: '6px' }} /> Pedir acesso a quem administra
    </button>
  );
}
