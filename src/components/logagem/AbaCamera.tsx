import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Minus, Plus, FileVideo, SlidersHorizontal, Tag } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem, NomenclaturaArquivo } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { CampoTexto } from '../ui/CampoTexto';
import { BotaoContador, Campo, MONO, Rotulo, Segmentado, SeletorComOutro, ValorQueTroca, estiloCampo } from './pecas';
import { garantirEstado, idDoEstado, mudarEstado, PADRAO } from '../../lib/logagem/estado';
import { NOMENCLATURAS, camposDaNomenclatura, nomeArquivoPrevisto } from '../../lib/logagem/nomenclatura';
import { OPCOES } from '../../lib/logagem/opcoes';
import { KitDeCameras, KitDeLentes } from './Kits';
import { confirmar } from '../ui/Confirmacao';
import { cartaoSeguro, cartaoTemTakes, oQueFalta } from '../../lib/logagem/backup';

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

  /**
   * A trava da troca de cartão.
   *
   * Trocar o cartão na tela é o gesto que acompanha tirar o cartão da câmera —
   * e o cartão que sai é o que corre risco de ser formatado. Se ele tem take
   * gravado e ainda não está liberado na aba Backup, a troca para e pergunta,
   * dizendo o que falta.
   *
   * É um aviso, e não uma proibição: às vezes o cartão precisa sair mesmo
   * (acabou o espaço no meio da cena), e o app não pode ser o motivo de a
   * filmagem esperar. O que ele não pode é deixar isso passar em silêncio.
   */
  const trocarDeCartao = async (novo: string) => {
    const anterior = String(estado.cartao || '').trim();
    if (novo === anterior) return;

    const [takes, hds, backups, checksums] = await Promise.all([
      db.log_takes.where('diaria_id').equals(estado.diaria_id).toArray(),
      db.log_hds.where('projeto_id').equals(estado.projeto_id).toArray(),
      db.log_backups.where('diaria_id').equals(estado.diaria_id).toArray(),
      db.log_checksums.where('diaria_id').equals(estado.diaria_id).toArray(),
    ]);

    if (cartaoTemTakes(takes, anterior) && !cartaoSeguro({ hds, backups, checksums, cartao: anterior })) {
      const falta = oQueFalta({ hds, backups, checksums, cartao: anterior });
      const seguir = await confirmar({
        titulo: `O cartão ${anterior} ainda não está liberado.`,
        detalhe: `Falta ${falta.join(' e ')}. Ele tem take gravado — se for formatado agora, o material se perde. Trocar mesmo assim?`,
        confirmar: 'Trocar assim mesmo',
        cancelar: 'Continuar no ' + anterior,
        perigo: true,
      });
      if (!seguir) return;
    }

    aoMudar({ cartao: novo });
  };

  /*
    O − e o + somam em cima do que está GRAVADO, e não do que está na tela.
    O campo grava depois de uma pausa (`CampoTexto`), então quem digita 148 e
    aperta o + em seguida veria 2 em vez de 149. Ler no clique resolve.
  */
  const passo = (direcao: 1 | -1) => {
    if (bloqueado) return;
    void (async () => {
      const atual = await db.log_estado.get(estado.id);
      const de = Number(atual?.proximo_clipe ?? clipe) || 0;
      aoMudar({ proximo_clipe: Math.max(0, de + direcao) });
    })();
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '22px' }}>
      <Rotulo icone={<FileVideo size={14} />}>Próximo arquivo</Rotulo>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <ValorQueTroca texto={nome} rotuloDeLeitura="Próximo arquivo" tamanho="clamp(30px, 8vw, 44px)" />

        {/* O clipe é o contador que mais se corrige à mão: a câmera gravou um
            clipe de teste, alguém formatou fora de hora. Por isso ele tem botões
            grandes, e não só um campo. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ marginRight: '4px' }}>Clipe</span>
          <BotaoContador rotulo="Clipe anterior" disabled={bloqueado || clipe <= 0} onClick={() => passo(-1)}>
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
          <BotaoContador rotulo="Próximo clipe" disabled={bloqueado} onClick={() => passo(1)}>
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
            <CartaoQueConfirma valor={estado.cartao} bloqueado={bloqueado} aoConfirmar={trocarDeCartao} />
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
            style={{ ...estiloCampo, fontFamily: MONO }}
          />
        </Campo>
      )}
    </section>
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
    if (limpo !== valor) {
      // Volta ao que estava na tela; se a troca vingar, o banco devolve o novo.
      // Assim, cancelar a trava não deixa o campo mostrando um cartão que não é
      // o que está na câmera.
      setTexto(valor);
      aoConfirmar(limpo);
    }
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
                <span style={{ fontFamily: MONO, fontSize: '13px', color: ativa ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
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
