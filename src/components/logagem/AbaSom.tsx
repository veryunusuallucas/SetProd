import { Fragment, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Mic, Wind, Volume2, Trash2, Plus, X, SlidersHorizontal, Users } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, Som } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { confirmar } from '../ui/Confirmacao';
import { Campo, Escolha, MONO, Rotulo, Segmentado, SeletorComOutro, estiloCampo } from './pecas';
import { garantirEstado, idDoEstado, mudarEstado, PADRAO } from '../../lib/logagem/estado';
import {
  MARCAS, NOTAS_DE_TRILHA, OPCOES_DO_GRAVADOR, kitLegivel, ROTULO_DO_TIPO, alternarNota, apagarSom, arquivoDoSom, mudarSom, ordenarSons,
  registrarSom, resumoDoSom, somJunto, trechosDoSom, trilhasDoSom,
} from '../../lib/logagem/som';
import { cenasDoElemento, normalizarCategoria } from '../../lib/decupagem';

/**
 * Aba Som: o sound report sendo preenchido (11/10/2026).
 *
 * O desenho é o do papel do som e dos apps de gravador: uma linha por arquivo,
 * uma coluna por trilha com o nome no topo, e as marcas que a montagem lê. O
 * take de câmera cria a linha sozinho (a ficha 🎙 do painel do take); aqui se
 * loga o que é só som e se anota o que cada trilha teve.
 */
/** O estado da Logagem da diária (onde mora o kit de som), criado se ainda não existe. */
function useEstado(projetoId: string, diariaId: string, podeEditar: boolean, departamentoId?: string) {
  const estadoSalvo = useLiveQuery(() => db.log_estado.get(idDoEstado(diariaId)), [diariaId]);
  useEffect(() => {
    if (podeEditar && estadoSalvo === undefined) void garantirEstado(projetoId, diariaId, departamentoId);
  }, [podeEditar, estadoSalvo, projetoId, diariaId, departamentoId]);
  const estado: EstadoDaLogagem = estadoSalvo ?? { ...PADRAO, id: idDoEstado(diariaId), projeto_id: projetoId, diaria_id: diariaId };
  const mudar = (m: Partial<EstadoDaLogagem>) => { if (podeEditar) void mudarEstado(diariaId, m); };
  return { estado, mudar };
}

export function AbaSom({ projetoId, diariaId, podeEditar, departamentoId, quem, aoAbrirGravador }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  quem?: string;
  /** Leva à aba Gravador, onde mora o kit. */
  aoAbrirGravador: () => void;
}) {
  const { estado, mudar } = useEstado(projetoId, diariaId, podeEditar, departamentoId);
  const sons = useLiveQuery(() => db.log_som.where('diaria_id').equals(diariaId).toArray(), [diariaId]) ?? [];
  const bloqueado = !podeEditar;

  const avulso = (tipo: Som['tipo']) => {
    if (!podeEditar) return;
    void (async () => {
      // Do banco: o arquivo pode ter acabado de andar com um take.
      const atual = (await db.log_estado.get(idDoEstado(diariaId))) ?? estado;
      await registrarSom(atual, tipo, quem);
    })();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 22px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <Rotulo icone={<Mic size={14} />}>Só som</Rotulo>
          <span className="text-xs text-muted">
            Próximo: <b style={{ fontFamily: MONO, color: 'var(--text-primary)' }}>{arquivoDoSom(estado)}</b> · Cena {estado.cena}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
          {([['wild', Wind], ['room_tone', Volume2]] as const).map(([tipo, Icone]) => (
            <BotaoTatil
              key={tipo}
              onClick={() => avulso(tipo)}
              disabled={bloqueado}
              escala={0.97}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '64px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 800, fontSize: '16px',
                cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? 0.5 : 1,
              }}
            >
              <Icone size={20} /> {ROTULO_DO_TIPO[tipo]}
            </BotaoTatil>
          ))}
        </div>
        <Segmentado
          nome="logagem-som-junto"
          opcoes={[{ id: 'junto', nome: 'Take leva som' }, { id: 'sem', nome: 'Câmera sem som' }]}
          valor={somJunto(estado) ? 'junto' : 'sem'}
          bloqueado={bloqueado}
          aoMudar={v => mudar({ som_junto: v === 'junto' })}
        />
      </section>

      <GradeDoSom sons={sons} podeEditar={podeEditar} />

      {/* O kit em uma linha, para conferir sem sair daqui; mexer nele é na aba Gravador. */}
      <button
        type="button"
        onClick={aoAbrirGravador}
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minHeight: '56px', padding: '12px 18px', textAlign: 'left', cursor: 'pointer', color: 'var(--text-secondary)' }}
      >
        <SlidersHorizontal size={16} style={{ color: 'var(--cor-criativo)', flexShrink: 0 }} />
        <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
          {[kitLegivel(estado) || 'Gravador não informado', estado.rolo_som && `Rolo ${estado.rolo_som}`, trilhasDoSom(estado).join(' · ')].filter(Boolean).join('  ·  ')}
        </span>
        <span className="text-xs text-muted">ajustar em Gravador</span>
      </button>
    </div>
  );
}

/** Aba Gravador: o equipamento de som e as trilhas — o "kit de câmera" do som. */
export function AbaGravador({ projetoId, diariaId, podeEditar, departamentoId }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
}) {
  const { estado, mudar } = useEstado(projetoId, diariaId, podeEditar, departamentoId);
  return <KitDoSom estado={estado} bloqueado={!podeEditar} mudar={mudar} projetoId={projetoId} />;
}

/* ───────────────────────── A grade ───────────────────────── */

type Celula = { id: string; trilha: number } | null; // trilha -1 = observação

function GradeDoSom({ sons, podeEditar }: { sons: Som[]; podeEditar: boolean }) {
  const [aberta, setAberta] = useState<Celula>(null);
  // No set, o que acabou de rodar fica em cima.
  const trechos = trechosDoSom(ordenarSons(sons)).reverse().map(t => ({ ...t, sons: [...t.sons].reverse() }));
  const maxTrilhas = Math.max(1, ...sons.map(s => s.trilhas.length));

  if (sons.length === 0) {
    return (
      <section className="card text-sm text-secondary" style={{ padding: '22px' }}>
        Nenhum arquivo de som ainda. Cada take registrado com a ficha 🎙 ligada aparece aqui, e os botões acima logam o que é só som.
      </section>
    );
  }

  const marcar = (s: Som, marca: Som['marca']) => {
    if (podeEditar) void mudarSom(s.id, { marca: s.marca === marca ? undefined : marca });
  };

  const th: React.CSSProperties = {
    padding: '8px', textAlign: 'left', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em',
    textTransform: 'uppercase', color: 'var(--text-secondary)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)',
  };
  const td: React.CSSProperties = { padding: '4px', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' };
  // O arquivo fica preso à esquerda: no celular a grade rola de lado, e uma nota sem o arquivo dela não diz nada.
  const preso: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 1, backgroundColor: 'var(--bg-surface)' };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: 'clamp(14px, 3vw, 22px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <Rotulo icone={<SlidersHorizontal size={14} />}>Sound report</Rotulo>
        <span className="text-xs text-muted">{resumoDoSom(sons)}</span>
      </div>
      <p className="text-xs text-muted" style={{ margin: 0 }}>
        Toque numa trilha para anotar o que ela teve. Trilha sem nota é trilha limpa.
      </p>

      <div style={{ overflowX: 'auto', margin: '0 -4px' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: `${300 + maxTrilhas * 110}px` }}>
          <tbody>
            {trechos.map((trecho, i) => (
              <Fragment key={i}>
                <tr>
                  <th style={{ ...th, ...preso }}>Arquivo{trecho.rolo ? ` · Rolo ${trecho.rolo}` : ''}</th>
                  {trecho.trilhas.map((nome, k) => (
                    <th key={k} style={th}><span style={{ color: 'var(--text-muted)' }}>Tr{k + 1}</span> {nome}</th>
                  ))}
                  {Array.from({ length: maxTrilhas - trecho.trilhas.length }, (_, k) => <th key={`v${k}`} style={th} />)}
                  <th style={th}>Marca</th>
                  <th style={th}>Obs</th>
                </tr>
                {trecho.sons.map(s => {
                  const editando = aberta?.id === s.id ? aberta.trilha : null;
                  return (
                    <Fragment key={s.id}>
                      <tr style={{ opacity: s.marca === 'ng' || s.marca === 'fs' ? 0.6 : 1 }}>
                        <td style={{ ...td, ...preso, padding: '6px 8px' }}>
                          <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: '15px' }}>{s.arquivo}</div>
                          <div className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                            {s.tipo === 'take' ? `${s.cena}-${s.plano} / Tk${s.take ?? ''}` : `${ROTULO_DO_TIPO[s.tipo]} · ${s.cena}`} · {s.hora.slice(0, 5)}
                          </div>
                        </td>
                        {s.trilhas.map((t, k) => (
                          <td key={k} style={td}>
                            <CelulaDaGrade
                              texto={t.nota}
                              vazio="—"
                              ativa={editando === k}
                              rotulo={`Tr${k + 1} ${t.nome} de ${s.arquivo}`}
                              aoTocar={() => setAberta(editando === k ? null : { id: s.id, trilha: k })}
                            />
                          </td>
                        ))}
                        {Array.from({ length: maxTrilhas - s.trilhas.length }, (_, k) => <td key={`v${k}`} style={td} />)}
                        <td style={td}>
                          <div role="group" aria-label={`Marca de ${s.arquivo}`} style={{ display: 'flex', gap: '4px' }}>
                            {MARCAS.map(m => {
                              const ativa = s.marca === m.id;
                              const cor = m.id === 'bom' ? 'var(--color-success)' : m.id === 'fs' ? 'var(--color-warning)' : 'var(--color-danger)';
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  aria-pressed={ativa}
                                  title={m.nome}
                                  disabled={!podeEditar}
                                  onClick={() => marcar(s, m.id)}
                                  style={{
                                    minWidth: '44px', minHeight: '44px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 800,
                                    border: `1px solid ${ativa ? cor : 'var(--border-light)'}`,
                                    backgroundColor: ativa ? `color-mix(in srgb, ${cor} 18%, transparent)` : 'transparent',
                                    color: ativa ? 'var(--text-primary)' : 'var(--text-muted)', cursor: podeEditar ? 'pointer' : 'default',
                                  }}
                                >
                                  {m.curto}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td style={td}>
                          <CelulaDaGrade
                            texto={s.obs}
                            vazio="+"
                            ativa={editando === -1}
                            rotulo={`Observação de ${s.arquivo}`}
                            aoTocar={() => setAberta(editando === -1 ? null : { id: s.id, trilha: -1 })}
                          />
                        </td>
                      </tr>
                      {editando !== null && (
                        <tr>
                          <td colSpan={maxTrilhas + 3} style={{ ...td, padding: '10px 8px', backgroundColor: 'var(--bg-primary)' }}>
                            <EditorDaCelula som={s} trilha={editando} podeEditar={podeEditar} aoFechar={() => setAberta(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CelulaDaGrade({ texto, vazio, ativa, rotulo, aoTocar }: {
  texto?: string;
  vazio: string;
  ativa: boolean;
  rotulo: string;
  aoTocar: () => void;
}) {
  const tem = Boolean(texto?.trim());
  return (
    <button
      type="button"
      aria-label={rotulo}
      aria-expanded={ativa}
      onClick={aoTocar}
      style={{
        width: '100%', minHeight: '44px', padding: '4px 8px', textAlign: 'left', fontSize: '13px', fontWeight: tem ? 700 : 500,
        borderRadius: 'var(--radius-sm)', cursor: 'pointer', overflowWrap: 'anywhere',
        border: `1px solid ${ativa ? 'var(--cor-criativo)' : tem ? 'color-mix(in srgb, var(--color-warning) 50%, transparent)' : 'transparent'}`,
        backgroundColor: tem ? 'color-mix(in srgb, var(--color-warning) 12%, transparent)' : 'transparent',
        color: tem ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      {tem ? texto : vazio}
    </button>
  );
}

/** A nota de uma trilha (ou a observação do arquivo), com as notas rápidas. */
function EditorDaCelula({ som, trilha, podeEditar, aoFechar }: {
  som: Som;
  trilha: number;
  podeEditar: boolean;
  aoFechar: () => void;
}) {
  const ehObs = trilha === -1;
  const texto = ehObs ? som.obs || '' : som.trilhas[trilha]?.nota || '';
  const gravar = (v: string) => {
    if (!podeEditar) return;
    const limpo = v.trim();
    if (ehObs) void mudarSom(som.id, { obs: limpo || undefined });
    else void mudarSom(som.id, { trilhas: som.trilhas.map((t, j) => (j === trilha ? { ...t, nota: limpo || undefined } : t)) });
  };

  const apagar = async () => {
    if (!(await confirmar({
      titulo: `Apagar o registro de ${som.arquivo}?`,
      detalhe: 'O arquivo continua no gravador; o que some é a linha dele aqui.',
      confirmar: 'Apagar',
      perigo: true,
    }))) return;
    aoFechar();
    await apagarSom(som.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '640px' }}>
      <span className="text-xs font-bold text-secondary">
        <span style={{ fontFamily: MONO }}>{som.arquivo}</span> · {ehObs ? 'Observação' : `Tr${trilha + 1} ${som.trilhas[trilha]?.nome}`}
      </span>
      <CampoTexto
        value={texto}
        aoGravar={gravar}
        disabled={!podeEditar}
        autoFocus
        placeholder={ehObs ? 'avião no fim, ator falou fora do texto…' : 'vento, clipou, roupa raspando…'}
        style={estiloCampo}
      />
      {!ehObs && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {NOTAS_DE_TRILHA.map(n => (
            <BotaoTatil
              key={n}
              disabled={!podeEditar}
              escala={0.94}
              onClick={() => gravar(alternarNota(texto, n))}
              style={{
                minHeight: '44px', padding: '0 14px', borderRadius: 'var(--radius-full)', fontSize: '14px', fontWeight: 600,
                border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              {n}
            </BotaoTatil>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={aoFechar} className="text-sm" style={{ minHeight: '44px', padding: '0 4px', border: 'none', background: 'none', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}>
          Fechar
        </button>
        {podeEditar && (
          <button type="button" onClick={() => void apagar()} className="text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 4px', border: 'none', background: 'none', color: 'var(--color-danger)', fontWeight: 600, cursor: 'pointer', marginLeft: 'auto' }}>
            <Trash2 size={14} /> Apagar a linha
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── O kit ───────────────────────── */

/** Os personagens da cena da claquete, com quem interpreta — para dar nome às lapelas. */
function useElencoDaCena(projetoId: string, estado: EstadoDaLogagem) {
  return useLiveQuery(async () => {
    const [elementos, tags, cenas, perfis] = await Promise.all([
      db.elementos.where('projeto_id').equals(projetoId).toArray(),
      db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(),
      db.cenas.where('projeto_id').equals(projetoId).toArray(),
      db.perfis.where('projeto_id').equals(projetoId).toArray(),
    ]);
    const cena = cenas.find(c => c.id === estado.cena_id)
      ?? cenas.find(c => String(c.numero).trim().toUpperCase() === String(estado.cena).trim().toUpperCase());
    if (!cena) return [];
    return elementos
      .filter(el => normalizarCategoria(el.categoria) === 'ELENCO' && cenasDoElemento(el, tags, cenas).has(cena.id))
      .map(el => {
        const p = perfis.find(x => x.id === el.perfil_id);
        return { personagem: el.nome, ator: p ? (p.nome_social || p.nome) : '' };
      });
  }, [projetoId, estado.cena_id, estado.cena]) ?? [];
}

function KitDoSom({ estado, bloqueado, mudar, projetoId }: {
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  mudar: (m: Partial<EstadoDaLogagem>) => void;
  projetoId: string;
}) {
  const trilhas = trilhasDoSom(estado);
  const elenco = useElencoDaCena(projetoId, estado);
  const trocar = (lista: string[]) => mudar({ trilhas_som: lista });

  /*
    O personagem entra na primeira lapela ainda genérica ("Lapela 2") ou vazia;
    sem nenhuma livre, vira uma trilha nova. Quem já tem lapela não duplica.
  */
  const darLapela = (personagem: string) => {
    if (trilhas.some(t => t.toLowerCase().includes(personagem.toLowerCase()))) return;
    const livre = trilhas.findIndex(t => !t.trim() || /^lapela\s*\d*$/i.test(t.trim()));
    const nome = `Lapela ${personagem}`;
    trocar(livre === -1 ? [...trilhas, nome] : trilhas.map((t, i) => (i === livre ? nome : t)));
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: 'clamp(14px, 3vw, 22px)' }}>
      <Rotulo icone={<SlidersHorizontal size={14} />}>Gravador</Rotulo>
      <Campo rotulo="Aparelho">
        <SeletorComOutro opcoes={OPCOES_DO_GRAVADOR.aparelho} valor={estado.gravador_som} bloqueado={bloqueado} aoMudar={v => mudar({ gravador_som: v })} />
      </Campo>
      <Campo rotulo="Taxa de amostragem">
        <Escolha nome="som-taxa" opcoes={OPCOES_DO_GRAVADOR.taxa} valor={estado.taxa_som} bloqueado={bloqueado} aoMudar={v => mudar({ taxa_som: v })} />
      </Campo>
      <Campo rotulo="Resolução">
        <Escolha nome="som-bits" opcoes={OPCOES_DO_GRAVADOR.bits} valor={estado.bits_som} bloqueado={bloqueado} aoMudar={v => mudar({ bits_som: v })} />
      </Campo>
      <Campo rotulo="Timecode">
        <Escolha nome="som-tc" opcoes={OPCOES_DO_GRAVADOR.tc} valor={estado.tc_som} bloqueado={bloqueado} aoMudar={v => mudar({ tc_som: v })} />
      </Campo>
      <p className="text-xs text-muted" style={{ margin: '-6px 0 0' }}>
        Sem timecode, o gravador grava a hora do relógio dele — o ingest usa isso para casar o som com o vídeo.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
        <Campo rotulo="Rolo (pasta)">
          <CampoTexto value={estado.rolo_som || ''} aoGravar={v => mudar({ rolo_som: v.trim() })} disabled={bloqueado} placeholder="02" style={{ ...estiloCampo, fontFamily: MONO }} />
        </Campo>
        <Campo rotulo="Próximo arquivo">
          <CampoTexto value={arquivoDoSom(estado)} aoGravar={v => mudar({ arquivo_som: v.trim() })} disabled={bloqueado} style={{ ...estiloCampo, fontFamily: MONO }} />
        </Campo>
      </div>

      <Campo rotulo="Trilhas">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {trilhas.map((t, i) => (
            <div key={`${i}-${trilhas.length}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-xs font-bold text-muted" style={{ width: '30px', flexShrink: 0 }}>Tr{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <CampoTexto value={t} aoGravar={v => trocar(trilhas.map((x, j) => (j === i ? v.trim() : x)))} disabled={bloqueado} style={estiloCampo} />
              </div>
              <button
                type="button"
                aria-label={`Tirar a trilha ${i + 1}`}
                disabled={bloqueado || trilhas.length === 1}
                onClick={() => trocar(trilhas.filter((_, j) => j !== i))}
                style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: trilhas.length === 1 ? 0.3 : 1 }}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={bloqueado}
            onClick={() => trocar([...trilhas, `Lapela ${trilhas.length}`])}
            className="text-sm"
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 4px', border: 'none', background: 'none', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={15} /> Trilha
          </button>
        </div>
      </Campo>

      {elenco.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="text-xs text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={13} /> Elenco da cena {estado.cena} — toque para dar uma lapela
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {elenco.map(e => {
              const tem = trilhas.some(t => t.toLowerCase().includes(e.personagem.toLowerCase()));
              return (
                <BotaoTatil
                  key={e.personagem}
                  disabled={bloqueado || tem}
                  escala={0.94}
                  onClick={() => darLapela(e.personagem)}
                  style={{
                    minHeight: '44px', padding: '0 14px', borderRadius: 'var(--radius-full)', fontSize: '14px', fontWeight: 600,
                    border: `1px solid ${tem ? 'var(--cor-criativo)' : 'var(--border-light)'}`, backgroundColor: 'var(--bg-primary)',
                    color: tem ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: tem ? 'default' : 'pointer',
                  }}
                >
                  {e.personagem}{e.ator ? <span className="text-muted"> · {e.ator}</span> : null}
                </BotaoTatil>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted" style={{ margin: 0 }}>
        O kit passa para a próxima diária, e o arquivo continua de onde parou. Os arquivos já logados guardam as trilhas que tinham na hora.
      </p>
    </section>
  );
}
