import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Car, ChevronDown, Home, MapPin, Plus, Trash2, Users, Utensils } from 'lucide-react';
import { db } from '../db/db';
import { CampoTexto } from './ui/CampoTexto';
import { cenasDoElemento, normalizarCategoria } from '../lib/decupagem';
import { montarLinhaDoDia } from '../lib/linhaDoDia';
import type { Diaria, HorarioElenco, VeiculoDeCena } from '../types';

/**
 * O que só a Ordem do Dia pergunta.
 *
 * Os blocos que o modelo do set exige e que o resto do app não guarda: o
 * ponto de encontro, as BASES (onde a equipe come e troca de roupa), os
 * HORÁRIOS DO ELENCO, as refeições a pedir e os VEÍCULOS DE CENA.
 *
 * ⚠️ FECHADO POR PADRÃO, E ISSO É PARTE DO DESENHO. Nada aqui é obrigatório:
 * quem não preencher continua com uma OD inteira — o bloco simplesmente não é
 * impresso. Aberto por padrão, ele viraria mais um formulário em branco
 * cobrando atenção numa tela que já é densa.
 */

/** As bases do modelo do set, na ordem dele: é o que a equipe procura no papel. */
const BASES_SUGERIDAS = ['Café da manhã', 'Almoço', 'Camarim figurino', 'Camarim make', 'Base de produção e direção'];

const HORARIOS_ELENCO: { campo: keyof HorarioElenco; rotulo: string }[] = [
  { campo: 'chegada', rotulo: 'Chegada' },
  { campo: 'make', rotulo: 'Make' },
  { campo: 'figurino', rotulo: 'Figurino' },
  { campo: 'mic', rotulo: 'Mic' },
  { campo: 'no_set', rotulo: 'No set' },
  { campo: 'fim', rotulo: 'Fim' },
];

export function DadosDaOD({ diaria }: { diaria: Diaria }) {
  const [aberto, setAberto] = useState(false);
  const linha = montarLinhaDoDia(diaria);
  const refeicoesDoDia = linha.filter(i => i.tipo === 'almoco' || i.tipo === 'coffee');

  const cenasDoDia = useLiveQuery(async () => {
    const ids = new Set(linha.filter(i => i.cena_id).map(i => i.cena_id!));
    if (ids.size === 0) return [];
    const todas = await db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray();
    return todas.filter(c => ids.has(c.id));
  }, [diaria.id, diaria.linha_do_tempo, diaria.cena_ids], []);

  /*
    Os personagens do dia saem da decupagem: `Elemento` de categoria ELENCO já
    é o personagem — com número de elenco, apelidos e quem o interpreta. As
    cenas de cada um vêm da mesma conta da OD (`cenasDoElemento`): marcação
    do roteiro ou o nome no texto da cena.
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
    return elenco
      .map(el => {
        const nasCenas = cenasDoElemento(el, tags, cenas);
        for (const c of cenas) if (el.perfil_id && (c.elenco_ids || []).includes(el.perfil_id)) nasCenas.add(c.id);
        const doDia = [...nasCenas].filter(id => idsDeCena.has(id));
        return {
          id: el.id,
          nome: el.nome,
          castId: el.cast_id,
          ator: perfis.find(p => p.id === el.perfil_id),
          cenas: doDia.map(id => cenas.find(c => c.id === id)?.numero).filter(Boolean) as string[],
        };
      })
      .filter(p => p.cenas.length > 0)
      .sort((a, b) => (a.castId ?? 999) - (b.castId ?? 999));
  }, [diaria.id, cenasDoDia], []);

  const gravar = (mudanca: Partial<Diaria>) => db.diarias.update(diaria.id, mudanca);

  const gravarElenco = (personagemId: string, campo: keyof HorarioElenco, valor: string) => {
    const atual = diaria.elenco || {};
    const dele = { ...(atual[personagemId] || {}), [campo]: valor || undefined };
    gravar({ elenco: { ...atual, [personagemId]: dele } });
  };

  /* As bases ficam na ordem do modelo; a linha vazia some do que é gravado. */
  const localDaBase = (rotulo: string) => diaria.bases?.find(b => b.rotulo === rotulo)?.local || '';
  const gravarBase = (rotulo: string, local: string) => {
    const outras = (diaria.bases || []).filter(b => b.rotulo !== rotulo);
    const todas = [...outras, ...(local.trim() ? [{ rotulo, local: local.trim() }] : [])];
    gravar({ bases: BASES_SUGERIDAS.flatMap(r => todas.filter(b => b.rotulo === r)) });
  };

  const gravarRefeicao = (grupo: 'elenco' | 'figuracao', itemId: string, valor: string) => {
    const atual = diaria.refeicoes || {};
    const n = parseInt(valor, 10);
    const doGrupo = { ...(atual[grupo] || {}) };
    if (n > 0) doGrupo[itemId] = n; else delete doGrupo[itemId];
    gravar({ refeicoes: { ...atual, [grupo]: doGrupo } });
  };

  const veiculos = diaria.veiculos_cena || [];
  const gravarVeiculo = (id: string, mudanca: Partial<VeiculoDeCena>) =>
    gravar({ veiculos_cena: veiculos.map(v => (v.id === id ? { ...v, ...mudanca } : v)) });

  const preenchidos = [
    diaria.ponto_encontro,
    diaria.bases?.length || diaria.base?.nome,
    Object.keys(diaria.elenco || {}).length,
    veiculos.length,
  ].filter(Boolean).length;

  const estilo = {
    padding: '5px 7px', fontSize: '13px', width: '100%',
    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  } as const;
  const tituloBloco = { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '6px' } as const;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: aberto ? '18px' : 0, borderLeft: '3px solid var(--cor-set)' }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
          <Home size={15} style={{ color: 'var(--cor-set)' }} /> Dados da OD
        </h2>
        {!aberto && (
          <span className="text-xs text-muted">
            {preenchidos === 0 ? 'ponto, bases, elenco, veículos — opcional' : `${preenchidos} de 4 blocos preenchidos`}
          </span>
        )}
        <ChevronDown size={16} className="text-muted" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {aberto && (
        <>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={tituloBloco}>
              <MapPin size={13} /> Ponto de encontro
            </h3>
            <CampoTexto
              value={diaria.ponto_encontro || ''}
              aoGravar={v => gravar({ ponto_encontro: v.trim() || undefined })}
              placeholder="Saída às 6h · Metrô Vila Madalena (linha verde)"
              style={estilo}
            />
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={tituloBloco}>
              <Home size={13} /> Bases
            </h3>
            <div className="text-xs text-muted" style={{ marginBottom: '6px', lineHeight: 1.5 }}>
              Onde a equipe come e troca de roupa. <b>Não é uma locação</b> — locação é onde se
              filma, e ela conta nas páginas e puxa clima e hospital.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
              {BASES_SUGERIDAS.map(rotulo => (
                <label key={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span className="text-xs text-muted">{rotulo}</span>
                  <CampoTexto value={localDaBase(rotulo)} aoGravar={v => gravarBase(rotulo, v)} placeholder="ex: Prédio 47" style={estilo} />
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={tituloBloco}>
              <Users size={13} /> Horários do elenco
            </h3>

            {(personagens || []).length === 0 ? (
              <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
                Nenhum personagem nas cenas deste dia. Eles aparecem sozinhos quando o nome
                está no texto da cena ou marcado no roteiro (Decupagem). Quem interpreta cada
                um se escolhe em Decupagem → Elementos.
              </div>
            ) : (
              <>
                <CampoTexto
                  value={diaria.aviso_elenco || ''}
                  aoGravar={v => gravar({ aviso_elenco: v.trim() || undefined })}
                  placeholder="Aviso no topo do elenco (ex: 20 minutos de montagem de camarim)"
                  style={{ ...estilo, marginBottom: '8px' }}
                />
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr className="text-xs text-muted uppercase" style={{ textAlign: 'left' }}>
                        <th style={{ padding: '4px 6px 6px 0' }}>Personagem</th>
                        {HORARIOS_ELENCO.map(h => <th key={h.campo} style={{ padding: '4px 6px 6px' }}>{h.rotulo}</th>)}
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
                                {p.ator ? `${p.ator.nome} ${p.ator.sobrenome || ''}`.trim() : 'sem atriz/ator — Decupagem → Elementos'}
                                {p.cenas.length > 0 ? ` · cenas ${p.cenas.join(', ')}` : ''}
                              </div>
                            </td>
                            {HORARIOS_ELENCO.map(({ campo }) => (
                              <td key={campo} style={{ padding: '6px' }}>
                                <input
                                  type="time"
                                  aria-label={`${campo} de ${p.nome}`}
                                  // O "make" mostra o horário antigo de maquiagem e figurino juntos.
                                  value={(campo === 'make' ? h.make || h.maq_fig : h[campo]) || ''}
                                  onChange={e => gravarElenco(p.id, campo, e.target.value)}
                                  style={{ ...estilo, width: '96px' }}
                                />
                              </td>
                            ))}
                            <td style={{ padding: '6px 0 6px 6px' }}>
                              <CampoTexto
                                value={h.obs || ''}
                                aoGravar={v => gravarElenco(p.id, 'obs', v)}
                                placeholder="figurino, make, arte"
                                style={estilo}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {refeicoesDoDia.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={tituloBloco}>
                <Utensils size={13} /> Refeições a pedir
              </h3>
              <div className="text-xs text-muted" style={{ marginBottom: '6px' }}>
                Sai na OD como "Elenco total: 9 = [ Café 5 + Almoço 9 ]".
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `140px repeat(${refeicoesDoDia.length}, minmax(90px, 1fr))`, gap: '6px', alignItems: 'center', overflowX: 'auto' }}>
                <span />
                {refeicoesDoDia.map(r => (
                  <span key={r.id} className="text-xs text-muted">{r.titulo || (r.tipo === 'almoco' ? 'Almoço' : 'Lanche')}</span>
                ))}
                {(['elenco', 'figuracao'] as const).map(grupo => (
                  <div key={grupo} style={{ display: 'contents' }}>
                    <span className="text-sm">{grupo === 'elenco' ? 'Elenco' : 'Figuração'}</span>
                    {refeicoesDoDia.map(r => (
                      <input
                        key={r.id}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`${grupo === 'elenco' ? 'Elenco' : 'Figuração'} · ${r.titulo || r.tipo}`}
                        value={diaria.refeicoes?.[grupo]?.[r.id] ?? ''}
                        onChange={e => gravarRefeicao(grupo, r.id, e.target.value)}
                        style={{ ...estilo, width: '100%' }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={tituloBloco}>
              <Car size={13} /> Veículos de cena
            </h3>
            <div className="text-xs text-muted" style={{ marginBottom: '6px' }}>
              O carro, a moto ou o ônibus que aparece na cena. O transporte da equipe fica no mapa de transporte.
            </div>
            {veiculos.length > 0 && <div style={{ overflowX: 'auto' }}>{veiculos.map(v => (
              <div key={v.id} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0, 2fr) minmax(0, 2fr) 96px minmax(0, 2fr) 96px 32px', gap: '6px', marginBottom: '6px', alignItems: 'center', minWidth: '720px' }}>
                <select value={v.cena || ''} onChange={e => gravarVeiculo(v.id, { cena: e.target.value || undefined })} style={estilo} aria-label="Cena">
                  <option value="">Cena</option>
                  {(cenasDoDia || []).map(c => <option key={c.id} value={c.numero}>{c.numero}</option>)}
                </select>
                <CampoTexto value={v.veiculo} aoGravar={x => gravarVeiculo(v.id, { veiculo: x })} placeholder="Veículo (ex: Honda Fit prata)" style={estilo} />
                <CampoTexto value={v.responsavel || ''} aoGravar={x => gravarVeiculo(v.id, { responsavel: x || undefined })} placeholder="Responsável" style={estilo} />
                <input type="time" aria-label="Chegada" value={v.chegada || ''} onChange={e => gravarVeiculo(v.id, { chegada: e.target.value || undefined })} style={estilo} />
                <CampoTexto value={v.local || ''} aoGravar={x => gravarVeiculo(v.id, { local: x || undefined })} placeholder="Locação ou base" style={estilo} />
                <input type="time" aria-label="Término" value={v.termino || ''} onChange={e => gravarVeiculo(v.id, { termino: e.target.value || undefined })} style={estilo} />
                <button
                  onClick={() => gravar({ veiculos_cena: veiculos.filter(x => x.id !== v.id) })}
                  className="btn-icon text-muted"
                  aria-label="Tirar este veículo"
                  style={{ padding: '6px', border: 'none', background: 'transparent' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}</div>}
            <button
              onClick={() => gravar({ veiculos_cena: [...veiculos, { id: crypto.randomUUID(), veiculo: '' }] })}
              className="btn-chip"
              style={{ fontSize: '12px' }}
            >
              <Plus size={13} /> Veículo de cena
            </button>
          </div>
        </>
      )}
    </div>
  );
}
