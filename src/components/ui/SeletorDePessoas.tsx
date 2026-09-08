import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';
import type { Departamento, Perfil } from '../../types';
import { normalizar } from '../../lib/creditos';

/**
 * Escolher VÁRIAS pessoas de uma vez: abre a lista e marca quem entra.
 *
 * ⚠️ NÃO USE `<select multiple>` NO LUGAR DISTO. Ele parece resolver e não
 * resolve: marcar o segundo nome exige segurar Ctrl (e ninguém descobre isso
 * sozinho), clicar sem Ctrl desmarca tudo silenciosamente, e a lista rolada
 * esconde quem já está escolhido — a pessoa perde de vista a própria escolha
 * enquanto a faz.
 *
 * Aqui a lista abre inteira, cada linha é um alvo grande de toque, e quem já
 * está marcado continua visível de duas formas: com o tique na linha e como
 * ficha no botão que abriu a lista.
 *
 * A busca aparece a partir de oito pessoas. Antes disso ela seria mais um campo
 * para ler numa lista que cabe inteira na tela.
 */
export function SeletorDePessoas({
  escolhidos, aoMudar, pessoas, departamentos = [], vazio = 'Ninguém', titulo = 'Quem entra',
}: {
  escolhidos: string[];
  aoMudar: (ids: string[]) => void;
  pessoas: Perfil[];
  departamentos?: Departamento[];
  /** O que o botão diz quando não há ninguém. */
  vazio?: string;
  /** Cabeçalho da lista aberta. */
  titulo?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const caixa = useRef<HTMLDivElement>(null);

  const disponiveis = useMemo(
    () => pessoas.filter(p => p.id !== 'caixa_central'),
    [pessoas]
  );

  /*
    Fecha ao clicar fora e no Escape.

    Sem isso a lista fica aberta por cima do resto do formulário, e a pessoa
    tenta preencher o prazo com o painel na frente. `mousedown` e não `click`:
    o clique num campo lá embaixo já move o foco antes do `click` chegar.
  */
  useEffect(() => {
    if (!aberto) return;
    const foraDaqui = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const escapou = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    document.addEventListener('mousedown', foraDaqui);
    document.addEventListener('keydown', escapou);
    return () => {
      document.removeEventListener('mousedown', foraDaqui);
      document.removeEventListener('keydown', escapou);
    };
  }, [aberto]);

  const nomeDe = (p: Perfil) => `${p.nome} ${p.sobrenome || ''}`.trim();
  const deptoDe = (p: Perfil) => departamentos.find(d => d.id === p.departamento_id);

  const filtrados = useMemo(() => {
    const q = normalizar(busca);
    const casa = q
      ? disponiveis.filter(p =>
          normalizar(nomeDe(p)).includes(q) ||
          normalizar(p.funcao || '').includes(q) ||
          normalizar(deptoDe(p)?.nome || '').includes(q))
      : disponiveis;

    /*
      Quem já está na tarefa vai para o topo.

      Numa equipe de trinta, tirar alguém significava rolar a lista atrás de um
      nome que já era conhecido. Em cima, desmarcar é tão rápido quanto marcar.
    */
    return [...casa].sort((a, b) => {
      const ea = escolhidos.includes(a.id) ? 0 : 1;
      const eb = escolhidos.includes(b.id) ? 0 : 1;
      if (ea !== eb) return ea - eb;
      return nomeDe(a).localeCompare(nomeDe(b));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disponiveis, busca, escolhidos, departamentos]);

  const alternar = (id: string) => {
    aoMudar(escolhidos.includes(id) ? escolhidos.filter(x => x !== id) : [...escolhidos, id]);
  };

  const marcados = escolhidos
    .map(id => disponiveis.find(p => p.id === id))
    .filter((p): p is Perfil => Boolean(p));

  return (
    <div ref={caixa} style={{ position: 'relative' }}>
      {/*
        O botão MOSTRA a escolha, em vez de só abrir a lista.

        Com as fichas aqui, quem passa os olhos no formulário já sabe quem está
        na tarefa sem abrir nada — e tirar alguém é um clique no × da ficha, sem
        precisar procurar o nome numa lista.
      */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
          width: '100%', minHeight: '42px', padding: '7px 10px',
          borderRadius: 'var(--radius-sm)', border: `1px solid ${aberto ? 'var(--accent)' : 'var(--border-light)'}`,
          backgroundColor: 'var(--bg-surface)', cursor: 'pointer',
        }}
        onClick={e => {
          // O × de uma ficha também é um clique aqui dentro; ele já tratou.
          if ((e.target as HTMLElement).closest('[data-ficha-x]')) return;
          setAberto(v => !v);
        }}
      >
        {marcados.length === 0 ? (
          <span className="text-sm text-muted" style={{ flex: 1 }}>{vazio}</span>
        ) : (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1, minWidth: 0 }}>
            {marcados.map(p => (
              <span
                key={p.id}
                className="text-xs"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '3px 6px 3px 10px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)',
                }}
              >
                {nomeDe(p)}
                <button
                  data-ficha-x
                  onClick={() => alternar(p.id)}
                  title={`Tirar ${nomeDe(p)} da tarefa`}
                  style={{ display: 'flex', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </span>
        )}
        <ChevronDown
          size={15}
          className="text-muted"
          style={{ flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}
        />
      </div>

      {aberto && (
        <div
          className="card"
          style={{
            /*
              O painel é MAIS LARGO que o campo, de propósito.

              Colado na largura do campo (que divide a linha com o
              departamento), "Operador de Câmera · Fotografia" quebrava em três
              linhas e a lista virava uma coluna de texto picado. A função e a
              área são o que faz escolher a pessoa certa numa equipe grande —
              elas precisam caber numa linha.
            */
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 60,
            width: '320px', minWidth: '100%', maxWidth: 'calc(100vw - 48px)',
            padding: '6px', backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)', borderRadius: '12px',
            boxShadow: '0 14px 34px rgba(0,0,0,0.4)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            maxHeight: '300px',
          }}
        >
          <div
            className="text-xs text-muted uppercase tracking-widest"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 2px' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={12} /> {titulo}
            </span>
            {marcados.length > 0 && <span>{marcados.length} marcad{marcados.length > 1 ? 'os' : 'o'}</span>}
          </div>

          {disponiveis.length >= 8 && (
            <div style={{ position: 'relative', padding: '2px 4px 4px' }}>
              <Search size={13} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input
                autoFocus
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome, função ou área…"
                style={{
                  width: '100%', padding: '7px 10px 7px 32px', fontSize: '13px',
                  borderRadius: '8px', border: '1px solid var(--border-light)',
                  backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)',
                }}
              />
            </div>
          )}

          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filtrados.length === 0 && (
              <div className="text-xs text-muted" style={{ padding: '14px 10px', textAlign: 'center' }}>
                {disponiveis.length === 0 ? 'Ninguém cadastrado na equipe ainda.' : 'Ninguém com esse nome.'}
              </div>
            )}
            {filtrados.map(p => {
              const marcado = escolhidos.includes(p.id);
              const depto = deptoDe(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => alternar(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: marcado ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    textAlign: 'left', color: 'var(--text-primary)',
                  }}
                >
                  {/* A caixinha é desenhada, e não um <input type=checkbox>: o
                      nativo não aceita cor de marca em todo navegador, e aqui
                      ele ficaria azul de sistema no meio de uma tela escura. */}
                  <span
                    style={{
                      width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1px solid ${marcado ? 'var(--accent)' : 'var(--border-light)'}`,
                      backgroundColor: marcado ? 'var(--accent)' : 'transparent',
                      color: '#000',
                    }}
                  >
                    {marcado && <Check size={12} strokeWidth={3} />}
                  </span>

                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="text-sm" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nomeDe(p)}
                    </span>
                    {(p.funcao || depto) && (
                      <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {p.funcao}
                        {p.funcao && depto && <span>·</span>}
                        {depto && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: depto.cor || 'var(--accent)' }} />
                            {depto.nome}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
