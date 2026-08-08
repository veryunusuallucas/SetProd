import { X, Sparkles, FileText, Users, ShieldCheck, History, Printer, ClipboardList } from 'lucide-react';

interface Novidade {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}

const NOVIDADES: Novidade[] = [
  {
    icone: <Users size={24} style={{ color: '#0984e3' }} />,
    titulo: 'Duas equipes, uma produção',
    texto: 'Crie um link de convite em "Quem tem acesso" e a outra equipe entra na MESMA produção — não em uma cópia. As duas têm o mesmo poder. O link vale 7 dias, serve uma vez só, e quem tiver ele entra: mande por canal privado.',
  },
  {
    icone: <Sparkles size={24} style={{ color: '#4cc9f0' }} />,
    titulo: 'O que uma equipe faz, a outra vê na hora',
    texto: 'Com as duas online, uma alteração aparece na tela da outra em menos de um segundo. Sem internet você continua trabalhando normalmente, e tudo sobe sozinho quando o sinal volta — nada se perde no caminho.',
  },
  {
    icone: <ShieldCheck size={24} className="text-success" />,
    titulo: 'O papel vem do login, não de um menu',
    texto: 'Saiu o seletor "Quem está usando?", que era só simulação. Agora quem decide o que você pode fazer é a sua conta, com a regra rodando no servidor — ninguém entra numa produção sem ser convidado, mesmo sabendo o endereço dela.',
  },
  {
    icone: <History size={24} style={{ color: '#a29bfe' }} />,
    titulo: 'Salvo, Salvando, Offline — e a ata',
    texto: 'O pé da barra lateral mostra se o seu trabalho já saiu do aparelho. Clicando, você vê o que andou acontecendo em linguagem de gente ("Outra equipe mexeu em Financeiro, há 20 min") e quanto a produção está ocupando.',
  },
  {
    icone: <FileText size={24} style={{ color: '#e85d04' }} />,
    titulo: 'O roteiro viaja junto',
    texto: 'Roteiro, comprovantes, storyboard e anexos da OD agora ficam no servidor e chegam na outra equipe. Continuam abrindo sem internet, porque cada aparelho guarda a própria cópia. E o limite de 3 MB por anexo acabou.',
  },
  {
    icone: <ClipboardList size={24} style={{ color: '#00b894' }} />,
    titulo: 'Apagar pesquisa agora apaga de verdade',
    texto: 'Antes a pesquisa sumia da sua tela e o link continuava vivo, recebendo respostas num lugar que ninguém mais abria. Agora apagar derruba o link para todo mundo — e apagar a produção derruba os links dela junto.',
  },
  {
    icone: <Printer size={24} style={{ color: '#fd79a8' }} />,
    titulo: 'O manual foi reescrito',
    texto: 'Estava parado numa época em que o app só cuidava de dinheiro. Agora cobre tudo: diárias, decupagem, locações, transporte, documentos, pesquisas — e explica o que fazer quando um anexo aparece como indisponível offline.',
  },
];

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v4.3</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div>
            <h3 className="font-bold text-md mb-2">Duas equipes trabalhando na mesma produção</h3>
            <p className="text-sm text-secondary" style={{ lineHeight: '1.6' }}>
              A v4.2 abriu o app para a equipe responder. A v4.3 abre para a equipe
              <strong> trabalhar junto</strong>: uma produção, duas equipes, o mesmo dado.
              O que uma altera aparece na outra em segundos — e continua funcionando offline.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {NOVIDADES.map(n => (
              <div key={n.titulo} style={{ display: 'flex', gap: '12px' }}>
                <span style={{ flexShrink: 0 }}>{n.icone}</span>
                <div>
                  <div className="font-bold text-sm">{n.titulo}</div>
                  <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>{n.texto}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
            <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
              <strong>Antes, na v4.2:</strong> pesquisas por link com recomendação da IA, decupagem
              cena a cena no PDF, aba Elementos com Cast ID, stripboard com quebra de diária, DOOD e
              mais três relatórios, versões do roteiro e teto de gasto da IA no servidor.
            </div>
          </div>

        </div>

        <div style={{ padding: '16px', borderTop: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-primary">Incrível! Entendido.</button>
        </div>
      </div>
    </div>
  );
}
