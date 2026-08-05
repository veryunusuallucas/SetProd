import { X, Sparkles, Film, CheckSquare, FileText, Calendar, Truck, FolderOpen, ClipboardList } from 'lucide-react';

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v4.0</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <h3 className="font-bold text-md mb-2">Os módulos novos chegaram</h3>
            <p className="text-sm text-secondary" style={{ lineHeight: '1.6' }}>
              A v4 liga as pontas do app: o que você decupa alimenta a diária, o que você anexa aparece em Documentos,
              e o que sai do set vira prestação de contas.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Calendar size={24} className="text-accent" />
              <div>
                <div className="font-bold text-sm">Calendário no Dashboard</div>
                <div className="text-xs text-muted">Mês inteiro com diárias e prazos de tasks, camada de clima com alcance configurável, e clique no dia para abrir a diária. Na Visão Geral, a faixa dos próximos 7 dias.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Film size={24} style={{ color: '#fca311' }} />
              <div>
                <div className="font-bold text-sm">Stripboard e Storyboard</div>
                <div className="text-xs text-muted">Arraste as tiras para montar a ordem de filmagem (com páginas, unidade e estimativa) e mande tudo para uma diária. Anexe referências de imagem por cena.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <FileText size={24} style={{ color: '#e85d04' }} />
              <div>
                <div className="font-bold text-sm">Roteiro e Análise Técnica</div>
                <div className="text-xs text-muted">Cenas separadas automaticamente do PDF (sem duplicar em revisões), marcação por categoria e relatório exportável. Itens marcados viram subtarefas da task-mãe "Análise Técnica".</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Truck size={24} style={{ color: '#4CAF50' }} />
              <div>
                <div className="font-bold text-sm">Transporte e Emergência</div>
                <div className="text-xs text-muted">Cadastro de veículos e motoristas reaproveitado nos comboios de cada diária, com ponto de encontro. E o hospital mais próximo via OpenStreetMap, com distância, telefone e rota na OD.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <FolderOpen size={24} style={{ color: '#4cc9f0' }} />
              <div>
                <div className="font-bold text-sm">Documentos com índice central</div>
                <div className="text-xs text-muted">Pastas com cor e nome, upload direto ou link do Drive com nome e miniatura automáticos. Roteiros, comprovantes e anexos de diária aparecem sozinhos, organizados por origem.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <CheckSquare size={24} style={{ color: '#9d4edd' }} />
              <div>
                <div className="font-bold text-sm">Tasks turbinadas</div>
                <div className="text-xs text-muted">Prazo por task (que aparece no calendário), card inteiro na cor do departamento e aviso de atraso.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <ClipboardList size={24} className="text-success" />
              <div>
                <div className="font-bold text-sm">Ficha como fonte única</div>
                <div className="text-xs text-muted">O Construtor de Ficha agora alimenta o cadastro, o link público e a importação de CSV — com mapeamento de colunas e campos obrigatórios que realmente bloqueiam o envio.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Sparkles size={24} className="text-warning" />
              <div>
                <div className="font-bold text-sm">Fechamento de diária</div>
                <div className="text-xs text-muted">Feche o dia e gere o resumo em PDF com gastos, equipe e checklist. Os dados continuam no banco — dá para reabrir quando quiser.</div>
              </div>
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
