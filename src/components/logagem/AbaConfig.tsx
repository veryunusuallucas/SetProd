import { useEffect, useState } from 'react';
import { StickyNote, UserCheck, Smartphone, X, Plus, RotateCcw, Check, WifiOff } from 'lucide-react';
import { db } from '../../db/db';
import type { Departamento, Perfil } from '../../types';
import { BotaoTatil } from '../ui/BotaoTatil';
import { Rotulo, estiloCampo } from './pecas';
import { useNotas } from './NotasRapidas';
import { MAXIMO_DE_NOTAS, NOTAS_PADRAO, lembrarNotas } from '../../lib/logagem/notas';
import { departamentoDaFotografia } from '../../lib/logagem/permissao';
import { nomeDoPerfil } from '../../lib/logagem/relatorio';
import { membrosDoProjeto, type Participacao } from '../../lib/membros';
import {
  pedirArmazenamentoPermanente, situacaoDoArmazenamento, type SituacaoDoArmazenamento,
} from '../../lib/logagem/aparelho';

/**
 * Config da Logagem: o que se ajusta uma vez e se esquece.
 *
 * Três blocos, cada um com um dono diferente:
 * - as anotações rápidas são DESTE APARELHO (o vocabulário de quem loga);
 * - quem registra takes é da PRODUÇÃO, e só dono/admin mexe;
 * - o armazenamento permanente é do NAVEGADOR deste aparelho.
 */
export function AbaConfig({ projetoId, podeEditar, administra, liberados, perfis, departamentos, eu }: {
  projetoId: string;
  podeEditar: boolean;
  administra: boolean;
  liberados: string[];
  perfis: Perfil[];
  departamentos: Departamento[];
  eu?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {podeEditar && <AnotacoesRapidas />}
      <QuemRegistra projetoId={projetoId} administra={administra} liberados={liberados} perfis={perfis} departamentos={departamentos} eu={eu} />
      <EsteAparelho />
    </div>
  );
}

const cartao = { display: 'flex', flexDirection: 'column' as const, gap: '12px', padding: '22px' };

function AnotacoesRapidas() {
  const notas = useNotas();
  const [nova, setNova] = useState('');
  const cheia = notas.length >= MAXIMO_DE_NOTAS;
  const igualAoPadrao = notas.join('|') === NOTAS_PADRAO.join('|');

  const adicionar = () => {
    const t = nova.trim();
    if (!t || cheia) return;
    lembrarNotas([...notas, t]);
    setNova('');
  };

  return (
    <section className="card" style={cartao}>
      <Rotulo icone={<StickyNote size={14} />}>Anotações rápidas</Rotulo>
      <p className="text-sm text-secondary" style={{ margin: 0 }}>
        As pílulas embaixo da observação. Um toque acrescenta a frase ao take que vem. A lista é deste aparelho.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {notas.map(n => (
          <span
            key={n}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '2px', minHeight: '44px', paddingLeft: '14px',
              borderRadius: '999px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            {n}
            <button
              type="button"
              aria-label={`Tirar "${n}"`}
              title="Tirar"
              onClick={() => lembrarNotas(notas.filter(x => x !== n))}
              style={{
                width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', borderRadius: '999px',
              }}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        {notas.length === 0 && <span className="text-sm text-muted">Nenhuma. As pílulas somem da tela de logar.</span>}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); adicionar(); }}
        style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
      >
        <input
          value={nova}
          onChange={e => setNova(e.target.value)}
          maxLength={40}
          disabled={cheia}
          placeholder={cheia ? `No máximo ${MAXIMO_DE_NOTAS}` : 'Nova anotação, ex.: Chuva no fundo'}
          aria-label="Nova anotação rápida"
          style={{ ...estiloCampo, flex: '1 1 200px', width: 'auto' }}
        />
        <BotaoTatil type="submit" disabled={!nova.trim() || cheia} className="btn-primary" style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Adicionar
        </BotaoTatil>
      </form>

      {!igualAoPadrao && (
        <BotaoTatil
          onClick={() => lembrarNotas(NOTAS_PADRAO)}
          style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 4px',
            border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} /> Voltar às do Lumavi
        </BotaoTatil>
      )}
    </section>
  );
}

function QuemRegistra({ projetoId, administra, liberados, perfis, departamentos, eu }: {
  projetoId: string;
  administra: boolean;
  liberados: string[];
  perfis: Perfil[];
  departamentos: Departamento[];
  eu?: string;
}) {
  const [membros, setMembros] = useState<Participacao[] | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!administra) return;
    let vivo = true;
    membrosDoProjeto(projetoId)
      .then(m => { if (vivo) setMembros(m); })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [administra, projetoId]);

  const foto = departamentoDaFotografia(departamentos);
  const perfilDe = (m: Participacao) => (m.perfil_id ? perfis.find(p => p.id === m.perfil_id) : undefined);
  const nomeDe = (m: Participacao) => {
    const p = perfilDe(m);
    return (p && nomeDoPerfil(p)) || m.apelido || 'Sem nome';
  };
  const daFotografia = (m: Participacao) => Boolean(foto && perfilDe(m)?.departamento_id === foto.id);

  const alternar = async (usuarioId: string) => {
    const atual = (await db.projetos.get(projetoId))?.logagem_liberados || [];
    const novos = atual.includes(usuarioId) ? atual.filter(x => x !== usuarioId) : [...atual, usuarioId];
    await db.projetos.update(projetoId, { logagem_liberados: novos });
  };

  const outros = (membros || []).filter(m => m.papel === 'equipe');
  const sempre = (membros || []).filter(m => m.papel === 'dono' || m.papel === 'admin');

  return (
    <section className="card" style={cartao}>
      <Rotulo icone={<UserCheck size={14} />}>Quem registra takes</Rotulo>
      <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
        Registram: quem administra a produção, quem tem ficha no departamento {foto ? foto.nome : 'Fotografia'}, e quem
        for liberado aqui. O resto da equipe acompanha sem mexer.
        {!foto && ' Esta produção ainda não tem um departamento Fotografia.'}
      </p>

      {!administra ? (
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Liberar mais alguém é com quem administra a produção.
          {liberados.length > 0 && ` Hoje há ${liberados.length} pessoa${liberados.length === 1 ? '' : 's'} liberada${liberados.length === 1 ? '' : 's'}.`}
        </p>
      ) : falhou || (!navigator.onLine && !membros) ? (
        <p className="text-sm text-muted" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <WifiOff size={16} /> A lista da equipe vem do servidor. Com internet, ela aparece aqui.
        </p>
      ) : !membros ? (
        <p className="text-sm text-muted" style={{ margin: 0 }}>Buscando a equipe…</p>
      ) : (
        <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sempre.map(m => (
            <Pessoa key={m.usuario_id} nome={nomeDe(m)} voce={m.usuario_id === eu} detalhe={m.papel === 'dono' ? 'dono, sempre registra' : 'admin, sempre registra'} />
          ))}
          {outros.map(m => (
            daFotografia(m)
              ? <Pessoa key={m.usuario_id} nome={nomeDe(m)} voce={m.usuario_id === eu} detalhe="da Fotografia, sempre registra" />
              : (
                <Pessoa
                  key={m.usuario_id}
                  nome={nomeDe(m)}
                  voce={m.usuario_id === eu}
                  detalhe={perfilDe(m)?.funcao || 'equipe'}
                  liberado={liberados.includes(m.usuario_id)}
                  aoAlternar={() => void alternar(m.usuario_id)}
                />
              )
          ))}
          {(membros || []).filter(m => m.papel === 'leitura').length > 0 && (
            <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
              Quem entrou só para ver não aparece aqui: esse acesso não grava nada, em módulo nenhum.
            </p>
          )}
          {outros.length === 0 && sempre.length <= 1 && (
            <p className="text-sm text-muted" style={{ margin: 0 }}>Ninguém mais da equipe entrou nesta produção ainda.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Pessoa({ nome, detalhe, voce, liberado, aoAlternar }: {
  nome: string;
  detalhe: string;
  voce?: boolean;
  liberado?: boolean;
  aoAlternar?: () => void;
}) {
  return (
    <div role="listitem" style={{
      display: 'flex', alignItems: 'center', gap: '12px', minHeight: '52px', padding: '6px 12px',
      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
    }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="text-sm font-bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {nome}{voce ? ' (você)' : ''}
        </span>
        <span className="text-xs text-muted">{detalhe}</span>
      </span>
      {aoAlternar ? (
        <BotaoTatil
          role="switch"
          aria-checked={Boolean(liberado)}
          aria-label={`${nome} pode registrar takes`}
          onClick={aoAlternar}
          style={{
            minHeight: '44px', padding: '0 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 600,
            border: `1px solid ${liberado ? 'var(--cor-criativo)' : 'var(--border-color)'}`,
            backgroundColor: liberado ? 'color-mix(in srgb, var(--cor-criativo) 12%, transparent)' : 'var(--bg-primary)',
            color: liberado ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {liberado ? <><Check size={14} /> Registra</> : 'Só vê'}
        </BotaoTatil>
      ) : (
        <Check size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} aria-hidden />
      )}
    </div>
  );
}

const TEXTO_DO_ARMAZENAMENTO: Record<SituacaoDoArmazenamento, { titulo: string; texto: string }> = {
  permanente: {
    titulo: 'Guardado para valer',
    texto: 'O navegador não apaga os takes deste aparelho para liberar espaço, nem os que ainda não subiram.',
  },
  temporario: {
    titulo: 'O navegador pode limpar',
    texto: 'Com o aparelho sem espaço, o navegador pode apagar os dados do app — inclusive takes que ainda não subiram por falta de sinal. Instalar o SetProd na tela inicial costuma resolver.',
  },
  'sem-suporte': {
    titulo: 'Sem como saber',
    texto: 'Este navegador não diz se guarda os dados de forma permanente. Suba os takes sempre que houver sinal.',
  },
};

function EsteAparelho() {
  const [situacao, setSituacao] = useState<SituacaoDoArmazenamento | null>(null);
  const [pedido, setPedido] = useState(false);

  useEffect(() => { void situacaoDoArmazenamento().then(setSituacao); }, []);

  if (!situacao) return null;
  const t = TEXTO_DO_ARMAZENAMENTO[situacao];

  return (
    <section className="card" style={cartao}>
      <Rotulo icone={<Smartphone size={14} />}>Este aparelho</Rotulo>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span className="text-sm font-bold" style={{ color: situacao === 'permanente' ? 'var(--color-success)' : 'var(--text-primary)' }}>
          {t.titulo}
        </span>
        <span className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>{t.texto}</span>
      </div>
      {situacao === 'temporario' && (
        <BotaoTatil
          onClick={async () => { setPedido(true); setSituacao(await pedirArmazenamentoPermanente()); }}
          className="btn-secondary"
          style={{ alignSelf: 'flex-start', minHeight: '44px' }}
        >
          Pedir de novo ao navegador
        </BotaoTatil>
      )}
      {pedido && situacao === 'temporario' && (
        <span className="text-xs text-muted">O navegador recusou por enquanto. Ele decide pelo uso do site; tente depois de instalar o app.</span>
      )}
    </section>
  );
}
