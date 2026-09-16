import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { ListTree, ChevronDown, Check } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { Abre } from './pecas';
import { claqueteDoPlano, planosDaDiaria, type PlanoDoDia } from '../../lib/logagem/decupagem';

/**
 * "Da decupagem": os planos escalados para a diária, para preencher a claquete
 * com um toque.
 *
 * Fica fechado por padrão. Aberto, a lista mostra cada plano na ordem do dia,
 * com a lente e a descrição, e quantos takes ele já teve — que é, de quebra, o
 * andamento do dia visto pela câmera.
 *
 * Some inteiro quando a diária não tem plano decupado: um botão que abre uma
 * lista vazia só ensina a pessoa a não tocar nele.
 */
export function PlanosDaDecupagem({ estado, bloqueado, aoEscolher }: {
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  aoEscolher: (mudanca: Partial<EstadoDaLogagem>) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const reduzido = useMovimentoReduzido();

  const dados = useLiveQuery(async () => {
    const diaria = await db.diarias.get(estado.diaria_id);
    if (!diaria?.cena_ids?.length) return null;
    const [cenas, planos, takes, kits] = await Promise.all([
      db.cenas.bulkGet(diaria.cena_ids),
      db.planos.where('cena_id').anyOf(diaria.cena_ids).toArray(),
      db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
      db.log_kits.where('projeto_id').equals(estado.projeto_id).toArray(),
    ]);
    return {
      diaria,
      cenas: cenas.filter((c): c is NonNullable<typeof c> => Boolean(c)),
      planos,
      takes,
      kitDeLentes: kits.find(k => k.tipo === 'lente' && k.id === estado.kit_lente_id) ?? kits.find(k => k.tipo === 'lente'),
    };
  }, [estado.diaria_id, estado.projeto_id, estado.kit_lente_id]);

  if (!dados) return null;

  const lista = planosDaDiaria({ ...dados, letras: estado.plano_letras !== false });
  if (lista.length === 0) return null;

  const escolher = (item: PlanoDoDia) => {
    aoEscolher(claqueteDoPlano(item, estado, dados.kitDeLentes));
    setAberto(false);
  };

  const rodados = lista.filter(i => i.takes > 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <BotaoTatil
        onClick={() => setAberto(v => !v)}
        disabled={bloqueado}
        aria-expanded={aberto}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', padding: '0 14px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: bloqueado ? 'default' : 'pointer',
          opacity: bloqueado ? 0.55 : 1, width: '100%', textAlign: 'left',
        }}
      >
        <ListTree size={16} style={{ color: 'var(--cor-criativo)' }} />
        <span style={{ flex: 1 }}>
          Da decupagem
          <span className="text-muted" style={{ fontWeight: 400 }}>
            {' '}· {lista.length} plano{lista.length === 1 ? '' : 's'} hoje · {rodados} com take
          </span>
        </span>
        <motion.span animate={{ rotate: aberto ? 180 : 0 }} transition={reduzido ? { duration: 0 } : MOLA} style={{ display: 'flex' }}>
          <ChevronDown size={16} />
        </motion.span>
      </BotaoTatil>

      <Abre aberto={aberto && !bloqueado}>
        <div role="listbox" aria-label="Planos da decupagem" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
          {lista.map(item => {
            const atual = estado.plano_id === item.plano.id;
            return (
              <BotaoTatil
                key={item.plano.id}
                role="option"
                aria-selected={atual}
                escala={0.98}
                onClick={() => escolher(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', minHeight: '52px', padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)', textAlign: 'left', cursor: 'pointer',
                  border: `1px solid ${atual ? 'var(--cor-criativo)' : 'var(--border-light)'}`,
                  backgroundColor: atual ? 'color-mix(in srgb, var(--cor-criativo) 10%, transparent)' : 'transparent',
                  color: 'inherit',
                }}
              >
                <span className="text-sm font-bold" style={{ minWidth: '74px', fontVariantNumeric: 'tabular-nums' }}>
                  {item.cena.numero} · {item.naClaquete}
                  {item.naClaquete !== item.plano.numero && (
                    <span className="text-xs text-muted" style={{ fontWeight: 400 }}> ({item.plano.numero})</span>
                  )}
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.plano.descricao || item.cena.descricao || 'sem descrição'}
                  </span>
                  {(item.plano.lente || item.plano.tamanho) && (
                    <span className="text-xs text-muted">
                      {[item.plano.tamanho, item.plano.lente].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                {item.takes > 0 && (
                  <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)', flexShrink: 0 }}>
                    <Check size={13} /> {item.takes} take{item.takes === 1 ? '' : 's'}
                  </span>
                )}
              </BotaoTatil>
            );
          })}
        </div>
      </Abre>
    </div>
  );
}
