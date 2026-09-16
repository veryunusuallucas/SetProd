import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  Clapperboard, Camera, HardDrive, FileInput, Settings2, Monitor, Eye, CalendarDays, ChevronDown,
} from 'lucide-react';
import { db } from '../db/db';
import { useRole } from '../hooks/useRole';
import { useAuth } from '../hooks/useAuth';
import { MOLA, useMovimentoReduzido } from '../components/ui/movimento';
import { podeEditarLogagem, departamentoDaFotografia, visaoPadraoDeQuemVe } from '../lib/logagem/permissao';
import { AbaCamera } from '../components/logagem/AbaCamera';
import { AbaLogagem } from '../components/logagem/AbaLogagem';
import { AbaBackup } from '../components/logagem/AbaBackup';
import { AbaIngest } from '../components/logagem/AbaIngest';
import type { VisaoDeQuemVe } from '../lib/logagem/permissao';
import { diariaPadrao } from '../lib/logagem/diariaPadrao';
import { hojeISO } from '../lib/urgencia';
import { diaDaSemana } from '../lib/formato';

/**
 * Logagem — o boletim de câmera da diária.
 *
 * Nasceu no Lumavi Camera Log, um app separado que rodava num notebook no set.
 * Aqui ele é um módulo do SetProd: mesma conta, mesmas diárias, mesmo sync.
 * O plano inteiro, e o porquê de cada decisão, está em `.md/PLANO-logagem.md`
 * (fora do Git, como os outros planos) e resumido no manual.
 *
 * ESTA TELA, POR ENQUANTO, É A CASCA: a diária escolhida e as cinco abas. O
 * conteúdo de cada aba chega em pedaços, um de cada vez.
 */

type Aba = 'logagem' | 'camera' | 'backup' | 'ingest' | 'config';

const ABAS: { id: Aba; nome: string; icone: typeof Camera }[] = [
  { id: 'logagem', nome: 'Logagem', icone: Clapperboard },
  { id: 'camera', nome: 'Câmera', icone: Camera },
  { id: 'backup', nome: 'Backup', icone: HardDrive },
  { id: 'ingest', nome: 'Ingest', icone: FileInput },
  { id: 'config', nome: 'Config', icone: Settings2 },
];

const CHAVE_ABA = 'setprod:logagem:aba';

function abaInicial(): Aba {
  try {
    const salva = localStorage.getItem(CHAVE_ABA);
    if (ABAS.some(a => a.id === salva)) return salva as Aba;
  } catch { /* sem localStorage: abre na Logagem */ }
  return 'logagem';
}

export default function LogagemPage() {
  const { id: projetoId } = useParams<{ id: string }>();
  const { role, perfilId } = useRole();
  const { user } = useAuth();
  const reduzido = useMovimentoReduzido();

  const projeto = useLiveQuery(() => (projetoId ? db.projetos.get(projetoId) : undefined), [projetoId]);
  const diarias = useLiveQuery(
    () => (projetoId ? db.diarias.where('projeto_id').equals(projetoId).toArray() : []),
    [projetoId]
  );
  const perfis = useLiveQuery(
    () => (projetoId ? db.perfis.where('projeto_id').equals(projetoId).toArray() : []),
    [projetoId]
  ) || [];
  const departamentos = useLiveQuery(
    () => (projetoId ? db.departamentos.where('projeto_id').equals(projetoId).toArray() : []),
    [projetoId]
  ) || [];

  const ordenadas = useMemo(
    () => [...(diarias || [])].sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.numero - b.numero),
    [diarias]
  );

  /*
    O link "Abrir a Logagem" da página da diária traz `?diaria=`. Sem isso, a
    Logagem abriria na diária de HOJE — e quem veio conferir a de ontem cairia
    na tela errada sem perceber.
  */
  const [parametros] = useSearchParams();
  const [diariaId, setDiariaId] = useState<string>(() => parametros.get('diaria') || '');
  useEffect(() => {
    // Só escolhe sozinho quando ainda não há escolha (ou a escolhida sumiu).
    if (!diarias) return;
    if (diariaId && diarias.some(d => d.id === diariaId)) return;
    setDiariaId(diariaPadrao(diarias, hojeISO())?.id || '');
  }, [diarias, diariaId]);

  const [aba, setAbaEstado] = useState<Aba>(abaInicial);
  /*
    A direção da troca de aba, para o conteúdo entrar pelo lado certo.

    Ir para uma aba à DIREITA faz o conteúdo novo chegar da direita; voltar faz
    chegar da esquerda. É a mesma geometria da barra de abas logo acima — se o
    conteúdo entrasse sempre do mesmo lado, a tela contradiria o dedo.
  */
  const [direcao, setDirecao] = useState(1);
  const setAba = (nova: Aba) => {
    const de = ABAS.findIndex(a => a.id === aba);
    const para = ABAS.findIndex(a => a.id === nova);
    setDirecao(para >= de ? 1 : -1);
    setAbaEstado(nova);
    try { localStorage.setItem(CHAVE_ABA, nova); } catch { /* fica só nesta visita */ }
  };

  /*
    A aba lembrada pode ser a última da faixa (Config, Ingest). No celular ela
    abriria escondida, fora da tela, com a pessoa sem saber em que aba está.
    Na abertura, a faixa rola até ela — sem animação, porque ninguém tocou em
    nada ainda.
  */
  useEffect(() => {
    if (diarias === undefined) return;
    document.querySelector<HTMLElement>('[role="tablist"] [aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [diarias === undefined]);

  if (!projetoId || diarias === undefined || projeto === undefined) {
    return <div className="screen-padding text-secondary">Carregando…</div>;
  }

  const podeEditar = podeEditarLogagem({
    papel: role,
    usuarioId: user?.id,
    perfilId,
    perfis,
    departamentos,
    liberados: projeto?.logagem_liberados,
  });

  const diaria = ordenadas.find(d => d.id === diariaId);
  const deslocamento = reduzido ? 0 : 24;

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="cabecalho-pagina" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clapperboard size={24} color="var(--cor-criativo)" /> Logagem
          </h1>
          <p className="text-sm text-secondary">O boletim de câmera da diária: takes, cartões e backup</p>
        </div>

        {ordenadas.length > 0 && (
          <SeletorDeDiaria
            diarias={ordenadas}
            valor={diariaId}
            aoMudar={setDiariaId}
          />
        )}
      </div>

      {ordenadas.length === 0 ? (
        <SemDiaria projetoId={projetoId} />
      ) : (
        <>
          {!podeEditar && (
            <div className="text-sm text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)' }}>
              <Eye size={16} style={{ flexShrink: 0 }} />
              Você acompanha a Logagem. Quem registra takes é a Fotografia.
            </div>
          )}

          {/*
            A barra de abas com o marcador que DESLIZA até a aba escolhida.

            O marcador é um elemento só, que a mola leva de uma aba à outra
            (`layoutId`). Trocar a cor do botão resolveria "qual está ativa",
            mas não diria DE ONDE você veio — e é o deslizar que faz a troca de
            aba parecer um lugar, e não um piscar.
          */}
          <div className="tab-strip" role="tablist" aria-label="Partes da Logagem" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', backgroundColor: 'var(--bg-surface)' }}>
            {ABAS.map(a => {
              const ativa = a.id === aba;
              const Icone = a.icone;
              return (
                <button
                  key={a.id}
                  role="tab"
                  aria-selected={ativa}
                  onClick={e => {
                    setAba(a.id);
                    // No celular a faixa rola: a aba escolhida não pode ficar
                    // meio escondida na borda, com o marcador fora da tela.
                    e.currentTarget.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
                  }}
                  style={{
                    position: 'relative', flex: '1 0 auto',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px', border: 'none', borderRadius: '8px', background: 'none', cursor: 'pointer',
                    fontWeight: 700, fontSize: '13px',
                    color: ativa ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {ativa && (
                    <motion.span
                      layoutId="logagem-aba-ativa"
                      transition={reduzido ? { duration: 0 } : MOLA}
                      style={{ position: 'absolute', inset: 0, borderRadius: '8px', backgroundColor: 'var(--bg-active)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
                    />
                  )}
                  <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icone size={16} /> {a.nome}
                  </span>
                </button>
              );
            })}
          </div>

          {/*
            O conteúdo da aba ENTRA com movimento e a aba anterior SAI NA HORA.

            A primeira versão animava as duas (AnimatePresence). Com `wait`, a
            aba nova só entrava depois de a antiga terminar de sair: três toques
            rápidos viravam três animações na fila, e a tela ficava para trás do
            dedo. Com `popLayout`, as saídas ficavam empilhadas enquanto
            animavam — e numa aba do navegador em segundo plano, onde o
            navegador pausa os quadros, elas nunca saíam e se acumulavam.

            Sair na hora resolve as duas coisas: nada espera animação para
            aparecer, e trocar de ideia no meio é sempre imediato. O movimento
            que sobra é o que informa: a aba nova chega do lado para onde o dedo
            foi.
          */}
          <motion.div
            key={aba}
            role="tabpanel"
            initial={{ opacity: 0, x: direcao * deslocamento }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduzido ? { duration: 0.12 } : MOLA}
          >
            <ConteudoDaAba
              aba={aba}
              diariaNumero={diaria?.numero}
              diariaData={diaria?.data}
              projetoId={projetoId}
              diariaId={diariaId}
              podeEditar={podeEditar}
              departamentoId={departamentoDaFotografia(departamentos)?.id}
              visaoDeQuemVe={visaoPadraoDeQuemVe(perfis.find(p => p.id === perfilId))}
              // A ficha primeiro: é o nome que a equipe conhece, e é o que o
              // camera report imprime em "logado por". A conta fica para quem
              // entrou só pelo convite, sem ficha vinculada.
              quem={perfilId || user?.id}
            />
          </motion.div>
        </>
      )}
    </div>
  );
}

/**
 * A diária em que a Logagem está. Um `select` nativo de propósito: no celular
 * ele abre a roda do sistema, que é o controle mais legível e mais fácil de
 * acertar com o dedo que existe — e ninguém precisa aprender um seletor novo
 * no meio do set.
 */
function SeletorDeDiaria({ diarias, valor, aoMudar }: {
  diarias: { id: string; numero: number; data: string }[];
  valor: string;
  aoMudar: (id: string) => void;
}) {
  const hoje = hojeISO();
  return (
    <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 36px 0 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', cursor: 'pointer', flexShrink: 0 }}>
      <CalendarDays size={16} color="var(--cor-set)" />
      <select
        value={valor}
        onChange={e => aoMudar(e.target.value)}
        aria-label="Diária da Logagem"
        style={{ appearance: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', fontWeight: 700, fontSize: '14px', cursor: 'pointer', outline: 'none', paddingRight: 0, minHeight: '44px' }}
      >
        {diarias.map(d => (
          <option key={d.id} value={d.id}>
            Diária {String(d.numero).padStart(2, '0')} · {d.data ? diaDaSemana(d.data) : 'sem data'}{d.data === hoje ? ' · hoje' : ''}
          </option>
        ))}
      </select>
      <ChevronDown size={16} className="text-muted" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }} />
    </label>
  );
}

function SemDiaria({ projetoId }: { projetoId: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', padding: '24px' }}>
      <CalendarDays size={28} color="var(--cor-set)" />
      <h2 className="text-lg font-bold">A Logagem acontece dentro de uma diária</h2>
      <p className="text-sm text-secondary" style={{ maxWidth: '52ch', lineHeight: 1.6 }}>
        Cada take pertence a um dia de filmagem, e esta produção ainda não tem nenhum.
        Crie a primeira diária e volte aqui.
      </p>
      <Link to={`/projeto/${projetoId}/diarias`} className="btn-primary" style={{ marginTop: '6px' }}>
        Ir para Diárias
      </Link>
    </div>
  );
}

/** O que vem em cada aba. Por enquanto, a promessa — escrita para quem vai usar. */
function ConteudoDaAba({ aba, diariaNumero, diariaData, projetoId, diariaId, podeEditar, departamentoId, visaoDeQuemVe, quem }: {
  aba: Aba;
  diariaNumero?: number;
  diariaData?: string;
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  visaoDeQuemVe?: VisaoDeQuemVe;
  quem?: string;
}) {
  if (aba === 'camera' && diariaId) {
    return <AbaCamera projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} />;
  }
  if (aba === 'backup' && diariaId) {
    return <AbaBackup projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} quem={quem} />;
  }
  if (aba === 'logagem' && diariaId) {
    return <AbaLogagem projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} visaoDeQuemVe={visaoDeQuemVe} quem={quem} />;
  }

  const dia = diariaNumero ? `da Diária ${String(diariaNumero).padStart(2, '0')}` : 'desta diária';

  if (aba === 'ingest') {
    return (
      <>
        <div className="mobile-only">
          <AvisoComputador />
        </div>
        <div className="desktop-only">
          <AbaIngest
            projetoId={projetoId}
            diariaId={diariaId}
            diaDaDiaria={diariaData}
            podeEditar={podeEditar}
            departamentoId={departamentoId}
          />
        </div>
      </>
    );
  }

  const textos: Record<Exclude<Aba, 'ingest'>, { titulo: string; texto: string }> = {
    logagem: {
      titulo: 'Logagem',
      texto: `A claquete, o arquivo que a câmera vai gravar e os botões OK, NG, HERO e REC invertido. Cada take ${dia} entra aqui, na ordem em que foi rodado.`,
    },
    camera: {
      titulo: 'Câmera',
      texto: 'Os kits de câmera e de lentes desta produção, o cartão no corpo da câmera e o formato do nome do arquivo. O que estiver aqui vai junto em cada take.',
    },
    backup: {
      titulo: 'Backup',
      texto: `Os HDs de destino, em quais deles cada cartão ${dia} já foi copiado, e o comprovante de checksum. Cartão só fica liberado para formatar com tudo isso em dia.`,
    },
    config: {
      titulo: 'Config',
      texto: 'Anotações rápidas e quem, além da Fotografia, pode registrar takes nesta produção.',
    },
  };

  const t = textos[aba];
  return <EmConstrucao titulo={t.titulo} texto={t.texto} />;
}

function EmConstrucao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px', borderStyle: 'dashed' }}>
      <span className="text-xs font-bold uppercase tracking-widest text-muted">Em construção</span>
      <h2 className="text-lg font-bold">{titulo}</h2>
      <p className="text-sm text-secondary" style={{ maxWidth: '60ch', lineHeight: 1.6 }}>{texto}</p>
    </div>
  );
}

/**
 * Ingest é tela de computador (decisão do Lucas, 15/09/2026).
 *
 * Não é descaso com o celular: o navegador do celular não deixa escolher uma
 * pasta inteira, e o ingest é justamente "leia TODOS os XML deste cartão". No
 * celular seria um arquivo por vez, centenas de toques. Dizer isso na tela é
 * melhor que entregar uma versão que ninguém conseguiria usar.
 */
function AvisoComputador() {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', padding: '24px' }}>
      <Monitor size={28} color="var(--cor-criativo)" />
      <h2 className="text-lg font-bold">O Ingest é feito no computador</h2>
      <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>
        Ele lê a pasta inteira do cartão de uma vez, e o navegador do celular não deixa escolher pastas.
        Abra a Logagem no computador, com o cartão ou o HD de backup conectado.
      </p>
    </div>
  );
}
