import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { MOLA } from './ia';
import { useMovimentoReduzido } from './movimento';

/** As janelas abertas, da mais antiga para a mais nova. */
const pilhaDeJanelas: object[] = [];

/**
 * O COMPORTAMENTO de uma janela, sem a aparência dela.
 *
 * Existe porque migrar 34 janelas para o componente `Janela` de uma vez seria
 * mexer em 34 telas no mesmo dia — e a parte que mais falta nelas não é a
 * moldura, é o comportamento: Esc, rolagem do fundo travada e o foco voltando
 * para onde estava. Isto dá as três coisas com uma linha, e a moldura converge
 * depois, quando cada tela for tocada.
 *
 * O clique fora fica de fora de propósito: ele depende da estrutura do JSX
 * (qual div é o fundo), e um palpite errado fecharia a janela no meio do
 * formulário.
 */
export function useComportamentoDeJanela(aoFechar: () => void) {
  const focoAnterior = useRef<Element | null>(null);
  const eu = useRef({});
  /*
    O `aoFechar` vai por ref, e o efeito roda UMA vez, ao abrir.
    Quem abre costuma passar uma função nova a cada render
    (`() => setAberto(false)`). Com ela na lista de dependências, cada tecla
    digitada num formulário da janela desmontava e remontava o efeito — e a
    limpeza devolve o foco ao botão que abriu: o campo perdia o cursor a cada
    letra.
  */
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    focoAnterior.current = document.activeElement;
    const minha = eu.current;
    pilhaDeJanelas.push(minha);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      /*
        UM Esc fecha UMA coisa, a de cima.
        · Uma confirmação aberta por cima ("descartar a ficha?") responde o Esc
          ela mesma — se a janela de baixo fechasse também, o "não" viraria
          "sim, feche".
        · Janela aberta de dentro de outra: só a mais recente fecha.
      */
      if (document.querySelector("[data-confirmacao]")) return;
      if (pilhaDeJanelas[pilhaDeJanelas.length - 1] !== minha) return;
      e.stopPropagation();
      fechar.current();
    };
    document.addEventListener("keydown", aoTeclar);

    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      const i = pilhaDeJanelas.lastIndexOf(minha);
      if (i >= 0) pilhaDeJanelas.splice(i, 1);
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = antes;
      (focoAnterior.current as HTMLElement | null)?.focus?.();
    };
  }, []);
}

/**
 * A base de toda janela do app.
 *
 * O QUE ISTO CONSERTA (leva de UI 3, item 3)
 * Em 20/09/2026 o app tinha **34 janelas feitas à mão**. Dessas, 10 fechavam no
 * Esc, 15 fechavam clicando fora e **uma** travava a rolagem do fundo. Ou seja:
 * a mesma tela respondia diferente conforme a janela que você abriu — e o
 * "fechar" que funcionou na anterior falha na seguinte. Ninguém relata isso
 * como bug; a pessoa só aprende a desconfiar do app.
 *
 * O QUE TODA JANELA GANHA AQUI
 * · portal no `body` — nenhum `overflow` de pai corta a janela;
 * · Esc fecha;
 * · clique fora fecha (no fundo, não no conteúdo);
 * · a página atrás para de rolar enquanto a janela está aberta;
 * · o foco entra na janela ao abrir e VOLTA para onde estava ao fechar;
 * · `aria-modal`, para quem usa leitor de tela saber que o resto está suspenso.
 *
 * O que ela NÃO faz: decidir o conteúdo. Cabeçalho, corpo e rodapé são da tela.
 */
export function Janela({
  titulo, icone, aoFechar, children, rodape, largura = '560px', fecharClicandoFora = true,
}: {
  titulo: React.ReactNode;
  icone?: React.ReactNode;
  aoFechar: () => void;
  children: React.ReactNode;
  /** Os botões do fim, quando houver. Ficam grudados na base da janela. */
  rodape?: React.ReactNode;
  largura?: string;
  /**
   * `false` em formulário longo: clique fora com meia ficha preenchida apaga
   * trabalho, e "tem certeza?" em cima de um clique errado é pior ainda.
   */
  fecharClicandoFora?: boolean;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const reduzido = useMovimentoReduzido();

  // Esc, rolagem travada e foco de volta vêm do hook — é o mesmo comportamento
  // que as janelas ainda não migradas já usam.
  useComportamentoDeJanela(aoFechar);

  useEffect(() => {
    // O que é só daqui: o foco ENTRA na janela, no primeiro campo se houver.
    const alvo = caixa.current?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select, button:not([data-fechar])'
    );
    (alvo ?? caixa.current)?.focus?.();
  }, []);

  return createPortal(
    <div
      onClick={fecharClicandoFora ? aoFechar : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 3900, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
    >
      <motion.div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)', width: `min(${largura}, 100%)`,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)', outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 18px 12px' }}>
          {icone && <span style={{ display: 'flex', color: 'var(--accent)' }}>{icone}</span>}
          <h2 style={{ margin: 0, fontSize: '18px', flex: 1, minWidth: 0 }}>{titulo}</h2>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar" data-fechar>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0 18px 18px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {rodape && (
          <div style={{
            display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap',
            padding: '12px 18px', borderTop: '1px solid var(--border-light)',
          }}>
            {rodape}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
