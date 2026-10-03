import { createRoot } from 'react-dom/client';
import '../index.css';
import '../layout.css';
import { GIFS } from '../lib/gifs';
import { aplicarTema } from '../lib/preferencias';
import { BotaoDoTema } from '../components/BotaoDoTema';
import { Confirmacoes, confirmar, type OpcoesConfirmacao } from '../components/ui/Confirmacao';

/**
 * A galeria dos gifs, para o Lucas ver cada um antes de publicar.
 *
 * Só de desenvolvimento (`galeria-gifs.html`, na raiz): não entra no build.
 * Cada humor mostra todos os seus arquivos e um botão que abre a PERGUNTA DE
 * VERDADE daquele humor — a mesma caixa que o app usa, com um gif sorteado.
 */

const ONDE: Record<string, { onde: string; exemplo?: OpcoesConfirmacao }> = {
  feliz: { onde: 'A carta do wrap no fim da diária; o acerto de alguém que zerou ("tudo quite").' },
  triste: {
    onde: 'Toda pergunta de apagar ou desfazer; apagar uma produção na tela inicial.',
    exemplo: { titulo: 'Apagar a Diária 03?', detalhe: 'Some a OD e as marcações dela.', confirmar: 'Apagar', perigo: true },
  },
  duvida: {
    onde: 'As outras perguntas de "tem certeza?" — sair sem salvar, trocar algo, publicar.',
    exemplo: { titulo: 'Sair sem salvar?', detalhe: 'O que você digitou nesta ficha se perde.', confirmar: 'Sair' },
  },
  vazio: {
    onde: 'Salvar um membro novo só com o nome. Pasta vazia usa um gif de dúvida.',
    exemplo: {
      titulo: 'Tem quase nada aí 👀',
      detalhe: 'Ana vai entrar só com o nome. Dá para completar depois — ou mandar o link de cadastro para a pessoa preencher.',
      confirmar: 'Salvar assim mesmo', cancelar: 'Voltar e completar', humor: 'vazio',
    },
  },
};

function Galeria() {
  const humores = [...new Set([...Object.keys(ONDE), ...Object.keys(GIFS)])];
  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 64px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Confirmacoes />
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 className="text-xl font-bold">Galeria de gifs</h1>
          <p className="text-sm text-secondary">src/conteudo/gifs/ — jogou gif novo? Rode <code>npm run gifs</code> e recarregue.</p>
        </div>
        <BotaoDoTema className="btn-icon" tamanho={20} />
      </header>

      {humores.map(humor => {
        const lista = GIFS[humor] || [];
        const info = ONDE[humor];
        return (
          <section key={humor} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div>
                <h2 className="font-bold" style={{ fontSize: '18px' }}>{humor}/ <span className="text-muted text-sm">· {lista.length} {lista.length === 1 ? 'arquivo' : 'arquivos'}</span></h2>
                <p className="text-sm text-secondary" style={{ marginTop: '4px' }}>{info?.onde || 'Humor sem lugar no app ainda — diga ao Claude onde usar.'}</p>
              </div>
              {info?.exemplo && (
                <button className="btn-primary" onClick={() => confirmar(info.exemplo!)}>Ver na pergunta</button>
              )}
            </div>
            {lista.length === 0 ? (
              <p className="text-sm text-muted">Pasta vazia.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {lista.map(m => (
                  <figure key={m.url} style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', padding: '8px', display: 'flex', justifyContent: 'center' }}>
                      {m.video
                        ? <video src={m.url} autoPlay loop muted playsInline style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)' }} />
                        : <img src={m.url} alt={m.nome} style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)' }} />}
                    </div>
                    <figcaption className="text-xs text-secondary" style={{ wordBreak: 'break-word' }}>
                      {m.nome}{m.video ? '' : ' · ainda não é mp4'}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

aplicarTema();
createRoot(document.getElementById('root')!).render(<Galeria />);
