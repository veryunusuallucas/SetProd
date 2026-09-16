import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import {
  FolderOpen, Files, FileWarning, CalendarX2, GitCompareArrows, FilePlus2, CheckCircle2, RotateCcw, Info,
} from 'lucide-react';
import { db } from '../../db/db';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { Rotulo, MONO } from './pecas';
import { Guia } from './Guia';
import {
  cameraECartaoDoNome, comoClipeDoXml, lerArquivosDoCartao, type ClipeLido, type LeituraDoCartao,
} from '../../lib/logagem/leitura';
import { aplicarIngest, cruzar, type Casamento } from '../../lib/logagem/ingest';
import { claqueteLegivel } from '../../lib/logagem/takes';
import { EXPLICACAO } from '../../lib/logagem/saude';
import { emGB } from '../../lib/logagem/manifesto';
import { dataCurta } from '../../lib/formato';

/**
 * Aba Ingest: o que a câmera gravou, contra o que foi logado.
 *
 * Só no computador — é onde o cartão está espetado e onde o DaVinci gera o
 * manifesto. Os arquivos NÃO saem daqui: são lidos, o que interessa vira
 * registro, e o arquivo é esquecido.
 *
 * A ORDEM DA TELA É A ORDEM DO PERIGO. Primeiro o que pode estar perdido
 * (arquivo que não é vídeo), depois o que não devia estar ali (clipe de outro
 * dia), e só então o trabalho normal (corrigir takes, importar clipes). Quem
 * rola até o botão de aplicar passou, necessariamente, pelos avisos.
 */
export function AbaIngest({ projetoId, diariaId, diaDaDiaria, podeEditar, departamentoId }: {
  projetoId: string;
  diariaId: string;
  /** `AAAA-MM-DD` da diária, para separar os clipes de outro dia. */
  diaDaDiaria?: string;
  podeEditar: boolean;
  departamentoId?: string;
}) {
  const takes = useLiveQuery(() => db.log_takes.where('diaria_id').equals(diariaId).toArray(), [diariaId]) ?? [];

  const [leitura, setLeitura] = useState<LeituraDoCartao | null>(null);
  const [progresso, setProgresso] = useState<{ feitos: number; total: number } | null>(null);
  const [incluirOutrosDias, setIncluirOutrosDias] = useState(false);
  /** O que a pessoa marcou ou desmarcou à mão. Sem escolha, vale o padrão. */
  const [escolhas, setEscolhas] = useState<Map<string, boolean>>(new Map());
  const [resultado, setResultado] = useState<{ corrigidos: number; importados: number } | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const ler = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setResultado(null);
    setLeitura(null);
    setEscolhas(new Map());
    setIncluirOutrosDias(false);
    setProgresso({ feitos: 0, total: lista.length });
    const lida = await lerArquivosDoCartao([...lista], (feitos, total) => setProgresso({ feitos, total }));
    setProgresso(null);
    setLeitura(lida);
  };

  const recomecar = () => {
    setLeitura(null);
    setResultado(null);
    setProgresso(null);
  };

  if (!podeEditar) {
    return (
      <section className="card" style={{ padding: '22px' }}>
        <p className="text-sm text-secondary" style={{ margin: 0 }}>
          O ingest corrige e importa takes, e por isso só a Fotografia faz. O resultado aparece na lista de takes da diária.
        </p>
      </section>
    );
  }

  if (resultado) {
    return <Aplicado resultado={resultado} aoRecomecar={recomecar} />;
  }

  if (!leitura) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Guia
          id="ingest"
          titulo="Para que serve o Ingest"
          passos={[
            {
              titulo: 'Copie o cartão antes',
              texto: 'O Ingest lê a cópia (ou o cartão ainda espetado) e não substitui o backup — esse é na aba Backup.',
            },
            {
              titulo: 'Escolha a pasta do cartão',
              texto: 'O app lê os XML que a câmera grava junto de cada clipe, o manifesto do DaVinci (.mhl) e confere se cada vídeo abre. Nada sai deste computador.',
            },
            {
              titulo: 'Revise e aplique',
              texto: 'Primeiro os avisos — vídeo que não abre, clipe de outro dia. Depois o que a câmera corrige nos takes (timecode, duração, lente) e os clipes que ninguém logou. Nada muda antes do botão de aplicar.',
            },
          ]}
          fecho="Resultado: o boletim com o que a câmera realmente gravou — e o camera report sai com timecode e duração de verdade."
        />
        <Escolher progresso={progresso} aoEscolher={ler} />
      </div>
    );
  }

  return (
    <Revisao
      leitura={leitura}
      takes={takes}
      diaDaDiaria={diaDaDiaria}
      incluirOutrosDias={incluirOutrosDias}
      aoIncluirOutrosDias={setIncluirOutrosDias}
      escolhas={escolhas}
      aoMarcarImportar={(nome, importar) =>
        setEscolhas(atual => new Map(atual).set(nome, importar))
      }
      aplicando={aplicando}
      aoRecomecar={recomecar}
      aoAplicar={async ({ corrigir, importar }) => {
        setAplicando(true);
        try {
          const r = await aplicarIngest({
            base: { projeto_id: projetoId, diaria_id: diariaId, departamento_id: departamentoId },
            corrigir,
            /*
              Câmera e cartão só quando o NOME do clipe diz (A003C010 = câmera
              A, cartão 003). Herdar do estado atual parecia gentil e é errado:
              num teste com o cartão da Canon, 41 clipes teriam entrado como
              "câmera A, cartão 003" — e a aba Backup passaria a mostrar o
              cartão 003 da Sony com 41 takes que não são dele. Em branco, o
              boletim diz a verdade: não se sabe, alguém ajusta.
            */
            importar: importar.map(c => {
              const doNome = cameraECartaoDoNome(c.nome);
              return { clipe: c, camera_id: doNome.camera_id || '', cartao: doNome.cartao || '' };
            }),
          });
          setResultado(r);
        } finally {
          setAplicando(false);
        }
      }}
    />
  );
}

/* ───────────────────────── Escolher ───────────────────────── */

function Escolher({ progresso, aoEscolher }: {
  progresso: { feitos: number; total: number } | null;
  aoEscolher: (lista: FileList | null) => void;
}) {
  const pasta = useRef<HTMLInputElement>(null);
  const soltos = useRef<HTMLInputElement>(null);
  const reduzido = useMovimentoReduzido();

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px' }}>
      <Rotulo icone={<FolderOpen size={14} />}>Ler o cartão</Rotulo>
      <p className="text-sm text-secondary" style={{ margin: 0, maxWidth: '62ch' }}>
        Pode ser a pasta raiz do cartão ou a cópia dele no HD: o app acha os XML, os vídeos e o manifesto
        dentro das subpastas. Sem pasta à mão, dá para escolher os arquivos soltos.
      </p>

      {progresso ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} aria-live="polite">
          <span className="text-sm">
            Lendo {progresso.feitos} de {progresso.total}…
          </span>
          <div style={{ height: '6px', borderRadius: '999px', backgroundColor: 'var(--bg-active)', overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${progresso.total ? (progresso.feitos / progresso.total) * 100 : 0}%` }}
              transition={reduzido ? { duration: 0 } : MOLA}
              style={{ height: '100%', backgroundColor: 'var(--cor-criativo)' }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <BotaoTatil
            onClick={() => pasta.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', minHeight: '48px', padding: '0 18px',
              borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: 'var(--cor-criativo)',
              color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}
          >
            <FolderOpen size={18} /> Escolher a pasta do cartão
          </BotaoTatil>
          <BotaoTatil
            onClick={() => soltos.current?.click()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', minHeight: '48px', padding: '0 18px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'transparent',
              color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Files size={18} /> Escolher arquivos soltos
          </BotaoTatil>
        </div>
      )}

      {/* `webkitdirectory` não está nos tipos do React, mas é o atributo que
          todo navegador de computador entende para escolher uma pasta. */}
      <input
        ref={pasta}
        type="file"
        hidden
        multiple
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
        onChange={e => { aoEscolher(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={soltos}
        type="file"
        hidden
        multiple
        accept=".xml,.XML,.mp4,.MP4,.mov,.MOV,.mxf,.MXF,.mhl,.txt"
        onChange={e => { aoEscolher(e.target.files); e.target.value = ''; }}
      />
    </section>
  );
}

/* ───────────────────────── Revisão ───────────────────────── */

type Aplicacao = {
  corrigir: { take: Extract<Casamento, { tipo: 'igual' }>['take']; clipe: Casamento['clipe'] }[];
  importar: Casamento['clipe'][];
};

function Revisao({
  leitura, takes, diaDaDiaria, incluirOutrosDias, aoIncluirOutrosDias, escolhas, aoMarcarImportar,
  aplicando, aoRecomecar, aoAplicar,
}: {
  leitura: LeituraDoCartao;
  takes: Parameters<typeof cruzar>[0];
  diaDaDiaria?: string;
  incluirOutrosDias: boolean;
  aoIncluirOutrosDias: (v: boolean) => void;
  escolhas: Map<string, boolean>;
  aoMarcarImportar: (nome: string, importar: boolean) => void;
  aplicando: boolean;
  aoRecomecar: () => void;
  aoAplicar: (a: Aplicacao) => void;
}) {
  const estragados = leitura.clipes.filter(c => c.video && c.video.exame.estado !== 'ok');
  const deOutroDia = diaDaDiaria ? leitura.clipes.filter(c => c.dia && c.dia !== diaDaDiaria) : [];
  const nomesDeOutroDia = new Set(deOutroDia.map(c => c.nome));
  const nomesEstragados = new Set(estragados.map(c => c.nome));

  const considerados = leitura.clipes.filter(c => incluirOutrosDias || !nomesDeOutroDia.has(c.nome));
  // Barato o bastante para refazer a cada desenho: são dezenas de clipes, e a
  // lista de takes muda sozinha quando outro aparelho registra um.
  const casamentos = cruzar(takes, considerados.map(comoClipeDoXml));

  const iguais = casamentos.filter((c): c is Extract<Casamento, { tipo: 'igual' }> => c.tipo === 'igual');
  const comDiferenca = iguais.filter(c => c.diferencas.length > 0);
  const semTake = casamentos.filter((c): c is Extract<Casamento, { tipo: 'sem-take' }> => c.tipo === 'sem-take');
  const repetidos = casamentos.filter((c): c is Extract<Casamento, { tipo: 'repetido' }> => c.tipo === 'repetido');

  /*
    Clipe estragado NÃO vira take importado por padrão: importar um arquivo que
    não abre poria no boletim um take que ninguém vai conseguir montar, com
    cara de normal. A pessoa pode marcar, se quiser que ele conste.
  */
  const vaiImportar = (nome: string) => escolhas.get(nome) ?? !nomesEstragados.has(nome);
  const importar = semTake.filter(c => vaiImportar(c.clipe.nome)).map(c => c.clipe);
  const corrigir = comDiferenca.map(c => ({ take: c.take, clipe: c.clipe }));

  const bytes = leitura.clipes.reduce((s, c) => s + (c.video?.bytes || c.manifesto?.bytes || 0), 0);
  const porDia = contarPorDia(leitura.clipes);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Resumo */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <Rotulo icone={<Info size={14} />}>O que foi lido</Rotulo>
          <BotaoTatil
            onClick={aoRecomecar}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 14px',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', backgroundColor: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} /> Ler outra pasta
          </BotaoTatil>
        </div>
        <p className="text-sm" style={{ margin: 0 }}>
          <strong>{leitura.clipes.length}</strong> clipe{leitura.clipes.length === 1 ? '' : 's'}
          {bytes > 0 && <> · {emGB(bytes)}</>}
          {leitura.ignorados > 0 && <span className="text-muted"> · {leitura.ignorados} arquivos que não são clipe (miniaturas, índices) ficaram de fora</span>}
        </p>
        {Object.keys(porDia).length > 0 && (
          <p className="text-xs text-secondary" style={{ margin: 0 }}>
            {Object.entries(porDia).map(([dia, n]) => `${dia === 'sem data' ? 'sem data' : dataCurta(dia)}: ${n}`).join(' · ')}
          </p>
        )}
        {leitura.manifesto && (
          <p className="text-xs text-muted" style={{ margin: 0 }}>
            Manifesto {leitura.manifesto.formato === 'mhl' ? '.mhl' : 'md5sums'}
            {leitura.manifesto.ferramenta && <> de {leitura.manifesto.ferramenta}</>}
            {leitura.manifesto.maquina && <>, em {leitura.manifesto.maquina}</>}
            {' '}· {leitura.manifesto.arquivos.length} arquivos listados
          </p>
        )}
        {leitura.erros.length > 0 && (
          <p className="text-xs" style={{ margin: 0, color: 'var(--color-warning)' }}>
            Não consegui ler: {leitura.erros.map(e => `${e.arquivo} (${e.motivo})`).join('; ')}
          </p>
        )}
      </section>

      {/* 1. O que pode estar perdido */}
      {estragados.length > 0 && (
        <Aviso cor="var(--color-danger)" icone={<FileWarning size={18} />}
          titulo={estragados.length === 1 ? 'Um arquivo não está bom' : `${estragados.length} arquivos não estão bons`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {estragados.map(c => (
              <div key={c.nome} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span className="text-sm font-bold" style={{ fontFamily: MONO, overflowWrap: 'anywhere' }}>
                  {c.video!.arquivo} <span className="text-xs text-muted" style={{ fontFamily: 'inherit' }}>· {emGB(c.video!.bytes)}</span>
                </span>
                <span className="text-xs text-secondary">{EXPLICACAO[c.video!.exame.estado]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted" style={{ margin: 0 }}>
            Estes não viram take importado a não ser que você marque. Não formate o cartão de onde eles vieram antes de resolver.
          </p>
        </Aviso>
      )}

      {/* 2. O que não devia estar ali */}
      {deOutroDia.length > 0 && (
        <Aviso cor="var(--color-warning)" icone={<CalendarX2 size={18} />}
          titulo={`${deOutroDia.length} clipe${deOutroDia.length === 1 ? '' : 's'} de outro dia`}>
          <p className="text-sm text-secondary" style={{ margin: 0 }}>
            A diária é de {diaDaDiaria ? dataCurta(diaDaDiaria) : '—'}, e estes foram gravados em{' '}
            {[...new Set(deOutroDia.map(c => c.dia!))].sort().map(d => dataCurta(d)).join(', ')}. Costuma ser cartão que não foi
            formatado depois de outra filmagem. Por isso eles ficam de fora.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', minHeight: '44px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={incluirOutrosDias}
              onChange={e => aoIncluirOutrosDias(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--cor-criativo)' }}
            />
            <span className="text-sm">São desta diária mesmo — incluir</span>
          </label>
        </Aviso>
      )}

      {/* 3. O trabalho normal */}
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
        <Rotulo icone={<GitCompareArrows size={14} />}>Takes que a câmera corrige</Rotulo>
        {iguais.length === 0 ? (
          <p className="text-sm text-secondary" style={{ margin: 0 }}>
            Nenhum clipe casou com um take desta diária pelo nome do arquivo.
          </p>
        ) : (
          <p className="text-xs text-muted" style={{ margin: 0 }}>
            {iguais.length === 1 ? '1 clipe achou o take' : `${iguais.length} clipes acharam o take`} ·{' '}
            {iguais.length - comDiferenca.length} já {iguais.length - comDiferenca.length === 1 ? 'batia' : 'batiam'} com o que foi logado.
            Onde a câmera discorda, vale a câmera.
          </p>
        )}
        {comDiferenca.map(c => (
          <div key={c.take.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <span className="text-sm">
              <strong style={{ fontFamily: MONO }}>{c.clipe.nome}</strong>
              <span className="text-secondary"> · {claqueteLegivel(c.take)}</span>
            </span>
            <div style={{ display: 'flex', gap: '6px 16px', flexWrap: 'wrap' }}>
              {c.diferencas.map(d => (
                <span key={d.campo} className="text-xs">
                  <span className="text-muted">{d.rotulo}: </span>
                  {d.logado ? <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>{d.logado}</span> : <span className="text-muted">—</span>}
                  <span className="text-muted"> → </span>
                  <strong>{d.daCamera}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
        <Rotulo icone={<FilePlus2 size={14} />}>Clipes que ninguém logou</Rotulo>
        {semTake.length === 0 ? (
          <p className="text-sm text-secondary" style={{ margin: 0 }}>Todo clipe lido tem take no boletim.</p>
        ) : (
          <>
            <p className="text-xs text-muted" style={{ margin: 0 }}>
              A câmera gravou e não há take com esse nome. Viram takes com status <strong>Importado</strong>, sem claquete —
              para o boletim dizer que eles existem. Câmera e cartão vêm do nome do arquivo quando ele diz (como A003C010);
              quando não diz, ficam em branco para alguém ajustar.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {semTake.map(c => {
                const lido = leitura.clipes.find(l => l.nome === c.clipe.nome);
                const estragado = nomesEstragados.has(c.clipe.nome);
                const marcado = vaiImportar(c.clipe.nome);
                return (
                  <LinhaSemTake
                    key={c.clipe.nome}
                    lido={lido}
                    nome={c.clipe.nome}
                    marcado={marcado}
                    estragado={estragado}
                    aoMarcar={v => aoMarcarImportar(c.clipe.nome, v)}
                  />
                );
              })}
            </div>
          </>
        )}
      </section>

      {repetidos.length > 0 && (
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '18px 22px' }}>
          <p className="text-sm" style={{ margin: 0 }}>
            <strong>{repetidos.length}</strong> clipe{repetidos.length === 1 ? '' : 's'} casou com um take que outro clipe já tinha
            achado, e ficou de fora para não corrigir a mesma linha duas vezes:{' '}
            <span style={{ fontFamily: MONO }}>{repetidos.map(r => r.clipe.nome).join(', ')}</span>.
          </p>
        </section>
      )}

      {/* O botão vem por último: quem chega aqui passou pelos avisos. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <BotaoTatil
          disabled={aplicando || (corrigir.length === 0 && importar.length === 0)}
          onClick={() => aoAplicar({ corrigir, importar })}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', minHeight: '52px', padding: '0 22px',
            borderRadius: 'var(--radius-md)', border: 'none', backgroundColor: 'var(--cor-criativo)',
            color: '#fff', fontSize: '15px', fontWeight: 800,
            cursor: aplicando ? 'default' : 'pointer',
            opacity: aplicando || (corrigir.length === 0 && importar.length === 0) ? 0.5 : 1,
          }}
        >
          <CheckCircle2 size={18} />
          {aplicando ? 'Aplicando…' : textoDoBotao(corrigir.length, importar.length)}
        </BotaoTatil>
      </div>
    </div>
  );
}

function textoDoBotao(corrigir: number, importar: number) {
  if (!corrigir && !importar) return 'Nada para aplicar';
  const partes: string[] = [];
  if (corrigir) partes.push(`corrigir ${corrigir} take${corrigir === 1 ? '' : 's'}`);
  if (importar) partes.push(`importar ${importar} clipe${importar === 1 ? '' : 's'}`);
  const frase = partes.join(' e ');
  return frase.charAt(0).toUpperCase() + frase.slice(1);
}

function contarPorDia(clipes: ClipeLido[]) {
  const contagem: Record<string, number> = {};
  for (const c of clipes) contagem[c.dia || 'sem data'] = (contagem[c.dia || 'sem data'] || 0) + 1;
  return Object.fromEntries(Object.entries(contagem).sort(([a], [b]) => a.localeCompare(b)));
}

function LinhaSemTake({ lido, nome, marcado, estragado, aoMarcar }: {
  lido?: ClipeLido;
  nome: string;
  marcado: boolean;
  estragado: boolean;
  aoMarcar: (v: boolean) => void;
}) {
  const bytes = lido?.video?.bytes || lido?.manifesto?.bytes;
  const duracao = lido?.xml?.meta.duracao || (lido?.video?.exame.segundos ? `${Math.round(lido.video.exame.segundos)} s` : undefined);
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', minHeight: '44px', padding: '4px 6px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexWrap: 'wrap' }}>
      <input
        type="checkbox"
        checked={marcado}
        onChange={e => aoMarcar(e.target.checked)}
        style={{ width: '18px', height: '18px', accentColor: 'var(--cor-criativo)' }}
      />
      <span className="text-sm font-bold" style={{ fontFamily: MONO }}>{nome}</span>
      {lido?.xml?.codec && <span className="text-xs text-secondary">{lido.xml.codec}</span>}
      {duracao && <span className="text-xs text-secondary">{duracao}</span>}
      {bytes ? <span className="text-xs text-muted">{emGB(bytes)}</span> : null}
      {lido?.dia && <span className="text-xs text-muted">{dataCurta(lido.dia)}</span>}
      {!lido?.xml && <span className="text-xs text-muted">sem XML</span>}
      {estragado && <span className="text-xs" style={{ color: 'var(--color-danger)', fontWeight: 700 }}>arquivo com problema</span>}
    </label>
  );
}

function Aviso({ cor, icone, titulo, children }: { cor: string; icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <section
      role="alert"
      className="card"
      style={{
        display: 'flex', flexDirection: 'column', gap: '12px', padding: '20px 22px',
        border: `1px solid ${cor}`, backgroundColor: `color-mix(in srgb, ${cor} 8%, var(--bg-surface))`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: cor }}>
        {icone}
        <span className="text-base font-bold">{titulo}</span>
      </div>
      {children}
    </section>
  );
}

/* ───────────────────────── Aplicado ───────────────────────── */

function Aplicado({ resultado, aoRecomecar }: { resultado: { corrigidos: number; importados: number }; aoRecomecar: () => void }) {
  const reduzido = useMovimentoReduzido();
  return (
    <motion.section
      initial={reduzido ? false : { scale: 0.98 }}
      animate={{ scale: 1 }}
      transition={MOLA}
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '24px', border: '1px solid var(--color-success)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-success)' }}>
        <CheckCircle2 size={22} />
        <span className="text-lg font-bold">Pronto</span>
      </div>
      <p className="text-sm" style={{ margin: 0 }}>
        {resultado.corrigidos} take{resultado.corrigidos === 1 ? '' : 's'} corrigido{resultado.corrigidos === 1 ? '' : 's'} pela câmera
        {' '}e {resultado.importados} clipe{resultado.importados === 1 ? '' : 's'} importado{resultado.importados === 1 ? '' : 's'}.
        Os arquivos ficaram neste computador; só o que foi lido deles foi para o boletim.
      </p>
      <BotaoTatil
        onClick={aoRecomecar}
        style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'transparent',
          color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <RotateCcw size={16} /> Ler outro cartão
      </BotaoTatil>
    </motion.section>
  );
}
