import { X, Sparkles, Film, CheckSquare, FileText, MapPin, Calendar } from 'lucide-react';

export function ChangelogModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '85vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent)" />
            <h2 className="font-bold text-lg" style={{ margin: 0 }}>Novidades da v2.0</h2>
          </div>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div>
            <h3 className="font-bold text-md mb-2">De Gestor Financeiro para Sistema de Produção!</h3>
            <p className="text-sm text-secondary" style={{ lineHeight: '1.6' }}>
              Nesta atualização, o app deixou de focar apenas no financeiro e ganhou super poderes para gerenciar todas as etapas de um set de filmagem.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Calendar size={24} className="text-accent" />
              <div>
                <div className="font-bold text-sm">Diárias & Cronograma</div>
                <div className="text-xs text-muted">Controle total dos horários, clima em tempo real baseado nas coordenadas e logística de transporte de cada dia.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Film size={24} style={{ color: '#fca311' }} />
              <div>
                <div className="font-bold text-sm">Decupagem Global (Master Shot List)</div>
                <div className="text-xs text-muted">Banco de dados centralizado com todas as Cenas e Planos. Especifique ambiente, período, lentes e enquadramentos.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <FileText size={24} style={{ color: '#e85d04' }} />
              <div>
                <div className="font-bold text-sm">Breakdown de Roteiro em PDF</div>
                <div className="text-xs text-muted">Suba o roteiro em PDF, grife trechos importantes e classifique com tags (Arte, Figurino, Elenco). Converta tags em tarefas com 1 clique.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <MapPin size={24} style={{ color: '#ff6b6b' }} />
              <div>
                <div className="font-bold text-sm">Locações</div>
                <div className="text-xs text-muted">Cadastro de endereço, coordenadas para clima automático e upload de fotos de scouting.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <CheckSquare size={24} style={{ color: '#4cc9f0' }} />
              <div>
                <div className="font-bold text-sm">Tarefas (Checklist)</div>
                <div className="text-xs text-muted">Atribua afazeres específicos para cada departamento. Nunca mais esqueça o gelo ou os rádios!</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Sparkles size={24} className="text-success" />
              <div>
                <div className="font-bold text-sm">Ordem do Dia com IA (Google Gemini)</div>
                <div className="text-xs text-muted">Geração automática da OD puxando cenas programadas, horários, clima e roteiro formatados para impressão ou PDF.</div>
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
