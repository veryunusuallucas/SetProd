import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleDot, Clock, MapPin, Utensils, Truck, Flag, StickyNote, Coffee, PackageOpen, Lightbulb, Drama, Brush, ArrowRight } from 'lucide-react';
import { db } from '../db/db';
import type { Cena, Diaria, TipoItemDia } from '../types';
import { montarLinhaDoDia, calcularDia, COR_TIPO } from '../lib/linhaDoDia';
import { estadoDa, ROTULO_ESTADO } from '../lib/sincronizaOD';
import { oitavosParaPaginas, paginasParaOitavos, getStripboardColor } from '../lib/decupagem';
import { diaDaSemana } from '../lib/formato';

const ICONE: Record<TipoItemDia, typeof Flag> = {
  cena: CircleDot,
  marco: Flag,
  prelight: Lightbulb,
  ensaio: Drama,
  preparacao: Brush,
  almoco: Utensils,
  coffee: Coffee,
  move: Truck,
  wrap: PackageOpen,
  nota: StickyNote,
};

/**
 * Todas as Ordens do Dia lado a lado — o plano da semana numa tela só.
 *
 * De onde veio: um AD, depois de meia hora montando dias — *"seria maneiro se
 * tivesse uma pequena área onde eu pudesse mexer em todas as ODs, sem precisar
 * ficar trocando diária"*.
 *
 * ⚠️ ESTA TELA É DE LEITURA, E ISSO É DECISÃO, NÃO PREGUIÇA.
 *
 * Editar continua sendo dentro da diária, por um motivo que a versão editável
 * não teria como respeitar sem virar a tela da diária de novo: cada dia tem
 * estado próprio. Um está em rascunho espelhando o stripboard, o outro está
 * publicado e a equipe já recebeu o PDF. Arrastar uma cena entre colunas teria
 * que perguntar, a cada gesto, o que fazer com o dia congelado do lado — e uma
 * tela que pergunta a cada gesto é pior que duas telas.
 *
 * O que ela responde de relance, e a lista de cartões não respondia: onde está
 * o buraco, onde o dia estourou, e qual dia ainda não tem nada.
 */
export function PlanoDaSemana({ projetoId, diarias }: { projetoId: string; diarias: Diaria[] }) {
  const navigate = useNavigate();
  const trilho = useRef<HTMLDivElement>(null);
  const hojeRef = useRef<HTMLDivElement>(null);

  const cenas = useLiveQuery(
    () => db.cenas.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  const ordenadas = [...diarias].sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.numero - b.numero);

  /*
    A tela abre no dia de hoje, e não no primeiro dia da produção.

    Numa produção de quarenta diárias, abrir no começo significa rolar até o
    presente toda vez — e o passado é justamente a parte que já não se pode
    mudar. `block: 'nearest'` para a página não pular junto.
  */
  useEffect(() => {
    hojeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [diarias.length]);

  if (ordenadas.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <Clock size={36} className="text-muted" style={{ margin: '0 auto 14px' }} />
        <div className="font-bold mb-2">Nenhuma diária ainda</div>
        <p className="text-sm text-secondary">
          Crie as diárias e mande os dias do stripboard para elas — o plano da semana aparece aqui.
        </p>
      </div>
    );
  }

  /** A produção pula de ano? Só aí o ano precisa aparecer em cada coluna. */
  const anos = new Set(ordenadas.map(d => (d.data || '').slice(0, 4)).filter(Boolean));
  const atravessaAno = anos.size > 1;

  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
        Os dias na ordem em que acontecem, lado a lado. Toque numa coluna para abrir a diária e mexer nela.
      </div>

      <div
        ref={trilho}
        style={{
          display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px',
          // As colunas não encolhem: espremer sete dias na largura da tela
          // deixaria cada um ilegível, que é o oposto do que a tela serve.
          scrollSnapType: 'x proximate',
        }}
      >
        {ordenadas.map((d, i) => {
          const doDia = (d.cena_ids || [])
            .map(id => cenas.find(c => c.id === id))
            .filter((c): c is Cena => Boolean(c));

          const dia = calcularDia(montarLinhaDoDia(d), d.chamada, id => cenas.find(c => c.id === id));
          const oitavos = doDia.reduce((s, c) => s + paginasParaOitavos(c.paginas), 0);
          const estado = estadoDa(d);
          const ehHoje = d.data === hojeISO;

          /*
            A semana muda quando o domingo passa. Uma barra fina entre as
            colunas é o bastante — um cabeçalho "Semana 3" por cima obrigaria a
            tela a ter duas alturas de rolagem para dizer uma coisa só.
          */
          const anterior = ordenadas[i - 1];
          const trocouSemana = Boolean(anterior && semanaDe(d.data) !== semanaDe(anterior.data));

          const locais = [...new Set(doDia.map(c => c.locacao_id).filter(Boolean))].length;

          return (
            <div key={d.id} style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
              {trocouSemana && (
                <div
                  aria-hidden
                  title="Começa outra semana"
                  style={{ width: '2px', backgroundColor: 'var(--border-color)', borderRadius: '1px', flexShrink: 0 }}
                />
              )}

              <div
                ref={ehHoje ? hojeRef : undefined}
                onClick={() => navigate(`/projeto/${projetoId}/diaria/${d.id}`)}
                className="card"
                style={{
                  width: '250px', flexShrink: 0, cursor: 'pointer', scrollSnapAlign: 'center',
                  display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px',
                  border: `1px solid ${ehHoje ? 'var(--accent)' : 'var(--border-light)'}`,
                }}
              >
                {/* ---- cabeçalho do dia ---- */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
                    <span className="font-bold">Diária {String(d.numero).padStart(2, '0')}</span>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: corDoEstado(estado) }}>
                      {ROTULO_ESTADO[estado]}
                    </span>
                  </div>
                  {/* `diaDaSemana` já vem com o dia e o mês ("ter, 08/09"). O
                      ano completo só entra quando a produção atravessa a
                      virada — antes disso ele é ruído em toda coluna. */}
                  <div className="text-xs" style={{ color: ehHoje ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {diaDaSemana(d.data)}{atravessaAno ? `/${(d.data || '').slice(2, 4)}` : ''}
                    {ehHoje && ' · é hoje'}
                  </div>
                </div>

                {/* ---- os números do dia ---- */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)' }}>
                  <Numerinho rotulo="chamada" valor={d.chamada || '—'} />
                  <Numerinho rotulo="wrap" valor={dia.wrap || '—'} />
                  <Numerinho rotulo="páginas" valor={oitavos > 0 ? oitavosParaPaginas(oitavos) : '—'} />
                </div>

                {/* ---- a linha do dia, resumida ---- */}
                {dia.itens.length === 0 ? (
                  <div className="text-xs text-muted" style={{ padding: '18px 0', textAlign: 'center', lineHeight: 1.5 }}>
                    Dia vazio.<br />Nada foi mandado para ele ainda.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {dia.itens.map(c => {
                      const Icone = ICONE[c.item.tipo];
                      const cor = c.item.tipo === 'cena' ? 'var(--accent)' : COR_TIPO[c.item.tipo];
                      const tira = c.cena ? getStripboardColor(c.cena.ambiente, c.cena.periodo) : null;

                      return (
                        <div key={c.item.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                          <span className="text-xs text-muted" style={{ width: '34px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                            {c.hora}
                          </span>
                          <Icone size={11} style={{ color: cor, flexShrink: 0 }} />
                          <span
                            className="text-xs"
                            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: c.cena ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                          >
                            {c.cena ? `${c.cena.numero} · ${c.cena.descricao}` : (c.item.titulo || '—')}
                          </span>
                          {/* A cor da tira diz interno/externo e dia/noite sem
                              gastar uma palavra — que é para o que ela existe
                              no stripboard de papel. */}
                          {tira && (
                            <span
                              aria-label={tira.label}
                              title={tira.label}
                              style={{ width: '7px', height: '14px', borderRadius: '2px', backgroundColor: tira.bg, flexShrink: 0 }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ---- rodapé ---- */}
                <div
                  className="text-xs text-muted"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border-light)' }}
                >
                  <span>{doDia.length} cena{doDia.length === 1 ? '' : 's'}</span>
                  {locais > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={10} /> {locais} local{locais === 1 ? '' : 'is'}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)' }}>
                    abrir <ArrowRight size={10} />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Numerinho({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column' }}>
      <span className="text-xs text-muted uppercase" style={{ fontSize: '9px', letterSpacing: '0.08em' }}>{rotulo}</span>
      <span className="text-sm font-bold">{valor}</span>
    </span>
  );
}

function corDoEstado(estado: string): string {
  if (estado === 'fechada') return 'var(--color-success)';
  if (estado === 'publicada') return 'var(--cor-set)';
  if (estado === 'travada') return 'var(--cor-equipe)';
  return 'var(--text-muted)';
}

/**
 * A que semana uma data pertence — só para saber QUANDO ELA MUDA.
 *
 * Não é a semana ISO do calendário: é a distância em semanas desde uma
 * segunda-feira qualquer do passado. Serve para comparar duas datas, que é tudo
 * o que a barra separadora precisa, e não tropeça na virada do ano como a
 * numeração ISO tropeça.
 */
function semanaDe(data?: string): number {
  if (!data) return -1;
  const d = new Date(data + 'T12:00');
  if (isNaN(d.getTime())) return -1;
  // Segunda como início da semana: no set, o fim de semana é a folga.
  const desdeSegunda = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desdeSegunda);
  return Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
}
