import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, ClipboardList } from 'lucide-react';
import { lerPesquisaPublica, enviarResposta } from '../lib/pesquisas';
import type { Pergunta } from '../types';
import { MOLA } from '../components/ui/ia';

/**
 * Link público da pesquisa.
 *
 * Roda no navegador de quem responde, sem login e sem o banco local do projeto
 * — tudo vem da tabela pública. É o mesmo caminho do link de cadastro.
 */
export function ResponderPesquisa() {
  const { pesquisaId } = useParams();

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  const [pesquisa, setPesquisa] = useState<Awaited<ReturnType<typeof lerPesquisaPublica>>>(null);
  const [nome, setNome] = useState('');
  const [valores, setValores] = useState<Record<string, string | string[]>>({});

  useEffect(() => {
    (async () => {
      if (!pesquisaId) return;
      try {
        setPesquisa(await lerPesquisaPublica(pesquisaId));
      } catch (e: any) {
        setErro('Não foi possível carregar a pesquisa. ' + (e?.message || ''));
      } finally {
        setCarregando(false);
      }
    })();
  }, [pesquisaId]);

  const responder = (id: string, valor: string | string[]) =>
    setValores(v => ({ ...v, [id]: valor }));

  const alternarMultipla = (id: string, opcao: string) => {
    const atual = (valores[id] as string[]) || [];
    responder(id, atual.includes(opcao) ? atual.filter(o => o !== opcao) : [...atual, opcao]);
  };

  const enviar = async () => {
    if (!pesquisa) return;

    const faltando = pesquisa.perguntas.filter(p => {
      if (!p.obrigatoria) return false;
      const v = valores[p.id];
      return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    });

    if (faltando.length) {
      setErro(`Responda: ${faltando.map(p => p.texto).join(', ')}.`);
      return;
    }

    setEnviando(true);
    setErro('');
    try {
      await enviarResposta({
        pesquisaId: pesquisa.id,
        projetoId: pesquisa.projeto_id,
        nome: nome.trim() || undefined,
        respostas: valores,
      });
      setEnviado(true);
    } catch (e: any) {
      setErro('Não foi possível enviar. ' + (e?.message || ''));
    } finally {
      setEnviando(false);
    }
  };

  const moldura = (conteudo: React.ReactNode) => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {conteudo}
      </div>
    </div>
  );

  if (carregando) return moldura(<span className="text-secondary">Carregando pesquisa...</span>);

  if (!pesquisa) {
    return moldura(
      <>
        <h2 className="text-lg font-bold">Pesquisa não encontrada</h2>
        <p className="text-sm text-secondary">
          O link pode estar errado ou a pesquisa ainda não foi publicada. Fale com a produção.
        </p>
      </>
    );
  }

  if (enviado) {
    return moldura(
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={MOLA}
        style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}
      >
        <CheckCircle2 size={44} className="text-success" />
        <h2 className="text-xl font-bold">Resposta enviada!</h2>
        <p className="text-sm text-secondary">Obrigado. A produção já consegue ver o resultado.</p>
      </motion.div>
    );
  }

  if (!pesquisa.aberta) {
    return moldura(
      <>
        <h2 className="text-lg font-bold">{pesquisa.titulo}</h2>
        <p className="text-sm text-secondary">Esta pesquisa foi encerrada e não aceita mais respostas.</p>
      </>
    );
  }

  return moldura(
    <>
      <div>
        <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ClipboardList size={13} /> {pesquisa.nome_projeto || 'Produção'}
        </div>
        <h2 className="text-xl font-bold" style={{ marginTop: '6px' }}>{pesquisa.titulo}</h2>
        {pesquisa.descricao && <p className="text-sm text-secondary" style={{ marginTop: '6px' }}>{pesquisa.descricao}</p>}
      </div>

      <div>
        <label className="text-xs text-secondary font-bold uppercase tracking-widest">Seu nome (opcional)</label>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Como te chamam no set" style={{ marginTop: '6px' }} />
      </div>

      {pesquisa.perguntas.map(p => (
        <CampoPergunta
          key={p.id}
          pergunta={p}
          valor={valores[p.id]}
          onTexto={v => responder(p.id, v)}
          onAlternar={o => alternarMultipla(p.id, o)}
        />
      ))}

      {erro && <span className="text-sm text-danger">{erro}</span>}

      <button onClick={enviar} disabled={enviando} className="btn-primary">
        {enviando ? 'Enviando...' : 'Enviar resposta'}
      </button>
    </>
  );
}

function CampoPergunta({ pergunta, valor, onTexto, onAlternar }: {
  pergunta: Pergunta;
  valor: string | string[] | undefined;
  onTexto: (v: string) => void;
  onAlternar: (opcao: string) => void;
}) {
  const opcoes = pergunta.tipo === 'sim_nao' ? ['Sim', 'Não'] : (pergunta.opcoes || []);
  const multipla = pergunta.tipo === 'escolha_multipla';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <span className="text-sm font-bold">
        {pergunta.texto}
        {pergunta.obrigatoria && <span className="text-danger"> *</span>}
      </span>

      {pergunta.tipo === 'texto' ? (
        <textarea
          value={(valor as string) || ''}
          onChange={e => onTexto(e.target.value)}
          rows={3}
          placeholder="Sua resposta"
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {opcoes.map(o => {
            const marcada = multipla ? ((valor as string[]) || []).includes(o) : valor === o;
            return (
              <motion.button
                key={o}
                type="button"
                whileTap={{ scale: 0.985 }}
                transition={MOLA}
                onClick={() => (multipla ? onAlternar(o) : onTexto(o))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left',
                  padding: '11px 14px', borderRadius: '10px',
                  border: `1px solid ${marcada ? 'var(--accent)' : 'var(--border-light)'}`,
                  backgroundColor: marcada ? 'var(--bg-active)' : 'var(--bg-surface)',
                  color: 'var(--text-primary)', fontSize: '14px',
                }}
              >
                <span style={{
                  width: '16px', height: '16px', flexShrink: 0,
                  borderRadius: multipla ? '4px' : '50%',
                  border: `2px solid ${marcada ? 'var(--accent)' : 'var(--border-color)'}`,
                  backgroundColor: marcada ? 'var(--accent)' : 'transparent',
                }} />
                {o}
              </motion.button>
            );
          })}
          {opcoes.length === 0 && (
            <span className="text-xs text-muted">Esta pergunta ficou sem opções — avise a produção.</span>
          )}
        </div>
      )}
    </div>
  );
}
