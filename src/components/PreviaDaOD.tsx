import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, RotateCw, X, ExternalLink } from 'lucide-react';
import { db } from '../db/db';
import { prepararOD, gerarPdf } from '../lib/od/exportar';
import { BLOCOS_PADRAO, type FormatoOD } from '../lib/od/tipos';
import { blocosLembrados, formatoLembrado, lembrarFormato } from '../lib/od/preferencia';
import { agruparClimasIguais, type ClimaPorLocal } from '../lib/clima';
import { Segmentado } from './logagem/pecas';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * A prévia da Ordem do Dia, ao lado da diária (Lucas, 13/10/2026).
 *
 * É o PDF DE VERDADE — o mesmo `gerarPdf` da exportação —, e não uma imitação
 * em HTML: o que aparece aqui é o que sai no papel. Por isso ela não acompanha
 * cada tecla: espera uma pausa e gera de novo.
 *
 * Olhar não publica nada. Quem sobe a versão e congela o plano continua sendo
 * só a exportação (`GeradorODModal`).
 */

/** Quanto esperar depois da última mudança: digitar uma hora não gera cinco PDFs. */
const PAUSA_MS = 1200;

/**
 * Um número que muda sempre que algo que a OD lê muda.
 *
 * O `useLiveQuery` refaz a consulta quando alguma linha lida muda — as
 * mesmas tabelas que `coletarOD` lê. Tem de LER as linhas (`toArray`): contar
 * ou pegar só as chaves não acorda quando uma cena muda de texto (testado em
 * 13/10/2026). O número devolvido é só o "acorda" para gerar de novo.
 */
let rodadas = 0;
function useVigiaDaOD(diariaId: string, projetoId: string) {
  return useLiveQuery(async () => {
    await Promise.all([
      db.diarias.where('projeto_id').equals(projetoId).toArray(),
      db.diarias.get(diariaId),
      db.projetos.get(projetoId),
      db.cenas.where('projeto_id').equals(projetoId).toArray(),
      db.planos.where('projeto_id').equals(projetoId).toArray(),
      db.locacoes.where('projeto_id').equals(projetoId).toArray(),
      db.perfis.where('projeto_id').equals(projetoId).toArray(),
      db.departamentos.where('projeto_id').equals(projetoId).toArray(),
      db.elementos.where('projeto_id').equals(projetoId).toArray(),
      db.roteiro_tags.where('projeto_id').equals(projetoId).toArray(),
      db.diaria_tasks.where('diaria_id').equals(diariaId).toArray(),
    ]);
    return ++rodadas;
  }, [diariaId, projetoId]);
}

export function PreviaDaOD({ diariaId, projetoId, versao, climas, aoFechar }: {
  diariaId: string;
  projetoId: string;
  /** O número que a próxima exportação vai ter — o que o papel mostra no topo. */
  versao: number;
  climas?: ClimaPorLocal[];
  aoFechar: () => void;
}) {
  const reduzido = useMovimentoReduzido();
  const [formato, setFormato] = useState<FormatoOD>(formatoLembrado);
  const [url, setUrl] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(true);
  const [erro, setErro] = useState('');
  const [forcar, setForcar] = useState(0);
  const vigia = useVigiaDaOD(diariaId, projetoId);
  const atual = useRef<string | null>(null);

  useEffect(() => {
    if (vigia === undefined) return;
    let vivo = true;
    setAtualizando(true);
    const relogio = setTimeout(async () => {
      try {
        const blocos = formato === 'padrao' ? BLOCOS_PADRAO : blocosLembrados();
        const od = await prepararOD(diariaId, { clima: agruparClimasIguais(climas || []), versao, blocos });
        if (!od) throw new Error('Não consegui ler esta diária.');
        const blob = await gerarPdf(od.doc);
        if (!vivo) return;
        const novo = URL.createObjectURL(blob);
        if (atual.current) URL.revokeObjectURL(atual.current);
        atual.current = novo;
        setUrl(novo);
        setErro('');
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : 'Não consegui gerar a prévia.');
      } finally {
        if (vivo) setAtualizando(false);
      }
    }, PAUSA_MS);
    return () => { vivo = false; clearTimeout(relogio); };
  }, [vigia, formato, versao, climas, diariaId, forcar]);

  // O último PDF sai da memória quando a prévia fecha.
  useEffect(() => () => { if (atual.current) URL.revokeObjectURL(atual.current); }, []);

  const trocarFormato = (f: FormatoOD) => { setFormato(f); lembrarFormato(f); };

  return (
    <section className="card previa-od" aria-label="Prévia da Ordem do Dia">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Eye size={15} style={{ color: 'var(--cor-set)', flexShrink: 0 }} aria-hidden />
        <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ flex: 1 }}>Prévia da OD</span>
        <button type="button" className="previa-od-botao" onClick={() => setForcar(n => n + 1)} title="Gerar de novo agora" aria-label="Gerar a prévia de novo agora">
          <RotateCw size={15} />
        </button>
        {url && (
          <a className="previa-od-botao" href={url} target="_blank" rel="noreferrer" title="Abrir grande numa aba" aria-label="Abrir a prévia grande numa aba">
            <ExternalLink size={15} />
          </a>
        )}
        <button type="button" className="previa-od-botao" onClick={aoFechar} title="Fechar a prévia" aria-label="Fechar a prévia">
          <X size={15} />
        </button>
      </div>

      <Segmentado
        nome="previa-od-formato"
        opcoes={[{ id: 'padrao', nome: 'Padrão' }, { id: 'detalhada', nome: 'Detalhada' }]}
        valor={formato}
        bloqueado={false}
        aoMudar={v => trocarFormato(v as FormatoOD)}
      />

      <div className="previa-od-papel">
        {/* O papel novo entra por cima do antigo, subindo um pouco — como a folha saindo da impressora. */}
        <AnimatePresence initial={false}>
          {url && (
            <motion.iframe
              key={url}
              src={`${url}#toolbar=0&navpanes=0&view=FitH`}
              title="Prévia da Ordem do Dia"
              initial={reduzido ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduzido ? { duration: 0.15 } : { ...MOLA, opacity: { duration: 0.35 } }}
            />
          )}
        </AnimatePresence>

        {/*
          A animação de atualizar: a folha esmaece e uma barra de luz desce por
          ela, como a lâmpada de uma copiadora. Diz "estou refazendo" sem tapar o
          papel — dá para continuar lendo a versão de antes enquanto isso.
        */}
        <AnimatePresence>
          {atualizando && (
            <motion.div
              className="previa-od-atualizando"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              aria-live="polite"
            >
              {!reduzido && (
                <motion.span
                  className="previa-od-luz"
                  initial={{ top: '-12%' }}
                  animate={{ top: '104%' }}
                  transition={{ duration: 1.1, ease: [0.45, 0, 0.55, 1], repeat: Infinity, repeatDelay: 0.15 }}
                />
              )}
              <span className="previa-od-selo">{url ? 'Atualizando…' : 'Montando a OD…'}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {erro && !atualizando && <p className="previa-od-erro text-xs">{erro}</p>}
      </div>

      <p className="text-xs text-muted" style={{ margin: 0 }}>
        É o PDF de verdade, e se refaz sozinho quando a diária muda. Olhar não publica nada: quem sobe a versão é o Exportar.
      </p>
    </section>
  );
}
