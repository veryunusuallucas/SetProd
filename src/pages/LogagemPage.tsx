import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  Clapperboard, Camera, HardDrive, FileInput, Settings2, Monitor, Eye, CalendarDays, AlertTriangle,
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
import { AbaConfig } from '../components/logagem/AbaConfig';
import { pedirUmaVez } from '../lib/logagem/aparelho';
import { SeletorDeDiaria } from '../components/logagem/SeletorDeDiaria';
import type { Departamento, Perfil } from '../types';
import type { VisaoDeQuemVe } from '../lib/logagem/permissao';
import { diariaDeAgora, estaAcontecendo } from '../lib/logagem/diariaPadrao';
import { confirmar } from '../components/ui/Confirmacao';
import { diaDaSemana } from '../lib/formato';

/**
 * Logagem — o boletim de câmera da diária.
 *
 * Nasceu no Lumavi Camera Log, um app separado que rodava num notebook no set.
 * Aqui ele é um módulo do SetProd: mesma conta, mesmas diárias, mesmo sync.
 * O plano inteiro, e o porquê de cada decisão, está em `.md/PLANO-logagem.md`
 * (fora do Git, como os outros planos) e resumido no manual.
 *
 * A página é a casca: a diária escolhida e as cinco abas. Cada aba mora no seu
 * componente, em `components/logagem/`.
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
  /*
    A Logagem SEGUE o dia sozinha enquanto ninguém escolheu outra diária à
    mão: quem deixou o app aberto da véspera abre na de hoje, e a diária que
    vira a noite continua a mesma até as 6h (ver `diariaDeAgora`). Escolher
    uma diária diferente da de agora trava a escolha; voltar para a de agora
    solta de novo.
  */
  const [escolhaManual, setEscolhaManual] = useState(() => parametros.has('diaria'));
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const bater = () => setAgora(new Date());
    const intervalo = setInterval(bater, 60_000);
    const aoVoltar = () => { if (document.visibilityState === 'visible') bater(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { clearInterval(intervalo); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);
  const deAgora = diarias ? diariaDeAgora(diarias, agora) : undefined;
  const idDeAgora = deAgora?.diaria.id;

  useEffect(() => {
    if (!diarias) return;
    const existe = Boolean(diariaId) && diarias.some(d => d.id === diariaId);
    if (existe && escolhaManual) return;
    const alvo = idDeAgora || '';
    if (alvo !== diariaId) setDiariaId(alvo);
  }, [diarias, diariaId, escolhaManual, idDeAgora]);

  /*
    Na primeira vez que alguém que REGISTRA abre a Logagem, o app pede ao
    navegador para não apagar os dados deste site (§8). O estado e o botão de
    pedir de novo ficam na Config.
  */
  const registra = Boolean(projeto) && podeEditarLogagem({
    papel: role, usuarioId: user?.id, perfilId, perfis, departamentos, liberados: projeto?.logagem_liberados,
  });
  useEffect(() => { if (registra) void pedirUmaVez(); }, [registra]);

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
  const administra = role === 'dono' || role === 'admin';
  const deslocamento = reduzido ? 0 : 24;

  const rotulo = (d?: { numero: number }) => (d ? `Diária ${String(d.numero).padStart(2, '0')}` : '');
  const acontecendo = Boolean(deAgora && estaAcontecendo(deAgora.motivo));
  /** Está numa diária que não é a do dia que está acontecendo. */
  const foraDoDia = acontecendo && Boolean(diaria) && diariaId !== idDeAgora;

  /*
    Trocar de diária no meio do dia é o jeito mais fácil de pôr take no dia
    errado — e ninguém confere depois. Quem registra ouve a pergunta; quem só
    acompanha troca à vontade (conferir a véspera é o trabalho dele).
  */
  const trocarDiaria = async (id: string) => {
    if (id === diariaId) return;
    const voltandoParaAgora = id === idDeAgora;
    if (!voltandoParaAgora && acontecendo && podeEditar && deAgora) {
      const destino = ordenadas.find(d => d.id === id);
      const ok = await confirmar({
        titulo: `A diária de agora é a ${String(deAgora.diaria.numero).padStart(2, '0')}`,
        detalhe: `${deAgora.motivo === 'virou_a_noite' ? 'Ela começou ontem e ainda está rolando. ' : ''}`
          + `Take registrado na ${rotulo(destino)} fica no boletim desse outro dia. `
          + 'Troque só para conferir um dia que passou ou preparar o próximo.',
        confirmar: `Ir para a ${rotulo(destino)}`,
        cancelar: `Ficar na ${rotulo(deAgora.diaria)}`,
      });
      if (!ok) return;
    }
    setEscolhaManual(!voltandoParaAgora);
    setDiariaId(id);
  };

  return (
    <div className="screen-padding" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="cabecalho-pagina" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        {/*
          No celular o título sai: as abas logo abaixo já dizem onde se está, e
          cada linha a menos aqui é a claquete e os botões mais perto da primeira
          tela (pedido de quem opera câmera, 16/09/2026).
        */}
        <div className="desktop-only" style={{ minWidth: 0 }}>
          <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clapperboard size={24} color="var(--cor-criativo)" /> Logagem
          </h1>
          <p className="text-sm text-secondary">O boletim de câmera da diária: takes, cartões e backup</p>
        </div>

        {ordenadas.length > 0 && (
          <SeletorDeDiaria
            diarias={ordenadas}
            valor={diariaId}
            aoMudar={id => void trocarDiaria(id)}
            agoraId={acontecendo ? idDeAgora : undefined}
            alerta={foraDoDia}
          />
        )}
      </div>

      {/* Fora da diária de agora: a faixa fica enquanto durar, com a volta a um toque. */}
      {foraDoDia && deAgora && diaria && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 10px 10px 14px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${podeEditar ? 'color-mix(in srgb, var(--color-warning) 55%, transparent)' : 'var(--border-light)'}`,
            backgroundColor: podeEditar ? 'var(--color-warning-bg)' : 'var(--bg-surface)',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, color: podeEditar ? 'var(--color-warning)' : 'var(--text-muted)' }} aria-hidden />
          <span className="text-sm" style={{ flex: '1 1 220px', lineHeight: 1.45 }}>
            <strong>Você está na {rotulo(diaria)}</strong>
            {diaria.data ? ` (${diaDaSemana(diaria.data)})` : ''}.{' '}
            A diária de agora é a <strong>{rotulo(deAgora.diaria)}</strong>
            {podeEditar ? ': take registrado aqui vai para o outro dia.' : '.'}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void trocarDiaria(deAgora.diaria.id)}
            style={{ minHeight: '44px', whiteSpace: 'nowrap' }}
          >
            Voltar para a {rotulo(deAgora.diaria)}
          </button>
        </div>
      )}

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
              administra={administra}
              liberados={projeto?.logagem_liberados || []}
              perfis={perfis}
              departamentos={departamentos}
              usuarioId={user?.id}
            />
          </motion.div>
        </>
      )}
    </div>
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
function ConteudoDaAba({
  aba, diariaData, projetoId, diariaId, podeEditar, departamentoId, visaoDeQuemVe, quem,
  administra, liberados, perfis, departamentos, usuarioId,
}: {
  aba: Aba;
  diariaData?: string;
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  visaoDeQuemVe?: VisaoDeQuemVe;
  quem?: string;
  administra: boolean;
  liberados: string[];
  perfis: Perfil[];
  departamentos: Departamento[];
  usuarioId?: string;
}) {
  // A Config não depende de diária: é da produção e do aparelho.
  if (aba === 'config') {
    return (
      <AbaConfig
        projetoId={projetoId}
        podeEditar={podeEditar}
        administra={administra}
        liberados={liberados}
        perfis={perfis}
        departamentos={departamentos}
        eu={usuarioId}
      />
    );
  }
  if (aba === 'camera' && diariaId) {
    return <AbaCamera projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} />;
  }
  if (aba === 'backup' && diariaId) {
    return <AbaBackup projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} quem={quem} />;
  }
  if (aba === 'logagem' && diariaId) {
    return <AbaLogagem projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} visaoDeQuemVe={visaoDeQuemVe} quem={quem} />;
  }

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

  // Só chega aqui no instante em que nenhuma diária está escolhida.
  return (
    <div className="card text-sm text-secondary" style={{ padding: '24px' }}>
      Escolha uma diária no alto da página para ver {aba === 'logagem' ? 'os takes' : 'esta parte'}.
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
