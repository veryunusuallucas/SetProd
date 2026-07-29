import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';

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

export function HelpButton({ style }: { style?: React.CSSProperties }) {
  const [aberto, setAberto] = useState(false);

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
              <h2 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={20} className="text-accent" /> Central de Ajuda
              </h2>
              <button onClick={() => setAberto(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {SECOES.map(s => (
                <div key={s.titulo}>
                  <h3 className="font-bold" style={{ marginBottom: '6px' }}>{s.titulo}</h3>
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
