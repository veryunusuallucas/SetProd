import { useState } from 'react';
import { db } from '../db/db';
import { Clapperboard, Plus, Trash2, ChevronDown, ChevronRight, Check, CircleSlash, Circle, Scissors, CircleDashed } from 'lucide-react';
import type { Diaria, Cena, StatusCena } from '../types';
import { useLiveQuery } from 'dexie-react-hooks';
import { ordenarPlanos, resumoDePlanos } from '../lib/planos';
import { marcarCena, limparMarcacao, proximoStatus, registroDe, ROTULO, MOTIVOS } from '../lib/registroSet';
import { useRole } from '../hooks/useRole';

/**
 * Cor E ícone, sempre os dois.
 *
 * A Ordem do Dia é fotocopiada, lida no escuro e olhada por gente daltônica. Se
 * a cor for o único sinal, "gravada" e "não gravada" viram a mesma tarja cinza
 * na fotocópia — e ninguém percebe até ser tarde.
 */
const CORES: Record<StatusCena, string> = {
  gravada: 'var(--color-success, #4ade80)',
  parcial: 'var(--color-warning, #fbbf24)',
  nao_gravada: 'var(--color-danger, #f87171)',
  cortada: 'var(--text-muted)',
};

const ICONE: Record<StatusCena, React.ReactNode> = {
  gravada: <Check size={13} />,
  parcial: <CircleDashed size={13} />,
  nao_gravada: <CircleSlash size={13} />,
  cortada: <Scissors size={13} />,
};

export function ShotList({ diaria, locacoes }: { diaria: Diaria, locacoes: any[] }) {
  const [showSelector, setShowSelector] = useState(false);
  const { perfilId: meuPerfilId } = useRole();

  /**
   * O que já foi marcado nesta diária.
   *
   * Consulta por `diaria_id`, e não o projeto inteiro: numa produção longa são
   * centenas de linhas, e a tela do set só precisa das de hoje.
   */
  const registros = useLiveQuery(
    () => db.registros_cena.where('diaria_id').equals(diaria.id).toArray(),
    [diaria.id]
  ) || [];

  const alternarStatus = async (cenaId: string) => {
    const atual = registroDe(registros, diaria.id, cenaId);
    const proximo = proximoStatus(atual?.status);

    /*
      Depois de `cortada`, o toque APAGA a marcação em vez de dar a volta.

      É a única saída de quem marcou a cena errada: sem isto, os quatro rótulos
      eram um caminho de mão única, e nenhum deles significa "eu não sei". E
      apagar de verdade importa — o motivo e a observação que ficaram na linha
      não podem sobreviver a um estado que não existe mais.
    */
    if (!proximo) {
      await limparMarcacao(diaria.id, cenaId);
      return;
    }

    await marcarCena(diaria.projeto_id, diaria.id, cenaId, proximo, {
      registrado_por: meuPerfilId || undefined,
    });
  };

  const definirMotivo = async (cenaId: string, motivo?: string) => {
    const atual = registroDe(registros, diaria.id, cenaId);
    if (atual) await db.registros_cena.update(atual.id, { motivo });
  };

  const definirObservacao = async (cenaId: string, observacao: string) => {
    const atual = registroDe(registros, diaria.id, cenaId);
    if (atual && (atual.observacao || '') !== observacao) {
      await db.registros_cena.update(atual.id, { observacao: observacao || undefined });
    }
  };

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
        const registro = registroDe(registros, diaria.id, cena.id);

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
              {/*
                O botão de estado, e ele vem ANTES da lixeira de propósito: no
                set a mão vai para o mesmo canto o dia inteiro, e trocar a ordem
                depois faria alguém apagar uma cena querendo marcá-la.

                Um toque avança o ciclo. Sem confirmação: marcação errada se
                desfaz com outro toque, e um modal a cada cena tornaria a tela
                inútil justamente quando ela precisa ser rápida.
              */}
              <button
                onClick={() => alternarStatus(cena.id)}
                title={
                  !registro
                    ? 'Marcar o que aconteceu'
                    : registro.status === 'cortada'
                      // O último do ciclo: o próximo toque limpa. Dizer isso
                      // aqui é o que torna a saída encontrável — ninguém
                      // descobre sozinho que existe um quinto toque.
                      ? 'Cortada — toque para tirar a marcação'
                      : `${ROTULO[registro.status]} — toque para mudar`
                }
                style={{
                  padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  border: `1px solid ${registro ? CORES[registro.status] : 'var(--border-color)'}`,
                  background: 'transparent',
                  color: registro ? CORES[registro.status] : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                {/* Cor NUNCA sozinha: OD fotocopiada em preto e branco, set no
                    escuro, daltonismo. O ícone e o texto carregam o significado. */}
                {registro ? ICONE[registro.status] : <Circle size={13} />}
                {registro ? ROTULO[registro.status] : 'marcar'}
              </button>

              <button onClick={() => removeCena(cena.id)} className="btn-icon text-muted" style={{ padding: '6px' }} title="Remover da Diária"><Trash2 size={16} /></button>
            </div>

            {/*
              O motivo só aparece quando faz sentido perguntar. "Cena 42 adiada
              por causa de luz, grava amanhã cedo" vale muito mais que "cena 42
              não gravada" — é o motivo que orienta a decisão seguinte, e é o
              que a produção vai querer ler quando o cronograma apertar.
            */}
            {registro && (registro.status === 'nao_gravada' || registro.status === 'parcial') && (
              <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', background: 'var(--bg-primary)', borderTop: '1px solid var(--border-light)' }}>
                <span className="text-xs text-muted" style={{ marginRight: '2px' }}>por quê:</span>
                {MOTIVOS.map(m => (
                  <button
                    key={m}
                    onClick={() => definirMotivo(cena.id, registro.motivo === m ? undefined : m)}
                    style={{
                      padding: '3px 9px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px',
                      border: '1px solid var(--border-light)',
                      background: registro.motivo === m ? 'var(--accent)' : 'transparent',
                      color: registro.motivo === m ? '#1a1508' : 'var(--text-secondary)',
                      fontWeight: registro.motivo === m ? 700 : 400,
                    }}
                  >
                    {m}
                  </button>
                ))}
                <input
                  defaultValue={registro.observacao || ''}
                  onBlur={e => definirObservacao(cena.id, e.target.value)}
                  placeholder="ou escreva…"
                  style={{
                    flex: 1, minWidth: '120px', padding: '3px 8px', fontSize: '12px',
                    borderRadius: '6px', border: '1px solid var(--border-light)',
                    background: 'transparent', color: 'var(--text-primary)',
                  }}
                />
              </div>
            )}

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
