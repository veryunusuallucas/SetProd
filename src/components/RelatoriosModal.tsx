import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Printer, Sheet, FileText, Users, CalendarDays, ListTree } from 'lucide-react';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import {
  breakdownSummary, elementList, doodHtml, shootingSchedule,
  elementListCsv, doodCsv, shootingScheduleCsv, type DadosRelatorio,
} from '../lib/relatorios';

interface Props {
  dados: DadosRelatorio;
  onFechar: () => void;
}

interface Definicao {
  chave: string;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
  html: (d: DadosRelatorio) => string;
  csv?: (d: DadosRelatorio) => string;
}

const RELATORIOS: Definicao[] = [
  {
    chave: 'schedule',
    icone: <CalendarDays size={18} />,
    titulo: 'Plano de filmagem',
    descricao: 'Cada diária com suas cenas, páginas e tempo. É o papel que vai para o set.',
    html: shootingSchedule,
    csv: shootingScheduleCsv,
  },
  {
    chave: 'dood',
    icone: <Users size={18} />,
    titulo: 'DOOD — Day Out of Days',
    descricao: 'Em que dias cada ator é necessário, com os dias de espera. Base de contrato e cachê.',
    html: doodHtml,
    csv: doodCsv,
  },
  {
    chave: 'breakdown',
    icone: <ListTree size={18} />,
    titulo: 'Breakdown por cena',
    descricao: 'O que cada cena precisa, separado por departamento.',
    html: breakdownSummary,
  },
  {
    chave: 'elementos',
    icone: <FileText size={18} />,
    titulo: 'Lista de elementos',
    descricao: 'Inventário por departamento, com em quantas cenas cada item aparece.',
    html: elementList,
    csv: elementListCsv,
  },
];

/**
 * Escolha de relatório.
 *
 * São documentos com leitores diferentes — o DOOD vai para contrato, o plano de
 * filmagem vai para o set —, então cada um sai sozinho em vez de tudo grudado
 * num arquivo só, como era antes.
 */
export function RelatoriosModal({ dados, onFechar }: Props) {
  const [gerando, setGerando] = useState<string | null>(null);

  const semDados = dados.cenas.length === 0;

  const gerar = (def: Definicao, formato: 'pdf' | 'csv') => {
    setGerando(def.chave + formato);
    try {
      if (formato === 'csv') {
        const conteudo = def.csv!(dados);
        const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${def.chave}-${dados.tituloProjeto || 'projeto'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const html = montarPaginaRelatorio(def.titulo, def.html(dados));
        if (!imprimirHtml(html)) baixarHtml(html, def.chave);
      }
    } finally {
      setTimeout(() => setGerando(null), 600);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
        style={{
          width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="font-bold text-lg">Relatórios</h3>
            <p className="text-xs text-muted">Saem do que já está decupado — nunca ficam desatualizados.</p>
          </div>
          <button onClick={onFechar} className="btn-icon"><X size={18} /></button>
        </div>

        {semDados && (
          <div className="text-sm text-muted" style={{ padding: '8px 0' }}>
            Nenhuma cena ainda. Envie o roteiro na aba <strong>Roteiro</strong> primeiro.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {RELATORIOS.map(def => (
            <div
              key={def.chave}
              style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 14px',
                border: '1px solid var(--border-light)', borderRadius: '10px',
                opacity: semDados ? 0.5 : 1,
              }}
            >
              <span className="text-accent" style={{ marginTop: '2px' }}>{def.icone}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="text-sm font-bold">{def.titulo}</div>
                <div className="text-xs text-muted" style={{ marginTop: '2px' }}>{def.descricao}</div>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => gerar(def, 'pdf')}
                  disabled={semDados}
                  className="btn-chip"
                  title="Abre a impressão — escolha 'Salvar como PDF'"
                >
                  <Printer size={13} /> {gerando === def.chave + 'pdf' ? '...' : 'PDF'}
                </button>
                {def.csv && (
                  <button
                    onClick={() => gerar(def, 'csv')}
                    disabled={semDados}
                    className="btn-chip"
                    title="Baixa uma planilha (abre no Excel)"
                  >
                    <Sheet size={13} /> {gerando === def.chave + 'csv' ? '...' : 'CSV'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
