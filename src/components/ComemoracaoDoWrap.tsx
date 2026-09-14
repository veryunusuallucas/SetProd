import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, ImagePlus, PartyPopper, Plus, Trash2, Eye } from 'lucide-react';
import { db } from '../db/db';
import { guardarArquivo, resolverArquivo } from '../lib/arquivos';
import { FRASES_WRAP_PADRAO } from '../lib/comemoracao';
import { CartaDeWrap } from './CartaDeWrap';
import { CampoTexto } from './ui/CampoTexto';

/**
 * As frases e os gifs do wrap — escritos por quem faz o filme.
 *
 * ⚠️ NÃO EXISTE MISTURA ENTRE PADRÃO E PERSONALIZADO. A lista abre preenchida
 * com as frases de partida, e a partir do primeiro toque o que toca na tela é
 * exatamente o que está aqui. É a única forma de "tirar uma frase" significar
 * tirar de verdade — com uma lista de fábrica escondida por baixo, apagar a
 * frase de que você não gosta não a faria sumir, e isso é o tipo de coisa que
 * faz a pessoa desistir de mexer.
 *
 * O GIF É GUARDADO, NUNCA LINKADO. O wrap acontece no set, que é justamente
 * onde não há sinal: um endereço do Giphy daria uma moldura vazia exatamente no
 * dia em que a comemoração importa.
 */

/** Acima disso o gif trava o celular de quem está no set. */
const LIMITE_GIF = 6 * 1024 * 1024;

export function ComemoracaoDoWrap({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const [aberto, setAberto] = useState(false);
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState('');
  const [previas, setPrevias] = useState<Record<string, string>>({});
  const [ensaiando, setEnsaiando] = useState(false);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const frases = projeto?.frases_wrap ?? [...FRASES_WRAP_PADRAO];
  /** Linha em branco existe na edição, mas não conta nem entra no sorteio. */
  const valendo = frases.filter(f => f.trim()).length;
  const gifs = projeto?.gifs_wrap ?? [];

  useEffect(() => {
    let vivo = true;
    Promise.all(gifs.map(async ref => [ref, await resolverArquivo(ref)] as const))
      .then(pares => {
        if (!vivo) return;
        setPrevias(Object.fromEntries(pares.filter(p => p[1]) as [string, string][]));
      });
    return () => { vivo = false; };
  }, [gifs.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!projeto) return null;

  const gravarFrases = (lista: string[]) => db.projetos.update(projetoId, { frases_wrap: lista });

  const acrescentar = () => {
    const texto = nova.trim();
    if (!texto) return;
    void gravarFrases([...frases, texto]);
    setNova('');
  };

  const subirGif = async (arquivo: File) => {
    setErro('');
    if (!arquivo.type.startsWith('image/')) { setErro('Escolha uma imagem ou um gif.'); return; }
    if (arquivo.size > LIMITE_GIF) {
      setErro(`Esse arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(1)}MB. O limite é 6MB — gif grande trava o celular no set.`);
      return;
    }
    try {
      const ref = await guardarArquivo(projetoId, arquivo, arquivo.name, arquivo.type);
      await db.projetos.update(projetoId, { gifs_wrap: [...gifs, ref] });
    } catch (e: any) {
      setErro(e?.message || 'Não consegui guardar o arquivo.');
    }
  };

  const campo = {
    padding: '7px 9px', fontSize: '13px', width: '100%',
    backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)',
    borderRadius: '6px', color: 'var(--text-primary)',
  } as const;

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: aberto ? '18px' : 0 }}>
        <button
          onClick={() => setAberto(a => !a)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
            <PartyPopper size={15} style={{ color: 'var(--accent)' }} /> Comemoração do wrap
          </h2>
          {!aberto && (
            <span className="text-xs text-muted">
              {valendo} {valendo === 1 ? 'frase' : 'frases'}
              {gifs.length > 0 ? ` · ${gifs.length} ${gifs.length === 1 ? 'gif' : 'gifs'}` : ''}
            </span>
          )}
          <ChevronDown size={16} className="text-muted" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>

        {aberto && (
          <>
            <div className="text-xs text-muted" style={{ lineHeight: 1.6, marginTop: '-6px' }}>
              No fim de cada diária o app sorteia uma frase e um gif desta lista — sem repetir
              o do dia anterior — e mostra junto com os números do dia. <b>A lista é sua</b>:
              o que estiver aqui é o que aparece, e o que você tirar some de verdade.
            </div>

            {/* ---- Frases ---- */}
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>
                Frases ({valendo})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                {/*
                  ⚠️ `CampoTexto`, E NÃO UM `<input defaultValue>`.

                  Com `defaultValue` o campo não acompanha a lista: apagar a
                  terceira frase encolhia a lista e deixava os campos exibindo os
                  textos antigos, deslocados em um. Quem apagasse "Corta. Foi
                  bom." veria "Wrap. Vão com cuidado" sumir da tela.

                  `CampoTexto` é o componente da casa para isto: acompanha
                  mudança de fora, grava depois de uma pausa e não empurra o
                  cursor nem come acento enquanto se digita.
                */}
                {frases.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CampoTexto
                      value={f}
                      aoGravar={texto => {
                        if (texto === f) return;
                        gravarFrases(frases.map((x, n) => (n === i ? texto : x)));
                      }}
                      placeholder="frase vazia — use a lixeira para tirar"
                      style={campo}
                    />
                    <button
                      onClick={() => gravarFrases(frases.filter((_, n) => n !== i))}
                      className="btn-icon"
                      aria-label="Tirar esta frase"
                      style={{ flexShrink: 0, width: 'auto', padding: '6px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {frases.length === 0 && (
                  <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
                    Sem frase nenhuma, a carta de wrap mostra só os números — e isso também
                    funciona.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                <input
                  value={nova}
                  onChange={e => setNova(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); acrescentar(); } }}
                  placeholder="Escreva uma frase de wrap e aperte Enter"
                  style={campo}
                />
                <button
                  onClick={acrescentar}
                  className="btn-icon"
                  style={{ flexShrink: 0, width: 'auto', padding: '7px 12px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Pôr
                </button>
              </div>
            </div>

            {/* ---- Gifs ---- */}
            <div>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '8px' }}>
                Gifs ({gifs.length})
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {gifs.map(ref => (
                  <div key={ref} style={{ position: 'relative' }}>
                    <div style={{ width: '112px', height: '84px', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {previas[ref]
                        ? <img src={previas[ref]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        : <span className="text-xs text-muted">carregando</span>}
                    </div>
                    <button
                      onClick={() => db.projetos.update(projetoId, { gifs_wrap: gifs.filter(g => g !== ref) })}
                      className="btn-icon"
                      aria-label="Tirar este gif"
                      style={{ position: 'absolute', top: '4px', right: '4px', width: 'auto', padding: '4px', backgroundColor: 'rgba(0,0,0,0.65)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => arquivoRef.current?.click()}
                  className="btn-icon"
                  style={{ width: '112px', height: '84px', border: '1px dashed var(--border-light)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '5px', fontSize: '12px' }}
                >
                  <ImagePlus size={17} /> pôr um gif
                </button>
              </div>

              <input
                ref={arquivoRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) void subirGif(f); e.target.value = ''; }}
              />
              {erro && <div className="text-danger text-xs" style={{ marginTop: '6px' }}>{erro}</div>}
              <div className="text-xs text-muted" style={{ marginTop: '6px', lineHeight: 1.6 }}>
                Guardados no projeto, não linkados de fora — o wrap acontece no set, onde
                costuma não ter sinal. Até 6MB cada.
              </div>
            </div>

            {/* Ver antes é o que dá coragem de mexer: ninguém escreve dez frases
                sem saber como a primeira fica na tela. */}
            <button
              onClick={() => setEnsaiando(true)}
              className="btn-icon"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: '1px solid var(--border-light)', width: 'auto', fontSize: '13px' }}
            >
              <Eye size={14} /> Ver como fica
            </button>
          </>
        )}
      </div>

      {/*
        O ensaio usa a carta DE VERDADE, com números de mentira.

        Uma prévia desenhada à parte seria outra tela para manter em pé, e ela
        divergiria da real no primeiro ajuste — que é exatamente o problema que
        este app acabou de resolver na Ordem do Dia.
      */}
      {ensaiando && (
        <CartaDeWrap
          projetoId={projetoId}
          numero={3}
          totalDiarias={12}
          frases={frases}
          gifs={gifs}
          dados={{
            gravadas: 6, parciais: 1, naoGravadas: 0,
            oitavosGravados: 35, setups: 14,
            wrapReal: '19:20', wrapPlanejado: '19:32', diferencaMin: -12,
          }}
          aoFechar={() => setEnsaiando(false)}
        />
      )}
    </>
  );
}
