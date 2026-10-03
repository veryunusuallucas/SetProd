import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings2, Plus } from 'lucide-react';
import { db } from '../db/db';
import { Janela } from './ui/Janela';
import { confirmar } from './ui/Confirmacao';
import { MODELO_COBRANCA_PADRAO, MODELO_REPASSE_PADRAO, VARIAVEIS_DA_MENSAGEM } from '../lib/mensagensDeAcerto';
import type { Projeto } from '../types';

/**
 * Os ajustes que servem ao Acertos, numa janela aberta de lá.
 *
 * MUDARAM DE LUGAR (pedido do Lucas, 02/10/2026). As mensagens de cobrança e
 * repasse e o modo de diária moravam nas Configurações da produção, longe da
 * tela onde fazem efeito: quem estava cobrando alguém e queria mudar o texto
 * tinha que sair do Financeiro, achar o cartão, salvar e voltar.
 *
 * As variáveis viraram BOTÕES. Antes a tela listava "{{nome}}, {{valor}}..." e
 * a pessoa tinha que digitá-las com as chaves duplas, sem errar uma letra —
 * "{{nome }}" funcionava, "{nome}" saía escrito na mensagem. Agora um toque
 * põe a variável onde o cursor está.
 */
export function AjustesDosAcertos({ projetoId, aoFechar }: { projetoId: string; aoFechar: () => void }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  // `?? null`: sem isto, "ainda carregando" e "nunca salvou mensagem" são o
  // mesmo `undefined`, e a janela ficaria em "Carregando..." para sempre.
  const configuracao = useLiveQuery(async () => (await db.configuracoes.get(projetoId)) ?? null, [projetoId]);

  const [cobranca, setCobranca] = useState<string | null>(null);
  const [repasse, setRepasse] = useState<string | null>(null);
  const [modoDiaria, setModoDiaria] = useState<Projeto['modo_diaria'] | null>(null);
  const original = useRef<string>('');

  // Preenche uma vez, quando os dados chegam — depois o que vale é o que a
  // pessoa digitou, mesmo que o banco atualize por baixo.
  useEffect(() => {
    if (cobranca !== null || configuracao === undefined || !projeto) return;
    const c = configuracao?.template_cobranca || MODELO_COBRANCA_PADRAO;
    const r = configuracao?.template_pagamento || MODELO_REPASSE_PADRAO;
    const m = projeto.modo_diaria || 'automatico';
    setCobranca(c); setRepasse(r); setModoDiaria(m);
    original.current = JSON.stringify([c, r, m]);
  }, [configuracao, projeto, cobranca]);

  const mudou = cobranca !== null && JSON.stringify([cobranca, repasse, modoDiaria]) !== original.current;

  const fechar = async () => {
    if (mudou && !(await confirmar({ titulo: 'Descartar as mudanças?', detalhe: 'O que você mudou nas mensagens e no modo de diária não foi salvo.', confirmar: 'Descartar', perigo: true }))) return;
    aoFechar();
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cobranca === null || !projeto) return;
    await db.configuracoes.put({
      id: projetoId,
      projeto_id: projetoId,
      template_cobranca: cobranca,
      template_pagamento: repasse || '',
      template_geral: configuracao?.template_geral || '',
    });
    if ((projeto.modo_diaria || 'automatico') !== modoDiaria) {
      await db.projetos.update(projetoId, { modo_diaria: modoDiaria || 'automatico' });
    }
    aoFechar();
  };

  return (
    <Janela
      titulo="Ajustes dos acertos"
      icone={<Settings2 size={18} />}
      aoFechar={fechar}
      largura="620px"
      fecharClicandoFora={false}
      rodape={
        <button type="submit" form="form-ajustes-acertos" className="btn-primary" style={{ width: '100%' }} disabled={cobranca === null}>
          Salvar
        </button>
      }
    >
      {cobranca === null ? (
        <div className="text-sm text-muted">Carregando...</div>
      ) : (
        <form id="form-ajustes-acertos" onSubmit={salvar} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          <section style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ margin: 0 }}>Mensagens</h3>
              <p className="text-xs text-muted" style={{ margin: '4px 0 0', lineHeight: 1.5 }}>
                O texto que o app monta quando você gera a mensagem de alguém. Toque num botão para pôr a informação onde está o cursor. Na hora de enviar, ainda dá para ajustar a mensagem de cada pessoa sem mudar o modelo.
              </p>
            </div>
            <CampoDeMensagem rotulo="Cobrança — quem deve à produção" valor={cobranca} aoMudar={setCobranca} padrao={MODELO_COBRANCA_PADRAO} />
            <CampoDeMensagem rotulo="Repasse — quem a produção vai pagar" valor={repasse || ''} aoMudar={setRepasse} padrao={MODELO_REPASSE_PADRAO} />
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ margin: 0 }}>Modo de diária</h3>
              <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>Como uma despesa nova escolhe a diária.</p>
            </div>
            {([
              ['automatico', 'Automático', 'A despesa nova já vem na diária atual da produção.'],
              ['manual', 'Manual / antecipado', 'Você escolhe a diária de cada gasto — serve para preparar diárias futuras.'],
            ] as const).map(([id, nome, ajuda]) => (
              <label
                key={id}
                className="checkbox-label"
                style={{ padding: '12px 14px', border: `1px solid ${modoDiaria === id ? 'var(--accent)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', backgroundColor: modoDiaria === id ? 'var(--bg-active)' : 'transparent', cursor: 'pointer' }}
              >
                <input type="radio" name="modo-diaria" checked={modoDiaria === id} onChange={() => setModoDiaria(id)} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="font-bold">{nome}</span>
                  <span className="text-xs text-muted">{ajuda}</span>
                </div>
              </label>
            ))}
          </section>
        </form>
      )}
    </Janela>
  );
}

/** Um modelo de mensagem com os botões das variáveis em cima. */
function CampoDeMensagem({ rotulo, valor, aoMudar, padrao }: {
  rotulo: string; valor: string; aoMudar: (v: string) => void; padrao: string;
}) {
  const campo = useRef<HTMLTextAreaElement>(null);

  const inserir = (chave: string) => {
    const el = campo.current;
    const marca = `{{${chave}}}`;
    // Sem cursor no campo, a variável entra no fim.
    let ini = el?.selectionStart ?? valor.length;
    let fim = el?.selectionEnd ?? valor.length;
    // Cursor no meio de outra variável ("{{no|me}}"): entra depois dela, senão
    // as duas quebram e saem escritas na mensagem.
    for (const m of valor.matchAll(/\{\{[^}]*\}\}/g)) {
      const a = m.index!, b = a + m[0].length;
      if (ini > a && ini < b) { ini = fim = b; break; }
    }
    aoMudar(valor.slice(0, ini) + marca + valor.slice(fim));
    // O cursor fica logo depois do que entrou, para dar para seguir digitando.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(ini + marca.length, ini + marca.length);
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
        <label className="text-xs text-secondary font-bold uppercase tracking-widest">{rotulo}</label>
        {valor !== padrao && (
          <button type="button" className="text-xs" onClick={() => aoMudar(padrao)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
            Voltar ao padrão
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {VARIAVEIS_DA_MENSAGEM.map(v => (
          <button
            key={v.chave}
            type="button"
            // mousedown sem foco: o campo não perde a posição do cursor antes do clique.
            onMouseDown={e => e.preventDefault()}
            onClick={() => inserir(v.chave)}
            className="text-xs"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <Plus size={12} className="text-accent" /> {v.rotulo}
          </button>
        ))}
      </div>
      <textarea ref={campo} value={valor} onChange={e => aoMudar(e.target.value)} rows={4} style={{ width: '100%' }} />
    </div>
  );
}
