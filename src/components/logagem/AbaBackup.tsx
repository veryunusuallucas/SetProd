import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  HardDrive, ShieldCheck, ShieldAlert, FileCheck2, Plus, Trash2, X, Check, Files, Camera, ChevronDown,
} from 'lucide-react';
import { db } from '../../db/db';
import type { BackupDeCartao, ChecksumDeCartao, HdDeBackup, Take } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import { Abre, Rotulo, estiloCampo } from './pecas';
import { Guia } from './Guia';
import { idDoEstado } from '../../lib/logagem/estado';
import { guardarArquivo, apagarArquivo } from '../../lib/arquivos';
import { dataHora, numero } from '../../lib/formato';
import {
  anexarChecksum, apagarChecksum, apagarHd, cartaoSeguro, cartoesConhecidos,
  criarHd, desmarcarBackup, detectarCartao, estimativaDoCartaoGB, marcarBackup, oQueFalta,
} from '../../lib/logagem/backup';
import { ExportarRelatorios } from './ExportarRelatorios';

/**
 * Aba Backup: o cartão pode ser formatado?
 *
 * É a única tela da Logagem que impede uma perda irreversível. Tudo aqui está a
 * serviço de uma frase só — **Safe to Format** ou **ainda não** — e, quando é
 * "ainda não", de dizer o que falta, e não só que falta.
 *
 * Verde só com cópia em TODOS os HDs cadastrados e com o comprovante de
 * verificação anexado. Nada de "quase": um cartão quase copiado se formata do
 * mesmo jeito.
 *
 * A TELA SEGUE O CAMINHO DO CARTÃO (leva de design, 16/09/2026). Backup é o que
 * a Fotografia menos pratica, e a primeira versão mostrava as peças soltas —
 * HDs, cartões, comprovantes — sem dizer a ordem. Agora: o veredito em cima,
 * o guia de três passos, e cada cartão como uma lista desses mesmos passos,
 * com o comprovante DENTRO do cartão a que pertence.
 */
export function AbaBackup({ projetoId, diariaId, podeEditar, departamentoId, quem }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  quem?: string;
}) {
  const hds = useLiveQuery(() => db.log_hds.where('projeto_id').equals(projetoId).toArray(), [projetoId]) ?? [];
  const takes = useLiveQuery(() => db.log_takes.where('diaria_id').equals(diariaId).toArray(), [diariaId]) ?? [];
  const backups = useLiveQuery(() => db.log_backups.where('diaria_id').equals(diariaId).toArray(), [diariaId]) ?? [];
  const checksums = useLiveQuery(() => db.log_checksums.where('diaria_id').equals(diariaId).toArray(), [diariaId]) ?? [];
  const estado = useLiveQuery(() => db.log_estado.get(idDoEstado(diariaId)), [diariaId]);

  const emOrdem = [...hds].sort((a, b) => a.ordem - b.ordem || a.criado_em - b.criado_em);
  const cartoes = cartoesConhecidos({ takes, backups, checksums, cartaoAtual: estado?.cartao });
  /*
    O cartão que está na câmera e ainda não gravou nada não conta no veredito:
    não há o que copiar, e "1 de 3 liberados" por causa dele assusta à toa.
  */
  const vazioNaCamera = (cartao: string) =>
    cartao === String(estado?.cartao || '').trim()
    && !takes.some(t => String(t.cartao).trim() === cartao)
    && !backups.some(b => String(b.cartao).trim() === cartao)
    && !checksums.some(c => String(c.cartao).trim() === cartao);
  const comMaterial = cartoes.filter(c => !vazioNaCamera(c));
  const seguros = comMaterial.filter(cartao => cartaoSeguro({ hds: emOrdem, backups, checksums, cartao }));

  const anexar = async (arquivo: File, cartao: string) => {
    const texto = await arquivo.text();
    const referencia = await guardarArquivo(projetoId, arquivo, arquivo.name, arquivo.type || 'text/plain');
    await anexarChecksum({
      projetoId, diariaId, cartao, nomeArquivo: arquivo.name, texto, arquivo: referencia, quem, departamentoId,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Veredito cartoes={comMaterial} seguros={seguros} semHd={emOrdem.length === 0} />

      <Guia
        id="backup"
        titulo="Como funciona o backup"
        passos={[
          {
            titulo: 'Copie o cartão para cada HD',
            texto: <>Com o programa de cópia que verifica o que copiou — o <em>Clone</em> do DaVinci Resolve, o Hedge ou o Silverstack. Copiar arrastando pasta não verifica nada.</>,
          },
          {
            titulo: 'Marque aqui em quais HDs ele já está',
            texto: 'Um toque no nome do HD, dentro do cartão. Quem copia marca — o DIT no computador e o 2º assistente no celular, cada um o seu.',
          },
          {
            titulo: 'Anexe o comprovante daquele cartão',
            texto: <>O arquivo que o programa gera ao terminar a verificação: <code>.mhl</code> no DaVinci, <code>md5sums.txt</code> em outros. Ele prova que a cópia bate com o original, arquivo por arquivo.</>,
          },
        ]}
        fecho={<>Com os três, o cartão fica <strong style={{ color: 'var(--color-success)' }}>Safe to Format</strong> e pode voltar para a câmera. Antes disso, não formate — nem que falte um HD só.</>}
      />

      {emOrdem.length === 0 && (
        <Hds hds={emOrdem} projetoId={projetoId} departamentoId={departamentoId} podeEditar={podeEditar} primeiraVez />
      )}

      <Cartoes
        cartoes={cartoes}
        hds={emOrdem}
        takes={takes}
        backups={backups}
        checksums={checksums}
        cartaoAtual={estado?.cartao}
        podeEditar={podeEditar}
        aoMarcar={(cartao, hdId) => void marcarBackup({ projetoId, diariaId, cartao, hdId, quem, departamentoId })}
        aoDesmarcar={id => void desmarcarBackup(id)}
        aoAnexar={anexar}
      />

      {emOrdem.length > 0 && (
        <Hds hds={emOrdem} projetoId={projetoId} departamentoId={departamentoId} podeEditar={podeEditar} />
      )}

      <ExportarRelatorios projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} quem={quem} />
    </div>
  );
}

/* ───────────────────────── Veredito ───────────────────────── */

/** A resposta em uma linha, antes de qualquer detalhe: pode formatar? */
function Veredito({ cartoes, seguros, semHd }: { cartoes: string[]; seguros: string[]; semHd: boolean }) {
  if (cartoes.length === 0) return null;
  const todos = seguros.length === cartoes.length;
  const cor = todos ? 'var(--color-success)' : 'var(--color-warning)';
  const titulo = todos
    ? (cartoes.length === 1 ? 'O cartão pode ser formatado' : 'Todos os cartões podem ser formatados')
    : seguros.length === 0
      ? (cartoes.length === 1 ? 'O cartão ainda não pode ser formatado' : 'Nenhum cartão pode ser formatado ainda')
      : `${seguros.length} de ${cartoes.length} cartões podem ser formatados`;

  return (
    <section
      className="card"
      aria-live="polite"
      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', borderLeft: `4px solid ${cor}` }}
    >
      {todos ? <ShieldCheck size={28} style={{ color: cor, flexShrink: 0 }} /> : <ShieldAlert size={28} style={{ color: cor, flexShrink: 0 }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
        <span className="font-bold" style={{ fontSize: '17px' }}>{titulo}</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {cartoes.map(c => {
            const ok = seguros.includes(c);
            return (
              <span
                key={c}
                className="text-xs font-bold"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px',
                  fontVariantNumeric: 'tabular-nums',
                  color: ok ? 'var(--color-success)' : 'var(--color-warning)',
                  backgroundColor: ok ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                }}
              >
                {ok ? <Check size={12} /> : null}{c}
              </span>
            );
          })}
        </div>
        {semHd && <span className="text-xs text-muted">Comece cadastrando os HDs para onde o material vai.</span>}
      </div>
    </section>
  );
}

/* ───────────────────────── HDs ───────────────────────── */

function Hds({ hds, projetoId, departamentoId, podeEditar, primeiraVez }: {
  hds: HdDeBackup[];
  projetoId: string;
  departamentoId?: string;
  podeEditar: boolean;
  /** Sem HD nenhum: o bloco sobe para o topo e fala como primeiro passo. */
  primeiraVez?: boolean;
}) {
  const [nome, setNome] = useState('');

  const acrescentar = async () => {
    const limpo = nome.trim();
    if (!limpo) return;
    await criarHd(projetoId, limpo, hds.length, departamentoId);
    setNome('');
  };

  const tirar = async (id: string, comoSeChama: string) => {
    if (!(await confirmar({
      titulo: `Tirar o ${comoSeChama} da lista?`,
      detalhe: 'As marcações de cópia para ele somem junto — um cartão não pode ficar liberado por causa de um HD que não existe mais.',
      confirmar: 'Tirar',
      perigo: true,
    }))) return;
    await apagarHd(id);
  };

  return (
    <section
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px',
        ...(primeiraVez ? { border: '1.5px solid var(--cor-criativo)' } : {}),
      }}
    >
      <Rotulo icone={<HardDrive size={14} />}>{primeiraVez ? 'Primeiro: os HDs de destino' : 'HDs desta produção'}</Rotulo>
      <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>
        {primeiraVez
          ? 'Para onde o material é copiado — normalmente dois, em lugares diferentes. Cadastra uma vez e vale para a produção inteira.'
          : 'Valem para todas as diárias. O cartão só fica liberado quando está em todos eles.'}
      </p>

      {hds.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {hds.map(h => (
            <span
              key={h.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: `0 ${podeEditar ? 0 : 14}px 0 14px`,
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-primary)', fontSize: '14px', fontWeight: 600,
              }}
            >
              <HardDrive size={14} style={{ color: 'var(--text-muted)' }} />
              {h.nome}
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => void tirar(h.id, h.nome)}
                  aria-label={`Tirar o ${h.nome}`}
                  title={`Tirar o ${h.nome}`}
                  style={{
                    /* 44px de alvo com um X pequeno dentro: o dedo acerta sem
                       o chip do HD virar um botão gigante de remover. */
                    width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: 'none', borderRadius: '8px', background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {podeEditar ? (
        <form onSubmit={e => { e.preventDefault(); void acrescentar(); }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="HD Preto, Shuttle 01, RAID da ilha…"
            aria-label="Nome do HD"
            style={{ ...estiloCampo, flex: '1 1 200px', width: 'auto' }}
          />
          <BotaoTatil type="submit" disabled={!nome.trim()} className="btn-primary" style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Cadastrar HD
          </BotaoTatil>
        </form>
      ) : hds.length === 0 && (
        <p className="text-sm text-muted" style={{ margin: 0 }}>Nenhum HD cadastrado ainda.</p>
      )}
    </section>
  );
}

/* ───────────────────────── Cartões ───────────────────────── */

function Cartoes({ cartoes, hds, takes, backups, checksums, cartaoAtual, podeEditar, aoMarcar, aoDesmarcar, aoAnexar }: {
  cartoes: string[];
  hds: HdDeBackup[];
  takes: Take[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  cartaoAtual?: string;
  podeEditar: boolean;
  aoMarcar: (cartao: string, hdId: string) => void;
  aoDesmarcar: (id: string) => void;
  aoAnexar: (arquivo: File, cartao: string) => Promise<void>;
}) {
  const varios = useRef<HTMLInputElement>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  /*
    Vários comprovantes de uma vez (o DIT que copiou três cartões seguidos):
    cada arquivo descobre o seu cartão pelo nome ou pelo conteúdo. O que não
    se descobre NÃO é anexado a um cartão qualquer — fica listado, para a
    pessoa anexar pelo botão do cartão certo.
  */
  const anexarVarios = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const feitos: string[] = [];
    const sobras: string[] = [];
    for (const arquivo of [...lista]) {
      try {
        const cartao = detectarCartao(arquivo.name, await arquivo.text(), cartoes);
        if (!cartao) { sobras.push(arquivo.name); continue; }
        await aoAnexar(arquivo, cartao);
        feitos.push(`${arquivo.name} → ${cartao}`);
      } catch {
        sobras.push(arquivo.name);
      }
    }
    setAviso(sobras.length
      ? { tipo: 'erro', texto: `${feitos.length ? `Anexados: ${feitos.join(', ')}. ` : ''}Não deu para saber o cartão de: ${sobras.join(', ')}. Anexe pelo botão do cartão certo.` }
      : { tipo: 'ok', texto: `Anexados: ${feitos.join(', ')}.` });
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: 'clamp(14px, 3vw, 22px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 12px', flexWrap: 'wrap' }}>
        <Rotulo icone={<ShieldCheck size={14} />}>Cartões desta diária</Rotulo>
        {podeEditar && cartoes.length > 1 && (
          <>
            <BotaoTatil
              onClick={() => varios.current?.click()}
              title="Cada arquivo descobre o seu cartão pelo nome ou pelo conteúdo"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 12px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'none',
                color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Files size={14} /> Anexar vários comprovantes
            </BotaoTatil>
            <input
              ref={varios}
              type="file"
              multiple
              hidden
              accept=".txt,.mhl,.md5,.xml,.csv,text/*"
              onChange={e => { void anexarVarios(e.target.files); e.target.value = ''; }}
            />
          </>
        )}
      </div>

      {aviso && (
        <p className="text-xs" role="status" style={{ margin: 0, color: aviso.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {aviso.texto}
        </p>
      )}

      {cartoes.length === 0 ? (
        <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>
          Nenhum cartão ainda. Ele aparece aqui sozinho quando o primeiro take é registrado, ou quando o cartão da câmera
          muda na aba Câmera.
        </p>
      ) : (
        /*
          Um bloco por CARTÃO, e não uma tabela: uma coluna por HD não cabe
          num celular de 360px, e a coluna que interessa — "pode formatar?" —
          seria a última, justamente a que sairia da tela.
        */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cartoes.map(cartao => (
            <Cartao
              key={cartao}
              cartao={cartao}
              cartoes={cartoes}
              hds={hds}
              takes={takes}
              backups={backups}
              checksums={checksums}
              naCamera={String(cartaoAtual || '').trim() === cartao}
              podeEditar={podeEditar}
              aoMarcar={aoMarcar}
              aoDesmarcar={aoDesmarcar}
              aoAnexar={aoAnexar}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Cartao({ cartao, cartoes, hds, takes, backups, checksums, naCamera, podeEditar, aoMarcar, aoDesmarcar, aoAnexar }: {
  cartao: string;
  cartoes: string[];
  hds: HdDeBackup[];
  takes: Take[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  naCamera: boolean;
  podeEditar: boolean;
  aoMarcar: (cartao: string, hdId: string) => void;
  aoDesmarcar: (id: string) => void;
  aoAnexar: (arquivo: File, cartao: string) => Promise<void>;
}) {
  const reduzido = useMovimentoReduzido();
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  /** Cartão liberado fica recolhido: o trabalho dele acabou, e a tela é de quem ainda falta. */
  const [verPassos, setVerPassos] = useState(false);

  const seguro = cartaoSeguro({ hds, backups, checksums, cartao });
  const falta = oQueFalta({ hds, backups, checksums, cartao });
  const gb = estimativaDoCartaoGB(takes, cartao);
  const nTakes = takes.filter(t => String(t.cartao).trim() === cartao).length;
  const cor = seguro ? 'var(--color-success)' : 'var(--color-warning)';

  // Na câmera e sem nada ainda: uma linha, e não três passos por fazer.
  const vazioNaCamera = naCamera && nTakes === 0
    && !backups.some(b => String(b.cartao).trim() === cartao)
    && !checksums.some(c => String(c.cartao).trim() === cartao);

  const copiados = hds.filter(h => backups.some(b => b.hd_id === h.id && String(b.cartao).trim() === cartao)).length;
  const comprovantes = checksums
    .filter(c => String(c.cartao).trim() === cartao)
    .sort((a, b) => b.anexado_em - a.anexado_em);

  const ler = async (arquivo?: File) => {
    if (!arquivo) return;
    setErro('');
    setLendo(true);
    try {
      // A detecção vira conferência: anexar no cartão errado é o engano mais
      // fácil desta tela, e o arquivo quase sempre diz de quem ele é.
      const outro = detectarCartao(arquivo.name, await arquivo.text(), cartoes);
      if (outro && outro !== cartao) {
        const mesmo = await confirmar({
          titulo: `Este comprovante parece ser do cartão ${outro}`,
          detalhe: `O nome ou o conteúdo de ${arquivo.name} fala do ${outro}. Anexar no ${cartao} liberaria o cartão errado.`,
          confirmar: `Anexar no ${cartao} mesmo`,
          cancelar: 'Cancelar',
        });
        if (!mesmo) return;
      }
      await aoAnexar(arquivo, cartao);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.');
    } finally {
      setLendo(false);
    }
  };

  const tirar = async (c: ChecksumDeCartao) => {
    if (!(await confirmar({
      titulo: `Apagar o comprovante do cartão ${c.cartao}?`,
      detalhe: 'O cartão volta a ficar não liberado até outro comprovante ser anexado.',
      confirmar: 'Apagar',
      perigo: true,
    }))) return;
    await apagarChecksum(c.id);
    if (c.arquivo) void apagarArquivo(c.arquivo);
  };

  if (vazioNaCamera) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 14px',
        borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-light)',
      }}>
        <span className="font-bold" style={{ fontSize: '18px', fontVariantNumeric: 'tabular-nums' }}>{cartao}</span>
        <span className="text-xs text-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Camera size={12} /> na câmera, sem take ainda
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: '14px', padding: '14px',
        borderRadius: 'var(--radius-md)', border: `1px solid ${seguro ? cor : 'var(--border-light)'}`,
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* Quem é o cartão, e o veredito */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px 10px', flexWrap: 'wrap' }}>
        <span className="font-bold" style={{ fontSize: '22px', fontVariantNumeric: 'tabular-nums' }}>{cartao}</span>
        <span className="text-xs text-muted">
          {nTakes} take{nTakes === 1 ? '' : 's'}{gb > 0 ? ` · ~${numero(gb, gb < 10 ? 1 : 0)} GB` : ''}
        </span>
        {naCamera && (
          <span className="text-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            <Camera size={12} /> na câmera
          </span>
        )}
        <motion.span
          layout={!reduzido}
          transition={MOLA}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            backgroundColor: seguro ? 'var(--color-success)' : 'transparent',
            border: `1px solid ${cor}`, color: seguro ? '#0b0b0b' : cor, fontSize: '12px', fontWeight: 800,
          }}
        >
          {seguro ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {seguro ? 'Safe to Format' : 'Não formatar'}
        </motion.span>
      </div>

      {naCamera && !seguro && (
        <p className="text-xs text-muted" style={{ margin: '-6px 0 0' }}>
          Ainda está gravando. Copie depois de tirar o cartão da câmera.
        </p>
      )}

      {seguro && (
        <button
          type="button"
          onClick={() => setVerPassos(v => !v)}
          aria-expanded={verPassos}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', margin: '-6px 0', padding: 0,
            border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span className="text-sm" style={{ flex: 1, minWidth: 0 }}>
            Em {hds.map(h => h.nome).join(' e ')} · comprovante {comprovantes[0]?.nome_arquivo}
          </span>
          <motion.span animate={{ rotate: verPassos ? 180 : 0 }} transition={reduzido ? { duration: 0 } : MOLA} style={{ display: 'flex', flexShrink: 0 }}>
            <ChevronDown size={16} />
          </motion.span>
        </button>
      )}

      <Abre aberto={!seguro || verPassos}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Passo 1: os HDs */}
          <Passo numero={1} feito={hds.length > 0 && copiados === hds.length} titulo={
            hds.length === 0 ? 'Copiar para os HDs' : `Copiado para ${copiados} de ${hds.length} HD${hds.length === 1 ? '' : 's'}`
          }>
            {hds.length === 0 ? (
              <span className="text-xs text-muted">Cadastre os HDs no bloco acima.</span>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {hds.map(h => {
                  const linha = backups.find(b => b.hd_id === h.id && String(b.cartao).trim() === cartao);
                  const marcado = Boolean(linha);
                  return (
                    <BotaoTatil
                      key={h.id}
                      role="checkbox"
                      aria-checked={marcado}
                      disabled={!podeEditar}
                      escala={0.97}
                      onClick={() => (marcado ? aoDesmarcar(linha!.id) : aoMarcar(cartao, h.id))}
                      title={marcado ? `Copiado para ${h.nome} — tocar desmarca` : `Marcar como copiado para ${h.nome}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 14px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px ${marcado ? 'solid' : 'dashed'} ${marcado ? 'var(--color-success)' : 'var(--border-color)'}`,
                        backgroundColor: marcado ? 'color-mix(in srgb, var(--color-success) 12%, transparent)' : 'transparent',
                        color: marcado ? 'var(--color-success)' : 'var(--text-secondary)',
                        fontSize: '14px', fontWeight: 700,
                        cursor: podeEditar ? 'pointer' : 'default', opacity: podeEditar || marcado ? 1 : 0.5,
                      }}
                    >
                      {marcado ? <Check size={15} /> : <HardDrive size={15} />}
                      {h.nome}
                    </BotaoTatil>
                  );
                })}
              </div>
            )}
          </Passo>

          {/* Passo 2: o comprovante, dentro do cartão a que pertence */}
          <Passo numero={2} feito={comprovantes.length > 0} titulo={comprovantes.length ? 'Comprovante anexado' : 'Anexar o comprovante da verificação'}>
            {comprovantes.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '4px 10px', flexWrap: 'wrap' }}>
                <FileCheck2 size={14} style={{ color: 'var(--color-success)' }} aria-hidden />
                <span className="text-sm" style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{c.nome_arquivo}</span>
                <span className="text-xs text-muted" title={c.digest}>{c.algoritmo} {c.digest.slice(0, 10)}… · {c.linhas} linha{c.linhas === 1 ? '' : 's'} · {dataHora(c.anexado_em)}</span>
                {podeEditar && (
                  <button
                    type="button"
                    onClick={() => void tirar(c)}
                    aria-label={`Apagar o comprovante ${c.nome_arquivo}`}
                    title="Apagar este comprovante"
                    style={{
                      marginLeft: 'auto', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: 'none', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
            {podeEditar && (
              <>
                <BotaoTatil
                  onClick={() => entrada.current?.click()}
                  disabled={lendo}
                  style={{
                    alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 14px',
                    borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', backgroundColor: 'transparent',
                    color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: lendo ? 'default' : 'pointer',
                  }}
                >
                  <FileCheck2 size={15} />
                  {lendo ? 'Lendo…' : comprovantes.length ? 'Anexar outro' : `Anexar o .mhl ou md5sums do ${cartao}`}
                </BotaoTatil>
                <input
                  ref={entrada}
                  type="file"
                  hidden
                  accept=".txt,.mhl,.md5,.xml,.csv,text/*"
                  onChange={e => { void ler(e.target.files?.[0]); e.target.value = ''; }}
                />
              </>
            )}
            {!podeEditar && comprovantes.length === 0 && <span className="text-xs text-muted">Nenhum ainda.</span>}
            {erro && <span className="text-xs" style={{ color: 'var(--color-danger)' }}>{erro}</span>}
          </Passo>

          {/* O que falta, em palavras. "Não formatar" sozinho manda procurar. */}
          {!seguro && (
            <p className="text-sm text-secondary" style={{ margin: 0 }}>
              Para liberar, falta {falta.join(', e ')}.
            </p>
          )}
        </div>
      </Abre>
    </div>
  );
}

/** Um passo do cartão: o número vira um ✓ quando está feito. */
function Passo({ numero: n, feito, titulo, children }: {
  numero: number;
  feito: boolean;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span
        aria-hidden
        style={{
          width: '24px', height: '24px', borderRadius: '999px', flexShrink: 0, marginTop: '1px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800,
          backgroundColor: feito ? 'var(--color-success)' : 'var(--bg-active)',
          color: feito ? '#0b0b0b' : 'var(--text-secondary)',
        }}
      >
        {feito ? <Check size={14} strokeWidth={3} /> : n}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, flex: 1 }}>
        <span className="text-sm font-bold">
          <span className="sr-only">{feito ? 'Feito: ' : 'A fazer: '}</span>
          {titulo}
        </span>
        {children}
      </div>
    </div>
  );
}
