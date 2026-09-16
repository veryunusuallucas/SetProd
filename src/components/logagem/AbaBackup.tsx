import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { HardDrive, ShieldCheck, ShieldAlert, FileCheck2, Plus, Trash2, X, Check } from 'lucide-react';
import { db } from '../../db/db';
import type { BackupDeCartao, ChecksumDeCartao, HdDeBackup, Take } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import { Rotulo, estiloCampo } from './pecas';
import { idDoEstado } from '../../lib/logagem/estado';
import { guardarArquivo, apagarArquivo } from '../../lib/arquivos';
import { dataHora } from '../../lib/formato';
import {
  anexarChecksum, apagarChecksum, apagarHd, cartaoSeguro, cartoesConhecidos,
  criarHd, desmarcarBackup, detectarCartao, estimativaDoCartaoGB, marcarBackup, oQueFalta, temChecksum,
} from '../../lib/logagem/backup';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Hds hds={emOrdem} projetoId={projetoId} departamentoId={departamentoId} podeEditar={podeEditar} />

      <Matriz
        cartoes={cartoes}
        hds={emOrdem}
        takes={takes}
        backups={backups}
        checksums={checksums}
        cartaoAtual={estado?.cartao}
        podeEditar={podeEditar}
        aoMarcar={(cartao, hdId) => void marcarBackup({ projetoId, diariaId, cartao, hdId, quem, departamentoId })}
        aoDesmarcar={id => void desmarcarBackup(id)}
      />

      <Comprovantes
        cartoes={cartoes}
        checksums={checksums}
        podeEditar={podeEditar}
        projetoId={projetoId}
        diariaId={diariaId}
        departamentoId={departamentoId}
        quem={quem}
      />
    </div>
  );
}

/* ───────────────────────── HDs ───────────────────────── */

function Hds({ hds, projetoId, departamentoId, podeEditar }: {
  hds: HdDeBackup[];
  projetoId: string;
  departamentoId?: string;
  podeEditar: boolean;
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
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<HardDrive size={14} />}>HDs de destino</Rotulo>
      <p className="text-xs text-muted" style={{ marginTop: '-8px' }}>
        Para onde o material desta produção é copiado. O cartão só fica liberado quando está em todos eles.
      </p>

      {hds.length === 0 ? (
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          Nenhum HD ainda. Sem HD cadastrado, nenhum cartão fica liberado — o que é o certo: não há para onde ter copiado.
        </p>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {hds.map(h => (
            <span
              key={h.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 8px 0 14px',
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

      {podeEditar && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={nome}
            onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void acrescentar(); }}
            placeholder="HD Preto, Shuttle 01, RAID da ilha…"
            style={{ ...estiloCampo, flex: '1 1 200px', width: 'auto' }}
          />
          <BotaoTatil
            onClick={() => void acrescentar()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px',
              borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--cor-criativo)',
              color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Plus size={16} /> Cadastrar
          </BotaoTatil>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── Matriz cartão × HD ───────────────────────── */

function Matriz({ cartoes, hds, takes, backups, checksums, cartaoAtual, podeEditar, aoMarcar, aoDesmarcar }: {
  cartoes: string[];
  hds: HdDeBackup[];
  takes: Take[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  cartaoAtual?: string;
  podeEditar: boolean;
  aoMarcar: (cartao: string, hdId: string) => void;
  aoDesmarcar: (id: string) => void;
}) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<ShieldCheck size={14} />}>Cartões desta diária</Rotulo>

      {cartoes.length === 0 ? (
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          Nenhum cartão ainda. Eles aparecem sozinhos quando um take é registrado ou quando o cartão da câmera muda.
        </p>
      ) : (
        /*
          Um cartão por CARTÃO, e não uma tabela de verdade.

          Uma tabela com uma coluna por HD não cabe num celular de 360px, e a
          coluna que interessa — "pode formatar?" — é a última, justamente a que
          sairia da tela. Aqui cada cartão é um bloco, com o veredito em cima e
          os HDs como botões grandes embaixo.
        */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {cartoes.map(cartao => (
            <CartaoDaMatriz
              key={cartao}
              cartao={cartao}
              hds={hds}
              takes={takes}
              backups={backups}
              checksums={checksums}
              ehOAtual={String(cartaoAtual || '').trim() === cartao}
              podeEditar={podeEditar}
              aoMarcar={aoMarcar}
              aoDesmarcar={aoDesmarcar}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CartaoDaMatriz({ cartao, hds, takes, backups, checksums, ehOAtual, podeEditar, aoMarcar, aoDesmarcar }: {
  cartao: string;
  hds: HdDeBackup[];
  takes: Take[];
  backups: BackupDeCartao[];
  checksums: ChecksumDeCartao[];
  ehOAtual: boolean;
  podeEditar: boolean;
  aoMarcar: (cartao: string, hdId: string) => void;
  aoDesmarcar: (id: string) => void;
}) {
  const reduzido = useMovimentoReduzido();
  const seguro = cartaoSeguro({ hds, backups, checksums, cartao });
  const falta = oQueFalta({ hds, backups, checksums, cartao });
  const gb = estimativaDoCartaoGB(takes, cartao);
  const cor = seguro ? 'var(--color-success)' : 'var(--color-warning)';

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px',
        borderRadius: 'var(--radius-md)', border: `1px solid ${seguro ? cor : 'var(--border-light)'}`,
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span className="text-lg font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{cartao}</span>
        {ehOAtual && (
          <span className="text-xs" style={{ padding: '2px 8px', borderRadius: '999px', border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
            na câmera agora
          </span>
        )}
        {gb > 0 && <span className="text-xs text-muted">~{gb.toFixed(0)} GB estimados</span>}
        {temChecksum(checksums, cartao) && (
          <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-success)' }}>
            <FileCheck2 size={13} /> comprovante
          </span>
        )}

        <motion.span
          layout={!reduzido}
          transition={MOLA}
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${cor}`, color: cor, fontSize: '12px', fontWeight: 800,
          }}
        >
          {seguro ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {seguro ? 'Safe to Format' : 'Ainda não'}
        </motion.span>
      </div>

      {hds.length > 0 && (
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
                  border: `1px solid ${marcado ? 'var(--color-success)' : 'var(--border-color)'}`,
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

      {/* O que falta, em palavras. "Não liberado" sozinho manda procurar. */}
      {falta.length > 0 && (
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Falta {falta.join(' e ')}.
        </p>
      )}
    </div>
  );
}

/* ───────────────────────── Comprovantes ───────────────────────── */

/**
 * O comprovante de verificação — o arquivo que o DaVinci (ou o Silverstack, ou
 * o Hedge) cospe depois de copiar e conferir.
 *
 * O app não refaz a verificação: ele guarda o comprovante, calcula uma
 * impressão digital dele e diz de qual cartão é. Quem copiou é que verificou; o
 * que faltava era o registro de que isso aconteceu.
 */
function Comprovantes({ cartoes, checksums, podeEditar, projetoId, diariaId, departamentoId, quem }: {
  cartoes: string[];
  checksums: ChecksumDeCartao[];
  podeEditar: boolean;
  projetoId: string;
  diariaId: string;
  departamentoId?: string;
  quem?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [escolhido, setEscolhido] = useState('');

  const ler = async (arquivo?: File) => {
    if (!arquivo) return;
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      const texto = await arquivo.text();
      const achado = detectarCartao(arquivo.name, texto, cartoes);
      const cartao = achado || escolhido || cartoes[0];
      if (!cartao) {
        setErro('Não há cartão nesta diária para ligar o comprovante. Registre um take ou troque o cartão na aba Câmera.');
        return;
      }
      const referencia = await guardarArquivo(projetoId, arquivo, arquivo.name, arquivo.type || 'text/plain');
      await anexarChecksum({
        projetoId, diariaId, cartao, nomeArquivo: arquivo.name, texto, arquivo: referencia, quem, departamentoId,
      });
      setAviso(
        achado
          ? `Comprovante do cartão ${cartao} anexado.`
          : `Não deu para saber o cartão pelo arquivo — anexei no ${cartao}. Confira, e apague se não for.`
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui ler este arquivo.');
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = '';
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

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<FileCheck2 size={14} />}>Comprovantes de verificação</Rotulo>
      <p className="text-xs text-muted" style={{ marginTop: '-8px' }}>
        O arquivo que o programa de cópia gera ao conferir (.txt, .mhl, .md5, .xml). O app guarda, calcula a impressão
        digital e descobre de qual cartão é.
      </p>

      {checksums.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {checksums.map(c => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
                padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
              }}
            >
              <span className="text-sm font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>cartão {c.cartao}</span>
              <span className="text-xs text-secondary" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{c.nome_arquivo}</span>
              <span className="text-xs text-muted">{c.linhas} linha{c.linhas === 1 ? '' : 's'}</span>
              <span className="text-xs text-muted" title={c.digest} style={{ overflowWrap: 'anywhere' }}>
                {c.algoritmo} · {c.digest.slice(0, 12)}…
              </span>
              <span className="text-xs text-muted">{dataHora(c.anexado_em)}</span>
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => void tirar(c)}
                  aria-label="Apagar este comprovante"
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
        </div>
      )}

      {podeEditar && (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <BotaoTatil
              onClick={() => entrada.current?.click()}
              disabled={ocupado}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px',
                borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600,
                cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.6 : 1,
              }}
            >
              <FileCheck2 size={16} />
              {ocupado ? 'Lendo…' : 'Anexar comprovante'}
            </BotaoTatil>

            {/* O seletor é a rede de segurança da detecção, não o caminho normal. */}
            {cartoes.length > 1 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="text-xs text-secondary">se não der para saber, é do cartão</span>
                <select
                  value={escolhido || cartoes[0]}
                  onChange={e => setEscolhido(e.target.value)}
                  style={{ ...estiloCampo, width: 'auto', cursor: 'pointer' }}
                >
                  {cartoes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>

          {aviso && <p className="text-xs" style={{ color: 'var(--color-success)', margin: 0 }}>{aviso}</p>}
          {erro && <p className="text-xs" style={{ color: 'var(--color-danger)', margin: 0 }}>{erro}</p>}

          <input
            ref={entrada}
            type="file"
            accept=".txt,.mhl,.md5,.xml,.csv,text/*"
            hidden
            onChange={e => void ler(e.target.files?.[0])}
          />
        </>
      )}

      {checksums.length === 0 && !podeEditar && (
        <p className="text-sm text-secondary" style={{ margin: 0 }}>Nenhum comprovante anexado nesta diária.</p>
      )}
    </section>
  );
}
