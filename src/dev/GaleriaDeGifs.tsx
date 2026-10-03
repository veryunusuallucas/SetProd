import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import '../layout.css';
import { BIBLIOTECA, GIFS, MOMENTOS } from '../lib/gifs';
import { aplicarTema } from '../lib/preferencias';
import { BotaoDoTema } from '../components/BotaoDoTema';
import { CartaDeAbertura } from '../components/CartaDeAbertura';
import { Confirmacoes, confirmar, type OpcoesConfirmacao } from '../components/ui/Confirmacao';

/**
 * A galeria dos gifs, para o Lucas ver cada um antes de publicar.
 *
 * Só de desenvolvimento (`galeria-gifs.html`, na raiz): não entra no build.
 * Em cima, os MOMENTOS do app — onde aparece, quais tags ele procura, e um
 * botão que abre a tela de verdade com um gif sorteado. Embaixo, a biblioteca
 * inteira, com as tags que cada arquivo tem no nome.
 */

type Momento = keyof typeof MOMENTOS;

const DESCRICAO: Record<Momento, { titulo: string; onde: string; pergunta?: OpcoesConfirmacao }> = {
  abertura: { titulo: 'Abertura', onde: 'Logo depois de criar uma produção.' },
  wrap: { titulo: 'Wrap', onde: 'A carta do fim da diária (com "Wrap com festa" ligado).' },
  quite: { titulo: 'Tudo quite', onde: 'No acerto de alguém que zerou.' },
  apagar: {
    titulo: 'Apagar', onde: 'Toda pergunta de apagar ou desfazer; mandar produção para a lixeira.',
    pergunta: { titulo: 'Apagar a Diária 03?', detalhe: 'Some a OD e as marcações dela.', confirmar: 'Apagar', perigo: true },
  },
  semVolta: {
    titulo: 'Sem volta', onde: 'Apagar uma produção de vez; arquivar o financeiro inteiro.',
    pergunta: { titulo: 'Apagar "Canção de Outono" de vez?', detalhe: 'Isto não tem volta.', confirmar: 'Apagar de vez', perigo: true, humor: MOMENTOS.semVolta },
  },
  pergunta: {
    titulo: 'Tem certeza?', onde: 'As perguntas comuns — sair sem salvar, trocar algo, publicar.',
    pergunta: { titulo: 'Sair sem salvar?', detalhe: 'O que você digitou nesta ficha se perde.', confirmar: 'Sair' },
  },
  vazio: {
    titulo: 'Tem nada aí', onde: 'Salvar um membro novo só com o nome.',
    pergunta: {
      titulo: 'Tem quase nada aí 👀', detalhe: 'Ana vai entrar só com o nome. Dá para completar depois — ou mandar o link de cadastro para a pessoa preencher.',
      confirmar: 'Salvar assim mesmo', cancelar: 'Voltar e completar', humor: MOMENTOS.vazio,
    },
  },
};

const Etiqueta = ({ texto, forte }: { texto: string; forte?: boolean }) => (
  <span className="text-xs" style={{
    padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-color)',
    background: forte ? 'var(--bg-active)' : 'transparent', color: forte ? 'var(--text-primary)' : 'var(--text-secondary)',
  }}>{texto}</span>
);

function Galeria() {
  const [abrindo, setAbrindo] = useState(false);
  const todasAsTags = Object.keys(GIFS).sort();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 64px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Confirmacoes />
      {abrindo && <CartaDeAbertura nome="Canção de Outono" aoEntrar={() => setAbrindo(false)} />}

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 className="text-xl font-bold">Galeria de gifs</h1>
          <p className="text-sm text-secondary">
            {BIBLIOTECA.length} arquivos em src/conteudo/gifs/ · nome = <code>tag_tag_filme.mp4</code> · jogou .gif? <code>npm run gifs</code>
          </p>
        </div>
        <BotaoDoTema className="btn-icon" tamanho={20} />
      </header>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 className="font-bold" style={{ fontSize: '18px' }}>Momentos do app</h2>
        {(Object.keys(MOMENTOS) as Momento[]).map(m => {
          const d = DESCRICAO[m];
          const tags = MOMENTOS[m] as readonly string[];
          const usada = tags.find(t => (GIFS[t] || []).length > 0);
          return (
            <div key={m} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                <div className="font-bold">{d.titulo}</div>
                <div className="text-xs text-secondary" style={{ margin: '2px 0 6px' }}>{d.onde}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="text-xs text-muted">procura:</span>
                  {tags.map(t => <Etiqueta key={t} texto={`${t} (${(GIFS[t] || []).length})`} forte={t === usada} />)}
                  {!usada && <span className="text-xs" style={{ color: 'var(--color-warning)' }}>nenhum gif ainda</span>}
                </div>
              </div>
              {m === 'abertura' && <button className="btn-primary" onClick={() => setAbrindo(true)}>Ver a abertura</button>}
              {d.pergunta && <button className="btn-primary" onClick={() => confirmar(d.pergunta!)}>Ver na pergunta</button>}
            </div>
          );
        })}
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 className="font-bold" style={{ fontSize: '18px' }}>Biblioteca</h2>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {todasAsTags.map(t => <Etiqueta key={t} texto={`${t} · ${GIFS[t].length}`} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
          {BIBLIOTECA.map(m => (
            <figure key={m.url} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', padding: '8px', display: 'flex', justifyContent: 'center' }}>
                {m.video
                  ? <video src={m.url} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)' }} />
                  : <img src={m.url} alt={m.nome} style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)' }} />}
              </div>
              <figcaption style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span className="text-xs font-bold" style={{ wordBreak: 'break-word' }}>{m.nome}{m.video ? '' : ' · ainda não é mp4'}</span>
                <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {m.tags.length ? m.tags.map(t => <Etiqueta key={t} texto={t} />) : <span className="text-xs" style={{ color: 'var(--color-warning)' }}>sem tag</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

aplicarTema();
createRoot(document.getElementById('root')!).render(<Galeria />);
