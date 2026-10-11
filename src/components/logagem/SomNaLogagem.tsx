import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Mic, Wind, Volume2, Trash2, ChevronDown } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, Som } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { confirmar } from '../ui/Confirmacao';
import { Abre, Campo, MONO, Rotulo, Segmentado, estiloCampo } from './pecas';
import { mudarEstado } from '../../lib/logagem/estado';
import {
  ROTULO_DO_STATUS_DO_SOM, apagarSom, arquivoDoSom, claqueteDoSom, mudarSom, ordenarSons, registrarSom,
  resumoDoSom, somJunto, trilhasDoSom,
} from '../../lib/logagem/som';

const COR_DO_SOM: Record<Som['status'], string> = {
  bom: 'var(--color-success)',
  problema: 'var(--color-warning)',
  descartar: 'var(--color-danger)',
};

/**
 * O boletim de som, dentro da Logagem (10/10/2026).
 *
 * Quem loga a câmera loga o som — no set da Canção de Outono foi o
 * continuísta. Com "Junto com a câmera", cada take registrado já cria o arquivo
 * do gravador; aqui fica o que é SÓ som (wild, room tone), o kit do dia e a
 * opinião sobre cada arquivo.
 */
export function SomNaLogagem({ estado, podeEditar, quem, limite }: {
  estado: EstadoDaLogagem;
  podeEditar: boolean;
  quem?: string;
  limite?: number;
}) {
  const sons = useLiveQuery(
    () => db.log_som.where('diaria_id').equals(estado.diaria_id).toArray(),
    [estado.diaria_id],
  ) ?? [];
  const [todos, setTodos] = useState(false);
  const bloqueado = !podeEditar;
  const mudar = (m: Partial<EstadoDaLogagem>) => { if (podeEditar) void mudarEstado(estado.diaria_id, m); };

  const lista = ordenarSons(sons).reverse();
  const visiveis = limite && !todos ? lista.slice(0, limite) : lista;

  const avulso = (tipo: Som['tipo']) => {
    if (!podeEditar) return;
    void (async () => {
      // Do banco: o arquivo pode ter acabado de andar com um take.
      const atual = (await db.log_estado.get(estado.id)) ?? estado;
      await registrarSom(atual, tipo, quem);
    })();
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 22px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        <Rotulo icone={<Mic size={14} />}>Som</Rotulo>
        {sons.length > 0 && <span className="text-xs text-muted">{resumoDoSom(sons)}</span>}
      </div>

      <Segmentado
        nome="logagem-som-junto"
        opcoes={[{ id: 'junto', nome: 'Som junto' }, { id: 'sem', nome: 'Câmera sem som' }]}
        valor={somJunto(estado) ? 'junto' : 'sem'}
        bloqueado={bloqueado}
        aoMudar={v => mudar({ som_junto: v === 'junto' })}
      />
      <p className="text-xs text-muted" style={{ margin: '-4px 0 0' }}>
        {somJunto(estado)
          ? <>Cada take registrado leva o arquivo <b style={{ fontFamily: MONO }}>{arquivoDoSom(estado)}</b>, e o número anda sozinho{estado.audio === 'MOS' ? ' — menos agora, com o áudio em MOS' : ''}.</>
          : 'Os takes saem sem som. O que o som gravar sozinho entra pelos botões abaixo.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
        {([['wild', 'Wild track', Wind], ['room_tone', 'Room tone', Volume2]] as const).map(([tipo, nome, Icone]) => (
          <BotaoTatil
            key={tipo}
            onClick={() => avulso(tipo)}
            disabled={bloqueado}
            escala={0.97}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '56px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontWeight: 700, fontSize: '15px',
              cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? 0.5 : 1,
            }}
          >
            <Icone size={18} /> {nome}
          </BotaoTatil>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <Campo rotulo="Próximo arquivo">
          <CampoTexto
            value={arquivoDoSom(estado)}
            aoGravar={v => mudar({ arquivo_som: v.trim() })}
            disabled={bloqueado}
            style={{ ...estiloCampo, fontFamily: MONO }}
          />
        </Campo>
        <Campo rotulo="Trilhas, na ordem">
          <CampoTexto
            value={trilhasDoSom(estado).join(', ')}
            aoGravar={v => mudar({ trilhas_som: v.split(',').map(t => t.trim()).filter(Boolean) })}
            disabled={bloqueado}
            placeholder="Boom, Lapela Alice, Lapela Nicole"
            style={estiloCampo}
          />
        </Campo>
      </div>

      {visiveis.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border-light)' }}>
          {visiveis.map(s => <LinhaDoSom key={s.id} som={s} podeEditar={podeEditar} />)}
        </div>
      )}
      {limite && lista.length > limite && (
        <button
          type="button"
          onClick={() => setTodos(v => !v)}
          className="text-xs text-secondary"
          style={{ alignSelf: 'flex-start', minHeight: '44px', padding: '0 4px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          {todos ? 'Mostrar só os últimos' : `Ver os ${lista.length} arquivos`}
        </button>
      )}
    </section>
  );
}

/** Um arquivo do gravador: o status, e uma nota por trilha quando precisar. */
function LinhaDoSom({ som, podeEditar }: { som: Som; podeEditar: boolean }) {
  const [aberto, setAberto] = useState(false);
  const notas = som.trilhas.filter(t => t.nota?.trim()).length;

  const apagar = async () => {
    if (!(await confirmar({
      titulo: `Apagar o registro de ${som.arquivo}?`,
      detalhe: 'O arquivo continua no gravador; o que some é o registro dele aqui.',
      confirmar: 'Apagar',
      perigo: true,
    }))) return;
    await apagarSom(som.id);
  };

  const notaDa = (i: number, nota: string) =>
    void mudarSom(som.id, { trilhas: som.trilhas.map((t, j) => (j === i ? { ...t, nota: nota.trim() || undefined } : t)) });

  return (
    <div style={{ borderBottom: '1px solid var(--border-light)', padding: '8px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', backgroundColor: COR_DO_SOM[som.status], flexShrink: 0 }} />
        <span style={{ display: 'flex', flexDirection: 'column', minWidth: '120px', flex: 1 }}>
          <span className="font-bold" style={{ fontFamily: MONO, fontSize: '15px' }}>{som.arquivo}</span>
          <span className="text-xs text-muted">
            {claqueteDoSom(som)} · {som.hora.slice(0, 5)}{som.take_id ? ' · com a câmera' : ''}
            {notas > 0 && ` · ${notas} nota${notas === 1 ? '' : 's'}`}
          </span>
        </span>
        <div role="radiogroup" aria-label={`Status de ${som.arquivo}`} style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(Object.keys(ROTULO_DO_STATUS_DO_SOM) as Som['status'][]).map(st => {
            const ativo = som.status === st;
            return (
              <button
                key={st}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={!podeEditar}
                onClick={() => void mudarSom(som.id, { status: st })}
                style={{
                  minHeight: '44px', padding: '0 10px', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontWeight: 700,
                  border: `1px solid ${ativo ? COR_DO_SOM[st] : 'var(--border-light)'}`,
                  backgroundColor: ativo ? `color-mix(in srgb, ${COR_DO_SOM[st]} 14%, transparent)` : 'transparent',
                  color: ativo ? 'var(--text-primary)' : 'var(--text-muted)', cursor: podeEditar ? 'pointer' : 'default',
                }}
              >
                {ROTULO_DO_STATUS_DO_SOM[st]}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setAberto(v => !v)}
          aria-expanded={aberto}
          aria-label={`Notas das trilhas de ${som.arquivo}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px', border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <ChevronDown size={18} style={{ transform: aberto ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
        </button>
      </div>

      <Abre aberto={aberto}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0 4px 14px' }}>
          {som.trilhas.map((t, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="text-xs text-secondary" style={{ width: '120px', flexShrink: 0 }}>Tr{i + 1} · {t.nome}</span>
              <CampoTexto
                value={t.nota || ''}
                aoGravar={v => notaDa(i, v)}
                disabled={!podeEditar}
                placeholder="clipou, roupa raspando, vento…"
                style={{ ...estiloCampo, flex: 1, minWidth: 0 }}
              />
            </label>
          ))}
          {podeEditar && (
            <button
              type="button"
              onClick={() => void apagar()}
              className="text-xs"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: 600 }}
            >
              <Trash2 size={14} /> Apagar este registro
            </button>
          )}
        </div>
      </Abre>
    </div>
  );
}
