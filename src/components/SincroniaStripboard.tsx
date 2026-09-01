import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { GitCompare, AlertTriangle, Check } from 'lucide-react';
import {
  aplicarDoStripboard, diferencaDeCenas, estadoDa, semDiferenca, ROTULO_ESTADO,
} from '../lib/sincronizaOD';
import type { Diaria } from '../types';

/**
 * A faixa que liga a Ordem do Dia ao stripboard — a Opção C do plano.
 *
 * ⚠️ ELA NÃO MEXE MAIS NO ESTADO DA DIÁRIA.
 *
 * Tinha "Publicar OD" e "Voltar a rascunho" aqui dentro, e isso escondia o
 * controle mais importante da tela num lugar que só existe quando a diária veio
 * de uma quebra do stripboard — diária montada à mão nunca conseguia sair de
 * rascunho. Pior: aquele "Publicar" publicava sem gerar o documento, criando
 * uma OD publicada que ninguém recebeu.
 *
 * Agora o estado é do `EstadoDaDiaria`, no topo, e publicar é exportar. Aqui
 * ficou só o que é de fato desta faixa: o que mudou no stripboard depois que a
 * OD congelou.
 *
 * Enquanto a diária é RASCUNHO, ela espelha o bloco do stripboard de onde veio:
 * arrastar uma cena lá atualiza a lista aqui, sozinho. Ao PUBLICAR, congela — e
 * mudança no stripboard passa a aparecer como sugestão, com "aplicar" e
 * "ignorar".
 *
 * Por que o congelamento existe: a equipe recebeu o PDF. Se alguém reordenar o
 * stripboard às 23h e a OD de amanhã mudar sozinha, quem vai para o set às 6h
 * está com um papel que não corresponde mais a nada — e ninguém foi avisado.
 *
 * Só aparece quando a diária veio de uma quebra. Diária montada à mão nunca foi
 * espelho de nada, e inventar uma comparação ali seria oferecer para "sincronizar"
 * com um dia que não é o dela.
 */
export function SincroniaStripboard({ diaria }: { diaria: Diaria }) {
  const [ignorado, setIgnorado] = useState(false);
  const [aplicando, setAplicando] = useState(false);

  const cenas = useLiveQuery(
    () => db.cenas.where('projeto_id').equals(diaria.projeto_id).toArray(),
    [diaria.projeto_id]
  );
  const itens = useLiveQuery(
    () => db.stripboard_itens.where('projeto_id').equals(diaria.projeto_id).toArray(),
    [diaria.projeto_id]
  );

  const estado = estadoDa(diaria);
  const pronto = Boolean(cenas && itens);
  const dif = pronto ? diferencaDeCenas(diaria, cenas!, itens!) : null;

  /*
    O espelho do rascunho roda aqui, e não num observador do stripboard.

    Motivo: assim ele é idempotente e não depende de ninguém ter deixado uma
    aba aberta. Abrir a diária É o momento em que a informação importa, e
    recalcular na abertura pega qualquer mudança feita enquanto ninguém olhava.
  */
  useEffect(() => {
    if (!pronto || estado !== 'rascunho' || !diaria.stripboard_item_id) return;
    void aplicarDoStripboard(diaria, cenas!, itens!);
    // `diaria` inteiro na dependência faria laço: aplicar altera a diária.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pronto, estado, diaria.id, diaria.stripboard_item_id, cenas, itens]);

  if (!diaria.stripboard_item_id || !pronto) return null;

  const aplicar = async () => {
    setAplicando(true);
    await aplicarDoStripboard(diaria, cenas!, itens!);
    setAplicando(false);
    setIgnorado(false);
  };

  // ---- rascunho: espelhando ----
  if (estado === 'rascunho') {
    return (
      <Faixa cor="var(--border-color)">
        <GitCompare size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div className="text-sm font-bold">Rascunho — seguindo o stripboard</div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
            Mexeu na linha do tempo, as cenas daqui se atualizam. Ao travar ou publicar, congela.
          </div>
        </div>
      </Faixa>
    );
  }

  if (estado === 'fechada') return null;

  // ---- publicada: congelada ----
  if (dif?.orfa) {
    return (
      <Faixa cor="var(--color-warning, #fbbf24)">
        <AlertTriangle size={16} style={{ color: 'var(--color-warning, #fbbf24)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div className="text-sm font-bold">A quebra de origem sumiu do stripboard</div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.45 }}>
            As cenas desta OD continuam aqui, intactas — só não há mais com o que
            compará-las. Reenvie a partir de uma quebra para religar.
          </div>
        </div>
      </Faixa>
    );
  }

  if (!dif || semDiferenca(dif) || ignorado) {
    return (
      <Faixa cor="var(--border-color)">
        <Check size={16} style={{ color: 'var(--color-success, #4ade80)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '180px' }}>
          <div className="text-sm font-bold">{ROTULO_ESTADO[estado]} — cenas congeladas</div>
          <div className="text-xs text-muted">
            Mudança no stripboard vira aviso aqui, nunca muda a OD sozinha.
          </div>
        </div>
      </Faixa>
    );
  }

  // ---- publicada E o stripboard mudou ----
  return (
    <Faixa cor="var(--accent)">
      <GitCompare size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: '200px' }}>
        <div className="text-sm font-bold">O stripboard mudou depois da publicação</div>
        <div className="text-xs" style={{ lineHeight: 1.5, marginTop: '2px' }}>
          {dif.entram.length > 0 && (
            <div style={{ color: 'var(--color-success, #4ade80)' }}>
              + entram: {dif.entram.map(c => `Cena ${c.numero}`).join(', ')}
            </div>
          )}
          {dif.saem.length > 0 && (
            <div style={{ color: 'var(--color-danger, #f87171)' }}>
              − saem: {dif.saem.map(c => `Cena ${c.numero}`).join(', ')}
            </div>
          )}
        </div>
        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
          A equipe já recebeu esta OD. Se aplicar, mande a versão nova.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button className="btn" onClick={() => setIgnorado(true)}>Ignorar</button>
        <button className="btn btn-primary" onClick={aplicar} disabled={aplicando}>
          {aplicando ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
    </Faixa>
  );
}

function Faixa({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <div className="card" style={{
      display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
      borderLeft: `4px solid ${cor}`,
    }}>
      {children}
    </div>
  );
}
