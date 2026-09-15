import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Minus, Plus, FileVideo, SlidersHorizontal, Tag } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, NomenclaturaArquivo } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { garantirEstado, idDoEstado, mudarEstado, PADRAO } from '../../lib/logagem/estado';
import { NOMENCLATURAS, camposDaNomenclatura, nomeArquivoPrevisto } from '../../lib/logagem/nomenclatura';
import { OPCOES } from '../../lib/logagem/opcoes';
import { KitDeCameras, KitDeLentes } from './Kits';

/**
 * Aba Câmera: o que a câmera vai gravar, e com que setup.
 *
 * Primeiro pedaço (15/09/2026): arquivo previsto, nomenclatura, contadores e
 * setup. Segundo pedaço (15/09/2026): kits de câmera e de lentes, em `Kits.tsx`.
 *
 * A ORDEM DA TELA É A ORDEM DA PERGUNTA NO SET. O 2º AC olha para esta aba para
 * responder "qual é o próximo arquivo?" — por isso ele vem primeiro, grande. O
 * formato do nome se escolhe uma vez por produção, e o setup muda poucas vezes
 * no dia; os dois vêm depois.
 */
export function AbaCamera({ projetoId, diariaId, podeEditar, departamentoId }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
}) {
  const estadoSalvo = useLiveQuery(() => db.log_estado.get(idDoEstado(diariaId)), [diariaId]);

  /*
    Só quem EDITA cria o estado. Quem acompanha vê o padrão sem gravar nada: se
    a direção abrisse a aba antes da Fotografia, o estado nasceria dela, com o
    departamento e o carimbo de quem não mexe na câmera.
  */
  useEffect(() => {
    if (podeEditar && estadoSalvo === undefined) {
      void garantirEstado(projetoId, diariaId, departamentoId);
    }
  }, [podeEditar, estadoSalvo, projetoId, diariaId, departamentoId]);

  const estado: EstadoDaLogagem = estadoSalvo ?? { ...PADRAO, id: idDoEstado(diariaId), projeto_id: projetoId, diaria_id: diariaId };
  const mudar = (m: Partial<EstadoDaLogagem>) => { if (podeEditar) void mudarEstado(diariaId, m); };
  const bloqueado = !podeEditar;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {!estadoSalvo && !podeEditar && (
        <p className="text-sm text-secondary">
          A Fotografia ainda não configurou a câmera desta diária. Abaixo, o ponto de partida.
        </p>
      )}

      <ProximoArquivo estado={estado} bloqueado={bloqueado} aoMudar={mudar} />
      <KitDeCameras projetoId={projetoId} estado={estado} bloqueado={bloqueado} aoMudar={mudar} departamentoId={departamentoId} />
      <KitDeLentes projetoId={projetoId} estado={estado} bloqueado={bloqueado} aoMudar={mudar} departamentoId={departamentoId} />
      <Nomenclatura estado={estado} bloqueado={bloqueado} aoMudar={mudar} />
      <Setup estado={estado} bloqueado={bloqueado} aoMudar={mudar} />
    </div>
  );
}

type PropsDeSecao = {
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  aoMudar: (m: Partial<EstadoDaLogagem>) => void;
};

/* ───────────────────────── Próximo arquivo ───────────────────────── */

function ProximoArquivo({ estado, bloqueado, aoMudar }: PropsDeSecao) {
  const nome = nomeArquivoPrevisto(estado);
  const campos = camposDaNomenclatura(estado.nomenclatura);
  const clipe = Number(estado.proximo_clipe) || 0;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '22px' }}>
      <Rotulo icone={<FileVideo size={14} />}>Próximo arquivo</Rotulo>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <NomeQueTroca texto={nome} />

        {/* O clipe é o contador que mais se corrige à mão: a câmera gravou um
            clipe de teste, alguém formatou fora de hora. Por isso ele tem botões
            grandes, e não só um campo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginRight: '4px' }}>Clipe</span>
          <BotaoContador rotulo="Clipe anterior" disabled={bloqueado || clipe <= 0} onClick={() => aoMudar({ proximo_clipe: Math.max(0, clipe - 1) })}>
            <Minus size={18} />
          </BotaoContador>
          <CampoTexto
            inputMode="numeric"
            title="Próximo clipe"
            disabled={bloqueado}
            value={String(clipe)}
            aoGravar={v => {
              const n = parseInt(v.replace(/\D/g, ''), 10);
              aoMudar({ proximo_clipe: Number.isFinite(n) ? n : 0 });
            }}
            style={{ ...estiloCampo, width: '72px', textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}
          />
          <BotaoContador rotulo="Próximo clipe" disabled={bloqueado} onClick={() => aoMudar({ proximo_clipe: clipe + 1 })}>
            <Plus size={18} />
          </BotaoContador>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(140px, 100%), 1fr))', gap: '12px' }}>
        {campos.usaCamera && (
          <Campo rotulo="Câmera">
            <CampoTexto
              value={estado.camera_id}
              aoGravar={v => aoMudar({ camera_id: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2) || 'A' })}
              disabled={bloqueado}
              placeholder="A"
              style={{ ...estiloCampo, textTransform: 'uppercase', fontWeight: 700 }}
            />
          </Campo>
        )}
        {campos.usaCartao && (
          <Campo rotulo="Cartão / reel">
            <CartaoQueConfirma valor={estado.cartao} bloqueado={bloqueado} aoConfirmar={v => aoMudar({ cartao: v })} />
          </Campo>
        )}
        {campos.usaPosicao && (
          <Campo rotulo="Posição">
            <Segmentado
              nome="logagem-posicao"
              opcoes={OPCOES.posicao.map(p => ({ id: p, nome: p }))}
              valor={estado.posicao}
              bloqueado={bloqueado}
              aoMudar={v => aoMudar({ posicao: v })}
            />
          </Campo>
        )}
        {campos.usaZeros && (
          <Campo rotulo="Dígitos do clipe">
            <Segmentado
              nome="logagem-zeros"
              opcoes={[3, 4, 5, 6].map(n => ({ id: String(n), nome: String(n) }))}
              valor={String(estado.zeros_clipe)}
              bloqueado={bloqueado}
              aoMudar={v => aoMudar({ zeros_clipe: Number(v) })}
            />
          </Campo>
        )}
      </div>

      {campos.usaTemplate && (
        <Campo rotulo="Modelo do nome">
          <CampoTexto
            value={estado.template || ''}
            aoGravar={v => aoMudar({ template: v })}
            disabled={bloqueado}
            placeholder="{CAM}_{CARD}_{CLIP}"
            style={{ ...estiloCampo, fontFamily: 'ui-monospace, "Cascadia Code", monospace' }}
          />
        </Campo>
      )}
    </section>
  );
}

/**
 * O nome do arquivo, com cada caractere que MUDA descendo para o lugar.
 *
 * Quando o clipe vira de C0148 para C0149, só o último dígito anda. É o que um
 * contador mecânico faz, e é o que diz "mudou, e mudou AQUI" sem o olho precisar
 * comparar os dois nomes. Os caracteres que ficaram iguais não se mexem.
 *
 * O caractere antigo sai na hora (sem animação de saída), pelo mesmo motivo das
 * abas: nada na tela pode depender de uma animação terminar.
 *
 * `tabular-nums` e fonte monoespaçada para o nome não "respirar" de largura a
 * cada troca: um 1 estreito ao lado de um 8 largo faria o nome inteiro pular.
 */
function NomeQueTroca({ texto }: { texto: string }) {
  const reduzido = useMovimentoReduzido();
  return (
    <div
      aria-live="polite"
      aria-label={`Próximo arquivo: ${texto}`}
      style={{
        fontFamily: 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace',
        fontSize: 'clamp(30px, 8vw, 44px)', fontWeight: 700, letterSpacing: '0.02em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: 'var(--text-primary)',
        display: 'flex', overflow: 'hidden', minWidth: 0, flexWrap: 'wrap',
      }}
    >
      {texto.split('').map((c, i) => (
        <motion.span
          key={`${i}-${c}`}
          aria-hidden
          initial={reduzido ? false : { y: '-0.45em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={MOLA}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}

/**
 * O cartão só vale quando a pessoa CONFIRMA (Enter ou sair do campo), e não a
 * cada tecla — regra do Lumavi (`onCardCommit`). Trocar de cartão é um ato: na
 * Fase 3 é aqui que entra a trava "este cartão ainda não teve backup".
 */
function CartaoQueConfirma({ valor, bloqueado, aoConfirmar }: { valor: string; bloqueado: boolean; aoConfirmar: (v: string) => void }) {
  const [texto, setTexto] = useState(valor);
  useEffect(() => { setTexto(valor); }, [valor]);
  const confirmar = () => {
    const limpo = texto.trim();
    if (!limpo) { setTexto(valor); return; }
    if (limpo !== valor) aoConfirmar(limpo);
  };
  return (
    <input
      value={texto}
      disabled={bloqueado}
      onChange={e => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{ ...estiloCampo, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

/* ───────────────────────── Nomenclatura ───────────────────────── */

function Nomenclatura({ estado, bloqueado, aoMudar }: PropsDeSecao) {
  const reduzido = useMovimentoReduzido();
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<Tag size={14} />}>Formato do nome</Rotulo>
      <div
        role="radiogroup"
        aria-label="Formato do nome do arquivo"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(200px, 100%), 1fr))', gap: '8px' }}
      >
        {NOMENCLATURAS.map(n => {
          const ativa = estado.nomenclatura === n.id;
          return (
            <button
              key={n.id}
              role="radio"
              aria-checked={ativa}
              disabled={bloqueado}
              onClick={() => aoMudar({ nomenclatura: n.id as NomenclaturaArquivo })}
              style={{
                position: 'relative', textAlign: 'left', padding: '12px 14px', minHeight: '64px',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
                backgroundColor: 'var(--bg-primary)', color: 'inherit',
                cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado && !ativa ? 0.55 : 1,
              }}
            >
              {/* A moldura escolhida é UMA só e desliza até a opção nova. */}
              {ativa && (
                <motion.span
                  layoutId="logagem-nomenclatura"
                  transition={reduzido ? { duration: 0 } : MOLA}
                  style={{
                    position: 'absolute', inset: -1, borderRadius: 'var(--radius-md)',
                    border: '1.5px solid var(--cor-criativo)',
                    backgroundColor: 'color-mix(in srgb, var(--cor-criativo) 10%, transparent)',
                  }}
                />
              )}
              <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="text-sm font-bold">{n.nome}</span>
                <span style={{ fontFamily: 'ui-monospace, "Cascadia Code", monospace', fontSize: '13px', color: ativa ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {n.exemplo}
                </span>
                <span className="text-xs text-muted">{n.explicacao}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────────────────── Setup ───────────────────────── */

function Setup({ estado, bloqueado, aoMudar }: PropsDeSecao) {
  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<SlidersHorizontal size={14} />}>Setup da câmera</Rotulo>
      <p className="text-xs text-muted" style={{ marginTop: '-6px' }}>Vai junto em cada take registrado, até alguém mudar aqui.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: '12px' }}>
        <Campo rotulo="FPS"><SeletorComOutro opcoes={OPCOES.fps} valor={estado.fps} bloqueado={bloqueado} aoMudar={v => aoMudar({ fps: v })} /></Campo>
        <Campo rotulo="Resolução"><SeletorComOutro opcoes={OPCOES.resolucao} valor={estado.resolucao} bloqueado={bloqueado} aoMudar={v => aoMudar({ resolucao: v })} /></Campo>
        <Campo rotulo="Codec"><SeletorComOutro opcoes={OPCOES.codec} valor={estado.codec} bloqueado={bloqueado} aoMudar={v => aoMudar({ codec: v })} /></Campo>
        <Campo rotulo="White balance"><SeletorComOutro opcoes={OPCOES.wb} valor={estado.wb} bloqueado={bloqueado} aoMudar={v => aoMudar({ wb: v })} /></Campo>
        <Campo rotulo="Shutter"><SeletorComOutro opcoes={OPCOES.shutter} valor={estado.shutter} bloqueado={bloqueado} aoMudar={v => aoMudar({ shutter: v })} /></Campo>
        <Campo rotulo="ISO"><SeletorComOutro opcoes={OPCOES.iso} valor={estado.iso} bloqueado={bloqueado} aoMudar={v => aoMudar({ iso: v })} /></Campo>
        <Campo rotulo="LUT de monitoramento">
          <CampoTexto value={estado.lut || ''} aoGravar={v => aoMudar({ lut: v })} disabled={bloqueado} placeholder="nenhuma" style={estiloCampo} />
        </Campo>
      </div>
    </section>
  );
}

const OUTRO = '__outro__';

/**
 * Um seletor com a lista do Lumavi e uma saída: "outro valor".
 *
 * A lista cobre a câmera que se espera; o set sempre tem a que ninguém previu
 * (o drone de 29.97, a câmera alugada em ProRes RAW). Travar numa lista
 * obrigaria a pessoa a mentir no boletim — e boletim com mentira é pior que
 * boletim em branco.
 */
function SeletorComOutro({ opcoes, valor, bloqueado, aoMudar }: {
  opcoes: readonly string[];
  valor?: string;
  bloqueado: boolean;
  aoMudar: (v: string) => void;
}) {
  const foraDaLista = Boolean(valor) && !opcoes.includes(valor!);
  const [digitando, setDigitando] = useState(false);

  if (digitando) {
    return (
      <CampoTexto
        value={foraDaLista ? valor! : ''}
        aoGravar={v => { if (v.trim()) aoMudar(v.trim()); }}
        placeholder="Digite o valor"
        autoFocus
        style={estiloCampo}
      />
    );
  }

  return (
    <select
      value={valor || ''}
      disabled={bloqueado}
      onChange={e => {
        if (e.target.value === OUTRO) { setDigitando(true); return; }
        aoMudar(e.target.value);
      }}
      style={{ ...estiloCampo, cursor: bloqueado ? 'default' : 'pointer' }}
    >
      {foraDaLista && <option value={valor}>{valor}</option>}
      {opcoes.map(o => <option key={o} value={o}>{o}</option>)}
      <option value={OUTRO}>Outro valor…</option>
    </select>
  );
}

/* ───────────────────────── Peças ───────────────────────── */

const estiloCampo: React.CSSProperties = {
  width: '100%', minHeight: '44px', padding: '10px 12px', fontSize: '15px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
};

function Rotulo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: 'var(--cor-criativo)', display: 'flex' }}>{icone}</span>
      {children}
    </h2>
  );
}

/*
  `div` e não `label`: um rótulo em volta de um grupo de botões (posição,
  dígitos) faria o toque em qualquer canto do rótulo apertar o PRIMEIRO botão,
  porque o navegador encaminha o clique do label para o primeiro elemento de
  dentro.
*/
function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <span className="text-xs font-bold text-secondary">{rotulo}</span>
      {children}
    </div>
  );
}

function BotaoContador({ rotulo, disabled, onClick, children }: { rotulo: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <BotaoTatil
      aria-label={rotulo}
      title={rotulo}
      disabled={disabled}
      onClick={onClick}
      escala={0.9}
      style={{
        width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </BotaoTatil>
  );
}

/**
 * Um grupo de botões com a escolha marcada por um fundo que desliza.
 * `nome` separa os marcadores: dois grupos na mesma tela não podem dividir o
 * mesmo `layoutId`, senão o marcador de um voaria até o outro.
 */
function Segmentado({ nome, opcoes, valor, bloqueado, aoMudar }: {
  nome: string;
  opcoes: { id: string; nome: string }[];
  valor: string;
  bloqueado: boolean;
  aoMudar: (v: string) => void;
}) {
  const reduzido = useMovimentoReduzido();
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: '4px', padding: '4px', minHeight: '54px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
      {opcoes.map(o => {
        const ativa = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativa}
            disabled={bloqueado}
            onClick={() => aoMudar(o.id)}
            style={{
              position: 'relative', flex: 1, minHeight: '38px', border: 'none', borderRadius: '6px', background: 'none',
              color: ativa ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '14px',
              cursor: bloqueado ? 'default' : 'pointer',
            }}
          >
            {ativa && (
              <motion.span
                layoutId={nome}
                transition={reduzido ? { duration: 0 } : MOLA}
                style={{ position: 'absolute', inset: 0, borderRadius: '6px', backgroundColor: 'var(--bg-active)' }}
              />
            )}
            <span style={{ position: 'relative' }}>{o.nome}</span>
          </button>
        );
      })}
    </div>
  );
}
