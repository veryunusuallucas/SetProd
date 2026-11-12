import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Film, Mic, Unlink, Link2, Plus } from 'lucide-react';
import type { Som, Take } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { MONO, estiloCampo } from './pecas';
import { desgrudarSom, grudarSom, sonsParaGrudar, takesParaGrudar, arquivoDoSom } from '../../lib/logagem/som';
import { ROTULO_DO_STATUS, somParaOTake } from '../../lib/logagem/takes';
import { db } from '../../db/db';
import { idDoEstado } from '../../lib/logagem/estado';
import { vibrar } from '../../lib/vibracao';

/**
 * A ligação vídeo↔áudio, dos dois lados (Logagem v2, passo 2, 11/11/2026).
 *
 * No set, o OK gruda os dois — e às vezes gruda errado: o som ficou de fora, o
 * áudio é de outro take, o wild era na verdade o som do plano. Aqui se vê com
 * quem cada um está e se acerta: desgrudar, grudar em outro, criar o que falta.
 * Nenhum contador anda: os arquivos já existem, só a ligação muda.
 */

const claquete = (t: Pick<Take, 'cena' | 'plano' | 'take'>) => `${t.cena}/${t.plano}/${t.take}`;

/** A ficha da ligação: "🎬 A001C002" / "solto", ou "🎙 ZOOM0002" / "sem áudio". Tocar abre o acerto. */
export function FichaDoVinculo({ lado, rotulo, ligado, aberta, aoTocar, desligada }: {
  lado: 'video' | 'audio';
  rotulo: string;
  ligado: boolean;
  aberta: boolean;
  aoTocar: () => void;
  desligada?: boolean;
}) {
  const Icone = lado === 'video' ? Film : Mic;
  return (
    <button
      type="button"
      onClick={aoTocar}
      disabled={desligada}
      aria-expanded={aberta}
      title={ligado ? 'Gravado junto — tocar para desgrudar ou trocar' : 'Sem ligação — tocar para grudar'}
      className="text-xs font-bold"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px', minHeight: '28px', padding: '0 9px',
        borderRadius: 'var(--radius-full)', cursor: desligada ? 'default' : 'pointer', whiteSpace: 'nowrap',
        border: `1px ${ligado ? 'solid' : 'dashed'} ${aberta ? 'var(--cor-criativo)' : 'var(--border-color)'}`,
        backgroundColor: ligado ? 'var(--bg-surface)' : 'transparent',
        color: ligado ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <Icone size={12} aria-hidden />
      <span style={{ fontFamily: ligado ? MONO : undefined }}>{rotulo}</span>
    </button>
  );
}

const botao: React.CSSProperties = { minHeight: '44px', display: 'inline-flex', alignItems: 'center', gap: '6px' };

/** Pelo lado do som: com que vídeo ele está, e trocar. */
export function EditorDoVideo({ som, takes, sons, podeEditar, aoFechar }: {
  som: Som; takes: Take[]; sons: Som[]; podeEditar: boolean; aoFechar: () => void;
}) {
  const atual = takes.find(t => t.id === som.take_id);
  const opcoes = takesParaGrudar(som, takes, sons);
  const [escolhido, setEscolhido] = useState(opcoes[0]?.take.id ?? '');
  const alvo = opcoes.find(o => o.take.id === escolhido);

  const grudar = async () => {
    if (!alvo) return;
    await grudarSom(som.id, alvo.take);
    vibrar('ok');
    aoFechar();
  };
  const desgrudar = async () => {
    await desgrudarSom(som.id);
    vibrar('toque');
    aoFechar();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
      <span className="text-sm">
        {atual
          ? <><b style={{ fontFamily: MONO }}>{som.arquivo}</b> foi gravado junto com o vídeo <b style={{ fontFamily: MONO }}>{atual.arquivo}</b> (take {claquete(atual)}, {ROTULO_DO_STATUS[atual.status]}).</>
          : <><b style={{ fontFamily: MONO }}>{som.arquivo}</b> está solto: não é o áudio de nenhum vídeo.</>}
      </span>
      {opcoes.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="text-xs font-bold text-secondary">{atual ? 'Era de outro vídeo? Grudar em' : 'Grudar no vídeo'}</span>
          <select value={escolhido} onChange={e => setEscolhido(e.target.value)} disabled={!podeEditar} style={estiloCampo}>
            {opcoes.map(({ take, audios }) => (
              <option key={take.id} value={take.id}>
                {take.arquivo} · take {claquete(take)} · {take.hora.slice(0, 5)} · {audios.length ? `já tem ${audios.join(', ')}` : 'sem áudio'}
              </option>
            ))}
          </select>
          {alvo?.audios.length ? (
            <span className="text-xs text-muted">Esse vídeo já tem {alvo.audios.join(', ')}. Os dois ficam nele (som partido em dois arquivos); desgrude o outro se ele não for de lá.</span>
          ) : null}
        </label>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {alvo && (
          <BotaoTatil onClick={() => void grudar()} disabled={!podeEditar} className="btn-primary" style={botao}>
            <Link2 size={15} /> Grudar em {alvo.take.arquivo}
          </BotaoTatil>
        )}
        {atual && (
          <BotaoTatil onClick={() => void desgrudar()} disabled={!podeEditar} className="btn-secondary" style={botao}>
            <Unlink size={15} /> Desgrudar
          </BotaoTatil>
        )}
        <BotaoTatil onClick={aoFechar} className="btn-secondary" style={botao}>Fechar</BotaoTatil>
      </div>
    </div>
  );
}

/** Pelo lado do vídeo: que áudio ele tem, e acertar — inclusive criar o que faltou. */
export function EditorDoAudio({ take, sons, quem, podeEditar, aoFechar }: {
  take: Take; sons: Som[]; quem?: string; podeEditar: boolean; aoFechar: () => void;
}) {
  const casados = sons.filter(s => s.take_id === take.id);
  const opcoes = sonsParaGrudar(take, sons);
  const [escolhido, setEscolhido] = useState(opcoes[0]?.id ?? '');
  const alvo = opcoes.find(s => s.id === escolhido);
  // O nome que "criar" vai usar: o próximo do gravador, como no OK.
  const proximo = useLiveQuery(async () => {
    const e = await db.log_estado.get(idDoEstado(take.diaria_id));
    return e ? arquivoDoSom(e) : undefined;
  }, [take.diaria_id]);

  const feito = (padrao: 'ok' | 'toque') => { vibrar(padrao); aoFechar(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '640px' }}>
      <span className="text-sm">
        {casados.length
          ? <>O vídeo <b style={{ fontFamily: MONO }}>{take.arquivo}</b> tem o áudio {casados.map(s => <b key={s.id} style={{ fontFamily: MONO }}>{s.arquivo} </b>)}.</>
          : <>O vídeo <b style={{ fontFamily: MONO }}>{take.arquivo}</b> está sem áudio.</>}
      </span>
      {casados.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {casados.map(s => (
            <BotaoTatil key={s.id} onClick={() => void desgrudarSom(s.id).then(() => feito('toque'))} disabled={!podeEditar} className="btn-secondary" style={botao}>
              <Unlink size={15} /> Desgrudar {s.arquivo}
            </BotaoTatil>
          ))}
        </div>
      )}
      {opcoes.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span className="text-xs font-bold text-secondary">Grudar um áudio que já está no boletim</span>
          <select value={escolhido} onChange={e => setEscolhido(e.target.value)} disabled={!podeEditar} style={estiloCampo}>
            {opcoes.map(s => (
              <option key={s.id} value={s.id}>
                {s.arquivo} · {s.tipo === 'take' ? `${s.cena}/${s.plano}/${s.take ?? ''}` : s.tipo === 'wild' ? 'wild track' : 'room tone'} · {s.hora.slice(0, 5)} · {s.take_id ? 'grudado em outro vídeo' : 'solto'}
              </option>
            ))}
          </select>
          {alvo?.take_id && <span className="text-xs text-muted">Esse áudio sai do vídeo em que está e vem para este.</span>}
        </label>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {alvo && (
          <BotaoTatil onClick={() => void grudarSom(alvo.id, take).then(() => feito('ok'))} disabled={!podeEditar} className="btn-primary" style={botao}>
            <Link2 size={15} /> Grudar {alvo.arquivo}
          </BotaoTatil>
        )}
        <BotaoTatil onClick={() => void somParaOTake(take, quem).then(() => feito('ok'))} disabled={!podeEditar} className="btn-secondary" style={botao}>
          <Plus size={15} /> Criar áudio novo{proximo ? ` (${proximo})` : ''}
        </BotaoTatil>
        <BotaoTatil onClick={aoFechar} className="btn-secondary" style={botao}>Fechar</BotaoTatil>
      </div>
    </div>
  );
}
