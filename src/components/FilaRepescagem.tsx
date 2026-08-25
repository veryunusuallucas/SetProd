import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { RotateCcw, CircleSlash, CircleDashed, CalendarPlus, X } from 'lucide-react';
import { filaDeRepescagem } from '../lib/registroSet';

/**
 * As cenas que ficaram para trás.
 *
 * É o equivalente às "cenas não agendadas" do Movie Magic e do StudioBinder, e
 * é a peça que fecha o ciclo: sem ela, "cena 42 não gravada" morre dentro de
 * uma diária fechada que ninguém mais abre, e a produção descobre o buraco na
 * véspera do último dia.
 *
 * ⚠️ NÃO É UM CHECKBOX, é uma fila de trabalho. Cada item traz o motivo e de
 * qual dia veio, porque é o motivo que decide onde a cena cabe agora: "adiada
 * por chuva" quer um dia de interna; "elenco atrasou" quer o dia em que aquela
 * pessoa volta.
 *
 * Só entra o que veio de diária JÁ FECHADA. Cena não gravada num dia que ainda
 * está rolando não é pendência — é o dia acontecendo.
 */
export function FilaRepescagem({ projetoId }: { projetoId: string }) {
  const [reencaixando, setReencaixando] = useState<string | null>(null);

  const registros = useLiveQuery(
    () => db.registros_cena.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];
  const cenas = useLiveQuery(
    () => db.cenas.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];
  const diarias = useLiveQuery(
    () => db.diarias.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  const fechadas = new Set(diarias.filter(d => d.fechada).map(d => d.id));
  const fila = filaDeRepescagem(registros, fechadas);

  /*
    Para onde dá para reencaixar: diárias ABERTAS, da mais próxima para a mais
    distante. Oferecer uma diária fechada seria oferecer um dia que já passou.
  */
  const destinos = diarias
    .filter(d => !d.fechada)
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const reencaixar = async (cenaId: string, diariaId: string) => {
    const destino = diarias.find(d => d.id === diariaId);
    if (!destino) return;

    if (!(destino.cena_ids || []).includes(cenaId)) {
      await db.diarias.update(diariaId, { cena_ids: [...(destino.cena_ids || []), cenaId] });
    }
    /*
      O registro antigo NÃO é apagado.

      Ele é a história: "esta cena foi programada para o dia 3, não saiu por
      causa de chuva, e foi remarcada para o dia 9". Apagar deixaria o
      cronograma parecendo que sempre esteve certo — e é justamente esse
      histórico que responde "por que estamos atrasados?".

      A cena sai da fila sozinha quando for marcada como gravada no dia novo,
      porque o estado atual é sempre o registro mais recente.
    */
    setReencaixando(null);
  };

  if (fila.length === 0) return null;

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <RotateCcw size={16} /> Repescagem
        <span className="text-xs text-muted" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
          — {fila.length === 1 ? '1 cena ficou para trás' : `${fila.length} cenas ficaram para trás`}
        </span>
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {fila.map(r => {
          const cena = cenas.find(c => c.id === r.cena_id);
          const veioDe = diarias.find(d => d.id === r.diaria_id);
          if (!cena) return null;

          return (
            <div key={r.id} style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ color: r.status === 'parcial' ? 'var(--color-warning, #fbbf24)' : 'var(--color-danger, #f87171)' }}>
                  {r.status === 'parcial' ? <CircleDashed size={15} /> : <CircleSlash size={15} />}
                </span>

                <div style={{ flex: 1, minWidth: '160px' }}>
                  <div className="text-sm font-bold">Cena {cena.numero} · {cena.descricao}</div>
                  <div className="text-xs text-muted">
                    {r.status === 'parcial' ? 'saiu pela metade' : 'não gravou'}
                    {r.motivo && ` — ${r.motivo}`}
                    {veioDe && ` · da Diária ${String(veioDe.numero).padStart(2, '0')}`}
                    {r.observacao && ` · ${r.observacao}`}
                  </div>
                </div>

                {reencaixando === r.cena_id ? (
                  <button onClick={() => setReencaixando(null)} className="btn-icon" style={{ padding: '4px' }} aria-label="Cancelar">
                    <X size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => setReencaixando(r.cena_id)}
                    className="text-xs"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
                      borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap',
                      border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)',
                    }}
                  >
                    <CalendarPlus size={13} /> reencaixar
                  </button>
                )}
              </div>

              {reencaixando === r.cena_id && (
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-light)' }}>
                  {destinos.length === 0 ? (
                    <div className="text-xs text-muted">
                      Não há diária aberta para receber esta cena. Crie uma nova em Diárias / OD.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {destinos.map(d => (
                        <button
                          key={d.id}
                          onClick={() => reencaixar(r.cena_id, d.id)}
                          className="text-xs"
                          style={{
                            padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                            border: '1px solid var(--border-light)', background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          Diária {String(d.numero).padStart(2, '0')}
                          <span className="text-muted"> · {d.data ? new Date(d.data + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'sem data'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
