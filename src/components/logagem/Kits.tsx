import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { Aperture, Camera, Plus, Pencil, Trash2, Download, X, Check } from 'lucide-react';
import { db } from '../../db/db';
import type { CameraDoKit, EstadoDaLogagem, KitDeLogagem, LenteDoKit } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { Abre } from './pecas';
import { BotaoTatil } from '../ui/BotaoTatil';
import { confirmar } from '../ui/Confirmacao';
import {
  aberturaQueCabe, aberturasDaLente, criarKitDeCamera, criarKitDeLente, excluirKit,
  formatarF, importarKit, kitsDoProjeto, renomearKit, salvarCameras, salvarLentes, trocarCamera,
} from '../../lib/logagem/kits';

/**
 * Os kits da aba Câmera: o equipamento que a produção tem em mãos.
 *
 * Duas seções com a mesma anatomia — seletor de kit em cima, chips do que tem
 * dentro, e um formulário que abre embaixo para acrescentar. A repetição é de
 * propósito: quem aprendeu a mexer nas câmeras já sabe mexer nas lentes.
 */

type Props = {
  projetoId: string;
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  aoMudar: (m: Partial<EstadoDaLogagem>) => void;
  departamentoId?: string;
};

/* ───────────────────────── Câmeras ───────────────────────── */

export function KitDeCameras({ projetoId, estado, bloqueado, aoMudar, departamentoId }: Props) {
  const kits = useLiveQuery(() => kitsDoProjeto(projetoId, 'camera'), [projetoId]);
  const lista = kits ?? [];
  const kit = lista.find(k => k.id === estado.kit_camera_id) ?? lista[0];
  const cameras = kit?.cameras ?? [];
  const [abrindo, setAbrindo] = useState(false);

  const ativar = async (id: string) => {
    if (bloqueado || !kit) return;
    const troca = trocarCamera(cameras, estado, id);
    if (!troca) return;
    await salvarCameras(kit.id, troca.cameras);
    aoMudar(troca.estado);
  };

  const acrescentar = async (dados: { id: string; modelo: string }) => {
    const digitado = dados.id.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
    const id = digitado || estado.camera_id || 'A';
    const modelo = dados.modelo.trim() || 'FX30';

    /*
      A câmera que entra com a MESMA letra da que está gravando agora nasce com
      os contadores de agora: quem cadastra a câmera A no meio do dia não pode
      perder o clipe 148 e voltar para 1. Qualquer outra letra começa do zero.
    */
    const daVez = id === estado.camera_id;
    const nova: CameraDoKit = {
      id, modelo,
      reel: daVez ? estado.cartao : '001',
      clipe: daVez ? estado.proximo_clipe : 1,
      posicao: daVez ? estado.posicao : 'C',
    };

    if (!kit) {
      const novo = await criarKitDeCamera(projetoId, 'Kit de câmeras', nova, departamentoId);
      aoMudar({ kit_camera_id: novo.id, camera_id: nova.id });
      return;
    }
    if (cameras.some(c => c.id === id)) return 'Já existe uma câmera com essa letra.';
    await salvarCameras(kit.id, [...cameras, nova]);
  };

  const remover = async (cam: CameraDoKit) => {
    if (!kit) return;
    if (!(await confirmar({ titulo: `Tirar a câmera ${cam.id} do kit?`, detalhe: 'Os takes já registrados com ela continuam como estão.', confirmar: 'Tirar', perigo: true }))) return;
    await salvarCameras(kit.id, cameras.filter(c => c.id !== cam.id));
  };

  const foraDoKit = Boolean(kit) && cameras.length > 0 && !cameras.some(c => c.id === estado.camera_id);

  return (
    <SecaoDeKit
      icone={<Camera size={14} />}
      titulo="Câmeras do kit"
      explicacao="Cada câmera guarda o cartão e o clipe dela. Trocar aqui troca o próximo arquivo."
      tipo="camera"
      kits={lista}
      kitAtivo={kit}
      projetoId={projetoId}
      departamentoId={departamentoId}
      bloqueado={bloqueado}
      aoEscolherKit={id => aoMudar({ kit_camera_id: id })}
      aoImportar={id => aoMudar({ kit_camera_id: id })}
      aoExcluirKit={() => aoMudar({ kit_camera_id: lista.find(k => k.id !== kit?.id)?.id })}
    >
      {cameras.length === 0 ? (
        <Vazio>{kit ? 'Nenhuma câmera no kit.' : 'Sem kit de câmeras nesta produção.'}</Vazio>
      ) : (
        <div style={chips}>
          {cameras.map(c => (
            <Chip
              key={c.id}
              ativo={c.id === estado.camera_id}
              marcador="logagem-camera-ativa"
              bloqueado={bloqueado}
              titulo={`Ativar a câmera ${c.id}`}
              aoClicar={() => void ativar(c.id)}
              aoRemover={bloqueado ? undefined : () => void remover(c)}
            >
              <span className="text-lg font-bold" style={{ lineHeight: 1 }}>{c.id}</span>
              <span className="text-xs text-secondary">{c.modelo}</span>
              <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                R{String(c.reel).replace(/\D/g, '').padStart(3, '0').slice(-3)}·#{String(c.clipe).padStart(3, '0')}
              </span>
            </Chip>
          ))}
        </div>
      )}

      {foraDoKit && (
        <p className="text-xs text-muted">
          A câmera <strong>{estado.camera_id}</strong> foi digitada à mão e não está neste kit — os contadores dela não ficam guardados.
        </p>
      )}

      {!bloqueado && (
        <>
          <BotaoDeAbrir aberto={abrindo} aoAlternar={() => setAbrindo(v => !v)}>
            {kit ? 'Acrescentar câmera' : 'Criar kit com a câmera de agora'}
          </BotaoDeAbrir>
          <Formulario
            aberto={abrindo}
            campos={[
              { chave: 'id', rotulo: 'Letra', placeholder: 'A', largura: '80px' },
              { chave: 'modelo', rotulo: 'Modelo', placeholder: 'FX30' },
            ]}
            aoEnviar={acrescentar}
            aoFechar={() => setAbrindo(false)}
          />
        </>
      )}
    </SecaoDeKit>
  );
}

/* ───────────────────────── Lentes ───────────────────────── */

export function KitDeLentes({ projetoId, estado, bloqueado, aoMudar, departamentoId }: Props) {
  const kits = useLiveQuery(() => kitsDoProjeto(projetoId, 'lente'), [projetoId]);
  const lista = kits ?? [];
  const kit = lista.find(k => k.id === estado.kit_lente_id) ?? lista[0];
  const lentes = kit?.lentes ?? [];
  const [abrindo, setAbrindo] = useState(false);

  const ativa = lentes.find(l => l.id === estado.lente_ref);
  const aberturas = aberturasDaLente(ativa);

  const escolher = (l: LenteDoKit) => {
    const faixa = aberturasDaLente(l);
    aoMudar({
      lente_ref: l.id,
      lente: `${l.nome}${l.focal ? ` ${l.focal}` : ''}`.trim(),
      // Se a f de agora não cabe na lente nova, cai na mais aberta dela: é o
      // valor que o boletim pode ter sem mentir.
      abertura: aberturaQueCabe(estado.abertura, faixa),
    });
  };

  const acrescentar = async (dados: { nome: string; focal: string; abre: string; fecha: string }) => {
    if (!dados.nome.trim()) return 'A lente precisa de um nome.';
    const nova: LenteDoKit = {
      id: crypto.randomUUID(),
      nome: dados.nome.trim(),
      focal: dados.focal.trim() || undefined,
      abre: Number(dados.abre) || 1.2,
      fecha: Number(dados.fecha) || 22,
    };
    if (!kit) {
      const novo = await criarKitDeLente(projetoId, 'Kit de lentes', departamentoId);
      await salvarLentes(novo.id, [nova]);
      aoMudar({ kit_lente_id: novo.id });
      return;
    }
    await salvarLentes(kit.id, [...lentes, nova]);
  };

  const remover = async (l: LenteDoKit) => {
    if (!kit) return;
    if (!(await confirmar({ titulo: `Tirar a ${l.nome} do kit?`, confirmar: 'Tirar', perigo: true }))) return;
    await salvarLentes(kit.id, lentes.filter(x => x.id !== l.id));
    if (estado.lente_ref === l.id) aoMudar({ lente_ref: '' });
  };

  return (
    <SecaoDeKit
      icone={<Aperture size={14} />}
      titulo="Lentes"
      explicacao="A abertura só oferece o que a lente escolhida alcança."
      tipo="lente"
      kits={lista}
      kitAtivo={kit}
      projetoId={projetoId}
      departamentoId={departamentoId}
      bloqueado={bloqueado}
      aoEscolherKit={id => aoMudar({ kit_lente_id: id })}
      aoImportar={id => aoMudar({ kit_lente_id: id })}
      aoExcluirKit={() => aoMudar({ kit_lente_id: lista.find(k => k.id !== kit?.id)?.id, lente_ref: '' })}
    >
      {lentes.length === 0 ? (
        <Vazio>{kit ? 'Nenhuma lente no kit.' : 'Sem kit de lentes nesta produção.'}</Vazio>
      ) : (
        <div style={chips}>
          {lentes.map(l => (
            <Chip
              key={l.id}
              ativo={l.id === estado.lente_ref}
              marcador="logagem-lente-ativa"
              bloqueado={bloqueado}
              titulo={`Usar a ${l.nome}`}
              aoClicar={() => escolher(l)}
              aoRemover={bloqueado ? undefined : () => void remover(l)}
            >
              <span className="text-sm font-bold" style={{ lineHeight: 1.2 }}>{l.nome}</span>
              <span className="text-xs text-secondary">{l.focal || '—'}</span>
              <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                f/{formatarF(l.abre)}–f/{formatarF(l.fecha)}
              </span>
            </Chip>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px, 100%), 1fr))', gap: '12px' }}>
        <div role="group" aria-label="Lente em uso" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span className="text-xs font-bold text-secondary">Lente em uso</span>
          <input
            value={estado.lente || ''}
            disabled={bloqueado}
            placeholder="35mm"
            /* Digitar aqui solta a lente do kit: a f volta a aceitar a série
               inteira, porque não se sabe a faixa de uma lente que não foi
               cadastrada. */
            onChange={e => aoMudar({ lente: e.target.value, lente_ref: '' })}
            style={campo}
          />
        </div>
        <div role="group" aria-label="Abertura" style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
          <span className="text-xs font-bold text-secondary">Abertura</span>
          <select
            value={estado.abertura || aberturas[0]}
            disabled={bloqueado}
            onChange={e => aoMudar({ abertura: e.target.value })}
            style={{ ...campo, cursor: bloqueado ? 'default' : 'pointer' }}
          >
            {aberturas.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {!bloqueado && (
        <>
          <BotaoDeAbrir aberto={abrindo} aoAlternar={() => setAbrindo(v => !v)}>
            {kit ? 'Acrescentar lente' : 'Criar kit de lentes'}
          </BotaoDeAbrir>
          <Formulario
            aberto={abrindo}
            campos={[
              { chave: 'nome', rotulo: 'Nome', placeholder: 'Helios 44' },
              { chave: 'focal', rotulo: 'Focal', placeholder: '58mm', largura: '110px' },
              { chave: 'abre', rotulo: 'Abre até', placeholder: '2', largura: '100px', numero: true },
              { chave: 'fecha', rotulo: 'Fecha até', placeholder: '22', largura: '100px', numero: true },
            ]}
            aoEnviar={acrescentar}
            aoFechar={() => setAbrindo(false)}
          />
        </>
      )}
    </SecaoDeKit>
  );
}

/* ───────────────────────── A casca das duas seções ───────────────────────── */

function SecaoDeKit({ icone, titulo, explicacao, tipo, kits, kitAtivo, projetoId, departamentoId, bloqueado, aoEscolherKit, aoImportar, aoExcluirKit, children }: {
  icone: React.ReactNode;
  titulo: string;
  explicacao: string;
  tipo: 'camera' | 'lente';
  kits: KitDeLogagem[];
  kitAtivo?: KitDeLogagem;
  projetoId: string;
  departamentoId?: string;
  bloqueado: boolean;
  aoEscolherKit: (id: string) => void;
  aoImportar: (id: string) => void;
  aoExcluirKit: () => void;
  children: React.ReactNode;
}) {
  const [importando, setImportando] = useState(false);
  const [renomeando, setRenomeando] = useState(false);

  const excluir = async () => {
    if (!kitAtivo) return;
    if (!(await confirmar({ titulo: `Excluir o kit "${kitAtivo.nome}"?`, detalhe: 'Os takes já registrados não mudam.', confirmar: 'Excluir', perigo: true }))) return;
    await excluirKit(kitAtivo.id);
    aoExcluirKit();
  };

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h2 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--cor-criativo)', display: 'flex' }}>{icone}</span>
          {titulo}
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {kits.length > 1 && (
            <select
              value={kitAtivo?.id || ''}
              disabled={bloqueado}
              aria-label={`Kit de ${tipo === 'camera' ? 'câmeras' : 'lentes'} em uso`}
              onChange={e => aoEscolherKit(e.target.value)}
              style={{ ...campo, width: 'auto', minWidth: '140px', cursor: bloqueado ? 'default' : 'pointer' }}
            >
              {kits.map(k => <option key={k.id} value={k.id}>{k.nome}</option>)}
            </select>
          )}
          {!bloqueado && kitAtivo && (
            <>
              <BotaoDeIcone rotulo="Renomear o kit" onClick={() => setRenomeando(v => !v)}><Pencil size={16} /></BotaoDeIcone>
              <BotaoDeIcone rotulo="Excluir o kit" onClick={() => void excluir()}><Trash2 size={16} /></BotaoDeIcone>
            </>
          )}
          {!bloqueado && (
            <BotaoDeIcone rotulo="Importar kit de outra produção" onClick={() => setImportando(v => !v)}><Download size={16} /></BotaoDeIcone>
          )}
        </div>
      </div>

      <p className="text-xs text-muted" style={{ marginTop: '-8px' }}>{explicacao}</p>

      {kitAtivo && (
        <Formulario
          aberto={renomeando}
          campos={[{ chave: 'nome', rotulo: 'Nome do kit', placeholder: kitAtivo.nome }]}
          aoEnviar={async d => { if (d.nome.trim()) await renomearKit(kitAtivo.id, d.nome.trim()); }}
          aoFechar={() => setRenomeando(false)}
        />
      )}

      <ImportarDeOutraProducao
        aberto={importando}
        tipo={tipo}
        projetoId={projetoId}
        departamentoId={departamentoId}
        aoImportar={id => { aoImportar(id); setImportando(false); }}
        aoFechar={() => setImportando(false)}
      />

      {children}
    </section>
  );
}

/**
 * Trazer o kit de outra produção — uma cópia, com ids novos.
 *
 * Quem filma com o mesmo set de lentes o ano inteiro não vai recadastrar cinco
 * lentes a cada produção. É a saída barata para o "kit da pessoa" que o sync do
 * app não comporta hoje (PLANO-logagem §1.1).
 */
function ImportarDeOutraProducao({ aberto, tipo, projetoId, departamentoId, aoImportar, aoFechar }: {
  aberto: boolean;
  tipo: 'camera' | 'lente';
  projetoId: string;
  departamentoId?: string;
  aoImportar: (id: string) => void;
  aoFechar: () => void;
}) {
  const opcoes = useLiveQuery(async () => {
    const [todos, projetos] = await Promise.all([db.log_kits.toArray(), db.projetos.toArray()]);
    const nomeDo = new Map(projetos.map(p => [p.id, p.nome]));
    return todos
      .filter(k => k.tipo === tipo && k.projeto_id !== projetoId)
      .map(k => ({ id: k.id, rotulo: `${k.nome} — ${nomeDo.get(k.projeto_id) || 'outra produção'}` }));
  }, [tipo, projetoId]) ?? [];

  const [escolhido, setEscolhido] = useState('');
  const alvo = escolhido || opcoes[0]?.id || '';

  return (
    <Abre aberto={aberto}>
      <div style={caixaDeForma}>
        {opcoes.length === 0 ? (
          <p className="text-sm text-secondary" style={{ margin: 0 }}>
            Nenhuma outra produção sua tem kit de {tipo === 'camera' ? 'câmeras' : 'lentes'} ainda.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div role="group" aria-label="Kit para copiar" style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: '200px' }}>
              <span className="text-xs font-bold text-secondary">Copiar de</span>
              <select value={alvo} onChange={e => setEscolhido(e.target.value)} style={{ ...campo, cursor: 'pointer' }}>
                {opcoes.map(o => <option key={o.id} value={o.id}>{o.rotulo}</option>)}
              </select>
            </div>
            <BotaoTatil
              onClick={async () => {
                const copia = await importarKit(alvo, projetoId, departamentoId);
                if (copia) aoImportar(copia.id);
              }}
              style={{ ...botaoDeAcao, backgroundColor: 'var(--cor-criativo)', color: '#fff', border: 'none' }}
            >
              <Check size={16} /> Copiar para cá
            </BotaoTatil>
          </div>
        )}
        <BotaoDeIcone rotulo="Fechar" onClick={aoFechar}><X size={16} /></BotaoDeIcone>
      </div>
    </Abre>
  );
}

/* ───────────────────────── Peças ───────────────────────── */

/**
 * Um chip do kit, com a moldura do escolhido deslizando de um para o outro.
 *
 * `marcador` separa os dois grupos: se câmeras e lentes dividissem o mesmo
 * `layoutId`, a moldura voaria de uma seção para a outra atravessando a tela.
 */
function Chip({ ativo, marcador, bloqueado, titulo, aoClicar, aoRemover, children }: {
  ativo: boolean;
  marcador: string;
  bloqueado: boolean;
  titulo: string;
  aoClicar: () => void;
  aoRemover?: () => void;
  children: React.ReactNode;
}) {
  const reduzido = useMovimentoReduzido();
  return (
    <div style={{ position: 'relative' }}>
      <BotaoTatil
        title={titulo}
        aria-pressed={ativo}
        disabled={bloqueado}
        escala={0.97}
        onClick={aoClicar}
        style={{
          position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px',
          minHeight: '76px', minWidth: '140px', padding: '12px 46px 12px 14px', textAlign: 'left',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)',
          backgroundColor: 'var(--bg-primary)', color: 'inherit',
          cursor: bloqueado ? 'default' : 'pointer', opacity: bloqueado && !ativo ? 0.55 : 1,
        }}
      >
        {ativo && (
          <motion.span
            layoutId={marcador}
            transition={reduzido ? { duration: 0 } : MOLA}
            style={{
              position: 'absolute', inset: -1, borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--cor-criativo)',
              backgroundColor: 'color-mix(in srgb, var(--cor-criativo) 10%, transparent)',
            }}
          />
        )}
        <span style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '4px' }}>{children}</span>
      </BotaoTatil>

      {/* Fora do botão de ativar: um botão dentro do outro não é clicável. */}
      {aoRemover && (
        <button
          type="button"
          title="Tirar do kit"
          aria-label="Tirar do kit"
          onClick={aoRemover}
          style={{
            /* 44px de alvo com um X pequeno dentro: o dedo acerta, e o chip não
               vira um botão de fechar com um texto do lado. */
            position: 'absolute', top: 0, right: 0, width: '44px', height: '44px',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: '8px',
            border: 'none', borderRadius: 'var(--radius-md)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Um formulário curto que desce de dentro da seção, sem tirar a tela do lugar. */
function Formulario<T extends Record<string, string>>({ aberto, campos, aoEnviar, aoFechar }: {
  aberto: boolean;
  campos: { chave: string; rotulo: string; placeholder?: string; largura?: string; numero?: boolean }[];
  aoEnviar: (dados: T) => Promise<string | void>;
  aoFechar: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [erro, setErro] = useState('');

  const enviar = async () => {
    const dados = Object.fromEntries(campos.map(c => [c.chave, valores[c.chave] ?? ''])) as T;
    const problema = await aoEnviar(dados);
    if (problema) { setErro(problema); return; }
    setValores({});
    setErro('');
    aoFechar();
  };

  return (
    <Abre aberto={aberto}>
      <div style={caixaDeForma}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap', flex: 1 }}>
          {campos.map(c => (
            <div key={c.chave} role="group" style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: c.largura, flex: c.largura ? '0 0 auto' : '1 1 140px', minWidth: 0 }}>
              <span className="text-xs font-bold text-secondary">{c.rotulo}</span>
              <input
                value={valores[c.chave] ?? ''}
                placeholder={c.placeholder}
                inputMode={c.numero ? 'decimal' : undefined}
                onChange={e => { setValores(v => ({ ...v, [c.chave]: e.target.value })); setErro(''); }}
                onKeyDown={e => { if (e.key === 'Enter') void enviar(); }}
                style={campo}
              />
            </div>
          ))}
          <BotaoTatil onClick={() => void enviar()} style={{ ...botaoDeAcao, backgroundColor: 'var(--cor-criativo)', color: '#fff', border: 'none' }}>
            <Check size={16} /> Pronto
          </BotaoTatil>
        </div>
        <BotaoDeIcone rotulo="Fechar" onClick={() => { setErro(''); aoFechar(); }}><X size={16} /></BotaoDeIcone>
        {erro && <p className="text-xs" style={{ color: 'var(--color-danger)', width: '100%', margin: 0 }}>{erro}</p>}
      </div>
    </Abre>
  );
}

function BotaoDeAbrir({ aberto, aoAlternar, children }: { aberto: boolean; aoAlternar: () => void; children: React.ReactNode }) {
  const reduzido = useMovimentoReduzido();
  return (
    <BotaoTatil
      onClick={aoAlternar}
      aria-expanded={aberto}
      style={{
        alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px',
        minHeight: '44px', padding: '0 16px', borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--border-color)', backgroundColor: 'transparent',
        color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
      }}
    >
      <motion.span
        animate={{ rotate: aberto ? 45 : 0 }}
        transition={reduzido ? { duration: 0 } : MOLA}
        style={{ display: 'flex' }}
      >
        <Plus size={16} />
      </motion.span>
      {children}
    </BotaoTatil>
  );
}

function BotaoDeIcone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <BotaoTatil
      title={rotulo}
      aria-label={rotulo}
      onClick={onClick}
      escala={0.9}
      className="btn-icon"
      style={{
        width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
        backgroundColor: 'var(--bg-primary)', color: 'var(--text-secondary)', cursor: 'pointer',
      }}
    >
      {children}
    </BotaoTatil>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-secondary" style={{ margin: 0 }}>{children}</p>;
}

const chips: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap' };

const caixaDeForma: React.CSSProperties = {
  display: 'flex', gap: '8px', alignItems: 'flex-end', flexWrap: 'wrap',
  padding: '14px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-active)',
};

const campo: React.CSSProperties = {
  width: '100%', minHeight: '44px', padding: '10px 12px', fontSize: '15px',
  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
};

const botaoDeAcao: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 16px',
  borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
};
