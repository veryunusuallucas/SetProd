import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Users, FileText, Wallet, Sparkles, CloudOff, Bug, HeartHandshake, ShieldCheck, LogOut,
} from 'lucide-react';
import SplitFlapText from './ui/SplitFlapText';
import Stepper, { Step } from './ui/Stepper';
import { Fogos } from './ui/Fogos';
import { MOLA, PASSO_STAGGER, useMovimentoReduzido } from './ui/movimento';
import { TermosDeUso } from './TermosDeUso';
import { RASCUNHO } from '../lib/termos';
import { VERSAO_ACEITA, registrarAceite } from '../lib/aceite';

/**
 * A primeira vez no SetProd: bem-vindo, como funciona, e o aceite dos termos.
 *
 * Aparece UMA vez por conta (`lib/aceite.ts` pergunta ao servidor). Quando só os
 * termos mudam, volta apenas o último passo — quem já conhece o app não precisa
 * ser apresentado de novo.
 *
 * O FUNDO é o próprio app: telas de verdade, desfocadas, subindo devagar atrás
 * do vidro. São desenhadas em CSS (`TelaInicio`, `TelaStripboard`...); prints
 * de verdade em `src/conteudo/boas-vindas/` entram no lugar delas, se um dia
 * houver — só de uma produção de exemplo, porque a imagem vai junto no app.
 *
 * Não fecha no Esc nem clicando fora: sem o aceite, não há app. A saída é
 * "Sair da conta", no passo dos termos.
 *
 * Os passos usam o `Stepper` da casa (ui/Stepper.tsx, o mesmo da criação de
 * produção).
 */

const TELAS = Object.values(
  import.meta.glob('../conteudo/boas-vindas/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' })
) as string[];

interface Props {
  usuario: string;
  nome?: string;
  /** `true` quando a pessoa já aceitou uma versão antiga: só o passo dos termos. */
  soTermos: boolean;
  aoTerminar: () => void;
  aoSair: () => void;
}

export function BoasVindas({ usuario, nome, soTermos, aoTerminar, aoSair }: Props) {
  const reduzido = useMovimentoReduzido();
  const total = soTermos ? 1 : 3;
  const [passo, setPasso] = useState(1);
  const [marcou, setMarcou] = useState(false);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [festa, setFesta] = useState(false);

  const comecar = async () => {
    if (!marcou || salvando) return;
    setSalvando(true);
    await registrarAceite(usuario);
    setFesta(true);
    setTimeout(aoTerminar, reduzido ? 200 : 1100);
  };

  const travado = passo === total && (!marcou || salvando);

  return createPortal(
    <div className="boas-vindas" role="dialog" aria-modal="true" aria-labelledby="boas-vindas-titulo">
      <FundoDeTelas parado={reduzido} />
      {festa && <Fogos duracaoMs={2200} quantidade={5} />}

      <motion.div
        className="boas-vindas-vidro"
        initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={festa ? { opacity: 0, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 }}
        transition={MOLA}
      >
        {/* O mesmo Stepper da criação de produção — uma peça só para "passos". */}
        <Stepper
          stepCircleContainerClassName="sem-moldura"
          stepContainerClassName={soTermos ? 'escondido' : ''}
          disableStepIndicators
          onStepChange={setPasso}
          onFinalStepCompleted={comecar}
          backButtonText="Voltar"
          nextButtonText="Continuar"
          finalButtonText={salvando ? 'Abrindo o set…' : soTermos ? 'Continuar' : 'Começar'}
          nextButtonProps={{ disabled: travado, style: travado ? { opacity: 0.45, cursor: 'not-allowed' } : undefined }}
        >
          {!soTermos && <Step><PassoBemVindo nome={nome} reduzido={reduzido} /></Step>}
          {!soTermos && <Step><PassoComoFunciona reduzido={reduzido} /></Step>}
          <Step>
            <PassoTermos
              soTermos={soTermos}
              marcou={marcou}
              aoMarcar={setMarcou}
              aoLer={() => setLendo(true)}
              aoSair={aoSair}
            />
          </Step>
        </Stepper>
      </motion.div>

      {lendo && <TermosDeUso aoFechar={() => setLendo(false)} />}
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// O fundo: o app passando atrás do vidro
// ---------------------------------------------------------------------------

function FundoDeTelas({ parado }: { parado: boolean }) {
  // Com prints na pasta, eles; sem, as telas desenhadas aqui mesmo.
  const telas: React.ReactNode[] = TELAS.length
    ? TELAS.map(src => <img src={src} alt="" loading="lazy" draggable={false} />)
    : [<TelaInicio />, <TelaStripboard />, <TelaCalendario />, <TelaOD />, <TelaDiaria />];

  // Três colunas com as mesmas telas em ordens diferentes, subindo em ritmos
  // diferentes: parece um app inteiro passando, com meia dúzia de telas.
  const colunas = [0, 1, 2].map(c => [...telas.slice(c % telas.length), ...telas.slice(0, c % telas.length)]);
  return (
    <div className="boas-vindas-fundo" aria-hidden="true">
      <div className={`boas-vindas-colunas ${parado ? 'parado' : ''}`}>
        {colunas.map((itens, c) => (
          <div key={c} className="boas-vindas-coluna" style={{ animationDuration: `${70 + c * 18}s`, animationDirection: c === 1 ? 'reverse' : 'normal' }}>
            {/* Duas voltas seguidas: a animação sobe meia altura e recomeça sem emenda. */}
            {[...itens, ...itens].map((t, i) => <div key={i} className="tela-falsa-moldura">{t}</div>)}
          </div>
        ))}
      </div>
      <div className="boas-vindas-veu" />
    </div>
  );
}

/*
  As telas desenhadas. Desfocadas, ninguém lê — o que importa é a FORMA de
  cada uma ser a do app (cartões, tiras coloridas, grade, folha da OD). Sem
  imagem: não pesa, acompanha o tema claro/escuro e nunca mostra dado de
  ninguém (um print de produção de verdade iria junto no app, sem desfoque,
  para quem baixasse o arquivo).
*/
const CORES_DEPTO = ['#ffd700', '#1dd1a1', '#54a0ff', '#ff6b6b', '#a78bfa', '#fb923c'];
const Linha = ({ l = '70%', a = 8, cor }: { l?: string; a?: number; cor?: string }) => (
  <div className="tela-falsa-linha" style={{ width: l, height: a, background: cor }} />
);

function TelaInicio() {
  return (
    <div className="tela-falsa">
      <div style={{ fontWeight: 900, fontSize: 30, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>SETPROD</div>
      <Linha l="55%" />
      {[0, 1, 2].map(i => (
        <div key={i} className="tela-falsa-cartao">
          <Linha l="35%" a={7} cor={CORES_DEPTO[i]} />
          <Linha l="75%" a={14} />
          <Linha l="45%" />
          <div className="tela-falsa-barra"><div style={{ width: `${30 + i * 25}%`, background: 'var(--accent)' }} /></div>
        </div>
      ))}
    </div>
  );
}

function TelaStripboard() {
  return (
    <div className="tela-falsa">
      <Linha l="40%" a={12} />
      {Array.from({ length: 11 }, (_, i) => (
        <div key={i} className="tela-falsa-tira" style={{ borderLeftColor: CORES_DEPTO[i % CORES_DEPTO.length] }}>
          <Linha l="12%" a={7} /><Linha l="50%" a={7} /><Linha l="14%" a={7} />
        </div>
      ))}
    </div>
  );
}

function TelaCalendario() {
  return (
    <div className="tela-falsa">
      <Linha l="45%" a={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="tela-falsa-dia">
            {[3, 9, 10, 16, 23, 24].includes(i) && <div style={{ height: 6, borderRadius: 3, background: 'var(--accent)' }} />}
            {[12, 19].includes(i) && <div style={{ height: 6, borderRadius: 3, background: '#54a0ff' }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function TelaOD() {
  return (
    <div className="tela-falsa" style={{ background: '#f7f7f5' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '40%' }}><Linha l="100%" a={12} cor="#222" /><Linha l="70%" cor="#999" /></div>
        <div style={{ width: '25%' }}><Linha l="100%" a={12} cor="#222" /></div>
      </div>
      <div style={{ height: 2, background: '#222' }} />
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 6 }}>
          <Linha l="15%" a={7} cor="#bbb" /><Linha l={`${40 + (i % 3) * 12}%`} a={7} cor="#ccc" />
        </div>
      ))}
    </div>
  );
}

function TelaDiaria() {
  return (
    <div className="tela-falsa">
      <Linha l="50%" a={14} />
      <div style={{ display: 'flex', gap: 6 }}>
        {['#1dd1a1', 'var(--accent)', '#54a0ff'].map(c => <div key={c} className="tela-falsa-pilula" style={{ background: c }} />)}
      </div>
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="tela-falsa-ponto" style={{ background: i < 3 ? 'var(--accent)' : 'var(--border-color)' }} />
          <Linha l="18%" a={7} /><Linha l={`${35 + (i % 4) * 10}%`} a={7} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Os passos
// ---------------------------------------------------------------------------

function Entra({ i, reduzido, children }: { i: number; reduzido: boolean; children: React.ReactNode }) {
  return (
    <motion.div
      initial={reduzido ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ ...MOLA, delay: reduzido ? 0 : 0.15 + i * PASSO_STAGGER * 2 }}
    >
      {children}
    </motion.div>
  );
}

function PassoBemVindo({ nome, reduzido }: { nome?: string; reduzido: boolean }) {
  const primeiroNome = (nome || '').trim().split(/\s+/)[0];
  const cartoes = [
    { icone: <Users size={18} />, titulo: 'Equipe e diárias', texto: 'Fichas, escala, presença e o dia a dia do set.' },
    { icone: <FileText size={18} />, titulo: 'Roteiro e Ordem do Dia', texto: 'Decupagem, stripboard e a OD pronta para mandar.' },
    { icone: <Wallet size={18} />, titulo: 'Dinheiro e acertos', texto: 'Despesas por área e quem deve o quê a quem.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <SplitFlapText
          // Centralizadas na largura da maior: sobra espaço dos dois lados, e o
          // letreiro fica simétrico como um painel de verdade.
          words={['BEM-VINDO', ' AO SET', ' SETPROD']}
          loop={false}
          padTo={9}
          cycleDelay={1100}
          charset="ABCDEFGHIJKLMNOPQRSTUVWXYZ-"
          fontSize="clamp(22px, 6.4vw, 38px)"
          gap={4}
          tileRadius={6}
          tileColor="#141418"
          textColor="#ffd700"
        />
      </div>
      <Entra i={0} reduzido={reduzido}>
        <h2 id="boas-vindas-titulo" className="font-bold" style={{ fontSize: 'clamp(20px, 5vw, 26px)', margin: 0 }}>
          {primeiroNome ? `Que bom ter você aqui, ${primeiroNome}.` : 'Que bom ter você aqui.'}
        </h2>
        <p className="text-sm text-secondary" style={{ margin: '6px 0 0', lineHeight: 1.6 }}>
          O set inteiro num app só — do roteiro ao último acerto.
        </p>
      </Entra>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
        {cartoes.map((c, i) => (
          <Entra key={c.titulo} i={i + 1} reduzido={reduzido}>
            <div className="boas-vindas-cartao">
              <span className="boas-vindas-icone">{c.icone}</span>
              <div>
                <div className="font-bold text-sm">{c.titulo}</div>
                <div className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>{c.texto}</div>
              </div>
            </div>
          </Entra>
        ))}
      </div>
    </div>
  );
}

function PassoComoFunciona({ reduzido }: { reduzido: boolean }) {
  const itens = [
    { icone: <Sparkles size={18} />, titulo: 'É beta', texto: 'Funciona em set de verdade, mas muda toda semana. As novidades aparecem no selo da tela inicial.' },
    { icone: <CloudOff size={18} />, titulo: 'Funciona sem sinal', texto: 'Tudo fica salvo no aparelho e sobe sozinho quando a internet volta.' },
    { icone: <Users size={18} />, titulo: 'Cada um no seu departamento', texto: 'Todo mundo vê a produção; cada um edita o que é da sua área. Dinheiro é de quem administra.' },
    { icone: <Bug size={18} />, titulo: 'Achou um problema?', texto: 'O botão no canto da tela manda o relato direto para quem faz o app.' },
    { icone: <HeartHandshake size={18} />, titulo: 'Feito para o cinema brasileiro', texto: 'Mantido por quem usa — dá para apoiar em Configurações, se quiser.' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <h2 id="boas-vindas-titulo" className="font-bold" style={{ fontSize: 'clamp(20px, 5vw, 24px)', margin: 0 }}>Antes de entrar no set</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {itens.map((c, i) => (
          <Entra key={c.titulo} i={i} reduzido={reduzido}>
            <div className="boas-vindas-cartao">
              <span className="boas-vindas-icone">{c.icone}</span>
              <div>
                <div className="font-bold text-sm">{c.titulo}</div>
                <div className="text-xs text-secondary" style={{ lineHeight: 1.5 }}>{c.texto}</div>
              </div>
            </div>
          </Entra>
        ))}
      </div>
    </div>
  );
}

function PassoTermos({ soTermos, marcou, aoMarcar, aoLer, aoSair }: {
  soTermos: boolean; marcou: boolean; aoMarcar: (v: boolean) => void; aoLer: () => void; aoSair: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="boas-vindas-icone"><ShieldCheck size={18} /></span>
        <h2 id="boas-vindas-titulo" className="font-bold" style={{ fontSize: 'clamp(20px, 5vw, 24px)', margin: 0 }}>
          {soTermos ? 'Os termos mudaram' : 'O combinado'}
        </h2>
      </div>

      {RASCUNHO && (
        <p className="text-xs" style={{ margin: 0, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent)', color: 'var(--text-secondary)' }}>
          Os termos ainda são um rascunho. Quando a versão final sair, o app pede o aceite de novo.
        </p>
      )}

      <ul className="text-sm text-secondary boas-vindas-resumo">
        <li>O SetProd guarda o que a produção registra: equipe, diárias, roteiro e contas — inclusive CPF, dados bancários e ficha médica de quem é da equipe.</li>
        <li>Documento, conta e saúde de alguém só são vistos por essa pessoa e por quem administra a produção.</li>
        <li>Seus dados não são vendidos nem usados para propaganda. Você pode pedir para apagar a sua conta.</li>
        <li>É beta: pode ter erros. Guarde um backup do que for importante (Gestão de dados).</li>
      </ul>

      <button type="button" onClick={aoLer} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent-texto)', fontWeight: 700, fontSize: '14px' }}>
        <FileText size={15} /> Ler os termos completos
      </button>

      <label className={`boas-vindas-aceite ${marcou ? 'marcado' : ''}`}>
        <input type="checkbox" checked={marcou} onChange={e => aoMarcar(e.target.checked)} />
        <span>
          Li e aceito os termos de uso <span className="text-muted">(versão {VERSAO_ACEITA})</span>
        </span>
      </label>

      <button type="button" onClick={aoSair} className="text-xs text-muted" style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 0, cursor: 'pointer', padding: '6px' }}>
        <LogOut size={13} /> Não quero aceitar agora — sair da conta
      </button>
    </div>
  );
}
