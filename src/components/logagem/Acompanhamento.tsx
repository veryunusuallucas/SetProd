import { useLiveQuery } from 'dexie-react-hooks';
import { Radio } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { ImagemAnexo } from '../ImagemAnexo';
import { MONO, Rotulo, ValorQueTroca } from './pecas';
import { ListaDeTakes } from './RegistroDeTake';
import { COR_DO_STATUS, ROTULO_DO_STATUS, claqueteLegivel } from '../../lib/logagem/takes';
import { nomeArquivoPrevisto } from '../../lib/logagem/nomenclatura';

/**
 * O que está rolando agora, para quem não loga.
 *
 * A pergunta da direção e da produção é "em que cena eles estão?" e "o 3 foi o
 * bom?". Nenhuma das duas se responde com uma tabela de vinte colunas — se
 * responde com a claquete do momento, grande, e o último take com o status.
 *
 * Não há nada para apertar: quem acompanha não deve conseguir mexer no boletim
 * nem sem querer.
 */
export function Acompanhamento({ estado }: { estado: EstadoDaLogagem }) {
  const takes = useLiveQuery(
    () => db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
    [estado.diaria_id]
  ) ?? [];

  const ultimo = [...takes].sort((a, b) => (b.ordem || 0) - (a.ordem || 0))[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '22px' }}>
        <Rotulo icone={<Radio size={14} />}>Agora</Rotulo>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: '16px' }}>
          <Pedaco rotulo="Cena" valor={String(estado.cena)} />
          <Pedaco rotulo="Plano" valor={String(estado.plano)} />
          <Pedaco rotulo="Take" valor={String(estado.take)} cor="var(--cor-criativo)" />
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }} className="text-xs text-secondary">
          <span>câmera <strong>{estado.camera_id}</strong> · cartão <strong>{estado.cartao}</strong></span>
          {estado.lente && <span>{estado.lente}{estado.abertura ? ` · ${estado.abertura}` : ''}</span>}
          {estado.ambiente && <span>{estado.ambiente} · {estado.luz}</span>}
          <span style={{ fontFamily: MONO }}>próximo · {nomeArquivoPrevisto(estado)}</span>
        </div>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
        <Rotulo icone={<Radio size={14} />}>Último take</Rotulo>
        {!ultimo ? (
          <p className="text-sm text-secondary" style={{ margin: 0 }}>Ainda não registraram nenhum take nesta diária.</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {ultimo.foto && (
              <ImagemAnexo
                valor={ultimo.foto}
                alt={`Referência do take ${ultimo.cena}/${ultimo.plano}/${ultimo.take}`}
                estiloLink={{ display: 'block', width: '96px', height: '64px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}
                estiloImagem={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            <span
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${COR_DO_STATUS[ultimo.status]}`, color: COR_DO_STATUS[ultimo.status],
                fontSize: '13px', fontWeight: 800,
              }}
            >
              {ROTULO_DO_STATUS[ultimo.status]}
            </span>
            <span className="text-lg font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {claqueteLegivel(ultimo)}
            </span>
            <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>às {ultimo.hora}</span>
            {ultimo.obs && <span className="text-xs text-secondary" style={{ flex: '1 1 100%' }}>{ultimo.obs}</span>}
          </div>
        )}
      </section>

      <ListaDeTakes takes={takes} podeEditar={false} titulo="O que já foi rodado" />
    </div>
  );
}

function Pedaco({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <span className="text-xs font-bold uppercase tracking-widest text-secondary">{rotulo}</span>
      <ValorQueTroca texto={valor || '—'} rotuloDeLeitura={rotulo} tamanho="clamp(34px, 10vw, 48px)" cor={cor} />
    </div>
  );
}
