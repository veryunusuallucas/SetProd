import { useState } from 'react';
import { HelpCircle, X, Info, Sparkles } from 'lucide-react';

const SECOES: { titulo: string, texto: string }[] = [
  {
    titulo: '🎬 Como o app funciona',
    texto: 'O SetMoney controla o dinheiro de uma produção de cinema. Tudo fica salvo no próprio aparelho (funciona offline). Cada produção tem sua equipe, suas despesas e seus acertos. A ideia central: toda despesa tem QUEM PAGOU e QUEM DEVE — o app calcula sozinho quem acerta com quem.',
  },
  {
    titulo: '📊 Dashboard',
    texto: 'Visão geral da produção: saldo disponível (caixa inicial menos gastos), total gasto, maior gasto e a faixa de diárias. Clique numa diária da faixa para focar nela. Mostra também o progresso "Diária X de Y".',
  },
  {
    titulo: '🎞️ Produção',
    texto: 'Três sub-abas: DADOS (informações da produção — diretor, nº de diárias, caixa, PIX do caixa, tudo editável); DEPTO (departamentos com orçamento); EQUIPE (cadastro completo de cada membro). Clique num membro para ver/editar a ficha e copiar dados (PIX, telefone ou a ficha inteira).',
  },
  {
    titulo: '🧾 Despesas',
    texto: 'Onde você lança cada gasto: descrição, valor, data, diária (em chips, sem digitar) e quem pagou. Escolha dividir com todos ou só com algumas pessoas. Na lista você pode apagar (com opção de desfazer) e editar uma despesa.',
  },
  {
    titulo: '🤝 Acertos',
    texto: 'O coração financeiro. O CAIXA DA PRODUÇÃO é o banco central: todos acertam com ele. Cada pessoa mostra o saldo já compensado (adiantou − deve). Abra um membro para ver o detalhe despesa por despesa, o PIX, gerar a mensagem de cobrança/repasse e confirmar o pagamento. Pagamentos confirmados vão para o histórico de PAGAS.',
  },
  {
    titulo: '⚙️ Config',
    texto: 'Modelos de mensagem (use variáveis como {{nome}}, {{valor}}, {{pix}}), modo de diária (automático ou manual), exportar/arquivar dados, relatar um problema e a zona de perigo para deletar a produção (com dupla confirmação).',
  },
];

const CHANGELOG = [
  {
    titulo: '🐛 Bug Report (Novo)',
    texto: 'Adicionamos um botão flutuante de relatar problemas presente em todas as páginas. Ele já captura automaticamente sua rota e os erros do sistema para facilitar o diagnóstico.',
  },
  {
    titulo: '📋 Construtor de Fichas e Importação',
    texto: 'Agora é possível criar campos customizados ilimitados para o projeto, e a Ficha de Cadastro (Pública) se ajusta automaticamente. Também suporta importação rápida de CSV do Google Forms.',
  },
  {
    titulo: '🗺️ Locações com Mapa',
    texto: 'O controle de locações foi totalmente reformulado, com busca automática de endereços (Google Maps), contatos de múltiplos responsáveis e status de negociação visual.',
  },
  {
    titulo: '🔗 Dependências de Tasks',
    texto: 'No Kanban, você agora pode configurar tarefas que "dependem" de outras. As tarefas bloqueadas ficam congeladas visualmente até que as anteriores sejam concluídas.',
  },
];

export function HelpButton({ style }: { style?: React.CSSProperties }) {
  const [aberto, setAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'ajuda' | 'changelog'>('ajuda');

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="btn-icon"
        title="Ajuda / Como funciona"
        style={{ padding: 0, ...style }}
      >
        <HelpCircle size={20} />
      </button>

      {aberto && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '560px', maxHeight: '88vh', backgroundColor: 'var(--bg-primary)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  onClick={() => setAbaAtiva('ajuda')}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '18px', fontWeight: abaAtiva === 'ajuda' ? 'bold' : 'normal', color: abaAtiva === 'ajuda' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Info size={18} className={abaAtiva === 'ajuda' ? 'text-accent' : ''} /> Manual do Usuário
                </button>
                <button 
                  onClick={() => setAbaAtiva('changelog')}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: '18px', fontWeight: abaAtiva === 'changelog' ? 'bold' : 'normal', color: abaAtiva === 'changelog' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Sparkles size={18} className={abaAtiva === 'changelog' ? 'text-accent' : ''} /> Novidades (v3)
                </button>
              </div>
              <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {abaAtiva === 'ajuda' && SECOES.map(s => (
                <div key={s.titulo}>
                  <h3 className="font-bold" style={{ marginBottom: '6px' }}>{s.titulo}</h3>
                  <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>{s.texto}</p>
                </div>
              ))}
              {abaAtiva === 'changelog' && CHANGELOG.map(s => (
                <div key={s.titulo} style={{ padding: '16px', backgroundColor: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
                  <h3 className="font-bold" style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>{s.titulo}</h3>
                  <p className="text-sm text-secondary" style={{ lineHeight: 1.6 }}>{s.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
