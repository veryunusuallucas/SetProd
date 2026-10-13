import { useState } from 'react';
import { Minus, Plus, Clapperboard, Mic, MicOff, Users, Sparkles } from 'lucide-react';
import { ehExtra, entrarNoExtra, sairDoExtra } from '../../lib/logagem/claquete';
import type { EstadoDaLogagem } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { MONO, ValorQueTroca } from './pecas';
import { BotoesDeStatus, type Registro } from './RegistroDeTake';
import { mudarEstado } from '../../lib/logagem/estado';
import { nomeArquivoPrevisto } from '../../lib/logagem/nomenclatura';
import { estimativaDoCartaoGB } from '../../lib/logagem/backup';
import { aberturaLegivel } from '../../lib/logagem/relatorio';
import { numero } from '../../lib/formato';
import { arquivoDoSom, somJunto, takeLevaSom } from '../../lib/logagem/som';
import { useElencoDaCena } from './useElencoDaCena';

type Campo = 'cena' | 'plano' | 'take';

/**
 * O painel do take: tudo o que se olha e se aperta durante a gravação, num
 * bloco só.
 *
 * A ordem é a do pedido de quem opera câmera (16/09/2026): **qual cena, plano e
 * take** é o mais importante, **o arquivo** vem logo depois, e os **quatro
 * botões** ficam colados na claquete — na mesma arrumação no celular e no
 * computador, para a mão não ter de reaprender o lugar de cada coisa.
 *
 * Em cima, uma linha com o que está na câmera (o HUD do Lumavi): conferir não
 * pode custar uma troca de aba.
 */
export function PainelDoTake({ estado, registro, podeEditar, aoPassar, aoDigitar, mostrarAtalhos }: {
  estado: EstadoDaLogagem;
  registro: Registro;
  podeEditar: boolean;
  aoPassar: (campo: Campo, direcao: 1 | -1) => void;
  aoDigitar: (campo: Campo, valor: string) => void;
  /** Só no computador: no celular não há teclado para os atalhos. */
  mostrarAtalhos: boolean;
}) {
  const bloqueado = !podeEditar;
  const letras = estado.plano_letras !== false;
  const gb = estimativaDoCartaoGB(registro.takes, estado.cartao);
  const lente = [estado.lente, aberturaLegivel(estado.abertura)].filter(Boolean).join(' ');

  /*
    A LOUSA (leva de UI, 12/10/2026). O Lucas disse o que olha: o arquivo, e a
    cena, o plano e o take. Os dois ficam numa peça só, desenhada como uma
    claquete digital — a referência é a lousa do MovieSlate e as claquetes
    eletrônicas, que põem o que se lê de longe no meio e o resto numa faixa
    pequena em cima. O que a decupagem preenche (INT/EXT, DIA/NOITE) vira
    leitura nessa faixa, e não um campo para apertar.
  */
  const cabecalho = [estado.ambiente, estado.luz].filter(Boolean).join(' · ');
  return (
    <section className="card painel-take" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: 'clamp(12px, 3vw, 22px)' }}>
      <div className="lousa">
        <div className="hud-logagem" aria-label="O que está na câmera">
          {cabecalho && <span className="hud-cena">{cabecalho}</span>}
          <span><i>Câm</i>{estado.camera_id || '—'}</span>
          <span><i>Cartão</i>{estado.cartao || '—'}{gb > 0 ? ` · ~${numero(gb, gb < 10 ? 1 : 0)} GB` : ''}</span>
          <span><i>Lente</i>{lente || '—'}</span>
          <span><i>ND</i>{estado.nd || '—'}</span>
          <span><i>Takes</i>{registro.takes.length}</span>
        </div>

        <div className="lousa-arquivo">
          {/* O som numa linha com o rótulo: embaixo do nome, gastava 50px que faltavam para o OK no celular. */}
          <div className="lousa-arquivo-topo">
            <span className="lousa-rotulo"><Clapperboard size={12} aria-hidden /> Arquivo</span>
            <FichaDoSom estado={estado} bloqueado={bloqueado} />
          </div>
          <div className="arquivo-previsto" style={{ fontWeight: 800 }}>
            <ValorQueTroca texto={nomeArquivoPrevisto(estado) || '—'} rotuloDeLeitura="Arquivo deste take" tamanho="inherit" />
          </div>
        </div>

        <div className="claquete-grade">
          <Contador campo="cena" rotulo="Cena" valor={String(estado.cena)} bloqueado={bloqueado} aoPassar={aoPassar} aoDigitar={aoDigitar} />
          <Contador campo="plano" rotulo="Plano" valor={String(estado.plano)} bloqueado={bloqueado} maiuscula={letras} aoPassar={aoPassar} aoDigitar={aoDigitar} />
          <Contador campo="take" rotulo="Take" valor={String(estado.take)} bloqueado={bloqueado} destaque aoPassar={aoPassar} aoDigitar={aoDigitar} />
        </div>
      </div>

      <BotoesDeStatus registro={registro} podeEditar={podeEditar} />

      {registro.decisoes}

      {/* Depois dos botões: é o que se confere, não o que se aperta a cada take. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px 12px', flexWrap: 'wrap' }}>
        <BotaoDoExtra estado={estado} registro={registro} bloqueado={bloqueado} />
        <ElencoEmCena estado={estado} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px 16px', flexWrap: 'wrap' }}>
        {mostrarAtalhos && podeEditar ? (
          <span className="text-xs text-muted">
            <Tecla>Espaço</Tecla> OK · <Tecla>Shift</Tecla>+<Tecla>Espaço</Tecla> NG · <Tecla>Enter</Tecla> observação
          </span>
        ) : <span />}
        {podeEditar && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={Boolean(estado.revisar_antes)}
              onChange={e => void mudarEstado(estado.diaria_id, { revisar_antes: e.target.checked })}
              style={{ width: '18px', height: '18px', accentColor: 'var(--cor-criativo)' }}
            />
            <span className="text-xs text-secondary">Perguntar antes de registrar</span>
          </label>
        )}
      </div>
    </section>
  );
}

/**
 * O arquivo do gravador que vai junto com este take — o mesmo lugar do arquivo
 * da câmera, porque é o mesmo momento. Tocar liga e desliga o som junto.
 */
function FichaDoSom({ estado, bloqueado }: { estado: EstadoDaLogagem; bloqueado: boolean }) {
  const vai = takeLevaSom(estado);
  const mos = somJunto(estado) && !vai;
  const rolo = estado.rolo_som?.trim();
  return (
    <button
      type="button"
      disabled={bloqueado || mos}
      aria-pressed={vai}
      onClick={() => void mudarEstado(estado.diaria_id, { som_junto: !somJunto(estado) })}
      title={mos ? 'O áudio da cena está em MOS' : vai ? 'Tocar para gravar este take sem som' : 'Tocar para o som ir junto'}
      className="ficha-do-som"
      style={{
        display: 'flex', alignItems: 'center', gap: '6px', minHeight: '30px', padding: '0 10px',
        borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 700,
        border: `1px solid ${vai ? 'var(--border-color)' : 'var(--border-light)'}`,
        backgroundColor: vai ? 'var(--bg-surface)' : 'transparent',
        color: vai ? 'var(--text-primary)' : 'var(--text-muted)', cursor: bloqueado || mos ? 'default' : 'pointer',
      }}
    >
      {vai ? <Mic size={13} aria-hidden /> : <MicOff size={13} aria-hidden />}
      {vai ? (
        <span><span style={{ fontFamily: MONO }}>{arquivoDoSom(estado)}</span>{rolo ? ` · Rolo ${rolo}` : ''}</span>
      ) : (
        <span>{mos ? 'MOS · sem som' : 'Sem som'}</span>
      )}
    </button>
  );
}

/**
 * O plano EXTRA: fora da decupagem, mas a equipe quis gravar. Entrar guarda a
 * claquete; sair volta para ela.
 */
function BotaoDoExtra({ estado, registro, bloqueado }: { estado: EstadoDaLogagem; registro: Registro; bloqueado: boolean }) {
  const ativo = ehExtra(estado.cena);
  const antes = estado.claquete_antes_do_extra;
  const alternar = () => {
    const m = ativo ? sairDoExtra(estado) : entrarNoExtra(registro.takes, estado);
    void mudarEstado(estado.diaria_id, m);
  };
  return (
    <button
      type="button"
      onClick={alternar}
      disabled={bloqueado}
      aria-pressed={ativo}
      style={{
        alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px',
        borderRadius: 'var(--radius-full)', fontSize: '14px', fontWeight: 700,
        border: `1px solid ${ativo ? 'var(--cor-criativo)' : 'var(--border-light)'}`,
        backgroundColor: ativo ? 'color-mix(in srgb, var(--cor-criativo) 14%, transparent)' : 'transparent',
        color: ativo ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: bloqueado ? 'default' : 'pointer',
      }}
    >
      <Sparkles size={15} aria-hidden />
      {ativo
        ? `Extra ${estado.plano} · voltar para a cena ${antes?.cena ?? '1'}`
        : 'Extra — plano fora da decupagem'}
    </button>
  );
}

/**
 * Quem está em cena, pela decupagem: a continuidade confere figurino e posição
 * de quem está ali, e o som sabe de quem é cada lapela.
 */
function ElencoEmCena({ estado }: { estado: EstadoDaLogagem }) {
  const elenco = useElencoDaCena(estado.projeto_id, estado);
  if (elenco.length === 0) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }} aria-label="Elenco em cena">
      <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Users size={13} aria-hidden /> Em cena
      </span>
      {elenco.map(e => (
        <span
          key={e.personagem}
          className="text-sm"
          style={{ padding: '4px 12px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', fontWeight: 700 }}
        >
          {e.personagem}{e.ator ? <span className="text-muted" style={{ fontWeight: 500 }}> · {e.ator}</span> : null}
        </span>
      ))}
    </div>
  );
}

function Tecla({ children }: { children: React.ReactNode }) {
  return (
    <kbd style={{
      fontFamily: 'inherit', fontSize: '11px', fontWeight: 700, padding: '1px 6px',
      borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-secondary)',
    }}>
      {children}
    </kbd>
  );
}

/**
 * Um número da claquete.
 *
 * O número É o campo: tocar nele abre a digitação ali mesmo, do tamanho em que
 * se lê. O campo separado que existia embaixo ocupava uma linha inteira por
 * contador e empurrava os botões de status para fora da primeira tela.
 */
function Contador({ campo, rotulo, valor, bloqueado, destaque, maiuscula, aoPassar, aoDigitar }: {
  campo: Campo;
  rotulo: string;
  valor: string;
  bloqueado: boolean;
  destaque?: boolean;
  maiuscula?: boolean;
  aoPassar: (campo: Campo, direcao: 1 | -1) => void;
  aoDigitar: (campo: Campo, valor: string) => void;
}) {
  const [digitando, setDigitando] = useState(false);
  const cor = destaque ? 'var(--cor-criativo)' : 'var(--text-primary)';

  const botao = (direcao: 1 | -1) => (
    <BotaoTatil
      className={`contador-botao ${direcao === 1 ? 'contador-mais' : 'contador-menos'}`}
      aria-label={direcao === 1 ? `Próximo ${rotulo.toLowerCase()}` : `${rotulo} anterior`}
      title={direcao === 1 ? `Próximo ${rotulo.toLowerCase()}` : `${rotulo} anterior`}
      disabled={bloqueado}
      escala={0.9}
      onClick={() => aoPassar(campo, direcao)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
        cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado ? 0.4 : 1,
      }}
    >
      {direcao === 1 ? <Plus size={20} strokeWidth={2.6} /> : <Minus size={20} strokeWidth={2.6} />}
    </BotaoTatil>
  );

  return (
    <div role="group" aria-label={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <div className="contador-corpo">
        {botao(-1)}
        {digitando ? (
          <div
            className="contador-valor"
            style={{ padding: 0, borderColor: cor, position: 'relative' }}
            // O blur do campo sobe até aqui depois de o campo gravar: sair dele
            // (ou Enter, ou Esc) volta a mostrar o número.
            onBlur={() => setDigitando(false)}
            // Tocar no número é para TROCAR o número: ele abre selecionado, e o
            // que se digita substitui em vez de grudar no fim ("4" + "12" ≠ "412").
            onFocus={e => (e.target as HTMLInputElement).select?.()}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); (e.target as HTMLElement).blur(); }
            }}
          >
            <span className="contador-rotulo" aria-hidden>{rotulo}</span>
            <CampoTexto
              value={valor}
              aoGravar={v => aoDigitar(campo, v)}
              autoFocus
              title={rotulo}
              style={{
                width: '100%', height: '100%', minHeight: 'inherit', border: 'none', background: 'none', outline: 'none',
                textAlign: 'center', fontFamily: MONO, fontWeight: 700, fontSize: 'inherit', color: cor,
                textTransform: maiuscula ? 'uppercase' : 'none', padding: 0,
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="contador-valor"
            disabled={bloqueado}
            onClick={() => setDigitando(true)}
            aria-label={`${rotulo}: ${valor || 'vazio'}. Tocar para digitar`}
            title="Tocar para digitar"
            style={{ cursor: bloqueado ? 'default' : 'text', color: cor, padding: '0 4px' }}
          >
            {/* O rótulo dentro da casa, como na claquete de giz: economiza uma linha no celular. */}
            <span className="contador-rotulo" aria-hidden>{rotulo}</span>
            <ValorQueTroca texto={valor || '—'} rotuloDeLeitura={rotulo} tamanho="inherit" cor={cor} />
          </button>
        )}
        {botao(1)}
      </div>
    </div>
  );
}
