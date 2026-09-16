import { useState } from 'react';
import { Minus, Plus, Clapperboard } from 'lucide-react';
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

  return (
    <section className="card painel-take" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: 'clamp(14px, 3vw, 22px)' }}>
      <div className="hud-logagem" aria-label="O que está na câmera">
        <span><i>Câmera</i>{estado.camera_id || '—'}</span>
        <span><i>Cartão</i>{estado.cartao || '—'}{gb > 0 ? ` · ~${numero(gb, gb < 10 ? 1 : 0)} GB` : ''}</span>
        <span><i>Lente</i>{lente || '—'}</span>
        <span><i>ND</i>{estado.nd || '—'}</span>
        <span><i>Takes</i>{registro.takes.length}</span>
      </div>

      <div className="claquete-grade">
        <Contador campo="cena" rotulo="Cena" valor={String(estado.cena)} bloqueado={bloqueado} aoPassar={aoPassar} aoDigitar={aoDigitar} />
        <Contador campo="plano" rotulo="Plano" valor={String(estado.plano)} bloqueado={bloqueado} maiuscula={letras} aoPassar={aoPassar} aoDigitar={aoDigitar} />
        <Contador campo="take" rotulo="Take" valor={String(estado.take)} bloqueado={bloqueado} destaque aoPassar={aoPassar} aoDigitar={aoDigitar} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1.5px solid var(--cor-criativo)', backgroundColor: 'color-mix(in srgb, var(--cor-criativo) 7%, transparent)' }}>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--cor-criativo)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Clapperboard size={12} aria-hidden /> Arquivo deste take
        </span>
        <span className="arquivo-previsto" style={{ fontFamily: MONO, fontWeight: 800 }}>
          {nomeArquivoPrevisto(estado) || '—'}
        </span>
      </div>

      <BotoesDeStatus registro={registro} podeEditar={podeEditar} />

      {registro.decisoes}

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
      <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ textAlign: 'center' }}>{rotulo}</span>
      <div className="contador-corpo">
        {botao(-1)}
        {digitando ? (
          <div
            className="contador-valor"
            style={{ padding: 0, borderColor: cor }}
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
            <ValorQueTroca texto={valor || '—'} rotuloDeLeitura={rotulo} tamanho="inherit" cor={cor} />
          </button>
        )}
        {botao(1)}
      </div>
    </div>
  );
}
