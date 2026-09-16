import { useState } from 'react';
import { motion } from 'framer-motion';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';

/**
 * As peças que as abas da Logagem dividem entre si.
 *
 * Vieram da aba Câmera, onde nasceram. Saíram de lá quando a Claquete precisou
 * das mesmas: um grupo de botões com marcador que desliza, um contador com −/+,
 * um seletor que aceita valor de fora da lista. Duas cópias das mesmas peças
 * viram duas telas que se parecem por acidente, e param de se parecer no
 * primeiro conserto feito só de um lado.
 */

export const estiloCampo: React.CSSProperties = {
  width: '100%', minHeight: '44px', padding: '10px 12px', fontSize: '15px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
};

export const MONO = 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace';

export function Rotulo({ icone, children }: { icone: React.ReactNode; children: React.ReactNode }) {
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
export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
      <span className="text-xs font-bold text-secondary">{rotulo}</span>
      {children}
    </div>
  );
}

export function BotaoContador({ rotulo, disabled, onClick, children }: { rotulo: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
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
export function Segmentado({ nome, opcoes, valor, bloqueado, aoMudar }: {
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
              position: 'relative', flex: 1, minWidth: 0, minHeight: '38px', border: 'none', borderRadius: '6px', background: 'none',
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

/**
 * Uma escolha entre várias, em fichas que quebram linha.
 *
 * É o irmão do `Segmentado` para quando as opções têm nome de verdade
 * ("ESTÚDIO", "PRÁTICA", "1.2 (4 Stops)"): quatro delas lado a lado numa tela de
 * 360px espremeriam o texto até ele sumir. Aqui elas quebram a linha, e o
 * marcador continua deslizando de uma para a outra.
 */
export function Escolha({ nome, opcoes, valor, bloqueado, aoMudar }: {
  nome: string;
  opcoes: readonly string[];
  valor?: string;
  bloqueado: boolean;
  aoMudar: (v: string) => void;
}) {
  const reduzido = useMovimentoReduzido();
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {opcoes.map(o => {
        const ativa = o === valor;
        return (
          <BotaoTatil
            key={o}
            role="radio"
            aria-checked={ativa}
            disabled={bloqueado}
            escala={0.96}
            onClick={() => aoMudar(o)}
            style={{
              position: 'relative', minHeight: '44px', padding: '0 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)',
              color: ativa ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: 700, fontSize: '14px',
              cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado && !ativa ? 0.55 : 1,
            }}
          >
            {ativa && (
              <motion.span
                layoutId={nome}
                transition={reduzido ? { duration: 0 } : MOLA}
                style={{
                  position: 'absolute', inset: -1, borderRadius: 'var(--radius-sm)',
                  border: '1.5px solid var(--cor-criativo)',
                  backgroundColor: 'color-mix(in srgb, var(--cor-criativo) 10%, transparent)',
                }}
              />
            )}
            <span style={{ position: 'relative' }}>{o}</span>
          </BotaoTatil>
        );
      })}
    </div>
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
export function SeletorComOutro({ opcoes, valor, bloqueado, aoMudar }: {
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

/**
 * Um valor grande com cada caractere que MUDA descendo para o lugar.
 *
 * Quando o clipe vira de C0148 para C0149, só o último dígito anda. É o que um
 * contador mecânico faz, e é o que diz "mudou, e mudou AQUI" sem o olho precisar
 * comparar os dois valores. Os caracteres que ficaram iguais não se mexem.
 *
 * O caractere antigo sai na hora (sem animação de saída), pelo mesmo motivo das
 * abas: nada na tela pode depender de uma animação terminar.
 *
 * `tabular-nums` e fonte monoespaçada para o valor não "respirar" de largura a
 * cada troca: um 1 estreito ao lado de um 8 largo faria tudo pular.
 */
export function ValorQueTroca({ texto, rotuloDeLeitura, tamanho, cor }: {
  texto: string;
  rotuloDeLeitura: string;
  tamanho: string;
  cor?: string;
}) {
  const reduzido = useMovimentoReduzido();
  return (
    <div
      aria-live="polite"
      aria-label={`${rotuloDeLeitura}: ${texto}`}
      style={{
        fontFamily: MONO, fontSize: tamanho, fontWeight: 700, letterSpacing: '0.02em',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, color: cor || 'var(--text-primary)',
        display: 'flex', minWidth: 0, flexWrap: 'wrap',
      }}
    >
      {texto.split('').map((c, i) => (
        <motion.span
          key={`${i}-${c}`}
          aria-hidden
          /*
            O caractere cai de cima, mas NUNCA começa invisível.

            Se os quadros não rodarem — aba em segundo plano, aparelho
            economizando bateria — um `opacity: 0` inicial deixaria a claquete
            em branco, e ela é o número que se lê de longe no set. Nascendo
            deslocado, o pior caso é um dígito um pouco acima do lugar: torto,
            mas legível. Por isso também não há `overflow: hidden` aqui.
          */
          initial={reduzido ? false : { y: '-0.4em' }}
          animate={{ y: 0 }}
          transition={MOLA}
          style={{ display: 'inline-block', whiteSpace: 'pre' }}
        >
          {c}
        </motion.span>
      ))}
    </div>
  );
}
