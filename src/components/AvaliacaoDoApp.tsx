import { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquareHeart, Check } from 'lucide-react';
import { Janela } from './ui/Janela';
import { ApoioAoApp } from './ApoioAoApp';
import { MOLA, useMovimentoReduzido } from './ui/movimento';
import { useAuth } from '../hooks/useAuth';
import { OPCOES_QUE_AJUDARAM, enviarAvaliacao, recusarAvaliacao } from '../lib/avaliacao';

/**
 * "Como foi fazer esta produção no SetProd?" — nota, o que ajudou, o que faltou.
 *
 * Abre sozinha uma vez quando uma produção encerra (Home), e a qualquer hora em
 * Configurações → "Dar minha opinião". Vai para os relatos (`lib/avaliacao.ts`).
 *
 * Não é formulário obrigatório: "Agora não" está sempre à mão, e a única coisa
 * que trava o envio é a nota — o resto é bônus.
 */
export function AvaliacaoDoApp({ projetoId, nomeDaProducao, diarias, aoFechar }: {
  projetoId?: string;
  nomeDaProducao?: string;
  diarias?: number;
  aoFechar: () => void;
}) {
  const { user } = useAuth();
  const reduzido = useMovimentoReduzido();
  const [nota, setNota] = useState(0);
  const [passando, setPassando] = useState(0);
  const [ajudou, setAjudou] = useState<string[]>([]);
  const [atrapalhou, setAtrapalhou] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const agoraNao = () => {
    if (user && projetoId && !enviado) recusarAvaliacao(user.id, projetoId);
    aoFechar();
  };

  const enviar = async () => {
    if (!user || !nota || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      await enviarAvaliacao(user, { nota, ajudou, atrapalhou, projetoId, diarias });
      setEnviado(true);
    } catch (e: any) {
      setErro(e?.message || 'Não deu para enviar agora.');
    } finally {
      setEnviando(false);
    }
  };

  const alternar = (o: string) => setAjudou(a => a.includes(o) ? a.filter(x => x !== o) : [...a, o]);
  const acesa = passando || nota;

  return (
    <Janela
      titulo={nomeDaProducao ? 'É um wrap' : 'Sua opinião sobre o SetProd'}
      icone={<MessageSquareHeart size={18} />}
      aoFechar={agoraNao}
      fecharClicandoFora={false}
      largura="520px"
      rodape={enviado ? <button type="button" className="btn-secondary" onClick={aoFechar} style={{ width: '100%' }}>Fechar</button> : (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <button type="button" className="btn-secondary" onClick={agoraNao}>Agora não</button>
          <button type="button" className="btn-primary" onClick={enviar} disabled={!nota || enviando} style={{ opacity: nota ? 1 : 0.5 }}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      )}
    >
      {enviado ? (
        <motion.div
          initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={MOLA}
          style={{ textAlign: 'center', padding: '24px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}
        >
          <span className="boas-vindas-icone" style={{ width: 44, height: 44 }}><Check size={22} /></span>
          <strong>Obrigado.</strong>
          <p className="text-sm text-secondary" style={{ margin: 0 }}>Chegou direto para quem faz o app — é isso que decide o que vem na próxima versão.</p>
          {/* O único lugar em que o app lembra do apoio sem a pessoa procurar: ela
              acabou de dizer como foi. Fica parado até ela fechar. */}
          <p className="text-xs text-muted" style={{ margin: '8px 0 0' }}>Se o SetProd ajudou, dá para apoiar:</p>
          <ApoioAoApp compacto />
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <p className="font-bold" style={{ margin: '0 0 4px' }}>
              {nomeDaProducao ? <>Como foi fazer <span style={{ color: 'var(--accent-texto)' }}>{nomeDaProducao}</span> no SetProd?</> : 'Como está sendo usar o SetProd?'}
            </p>
            {nomeDaProducao && <p className="text-xs text-muted" style={{ margin: 0 }}>A filmagem terminou. Leva meio minuto, e ajuda muito.</p>}
            <div
              role="radiogroup"
              aria-label="Nota de 1 a 5"
              onMouseLeave={() => setPassando(0)}
              style={{ display: 'flex', gap: '6px', marginTop: '12px' }}
            >
              {[1, 2, 3, 4, 5].map(n => (
                <motion.button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={nota === n}
                  aria-label={`${n} de 5`}
                  onClick={() => setNota(n)}
                  onMouseEnter={() => setPassando(n)}
                  whileTap={reduzido ? undefined : { scale: 0.85 }}
                  animate={nota === n && !reduzido ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  style={{ background: 'none', border: 0, padding: '4px', cursor: 'pointer', minWidth: 40, minHeight: 40, color: n <= acesa ? 'var(--accent)' : 'var(--border-color)' }}
                >
                  <Star size={30} fill={n <= acesa ? 'currentColor' : 'none'} strokeWidth={1.6} />
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-bold" style={{ margin: '0 0 8px' }}>O que mais ajudou? <span className="text-muted" style={{ fontWeight: 400 }}>(pode marcar vários)</span></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {OPCOES_QUE_AJUDARAM.map(o => {
                const marcada = ajudou.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    className="btn-chip"
                    aria-pressed={marcada}
                    onClick={() => alternar(o)}
                    style={marcada ? { borderColor: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--text-primary)' } : undefined}
                  >
                    {marcada && <Check size={12} />} {o}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="avaliacao-texto" className="text-sm font-bold" style={{ display: 'block', marginBottom: '8px' }}>
              O que atrapalhou, ou o que faltou?
            </label>
            <textarea
              id="avaliacao-texto"
              value={atrapalhou}
              onChange={e => setAtrapalhou(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Ex.: queria mandar a OD pelo WhatsApp direto do app"
            />
          </div>

          {erro && <p className="text-sm text-danger" style={{ margin: 0 }}>{erro}</p>}
        </div>
      )}
    </Janela>
  );
}
