import { useEffect, useId, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import type { Diaria } from '../../types';
import { diaDaSemana } from '../../lib/formato';
import { diasEntre, hojeISO } from '../../lib/urgencia';

/**
 * A diária em que a Logagem está.
 *
 * Dois controles com a mesma cara:
 * - no toque, o `select` nativo, invisível por cima do botão: o celular abre a
 *   roda do sistema, o controle mais fácil de acertar com o dedo no set;
 * - com mouse, uma lista própria. A lista nativa do navegador no computador
 *   abre branca, fora do tema, e não cabe o "hoje" nem o "há 3 dias".
 */

type DiariaDoSeletor = Pick<Diaria, 'id' | 'numero' | 'data'> & { estado?: Diaria['estado'] };

const numero = (n: number) => String(n).padStart(2, '0');

function quando(data: string, hoje: string): string {
  if (!data) return 'sem data';
  const d = diasEntre(hoje, data);
  if (d === 0) return 'hoje';
  if (d === 1) return 'amanhã';
  if (d === -1) return 'ontem';
  return d > 0 ? `em ${d} dias` : `há ${-d} dias`;
}

function useToque() {
  const [toque, setToque] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  useEffect(() => {
    const m = window.matchMedia('(pointer: coarse)');
    const mudar = () => setToque(m.matches);
    m.addEventListener('change', mudar);
    return () => m.removeEventListener('change', mudar);
  }, []);
  return toque;
}

export function SeletorDeDiaria({ diarias, valor, aoMudar, agoraId, alerta }: {
  diarias: DiariaDoSeletor[];
  valor: string;
  aoMudar: (id: string) => void;
  /** A diária do dia que está acontecendo (inclusive a que virou a noite). */
  agoraId?: string;
  /** Está fora da diária de agora: o botão fica laranja. */
  alerta?: boolean;
}) {
  const hoje = hojeISO();
  const toque = useToque();
  const [aberto, setAberto] = useState(false);
  const [foco, setFoco] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const idLista = useId();

  const atual = diarias.find(d => d.id === valor) ?? diarias[0];
  const indiceAtual = Math.max(0, diarias.findIndex(d => d.id === atual?.id));

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  // Ao abrir, a atual já aparece na lista, sem precisar rolar.
  useEffect(() => {
    if (!aberto) return;
    lista.current?.querySelector<HTMLElement>(`[data-indice="${foco}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [aberto, foco]);

  const abrir = () => { setFoco(indiceAtual); setAberto(true); };
  const escolher = (id: string) => { aoMudar(id); setAberto(false); };

  const teclar = (e: React.KeyboardEvent) => {
    if (!aberto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setAberto(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setFoco(f => Math.min(diarias.length - 1, f + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFoco(f => Math.max(0, f - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setFoco(0); }
    else if (e.key === 'End') { e.preventDefault(); setFoco(diarias.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (diarias[foco]) escolher(diarias[foco].id); }
    else if (e.key === 'Tab') setAberto(false);
  };

  if (!atual) return null;
  const selo = (d: DiariaDoSeletor) => (d.id === agoraId ? (d.data === hoje ? 'Hoje' : 'Agora') : !agoraId && d.data === hoje ? 'Hoje' : null);
  const ehHoje = atual.data === hoje;

  return (
    <div ref={raiz} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={teclar}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? idLista : undefined}
        aria-label={`Diária da Logagem: Diária ${numero(atual.numero)}, ${quando(atual.data, hoje)}`}
        tabIndex={toque ? -1 : 0}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '6px 12px 6px 10px',
          borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
          border: `1px solid ${alerta ? 'var(--color-warning)' : aberto ? 'var(--cor-set)' : 'var(--border-color)'}`,
          backgroundColor: 'var(--bg-surface)', transition: 'border-color 0.15s ease',
        }}
      >
        <span aria-hidden style={{
          width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: alerta ? 'var(--color-warning)' : 'var(--cor-set)', flexShrink: 0,
          backgroundColor: `color-mix(in srgb, ${alerta ? 'var(--color-warning)' : 'var(--cor-set)'} 14%, transparent)`,
        }}>
          <CalendarDays size={17} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontWeight: 800, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Diária {numero(atual.numero)}
            {selo(atual) && <SeloHoje texto={selo(atual)!} />}
          </span>
          <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
            {atual.data ? diaDaSemana(atual.data) : 'sem data'}{atual.data && !ehHoje ? ` · ${quando(atual.data, hoje)}` : ''}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          style={{ color: 'var(--text-muted)', marginLeft: '4px', transform: aberto ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s ease' }}
        />
      </button>

      {/* No toque: o select nativo cobre o botão e recebe o dedo. */}
      {toque && (
        <select
          value={atual.id}
          onChange={e => aoMudar(e.target.value)}
          aria-label="Diária da Logagem"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', padding: 0, border: 'none' }}
        >
          {diarias.map(d => (
            <option key={d.id} value={d.id}>
              Diária {numero(d.numero)} · {d.data ? diaDaSemana(d.data) : 'sem data'}{d.data === hoje ? ' · hoje' : ''}
            </option>
          ))}
        </select>
      )}

      {aberto && !toque && (
        <ul
          ref={lista}
          id={idLista}
          role="listbox"
          aria-label="Diárias"
          aria-activedescendant={`${idLista}-${foco}`}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 40, minWidth: '100%', width: 'max-content',
            maxHeight: '340px', overflowY: 'auto', margin: 0, padding: '6px', listStyle: 'none',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
          }}
        >
          {diarias.map((d, i) => {
            const escolhida = d.id === atual.id;
            const passou = d.data !== '' && d.data < hoje;
            return (
              <li
                key={d.id}
                id={`${idLista}-${i}`}
                data-indice={i}
                role="option"
                aria-selected={escolhida}
                onPointerEnter={() => setFoco(i)}
                onClick={() => escolher(d.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  backgroundColor: i === foco ? 'var(--bg-active)' : 'transparent',
                }}
              >
                <span style={{
                  minWidth: '30px', fontWeight: 800, fontSize: '15px', fontVariantNumeric: 'tabular-nums',
                  color: escolhida ? 'var(--cor-set)' : passou ? 'var(--text-muted)' : 'var(--text-primary)',
                }}>
                  {numero(d.numero)}
                </span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: passou ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    {d.data ? diaDaSemana(d.data) : 'Sem data'}
                  </span>
                  <span className="text-xs text-muted">
                    {d.estado === 'fechada' ? 'fechada' : d.data ? quando(d.data, hoje) : ''}
                  </span>
                </span>
                {selo(d) && <SeloHoje texto={selo(d)!} />}
                <Check size={16} aria-hidden style={{ color: 'var(--cor-set)', visibility: escolhida ? 'visible' : 'hidden', flexShrink: 0 }} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SeloHoje({ texto }: { texto: string }) {
  return (
    <span style={{
      padding: '1px 6px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em',
      textTransform: 'uppercase', color: 'var(--color-success)',
      backgroundColor: 'color-mix(in srgb, var(--color-success) 14%, transparent)',
    }}>
      {texto}
    </span>
  );
}
