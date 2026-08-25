import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, UserPlus, ShieldCheck, Lock, IdCard, Clapperboard, ClipboardCheck,
  RotateCcw, GitCompare, PieChart, CloudSun, Trash2, GitMerge, MapPin, Clock,
} from 'lucide-react';
import { MOLA } from './ui/ia';

/**
 * As novidades da versão.
 *
 * Antes era uma lista corrida de sete itens. Com uma versão do tamanho desta,
 * uma lista corrida vira parede de texto: a pessoa rola até o fim, fecha, e não
 * lembra de nada — o oposto do que a tela existe para fazer.
 *
 * Três decisões que mudam isso:
 *
 *   AGRUPADO POR ASSUNTO. Ninguém guarda dezesseis novidades soltas, mas guarda
 *   "mexeram em contas, no set e no dinheiro" e sabe onde procurar depois.
 *
 *   ETIQUETADO. "Novo" e "Consertado" são coisas diferentes e a pessoa lê cada
 *   um com uma expectativa: um é o que ela ganhou, o outro é aquilo que ela
 *   estranhou e achou que era ela. Misturar os dois esconde os dois.
 *
 *   RECOLHIDO POR PADRÃO, menos o primeiro grupo. Sete parágrafos abertos
 *   afastam; sete títulos convidam.
 */

type Tipo = 'novo' | 'melhor' | 'corrigido';

interface Item {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
  tipo: Tipo;
}

interface Grupo {
  id: string;
  titulo: string;
  resumo: string;
  cor: string;
  itens: Item[];
}

const ETIQUETA: Record<Tipo, { texto: string; cor: string; fundo: string }> = {
  novo: { texto: 'novo', cor: '#4cc9f0', fundo: 'rgba(76,201,240,0.12)' },
  melhor: { texto: 'melhor', cor: 'var(--accent)', fundo: 'rgba(255,209,102,0.12)' },
  corrigido: { texto: 'consertado', cor: '#4ade80', fundo: 'rgba(74,222,128,0.12)' },
};

const GRUPOS: Grupo[] = [
  {
    id: 'set',
    titulo: 'O set finalmente responde',
    resumo: 'O app planejava e nunca ficava sabendo o que aconteceu. Agora fecha o ciclo.',
    cor: '#4cc9f0',
    itens: [
      {
        tipo: 'novo',
        icone: <Clapperboard size={20} />,
        titulo: 'Marcar o que foi gravado, cena por cena',
        texto: 'Na diária, um toque na cena alterna Gravada → Parcial → Não gravada → Cortada. Sem confirmação, porque no set você está de pé, no escuro, com o rádio na outra mão. Quando não gravou, aparecem os motivos por atalho: chuva, luz, elenco, equipamento.',
      },
      {
        tipo: 'novo',
        icone: <ClipboardCheck size={20} />,
        titulo: 'Fechar a diária virou o relatório do dia',
        texto: 'Antes era só arquivar. Agora mostra o que saiu, quantas páginas de roteiro foram gravadas do previsto, e destaca as cenas que ninguém marcou — porque "ninguém marcou" não é "não gravou", e tratar como se fosse encheria a repescagem de cena que talvez tenha saído.',
      },
      {
        tipo: 'novo',
        icone: <RotateCcw size={20} />,
        titulo: 'O que ficou para trás volta na fila',
        texto: 'Cena que não saiu numa diária fechada aparece no topo do painel, com o motivo e de que dia veio — e um botão para reencaixar em outro dia. Sem isso, "cena 42 não gravada" morria dentro de uma diária que ninguém mais abre.',
      },
      {
        tipo: 'novo',
        icone: <GitCompare size={20} />,
        titulo: 'O stripboard alimenta a Ordem do Dia — até você publicar',
        texto: 'Enquanto a diária é rascunho, arrastar uma cena na linha do tempo atualiza a OD sozinho. Ao publicar, ela congela: mudança no stripboard vira aviso com "aplicar" ou "ignorar". A equipe já está com o PDF na mão — a OD não pode mudar por baixo dela.',
      },
      {
        tipo: 'corrigido',
        icone: <Clapperboard size={20} />,
        titulo: 'A shot list voltava vazia na OD impressa',
        texto: 'A caixinha existia, você marcava, e não saía nada: o bloco lia campos que o app parou de usar há duas versões. Agora imprime os planos de cada cena, em ordem — com 3, 3A e 3B no lugar certo, em vez do 10 antes do 2.',
      },
    ],
  },
  {
    id: 'contas',
    titulo: 'Contas, papéis e privacidade',
    resumo: 'Quem entra, o que pode fazer, e o que cada um enxerga da ficha dos outros.',
    cor: '#a29bfe',
    itens: [
      {
        tipo: 'novo',
        icone: <UserPlus size={20} />,
        titulo: 'Dá para criar conta sozinho',
        texto: 'As contas nasciam no painel do Supabase, uma por uma, na mão. Agora tem tela de cadastro e "esqueci a senha" — e quem recebe um convite sem ter conta cria a dele ali mesmo, sem ficar preso na porta.',
      },
      {
        tipo: 'novo',
        icone: <ShieldCheck size={20} />,
        titulo: 'Papel deixou de ser enfeite',
        texto: 'Dono, Administra, Equipe e Só leitura. Ao criar o link de convite você escolhe qual — e a regra vale no servidor, não só na tela: quem entrou como leitura não escreve nada, nem pelo console do navegador.',
      },
      {
        tipo: 'novo',
        icone: <Lock size={20} />,
        titulo: 'CPF, banco e ficha médica saem da vista de todo mundo',
        texto: 'Qualquer convidado enxergava o CPF, o remédio de uso contínuo e o cachê de toda a equipe — inclusive o figurante chamado para uma diária. Agora só a própria pessoa e quem administra veem, e o "copiar ficha inteira" respeita a mesma regra.',
      },
      {
        tipo: 'novo',
        icone: <IdCard size={20} />,
        titulo: 'A conta sabe quem você é na equipe',
        texto: 'Na ficha da equipe, cada pessoa ganhou um botão "convidar": o link já nasce sabendo quem ela é, e ela entra como "Maira, da Arte" sem escolher nada. Quem já estava dentro vê um aviso para se vincular — é isso que faz "Minhas Tasks" funcionar e você enxergar a própria ficha.',
      },
      {
        tipo: 'melhor',
        icone: <IdCard size={20} />,
        titulo: '"Equipe A" e "Equipe B" acabaram',
        texto: 'Era herança de quando o app tinha duas máquinas, e ainda roubava o nome do A/B que existe de verdade no set: a segunda unidade. Agora a ata diz "Maira mexeu em Financeiro", e a lista de acesso mostra nome e função.',
      },
      {
        tipo: 'novo',
        icone: <Trash2 size={20} />,
        titulo: 'Sair da conta limpa o aparelho',
        texto: 'A produção inteira fica no navegador para funcionar offline — e continuava lá depois de você sair, aberta para a próxima pessoa que usasse o computador. Agora sair apaga, mas só depois de subir o que faltava e avisar se algo se perderia.',
      },
    ],
  },
  {
    id: 'dinheiro',
    titulo: 'Dinheiro por área',
    resumo: 'A pergunta de toda reunião de produção passou a ter resposta.',
    cor: '#00b894',
    itens: [
      {
        tipo: 'novo',
        icone: <PieChart size={20} />,
        titulo: 'Cada gasto tem uma área, e cada área tem um quanto',
        texto: 'Ao lançar, você diz de qual área é o gasto — e ele já vem preenchido com o seu setor. No Financeiro, uma barra por área mostra quanto gastou do que tinha. É de QUEM é o gasto, não de quem pagou: a Arte pode comprar uma lente da Fotografia.',
      },
    ],
  },
  {
    id: 'consertos',
    titulo: 'Coisas que estavam quebradas em silêncio',
    resumo: 'Nada aqui dava erro. Só não fazia o que parecia fazer.',
    cor: '#f87171',
    itens: [
      {
        tipo: 'corrigido',
        icone: <CloudSun size={20} />,
        titulo: 'A previsão do tempo era de um set só, e não dizia qual',
        texto: 'Com dois sets no dia, o app buscava o clima de um deles e mostrava sem identificar. Numa diária que atravessa a cidade, isso é pior que não ter previsão. Agora mostra todos, com o nome de cada um — e junta num cartão só quando a previsão é a mesma.',
      },
      {
        tipo: 'corrigido',
        icone: <Trash2 size={20} />,
        titulo: 'Apagar uma produção não chegava na outra equipe',
        texto: 'Você mandava para a lixeira e ela continuava na lista da outra conta, para sempre. Eram dois problemas: o que você fazia na tela inicial nunca saía do aparelho, e destruir de vez não tinha como ser avisado do outro lado.',
      },
      {
        tipo: 'corrigido',
        icone: <Clock size={20} />,
        titulo: 'O "Andamento do Projeto" mostrava Diária 1 para sempre',
        texto: 'Ele lia um valor que nada no app jamais escreveu, e a barra ficava parada em zero. Agora mostra diárias fechadas e páginas de roteiro gravadas — dez diárias de meia página não são metade de um filme.',
      },
      {
        tipo: 'novo',
        icone: <GitMerge size={20} />,
        titulo: 'Aviso quando duas pessoas mexem na mesma coisa',
        texto: 'Quando a outra equipe altera algo que você estava editando, a versão dela vence — e antes isso acontecia em silêncio, com o seu texto mudando sozinho na tela. Agora aparece um aviso no canto dizendo o que mudou.',
      },
      {
        tipo: 'melhor',
        icone: <MapPin size={20} />,
        titulo: 'Contato da locação num lugar só',
        texto: 'Havia um campo solto de "segurança" e uma lista de contatos — dois lugares para a mesma coisa, e você preenchia um e procurava no outro. Agora é uma lista só, com atalhos para Segurança, Dono, Zelador e Síndico.',
      },
    ],
  },
];

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  // O primeiro grupo já vem aberto: uma tela toda fechada não convida a abrir
  // nada, e a pessoa fecha sem ler.
  const [abertos, setAbertos] = useState<Set<string>>(new Set([GRUPOS[0].id]));

  const alternar = (id: string) => setAbertos(atual => {
    const proximo = new Set(atual);
    if (proximo.has(id)) proximo.delete(id);
    else proximo.add(id);
    return proximo;
  });

  const totalNovo = GRUPOS.flatMap(g => g.itens).filter(i => i.tipo === 'novo').length;
  const totalCorrigido = GRUPOS.flatMap(g => g.itens).filter(i => i.tipo === 'corrigido').length;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        className="card"
        style={{ width: '100%', maxWidth: '620px', maxHeight: '86vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Cabeçalho */}
        <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Sparkles size={18} color="var(--accent)" />
                <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v4.4</h2>
              </div>
              <p className="text-sm text-secondary" style={{ margin: 0, lineHeight: 1.55 }}>
                A v4.3 fez duas equipes trabalharem na mesma produção. A v4.4 fecha o
                ciclo do set: o app deixa de só <strong>planejar</strong> e passa a
                saber <strong>o que de fato aconteceu</strong> — e a usar isso.
              </p>
            </div>
            <button onClick={onClose} className="btn-icon" aria-label="Fechar"><X size={20} /></button>
          </div>

          {/* Placar: dá a dimensão da versão antes de ler qualquer item. */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <Selo cor={ETIQUETA.novo.cor} fundo={ETIQUETA.novo.fundo} texto={`${totalNovo} novidades`} />
            <Selo cor={ETIQUETA.corrigido.cor} fundo={ETIQUETA.corrigido.fundo} texto={`${totalCorrigido} consertos`} />
          </div>
        </div>

        {/* Grupos */}
        <div style={{ padding: '16px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {GRUPOS.map(grupo => {
            const aberto = abertos.has(grupo.id);
            return (
              <div
                key={grupo.id}
                style={{
                  borderRadius: '14px', overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                  borderLeft: `3px solid ${grupo.cor}`,
                  backgroundColor: 'var(--bg-primary)',
                }}
              >
                <button
                  onClick={() => alternar(grupo.id)}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    padding: '14px 16px', background: 'transparent', border: 'none',
                    color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-bold text-sm">{grupo.titulo}</div>
                    <div className="text-xs text-muted" style={{ lineHeight: 1.45, marginTop: '2px' }}>
                      {grupo.resumo}
                    </div>
                  </div>
                  <span className="text-xs text-muted" style={{ flexShrink: 0 }}>
                    {aberto ? '−' : `+${grupo.itens.length}`}
                  </span>
                </button>

                <AnimatePresence initial={false}>
                  {aberto && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {grupo.itens.map(item => (
                          <div key={item.titulo} style={{ display: 'flex', gap: '12px' }}>
                            <span style={{ flexShrink: 0, color: grupo.cor, marginTop: '2px' }}>{item.icone}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                                <span className="font-bold text-sm">{item.titulo}</span>
                                <Selo
                                  cor={ETIQUETA[item.tipo].cor}
                                  fundo={ETIQUETA[item.tipo].fundo}
                                  texto={ETIQUETA[item.tipo].texto}
                                />
                              </div>
                              <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>{item.texto}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', marginTop: '4px' }}>
            <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
              <strong>Antes, na v4.3:</strong> duas equipes na mesma produção com tempo
              real, anexos no servidor, papel vindo do login, rodapé de Salvo/Salvando
              com a ata, lixeira de 7 dias e o manual reescrito.
            </div>
          </div>
        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary">Incrível! Entendido.</button>
        </div>
      </motion.div>
    </div>
  );
}

function Selo({ cor, fundo, texto }: { cor: string; fundo: string; texto: string }) {
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '3px 8px', borderRadius: '20px',
      color: cor, backgroundColor: fundo, border: `1px solid ${cor}33`,
      whiteSpace: 'nowrap',
    }}>
      {texto}
    </span>
  );
}
