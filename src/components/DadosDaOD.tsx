import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, Home, Users } from 'lucide-react';
import { db } from '../db/db';
import { CampoTexto } from './ui/CampoTexto';
import { normalizarCategoria } from '../lib/decupagem';
import { montarLinhaDoDia } from '../lib/linhaDoDia';
import type { Diaria, HorarioElenco } from '../types';

/**
 * O que só a Ordem do Dia pergunta.
 *
 * Dois blocos que o modelo do mercado exige e que o app não tinha onde guardar:
 * a BASE (onde a equipe se concentra e troca de roupa) e os HORÁRIOS DO ELENCO
 * (chegada, maquiagem/figurino, no set, liberado).
 *
 * ⚠️ FECHADO POR PADRÃO, E ISSO É PARTE DO DESENHO. Nenhum dos dois é
 * obrigatório: quem não preencher continua com uma OD inteira — o bloco
 * simplesmente não é impresso. Aberto por padrão, ele viraria mais um formulário
 * em branco cobrando atenção numa tela que já é densa.
 */
export function DadosDaOD({ diaria }: { diaria: Diaria }) {
  const [aberto, setAberto] = useState(false);

  const cenasDoDia = useLiveQuery(async () => {
    const ids = new Set(montarLinhaDoDia(diaria).filter(i => i.cena_id).map(i => i.cena_id!));
    if (ids.size === 0) return [];
    const todas = await db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray();
    return todas.filter(c => ids.has(c.id));
  }, [diaria.id, diaria.linha_do_tempo, diaria.cena_ids], []);

  /*
    Os personagens do dia saem das MARCAÇÕES do roteiro.

    `Elemento` de categoria ELENCO já é o personagem — com número de elenco,
    apelidos ("Renata" também é "sua mulher") e vínculo com o ator cadastrado.
    Não fazia sentido criar uma tabela nova para o que a decupagem já sabe.
  */
  const personagens = useLiveQuery(async () => {
    const idsDeCena = new Set(cenasDoDia?.map(c => c.id) || []);
    if (idsDeCena.size === 0) return [];

    const [elementos, tags, cenas, perfis] = await Promise.all([
      db.elementos.where('projeto_id').equals(diaria.projeto_id).toArray(),
      db.roteiro_tags.where('projeto_id').equals(diaria.projeto_id).toArray(),
      db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray(),
      db.perfis.where('projeto_id').equals(diaria.projeto_id).toArray(),
    ]);

    const elenco = elementos.filter(el => normalizarCategoria(el.categoria) === 'ELENCO');
    const noDia = new Map<string, Set<string>>();
    const marcar = (elId: string, cenaId: string) => {
      if (!idsDeCena.has(cenaId)) return;
      if (!noDia.has(elId)) noDia.set(elId, new Set());
      noDia.get(elId)!.add(cenaId);
    };

    for (const t of tags) if (t.elemento_id && t.cena_id) marcar(t.elemento_id, t.cena_id);
    for (const el of elenco) {
      if (!el.perfil_id) continue;
      for (const c of cenas) if ((c.elenco_ids || []).includes(el.perfil_id)) marcar(el.id, c.id);
    }

    return elenco
      .filter(el => noDia.has(el.id))
      .sort((a, b) => (a.cast_id ?? 999) - (b.cast_id ?? 999))
      .map(el => ({
        id: el.id,
        nome: el.nome,
        castId: el.cast_id,
        ator: perfis.find(p => p.id === el.perfil_id),
        cenas: [...(noDia.get(el.id) || [])]
          .map(id => cenas.find(c => c.id === id)?.numero)
          .filter(Boolean) as string[],
      }));
  }, [diaria.id, cenasDoDia], []);

  const gravarBase = (campo: 'nome' | 'endereco' | 'obs', valor: string) => {
    db.diarias.update(diaria.id, { base: { ...(diaria.base || {}), [campo]: valor || undefined } });
  };

  const gravarElenco = (personagemId: string, campo: keyof HorarioElenco, valor: string) => {
    const atual = diaria.elenco || {};
    const dele = { ...(atual[personagemId] || {}), [campo]: valor || undefined };
    db.diarias.update(diaria.id, { elenco: { ...atual, [personagemId]: dele } });
  };

  const preenchidos = [
    diaria.base?.nome || diaria.base?.endereco ? 'base' : null,
    Object.keys(diaria.elenco || {}).length > 0 ? 'elenco' : null,
  ].filter(Boolean).length;

  const estilo = {
    padding: '5px 7px', fontSize: '13px', width: '100%',
    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)',
    borderRadius: '6px', color: 'var(--text-primary)',
  } as const;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: aberto ? '16px' : 0, borderLeft: '3px solid var(--cor-set)' }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
          <Home size={15} style={{ color: 'var(--cor-set)' }} /> Base e elenco na OD
        </h2>
        {!aberto && (
          <span className="text-xs text-muted">
            {preenchidos === 0 ? 'nada preenchido — opcional' : preenchidos === 2 ? 'base e elenco' : 'preenchido em parte'}
          </span>
        )}
        <ChevronDown size={16} className="text-muted" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {aberto && (
        <>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: '6px', lineHeight: 1.5 }}>
              Onde a equipe se concentra, come e troca de roupa. <b>Não é uma locação</b> —
              locação é onde se filma, e ela conta nas páginas e puxa clima e hospital.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '8px' }}>
              <CampoTexto value={diaria.base?.nome || ''} aoGravar={v => gravarBase('nome', v)} placeholder="Local (ex: Galpão da Rua 7)" style={estilo} />
              <CampoTexto value={diaria.base?.endereco || ''} aoGravar={v => gravarBase('endereco', v)} placeholder="Endereço" style={estilo} />
              <CampoTexto value={diaria.base?.obs || ''} aoGravar={v => gravarBase('obs', v)} placeholder="Observação (ex: portão dos fundos)" style={estilo} />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' }}>
              <Users size={13} /> Horários do elenco
            </h3>

            {(personagens || []).length === 0 ? (
              <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
                Nenhum personagem nas cenas deste dia. Eles aparecem sozinhos quando o
                roteiro é marcado na Decupagem, ou quando o elenco é escolhido na cena.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '620px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr className="text-xs text-muted uppercase" style={{ textAlign: 'left' }}>
                      <th style={{ padding: '4px 6px 6px 0' }}>Personagem</th>
                      <th style={{ padding: '4px 6px 6px' }}>Chegada</th>
                      <th style={{ padding: '4px 6px 6px' }}>Maq/Fig</th>
                      <th style={{ padding: '4px 6px 6px' }}>No set</th>
                      <th style={{ padding: '4px 6px 6px' }}>Fim</th>
                      <th style={{ padding: '4px 0 6px 6px' }}>Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(personagens || []).map(p => {
                      const h = (diaria.elenco || {})[p.id] || {};
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--border-light)' }}>
                          <td style={{ padding: '6px 6px 6px 0' }}>
                            <div className="font-bold">{p.castId !== undefined ? `${p.castId}. ` : ''}{p.nome}</div>
                            <div className="text-xs text-muted">
                              {p.ator ? `${p.ator.nome} ${p.ator.sobrenome || ''}`.trim() : 'sem elenco vinculado'}
                              {p.cenas.length > 0 ? ` · cenas ${p.cenas.join(', ')}` : ''}
                            </div>
                          </td>
                          {(['chegada', 'maq_fig', 'no_set', 'fim'] as const).map(campo => (
                            <td key={campo} style={{ padding: '6px' }}>
                              <input
                                type="time"
                                value={h[campo] || ''}
                                onChange={e => gravarElenco(p.id, campo, e.target.value)}
                                style={{ ...estilo, width: '104px' }}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '6px 0 6px 6px' }}>
                            <CampoTexto
                              value={h.obs || ''}
                              aoGravar={v => gravarElenco(p.id, 'obs', v)}
                              placeholder="figurino, maquiagem, arte"
                              style={estilo}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
