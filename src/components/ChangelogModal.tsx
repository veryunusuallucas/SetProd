import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { MOLA } from './ui/ia';
import { useOrigemAncorada } from './ui/origemAncorada';
import { VERSOES, ETIQUETA, itensDa, type Grupo, type Item, type Versao } from '../lib/novidades';

/**
 * As novidades da versão.
 *
 * O CONTEÚDO NÃO MORA AQUI. Ele está em `src/lib/novidades.tsx`, e a razão é
 * prática: enquanto o texto vivia no meio deste JSX, acrescentar uma linha
 * significava editar código de layout. Correção pequena não paga esse preço, e
 * changelog que custa caro por item simplesmente para de ser escrito.
 *
 * Três decisões de leitura que vieram da versão anterior e continuam valendo:
 *
 *   AGRUPADO POR ASSUNTO, nas versões grandes. Ninguém guarda dezesseis
 *   novidades soltas, mas guarda "mexeram em contas, no set e no dinheiro" e
 *   sabe onde procurar depois. Versão pequena não agrupa — dois itens em
 *   categoria é burocracia.
 *
 *   ETIQUETADO. "Novo" e "Consertado" são coisas diferentes e a pessoa lê cada
 *   um com uma expectativa: um é o que ela ganhou, o outro é aquilo que ela
 *   estranhou e achou que era ela. Misturar os dois esconde os dois.
 *
 *   RECOLHIDO POR PADRÃO, menos o primeiro. Sete parágrafos abertos afastam;
 *   sete títulos convidam.
 *
 * E a versão anterior fica listada embaixo, fechada. Quem pulou duas versões
 * não fica sem saber o que mudou só porque não abriu o app naquele dia.
 */

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  // Cresce do selo da versão que a abriu, e não do centro da tela.
  const ancora = useOrigemAncorada();
  const atual = VERSOES[0];
  const anteriores = VERSOES.slice(1);

  // Chave de "o que está aberto" para grupos e para versões antigas, no mesmo
  // conjunto: os ids não colidem porque os das versões levam prefixo.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(atual.grupos?.length ? [atual.grupos[0].id] : [])
  );

  const alternar = (id: string) => setAbertos(a => {
    const p = new Set(a);
    if (p.has(id)) p.delete(id); else p.add(id);
    return p;
  });

  const itens = itensDa(atual);
  const totalNovo = itens.filter(i => i.tipo === 'novo').length;
  const totalCorrigido = itens.filter(i => i.tipo === 'corrigido').length;
  const totalMelhor = itens.filter(i => i.tipo === 'melhor').length;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        ref={ancora}
        className="card"
        style={{ width: '100%', maxWidth: '620px', maxHeight: '86vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Cabeçalho */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={18} color="var(--accent)" />
                <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v{atual.versao}</h2>
              </div>
              {atual.resumo && (
                <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>{atual.resumo}</p>
              )}
            </div>
            <button onClick={onClose} className="btn-icon" aria-label="Fechar"><X size={20} /></button>
          </div>

          {/* Placar: dá a dimensão da versão antes de ler qualquer item. */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            {totalNovo > 0 && <Selo cor={ETIQUETA.novo.cor} fundo={ETIQUETA.novo.fundo} texto={`${totalNovo} novidades`} />}
            {totalCorrigido > 0 && <Selo cor={ETIQUETA.corrigido.cor} fundo={ETIQUETA.corrigido.fundo} texto={`${totalCorrigido} consertos`} />}
            {totalMelhor > 0 && <Selo cor={ETIQUETA.melhor.cor} fundo={ETIQUETA.melhor.fundo} texto={`${totalMelhor} melhorias`} />}
          </div>
        </div>

        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* A versão atual: agrupada, se ela tiver grupos. */}
          {atual.grupos?.map(grupo => (
            <CartaoGrupo
              key={grupo.id}
              grupo={grupo}
              aberto={abertos.has(grupo.id)}
              aoAlternar={() => alternar(grupo.id)}
            />
          ))}

          {/* Ou solta, que é o caso das correções pequenas. */}
          {!atual.grupos?.length && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px 2px' }}>
              {(atual.itens ?? []).map(item => (
                <LinhaItem key={item.titulo} item={item} cor="var(--accent)" />
              ))}
            </div>
          )}

          {/* As anteriores, fechadas. */}
          {anteriores.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">Versões anteriores</div>
              {anteriores.map(v => (
                <CartaoVersao
                  key={v.versao}
                  versao={v}
                  aberto={abertos.has(`v:${v.versao}`)}
                  aoAlternar={() => alternar(`v:${v.versao}`)}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary">Incrível! Entendido.</button>
        </div>
      </motion.div>
    </div>
  );
}

/*
  `flexShrink: 0` NÃO É ENFEITE — SEM ELE O MODAL NÃO ROLA.

  O pai é uma coluna flex com `overflow-y: auto`. Nessa combinação, item de flex
  ENCOLHE antes de transbordar: em vez de o conteúdo passar do fundo e virar
  barra de rolagem, os cartões se espremem para caber. O contêiner então mede que
  cabe tudo e não oferece rolagem nenhuma — e o que sobra é cortado aqui mesmo,
  pelo `overflow: hidden` que existe só para o conteúdo respeitar o canto
  arredondado.

  Normalmente o `min-height: auto` do flex impede esse encolhimento. Mas ele vale
  só para item com `overflow: visible`; qualquer outro valor faz o mínimo
  automático virar zero. O arredondamento da borda, portanto, foi o que autorizou
  o card a encolher — por isso o defeito não parecia ter relação com layout.
*/
const CARTAO: React.CSSProperties = {
  borderRadius: '14px', overflow: 'hidden', flexShrink: 0,
  border: '1px solid var(--border-light)',
  backgroundColor: 'var(--bg-primary)',
};

function CartaoGrupo({ grupo, aberto, aoAlternar }: { grupo: Grupo; aberto: boolean; aoAlternar: () => void }) {
  return (
    <div style={{ ...CARTAO, borderLeft: `3px solid ${grupo.cor}` }}>
      <button
        onClick={aoAlternar}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '14px 16px', background: 'transparent', border: 'none',
          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="font-bold text-sm">{grupo.titulo}</div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.45, marginTop: '2px' }}>{grupo.resumo}</div>
        </div>
        <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
          {aberto ? '−' : `+${grupo.itens.length}`}
        </span>
      </button>

      <Sanfona aberto={aberto}>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {grupo.itens.map(item => <LinhaItem key={item.titulo} item={item} cor={grupo.cor} />)}
        </div>
      </Sanfona>
    </div>
  );
}

function CartaoVersao({ versao, aberto, aoAlternar }: { versao: Versao; aberto: boolean; aoAlternar: () => void }) {
  const itens = itensDa(versao);
  return (
    <div style={CARTAO}>
      <button
        onClick={aoAlternar}
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          padding: '12px 16px', background: 'transparent', border: 'none',
          color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px',
        }}
      >
        <div className="font-bold text-sm" style={{ flex: 1, minWidth: 0 }}>v{versao.versao}</div>
        <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
          {aberto ? '−' : `+${itens.length}`}
        </span>
      </button>

      <Sanfona aberto={aberto}>
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {itens.map(item => <LinhaItem key={item.titulo} item={item} cor="var(--text-muted)" />)}
        </div>
      </Sanfona>
    </div>
  );
}

function Sanfona({ aberto, children }: { aberto: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {aberto && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LinhaItem({ item, cor }: { item: Item; cor: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ flexShrink: 0, color: cor, marginTop: '2px' }}>{item.icone}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
          <span className="font-bold text-sm">{item.titulo}</span>
          <Selo cor={ETIQUETA[item.tipo].cor} fundo={ETIQUETA[item.tipo].fundo} texto={ETIQUETA[item.tipo].texto} />
        </div>
        <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>{item.texto}</div>
      </div>
    </div>
  );
}

function Selo({ cor, fundo, texto }: { cor: string; fundo: string; texto: string }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: '20px',
      color: cor, backgroundColor: fundo, border: `1px solid ${cor}33`,
      whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  );
}
