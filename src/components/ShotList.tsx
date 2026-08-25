import { useState } from 'react';
import { db } from '../db/db';
import { Clapperboard, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import type { Diaria, Cena } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { ordenarPlanos, resumoDePlanos } from '../lib/planos';

export function ShotList({ diaria, locacoes }: { diaria: Diaria, locacoes: any[] }) {
  const [showSelector, setShowSelector] = useState(false);

  /** Quais cenas estão com os planos abertos. Recolhido é o padrão. */
  const [aberta, setAberta] = useState<Set<string>>(new Set());
  const alternar = (cenaId: string) => setAberta(atual => {
    const proxima = new Set(atual);
    if (proxima.has(cenaId)) proxima.delete(cenaId);
    else proxima.add(cenaId);
    return proxima;
  });

  // Busca as cenas e planos globais
  const cenasGlobais = useLiveQuery(() => db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray(), [diaria.projeto_id]) || [];
  const planosGlobais = useLiveQuery(() => db.planos.where('projeto_id').equals(diaria.projeto_id).toArray(), [diaria.projeto_id]) || [];

  const cenasSelecionadas = (diaria.cena_ids || []).map(id => cenasGlobais.find(c => c.id === id)).filter(Boolean) as Cena[];
  
  // Para manter compatibilidade com projetos antigos (que tinham 'cenas' embutido na diaria)
  const cenasAntigas = diaria.cenas || [];
  const todasCenas = [...cenasSelecionadas, ...cenasAntigas];

  const addCena = async (cenaId: string) => {
    if (!diaria.cena_ids?.includes(cenaId)) {
      await db.diarias.update(diaria.id, {
        cena_ids: [...(diaria.cena_ids || []), cenaId]
      });
    }
  };

  const removeCena = async (cenaId: string) => {
    // Remove tanto da nova estrutura (cena_ids) quanto da antiga (cenas) para limpeza
    const novosCenaIds = (diaria.cena_ids || []).filter(id => id !== cenaId);
    const novasCenasAntigas = (diaria.cenas || []).filter(c => c.id !== cenaId);
    
    await db.diarias.update(diaria.id, { 
      cena_ids: novosCenaIds,
      cenas: novasCenasAntigas
    });
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clapperboard size={16} /> Cenas Programadas
        </h2>
        <button onClick={() => setShowSelector(!showSelector)} className="btn-icon" style={{ backgroundColor: 'var(--bg-surface)', padding: '4px 12px', width: 'auto', gap: '6px' }}>
          <Plus size={16} /> <span className="text-xs">Adicionar Cena</span>
        </button>
      </div>

      {showSelector && (
        <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--accent)', marginBottom: '16px' }}>
          <div className="text-sm font-bold mb-2">Selecione as cenas decupadas:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {cenasGlobais.length === 0 ? (
              <div className="text-xs text-muted">Vá em "Decupagem" no menu inicial para criar cenas.</div>
            ) : (
              cenasGlobais.map(c => {
                const isSelected = diaria.cena_ids?.includes(c.id);
                return (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span className="font-bold text-xs" style={{ width: '24px' }}>{c.numero}</span>
                      <span className="text-sm">{c.descricao}</span>
                    </div>
                    {isSelected ? (
                      <button onClick={() => removeCena(c.id)} className="btn-icon text-danger" style={{ padding: '4px 8px', fontSize: '10px' }}>Remover</button>
                    ) : (
                      <button onClick={() => addCena(c.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '10px' }}>Adicionar</button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {todasCenas.length === 0 && (
        <div className="text-muted text-sm text-center" style={{ padding: '16px' }}>
          Nenhuma cena programada para esta diária.
        </div>
      )}

      {todasCenas.map(cena => {
        // Se for cena antiga, os planos estão em diaria.planos. Se for nova, estão em planosGlobais
        const isAntiga = !!cena.ambiente && !cena.projeto_id;
        /*
          Ordenados, e não na ordem em que o Dexie devolveu.
          `Plano.numero` é TEXTO, então ordenar por ele direto coloca o 10 antes
          do 2 e perde o 3A no meio. `ordenarPlanos` lê o número como número e
          usa a letra para desempatar — que é como a decupagem numera.
        */
        const planosDaCena = ordenarPlanos(
          isAntiga
            ? (diaria.planos || []).filter(p => p.cena_id === cena.id)
            : planosGlobais.filter(p => p.cena_id === cena.id)
        );
        
        const loc = locacoes.find(l => l.id === cena.locacao_id);
        
        return (
          <div key={cena.id} style={{ border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '40px', fontWeight: 'bold', textAlign: 'center', fontSize: '14px' }}>
                {cena.numero}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span className="font-bold">{cena.descricao}</span>
                <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span style={{ textTransform: 'uppercase' }}>{cena.ambiente} · {cena.periodo}</span>
                  {loc && <span>· {loc.nome}</span>}
                </div>
              </div>
              <button onClick={() => removeCena(cena.id)} className="btn-icon text-muted" style={{ padding: '6px' }} title="Remover da Diária"><Trash2 size={16} /></button>
            </div>

            {/*
              Recolhido por padrão, e isso não é preferência estética: uma cena
              pode ter vinte planos, e três cenas assim transformam a Ordem do
              Dia num rolo em que ninguém acha a cena seguinte. A contagem fica
              visível — é ela que diz se a cena foi decupada ou não.
            */}
            <button
              onClick={() => alternar(cena.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                padding: '10px 12px', cursor: planosDaCena.length ? 'pointer' : 'default',
                background: 'var(--bg-surface)', border: 'none',
                borderTop: '1px solid var(--border-light)',
                color: 'var(--text-secondary)', textAlign: 'left',
              }}
              disabled={planosDaCena.length === 0}
            >
              {planosDaCena.length > 0 && (
                aberta.has(cena.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              )}
              <span className="text-xs font-bold uppercase tracking-widest">
                {resumoDePlanos(planosDaCena.length)}
              </span>
            </button>

            {aberta.has(cena.id) && planosDaCena.length > 0 && (
              <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-surface)' }}>
                {planosDaCena.map(plano => (
                  <div key={plano.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span className="font-bold text-muted" style={{ width: '28px' }}>{plano.numero}</span>
                    <span style={{ flex: 1 }}>{plano.descricao}</span>
                    <span className="text-xs text-secondary">
                      {[plano.tamanho, plano.movimento, plano.lente].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
