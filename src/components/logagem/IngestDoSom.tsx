import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AudioLines, FolderOpen, CheckCircle2, AlertTriangle, Link2, Plus, Wind, Loader2 } from 'lucide-react';
import { db } from '../../db/db';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { MONO, Rotulo, estiloCampo } from './pecas';
import { garantirEstado, idDoEstado } from '../../lib/logagem/estado';
import { aplicarSincronia } from '../../lib/logagem/som';
import {
  acharDesvio, casar, clipesDosTakes, desvioDoBoletim, desvioLegivel, horaDoDia, juntarFaixas, lerCabecalhoWav,
  lerDesvio, planejarSincronia, type AcaoDaSincronia, type ArquivoDoGravador,
} from '../../lib/logagem/sincronia';
import { claqueteLegivel } from '../../lib/logagem/takes';
import { duracaoLegivel } from '../../lib/logagem/nrt';

const ROTULO: Record<AcaoDaSincronia, { texto: string; cor: string }> = {
  conferido: { texto: 'boletim confere', cor: 'var(--color-success)' },
  ligar: { texto: 'liga ao take', cor: 'var(--cor-criativo)' },
  divergente: { texto: 'boletim diz outro take', cor: 'var(--color-warning)' },
  novo: { texto: 'entra no boletim', cor: 'var(--cor-criativo)' },
  no_boletim: { texto: 'só som, já no boletim', cor: 'var(--text-secondary)' },
  sem_video: { texto: 'sem vídeo no horário', cor: 'var(--text-muted)' },
};

/**
 * O ingest do som (PLANO-boletim-de-som, Fase 2): a pasta do cartão do
 * gravador, casada com os clipes da câmera pela hora.
 *
 * Os WAV não saem do computador e nem são lidos inteiros — só o cabeçalho, que
 * diz quando cada arquivo começou. O desvio entre os relógios é achado sozinho
 * (o que mais casa pares) ou vem do próprio boletim ("Som junto"); quem quiser
 * corrige à mão. Nada muda antes do botão de aplicar.
 */
export function IngestDoSom({ projetoId, diariaId, podeEditar, departamentoId, quem }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  quem?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lidos, setLidos] = useState<ArquivoDoGravador[] | null>(null);
  const [lendo, setLendo] = useState<{ feitos: number; total: number } | null>(null);
  const [desvioDigitado, setDesvioDigitado] = useState<number | null>(null);
  const [incluirSemVideo, setIncluirSemVideo] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);

  const dados = useLiveQuery(async () => {
    const [takes, sons, estado] = await Promise.all([
      db.log_takes.where('diaria_id').equals(diariaId).toArray(),
      db.log_som.where('diaria_id').equals(diariaId).toArray(),
      db.log_estado.get(idDoEstado(diariaId)),
    ]);
    return { takes, sons, estado };
  }, [diariaId]);

  if (!podeEditar || !dados) return null;

  const ler = async (lista: FileList | null) => {
    const wavs = [...(lista ?? [])].filter(f => /\.wav$/i.test(f.name));
    setFeito(null);
    setDesvioDigitado(null);
    if (!wavs.length) { setLidos([]); return; }
    setLendo({ feitos: 0, total: wavs.length });
    const cabecalhos: { arquivo: string; cab: Awaited<ReturnType<typeof lerCabecalhoWav>> }[] = [];
    for (const [i, f] of wavs.entries()) {
      cabecalhos.push({ arquivo: f.name, cab: await lerCabecalhoWav(f).catch(() => ({})) });
      setLendo({ feitos: i + 1, total: wavs.length });
    }
    setLendo(null);
    setLidos(juntarFaixas(cabecalhos));
  };

  const clipes = clipesDosTakes(dados.takes);
  const arquivos = lidos ?? [];
  const doBoletim = lidos ? desvioDoBoletim(dados.sons, clipes, arquivos) : null;
  const achado = lidos ? acharDesvio(clipes, arquivos) : null;
  /*
    O horário vem antes do boletim: ele usa TODOS os pares, e o par do boletim
    carrega o atraso de quem apertou REC (3 s, às vezes). O boletim entra
    quando o horário sozinho não prova nada (menos de dois pares).
  */
  const desvio = desvioDigitado ?? achado ?? doBoletim ?? dados.estado?.desvio_som ?? null;
  const origem = desvioDigitado !== null ? 'digitado'
    : achado !== null ? 'achado pelo horário de todos os arquivos'
    : doBoletim !== null ? 'pelo boletim (um arquivo logado com a câmera)'
    : dados.estado?.desvio_som !== undefined ? 'o da última vez' : '';
  const linhas = lidos && desvio !== null ? planejarSincronia(casar(clipes, arquivos, desvio), dados.takes, dados.sons) : [];
  const semSom = lidos && desvio !== null ? casar(clipes, arquivos, desvio).semSom : [];

  const aplicar = async () => {
    if (desvio === null) return;
    setAplicando(true);
    try {
      // Quem vem direto ao Ingest pode nunca ter aberto a Logagem desta diária: o kit de som mora no estado.
      await garantirEstado(projetoId, diariaId, departamentoId);
      const estado = await db.log_estado.get(idDoEstado(diariaId));
      if (!estado) return;
      const r = await aplicarSincronia(estado, linhas, { desvio, incluirSemVideo, quem });
      setFeito(`Pronto: ${r.novos} arquivo${r.novos === 1 ? '' : 's'} novo${r.novos === 1 ? '' : 's'} ligado${r.novos === 1 ? '' : 's'} ao take, ${r.ligados} do boletim ligado${r.ligados === 1 ? '' : 's'}${r.semVideo ? `, ${r.semVideo} sem vídeo como wild` : ''}. O camera report já sai com a coluna Áudio.`);
      setLidos(null);
    } finally {
      setAplicando(false);
    }
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<AudioLines size={14} />}>Som do gravador</Rotulo>
      <p className="text-sm text-secondary" style={{ margin: 0, maxWidth: '64ch' }}>
        Escolha a pasta do cartão do gravador. O app lê a hora em que cada WAV começou e acha o clipe da câmera
        que começou junto — sem timecode, pelo relógio. Precisa do ingest da câmera feito antes: é dele que vem a hora dos clipes.
      </p>

      <input
        ref={entrada}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={e => { void ler(e.target.files); e.target.value = ''; }}
      />
      <BotaoTatil
        onClick={() => entrada.current?.click()}
        disabled={Boolean(lendo)}
        style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '10px', minHeight: '52px', padding: '0 18px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer',
        }}
      >
        {lendo ? <Loader2 size={18} className="girando" /> : <FolderOpen size={18} />}
        {lendo ? `Lendo ${lendo.feitos} de ${lendo.total}…` : lidos ? 'Escolher outra pasta' : 'Escolher a pasta do gravador'}
      </BotaoTatil>

      {feito && (
        <p role="status" className="text-sm" style={{ margin: 0, display: 'flex', gap: '8px', color: 'var(--color-success)' }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> {feito}
        </p>
      )}

      {lidos && lidos.length === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>Nenhum WAV nessa pasta.</p>}

      {lidos && lidos.length > 0 && clipes.length === 0 && (
        <p className="text-sm" style={{ margin: 0, display: 'flex', gap: '8px', color: 'var(--color-warning)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          {lidos.length} arquivo{lidos.length === 1 ? '' : 's'} de som lido{lidos.length === 1 ? '' : 's'}, mas nenhum take desta diária tem a hora da câmera. Faça o ingest do cartão da câmera acima e volte.
        </p>
      )}

      {lidos && lidos.length > 0 && clipes.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span className="text-xs font-bold text-secondary">Relógio do gravador × câmera</span>
              <CampoTexto
                value={desvio === null ? '' : desvioLegivel(desvio)}
                aoGravar={v => setDesvioDigitado(lerDesvio(v))}
                placeholder="+00:00"
                style={{ ...estiloCampo, fontFamily: MONO, width: '140px' }}
              />
            </label>
            <span className="text-xs text-muted" style={{ paddingBottom: '12px', maxWidth: '52ch' }}>
              {desvio === null
                ? 'Não achei a diferença sozinho. Escreva quanto o gravador está adiantado (+) ou atrasado (−) em relação à câmera.'
                : `${desvio >= 0 ? 'O gravador está adiantado' : 'O gravador está atrasado'} ${desvioLegivel(Math.abs(desvio)).slice(1)} em relação à câmera — ${origem}.`}
            </span>
          </div>

          {linhas.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table className="text-sm" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '640px' }}>
                <thead>
                  <tr>
                    {['Arquivo', 'Começou', 'Duração', 'Trilhas', 'Clipe', 'O que acontece'].map(t => (
                      <th key={t} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => {
                    const r = ROTULO[l.acao];
                    const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--border-light)' };
                    return (
                      <tr key={l.arquivo.nome} style={{ opacity: l.acao === 'sem_video' && !incluirSemVideo ? 0.45 : 1 }}>
                        <td style={{ ...td, fontFamily: MONO, fontWeight: 800 }}>{l.arquivo.nome}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{l.arquivo.inicio !== undefined ? horaDoDia(l.arquivo.inicio) : '—'}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{l.arquivo.duracao ? duracaoLegivel(l.arquivo.duracao) : '—'}</td>
                        <td style={{ ...td, color: 'var(--text-secondary)' }}>{l.arquivo.faixas.join(' ') || '—'}</td>
                        <td style={td}>
                          {l.take ? (
                            <span><b style={{ fontFamily: MONO }}>{l.take.arquivo}</b> <span className="text-muted">{claqueteLegivel(l.take)}</span></span>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ ...td, color: r.cor, fontWeight: 700 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {l.acao === 'novo' ? <Plus size={14} /> : l.acao === 'ligar' ? <Link2 size={14} /> : l.acao === 'sem_video' ? <Wind size={14} /> : l.acao === 'divergente' ? <AlertTriangle size={14} /> : null}
                            {r.texto}{l.acao === 'divergente' && l.som ? ` (${l.som.cena}-${l.som.plano} / Tk${l.som.take ?? ''})` : ''}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {semSom.length > 0 && (
            <p className="text-xs text-muted" style={{ margin: 0 }}>
              Clipes sem som no mesmo horário: {semSom.map(c => c.arquivo).join(', ')}. Pode ser plano sem som — ou som gravado em dois pedaços, que vale conferir.
            </p>
          )}

          {linhas.some(l => l.acao === 'sem_video') && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: 'pointer' }}>
              <input type="checkbox" checked={incluirSemVideo} onChange={e => setIncluirSemVideo(e.target.checked)} style={{ width: '18px', height: '18px', accentColor: 'var(--cor-criativo)' }} />
              <span className="text-sm">
                {(n => n === 1 ? 'Trazer o arquivo sem vídeo para o boletim, como wild' : `Trazer os ${n} arquivos sem vídeo para o boletim, como wild`)(linhas.filter(l => l.acao === 'sem_video').length)}
              </span>
            </label>
          )}

          <BotaoTatil
            onClick={() => void aplicar()}
            disabled={aplicando || desvio === null || linhas.length === 0}
            style={{
              alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '52px', padding: '0 20px',
              borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--cor-criativo)', color: '#0b0b0b',
              fontWeight: 800, cursor: aplicando ? 'default' : 'pointer', opacity: desvio === null ? 0.5 : 1,
            }}
          >
            {aplicando ? <Loader2 size={18} className="girando" /> : <CheckCircle2 size={18} />} Aplicar no boletim de som
          </BotaoTatil>
        </>
      )}
    </section>
  );
}
