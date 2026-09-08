import { useMemo, useRef, useState } from 'react';
import { Search, Users, CornerDownLeft } from 'lucide-react';
import type { Departamento, Perfil } from '../../types';
import { DEPARTAMENTOS_PADRAO, normalizar, proximaVariante } from '../../lib/creditos';

/**
 * O campo "Função / Cargo" da ficha, com o catálogo do audiovisual atrás.
 *
 * ANTES: um `<input>` em branco com o placeholder "Ex: Diretor, Atriz". Quem
 * preenchia escrevia o que lembrava — "Dir. Fotografia", "Diretor de fotografia",
 * "DOP" —, e a ficha técnica saía com três nomes para a mesma função. Pior: o
 * app casa a ficha da pessoa com a vaga nos Créditos comparando esse texto, e
 * uma letra de diferença faz o casamento não acontecer, sem ninguém entender por
 * quê.
 *
 * AGORA: digitar filtra o catálogo, e escolher uma sugestão escreve o nome
 * canônico. As funções que a própria produção já inventou entram na lista junto
 * com as do catálogo — a segunda pessoa a ser um "Motorista de Produção" acha a
 * função que a primeira criou, em vez de escrever de novo.
 *
 * DUAS COISAS QUE ELE FAZ ALÉM DE COMPLETAR
 *
 *   o departamento    escolher "Microfonista" já põe Som no campo de baixo, se
 *                     ele ainda estiver vazio. A função ensina o departamento, e
 *                     perguntar as duas coisas separadamente é perguntar duas
 *                     vezes o que se sabe uma vez.
 *   quem já ocupa     se alguém da produção já é Operador de Câmera, o campo
 *                     avisa — e diz que os dois vão aparecer como A e B na ficha
 *                     técnica. Isso não é um erro a impedir: dois operadores é
 *                     uma produção com duas câmeras. É só uma coisa que quem
 *                     está preenchendo precisa saber ANTES de salvar.
 */
export function CampoFuncao({
  value, aoMudar, departamentoId, aoEscolherDepartamento, departamentos, perfis, meuId, placeholder, style,
}: {
  value: string;
  aoMudar: (v: string) => void;
  departamentoId?: string;
  /** Chamado quando a função escolhida ensina o departamento. */
  aoEscolherDepartamento?: (id: string) => void;
  departamentos: Departamento[];
  perfis: Perfil[];
  /** Quem está sendo editado — para ele não aparecer como "já ocupa". */
  meuId?: string;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [aberto, setAberto] = useState(false);
  const fechando = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * O catálogo, mais o que esta produção inventou.
   *
   * A função do catálogo sabe a que departamento pertence; a inventada aprende
   * pelo departamento de quem a usa. Uma função que aparece em dois
   * departamentos entra duas vezes, de propósito: "Assistente de Produção" é de
   * Produção e de Direção conforme a casa, e esconder uma das duas escolheria
   * pela pessoa.
   */
  const catalogo = useMemo(() => {
    const lista: { funcao: string; departamento?: Departamento }[] = [];
    const visto = new Set<string>();

    for (const padrao of DEPARTAMENTOS_PADRAO) {
      const depto = departamentos.find(d => normalizar(d.nome) === normalizar(padrao.nome));
      for (const funcao of padrao.funcoes) {
        const chave = `${normalizar(funcao)}::${depto?.id || padrao.nome}`;
        if (visto.has(chave)) continue;
        visto.add(chave);
        lista.push({ funcao, departamento: depto });
      }
    }

    for (const p of perfis) {
      if (!p.funcao?.trim()) continue;
      const depto = departamentos.find(d => d.id === p.departamento_id);
      const chave = `${normalizar(p.funcao)}::${depto?.id || '-'}`;
      if (visto.has(chave)) continue;
      // Só as que o catálogo não tem em lugar nenhum: senão a mesma função
      // apareceria duas vezes por causa de uma diferença de acento.
      if (lista.some(x => normalizar(x.funcao) === normalizar(p.funcao!))) continue;
      visto.add(chave);
      lista.push({ funcao: p.funcao.trim(), departamento: depto });
    }

    return lista;
  }, [departamentos, perfis]);

  const busca = normalizar(value);
  const sugestoes = useMemo(() => {
    const casa = busca
      ? catalogo.filter(c => normalizar(c.funcao).includes(busca))
      : catalogo;

    /*
      As do departamento já escolhido vêm primeiro.

      Quem já disse "Som" está procurando uma função de Som. Sem isto, digitar
      "assistente" devolve sete assistentes de sete áreas e a certa fica em
      quinto lugar.
    */
    return [...casa].sort((a, b) => {
      const aq = a.departamento?.id === departamentoId ? 0 : 1;
      const bq = b.departamento?.id === departamentoId ? 0 : 1;
      if (aq !== bq) return aq - bq;
      // Quem COMEÇA com o que foi digitado ganha de quem só contém.
      const ai = normalizar(a.funcao).startsWith(busca) ? 0 : 1;
      const bi = normalizar(b.funcao).startsWith(busca) ? 0 : 1;
      if (ai !== bi) return ai - bi;
      return a.funcao.localeCompare(b.funcao);
    }).slice(0, 8);
  }, [catalogo, busca, departamentoId]);

  /** Quem já ocupa esta mesma função — o aviso do "quer entrar como B?". */
  const jaOcupam = useMemo(() => {
    if (!value.trim()) return [];
    return perfis.filter(p =>
      p.id !== meuId &&
      p.funcao &&
      normalizar(p.funcao) === normalizar(value) &&
      // Mesma função em departamentos diferentes não é a mesma vaga.
      (!departamentoId || !p.departamento_id || p.departamento_id === departamentoId)
    );
  }, [perfis, value, meuId, departamentoId]);

  const escolher = (item: { funcao: string; departamento?: Departamento }) => {
    aoMudar(item.funcao);
    // Só preenche o departamento quando ele está vazio: a pessoa pode ter
    // escolhido de propósito um departamento diferente do usual.
    if (!departamentoId && item.departamento && aoEscolherDepartamento) {
      aoEscolherDepartamento(item.departamento.id);
    }
    setAberto(false);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ position: 'relative' }}>
        <Search
          size={15}
          style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }}
        />
        <input
          value={value}
          onChange={e => { aoMudar(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          // O clique numa sugestão dispara o blur ANTES do clique. Sem este
          // atraso a lista some no caminho e o clique cai no vazio.
          onBlur={() => { fechando.current = setTimeout(() => setAberto(false), 160); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setAberto(false); return; }
            if (e.key === 'Enter' && aberto && sugestoes.length > 0) {
              e.preventDefault();
              escolher(sugestoes[0]);
            }
          }}
          placeholder={placeholder || 'Função (ex: Diretor, Operador de Câmera)'}
          style={{ ...style, paddingLeft: '40px' }}
        />
      </div>

      {aberto && sugestoes.length > 0 && (
        <div
          onMouseDown={() => clearTimeout(fechando.current)}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 40,
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)',
            borderRadius: '12px', padding: '5px', maxHeight: '260px', overflowY: 'auto',
            boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
          }}
        >
          {sugestoes.map((s, i) => (
            <button
              key={`${s.funcao}::${s.departamento?.id || i}`}
              type="button"
              onClick={() => escolher(s)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                width: '100%', padding: '9px 11px', borderRadius: '8px', border: 'none',
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                color: 'var(--text-primary)',
              }}
            >
              <span className="text-sm" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.funcao}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {s.departamento && (
                  <span className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-muted)' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: s.departamento.cor || 'var(--accent)' }} />
                    {s.departamento.nome}
                  </span>
                )}
                {i === 0 && <CornerDownLeft size={12} className="text-muted" style={{ opacity: 0.5 }} />}
              </span>
            </button>
          ))}
        </div>
      )}

      {/*
        "Já tem um Operador de Câmera."

        Não é erro nem impedimento — produção com duas câmeras tem dois
        operadores. É informação que só serve ANTES de salvar: ou a pessoa
        percebe que escreveu a função errada, ou ela confirma que são dois mesmo
        e já sabe como os dois vão sair na ficha técnica.
      */}
      {jaOcupam.length > 0 && (
        <div
          className="text-xs"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '7px', lineHeight: 1.5,
            padding: '8px 11px', borderRadius: '10px',
            backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            color: 'var(--text-secondary)',
          }}
        >
          <Users size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
          <span>
            {jaOcupam.length === 1 ? 'Já tem ' : 'Já têm '}
            <b>{jaOcupam.map(p => `${p.nome} ${p.sobrenome || ''}`.trim()).join(', ')}</b> nesta função.{' '}
            {/*
              A letra é CALCULADA, e não escrita à mão.

              O texto dizia sempre "vocês entram como A e B" — certo com uma
              pessoa antes, errado com duas, porque aí a nova é a C. Dizer a
              letra errada é pior que não dizer nenhuma: quem lê confere depois
              e acha que o app se enganou.
            */}
            {jaOcupam.length === 1
              ? <>Nos créditos vocês aparecem como <b>{proximaVariante(0)}</b> e <b>{proximaVariante(1)}</b></>
              : <>Nos créditos você entra como <b>{proximaVariante(jaOcupam.length)}</b></>}
            {' '}— dá para trocar por "principal" e "complementar" lá, se fizer mais sentido.
          </span>
        </div>
      )}
    </div>
  );
}
