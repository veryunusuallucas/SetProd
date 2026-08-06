import { X, Sparkles, Film, FileText, Users, Layers, ShieldCheck, History, Printer } from 'lucide-react';

interface Novidade {
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}

const NOVIDADES: Novidade[] = [
  {
    icone: <FileText size={24} style={{ color: '#e85d04' }} />,
    titulo: 'Decupagem por IA que funciona',
    texto: 'Mande o PDF e a IA lê cena por cena, marcando elenco, objetos, figurino, som e veículos direto no roteiro. As cenas são separadas por padrão de cabeçalho, não por palpite: no roteiro de teste foram 30 de 30, com 147 elementos marcados e nenhum descartado.',
  },
  {
    icone: <Layers size={24} style={{ color: '#00b894' }} />,
    titulo: 'Aba Elementos: junte os nomes repetidos',
    texto: 'O roteiro chama a mesma pessoa de "Renata" e de "sua mulher". Agora o app percebe e pergunta se são a mesma — você aceita e vira um item só, com Cast ID automático por ordem de entrada. Dá para desfazer a qualquer momento.',
  },
  {
    icone: <Film size={24} style={{ color: '#fca311' }} />,
    titulo: 'Stripboard com quebra de diária',
    texto: 'Insira quebras de dia, almoço e mudança de locação entre as cenas. Cada dia mostra sozinho quantas cenas, quantas páginas e quantas horas — contando o almoço, que ocupa o dia sem filmar. Agrupe por locação num clique e mande o dia direto para uma Ordem do Dia.',
  },
  {
    icone: <Users size={24} style={{ color: '#0984e3' }} />,
    titulo: 'DOOD e mais três relatórios',
    texto: 'Day Out of Days com os dias de espera de cada ator — aquele que filma no dia 1 e no dia 8 costuma ser pago pelos seis do meio. Mais plano de filmagem, breakdown por cena e lista de elementos. Todos em PDF, e os tabulares também em CSV.',
  },
  {
    icone: <History size={24} style={{ color: '#a29bfe' }} />,
    titulo: 'Versões do roteiro',
    texto: 'Subir uma revisão não apaga mais o trabalho feito na anterior. Cada versão guarda as próprias marcações e dá para voltar quando quiser.',
  },
  {
    icone: <ShieldCheck size={24} className="text-success" />,
    titulo: 'IA sem susto na conta',
    texto: 'A chave da IA vive no servidor — ninguém no app consegue vê-la ou trocá-la por um modelo caro. Tem teto diário para a produção inteira e fila de uma análise por vez: se alguém já estiver rodando, você vê o progresso em vez de estourar a cota dos dois.',
  },
  {
    icone: <Printer size={24} style={{ color: '#fd79a8' }} />,
    titulo: 'Consertos que faziam falta',
    texto: 'Os botões de exportar não abriam nada com bloqueador de pop-up — agora imprimem direto. A marcação no PDF encaixa em palavra inteira (chega de "ARCOS" no lugar de "MARCOS"). A locação da cena vem sozinha do cabeçalho. E o roteiro abre sem internet, como o resto do app.',
  },
];

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>

        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v4.1</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          <div>
            <h3 className="font-bold text-md mb-2">A decupagem ficou de verdade</h3>
            <p className="text-sm text-secondary" style={{ lineHeight: '1.6' }}>
              A v4.0 montou os módulos. A v4.1 faz o roteiro virar plano de filmagem: você sobe o PDF,
              a IA marca, o stripboard divide os dias e sai o relatório que a produção usa no set.
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
              <strong>Antes, na v4.0:</strong> calendário no dashboard com clima, transporte com
              veículos e motoristas, hospital mais próximo na Ordem do Dia, documentos com índice
              central, tasks com prazo e cor de departamento, ficha como fonte única do cadastro e
              fechamento de diária em PDF.
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
