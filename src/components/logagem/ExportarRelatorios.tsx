import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { FileDown, FileText, ShieldCheck, Files, Table, ChevronDown, Check, Loader2, AlertTriangle } from 'lucide-react';
import { db } from '../../db/db';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { CampoTexto } from '../ui/CampoTexto';
import { Abre, Campo, MONO, Rotulo, Segmentado, estiloCampo } from './pecas';
import {
  COLUNAS_DO_REPORT, claqueteNoFormato, lembrarOpcoesDoReport, lerOpcoesDoReport,
  type ColunaDoReport, type OpcoesDoReport, type TipoDeRelatorio,
} from '../../lib/logagem/relatorio';
import {
  arquivarRelatorio, coletarRelatorio, csvDaLogagem, gerarPdfDaLogagem, nomeDoRelatorio,
} from '../../lib/logagem/exportar';
import { baixar } from '../../lib/od/exportar';

type Saida = TipoDeRelatorio | 'csv';

const SAIDAS: { id: Saida; nome: string; explica: string; icone: typeof FileText }[] = [
  { id: 'camera', nome: 'Camera report', explica: 'PDF com os takes do dia', icone: FileText },
  { id: 'integridade', nome: 'Integridade', explica: 'PDF dos cartões, HDs e checksums', icone: ShieldCheck },
  { id: 'consolidado', nome: 'Os dois juntos', explica: 'um PDF só, para a montagem', icone: Files },
  { id: 'csv', nome: 'Planilha', explica: 'CSV com as 43 colunas do Lumavi', icone: Table },
];

/**
 * "Relatórios da diária": o que sai da Logagem para a montagem e para o
 * arquivo da produção.
 *
 * Um toque gera, GUARDA em Documentos → Camera Reports e entrega o arquivo.
 * Guardar vem antes de entregar pelo mesmo motivo da OD: a segunda cópia sai
 * de lá, sem gerar de novo.
 *
 * Quem só acompanha também exporta — a produção quer o PDF tanto quanto a
 * Fotografia —, mas o arquivo só vai para Documentos quando quem exporta pode
 * escrever na Logagem. Senão cada curioso encheria a pasta de cópias.
 */
export function ExportarRelatorios({ diariaId, podeEditar }: { diariaId: string; podeEditar: boolean }) {
  const reduzido = useMovimentoReduzido();
  const [opcoes, setOpcoes] = useState<OpcoesDoReport>(lerOpcoesDoReport);
  const [ajustes, setAjustes] = useState(false);
  const [fazendo, setFazendo] = useState<Saida | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  const quantos = useLiveQuery(async () => {
    const [takes, cartoes] = await Promise.all([
      db.log_takes.where('diaria_id').equals(diariaId).count(),
      db.log_backups.where('diaria_id').equals(diariaId).count(),
    ]);
    return { takes, cartoes };
  }, [diariaId]);

  /*
    Sempre a partir do valor MAIS NOVO. Partindo do `opcoes` desta renderização,
    dois toques antes de a tela redesenhar (o formato da claquete e depois uma
    coluna) faziam o segundo apagar o primeiro.
  */
  const mudarOpcoes = (m: Partial<OpcoesDoReport>) => setOpcoes(atual => ({ ...atual, ...m }));
  useEffect(() => { lembrarOpcoesDoReport(opcoes); }, [opcoes]);

  const alternarColuna = (id: ColunaDoReport) => setOpcoes(atual => {
    const tem = atual.colunas.includes(id);
    // A última coluna não sai: uma tabela sem colunas é uma página em branco.
    if (tem && atual.colunas.length === 1) return atual;
    const colunas = COLUNAS_DO_REPORT.map(c => c.id).filter(c => (c === id ? !tem : atual.colunas.includes(c)));
    return { ...atual, colunas };
  });

  const semNada = (quantos?.takes ?? 0) === 0 && (quantos?.cartoes ?? 0) === 0;
  const indisponivel = (s: Saida) =>
    !quantos || (s === 'csv' ? quantos.takes === 0 : s === 'camera' ? quantos.takes === 0 : semNada);

  const exportar = async (saida: Saida) => {
    if (fazendo) return;
    setFazendo(saida);
    setAviso(null);
    try {
      const precisaFotos = saida !== 'csv' && saida !== 'integridade' && opcoes.colunas.includes('foto');
      const dados = await coletarRelatorio(diariaId, {
        fotos: precisaFotos,
        comprovantes: saida === 'integridade' || saida === 'consolidado',
      });
      if (!dados) throw new Error('A diária não foi encontrada neste aparelho.');

      const blob = saida === 'csv' ? csvDaLogagem(dados) : await gerarPdfDaLogagem(saida, dados, opcoes);
      const nome = nomeDoRelatorio(saida, dados);

      let guardado = false;
      if (podeEditar) {
        try {
          await arquivarRelatorio({ tipo: saida, dados, blob, nomeArquivo: nome });
          guardado = true;
        } catch (e) {
          // Não guardar não impede de entregar: no set, o arquivo na mão vale mais.
          console.warn('[SetProd] Não consegui guardar o relatório em Documentos:', e);
        }
      }
      baixar(blob, nome);

      setAviso({
        tipo: 'ok',
        texto: guardado
          ? `${nome} baixado e guardado em Documentos → Camera Reports.`
          : podeEditar
            ? `${nome} baixado. Não consegui guardar uma cópia em Documentos.`
            : `${nome} baixado.`,
      });
    } catch (e) {
      console.error('[SetProd] Falha ao exportar a Logagem:', e);
      setAviso({ tipo: 'erro', texto: e instanceof Error && e.message ? `Não saiu: ${e.message}` : 'Não saiu. Tente de novo.' });
    } finally {
      setFazendo(null);
    }
  };

  const exemplo = claqueteNoFormato({ cena: '12', plano: 'B', take: 3, status: 'OK' }, opcoes);

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '22px' }}>
      <Rotulo icone={<FileDown size={14} />}>Relatórios da diária</Rotulo>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        {SAIDAS.map(s => {
          const Icone = s.icone;
          const agora = fazendo === s.id;
          const desligado = Boolean(fazendo) || indisponivel(s.id);
          return (
            <BotaoTatil
              key={s.id}
              onClick={() => void exportar(s.id)}
              disabled={desligado}
              escala={0.97}
              aria-busy={agora}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', minHeight: '60px', padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', textAlign: 'left',
                cursor: desligado ? 'default' : 'pointer', opacity: desligado && !agora ? 0.5 : 1,
              }}
            >
              <span style={{ display: 'flex', color: 'var(--cor-criativo)', flexShrink: 0 }}>
                {agora ? <Loader2 size={20} className="girando" /> : <Icone size={20} />}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                <span className="text-sm font-bold">{agora ? 'Gerando…' : s.nome}</span>
                <span className="text-xs text-muted">{s.explica}</span>
              </span>
            </BotaoTatil>
          );
        })}
      </div>

      {quantos && semNada && (
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Ainda não há take nem cartão nesta diária. Os botões acendem quando houver.
        </p>
      )}

      {aviso && (
        <p
          role="status"
          className="text-sm"
          style={{
            margin: 0, display: 'flex', alignItems: 'flex-start', gap: '8px', overflowWrap: 'anywhere',
            color: aviso.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {aviso.tipo === 'ok' ? <Check size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
          {aviso.texto}
        </p>
      )}

      <BotaoTatil
        onClick={() => setAjustes(v => !v)}
        aria-expanded={ajustes}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 4px',
          border: 'none', background: 'none', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600,
          cursor: 'pointer', alignSelf: 'flex-start',
        }}
      >
        Como o camera report sai
        <motion.span animate={{ rotate: ajustes ? 180 : 0 }} transition={reduzido ? { duration: 0 } : MOLA} style={{ display: 'flex' }}>
          <ChevronDown size={16} />
        </motion.span>
      </BotaoTatil>

      <Abre aberto={ajustes}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '4px' }}>
          <Campo rotulo="Claquete">
            <Segmentado
              nome="relatorio-claquete"
              opcoes={[
                { id: 'traco', nome: '12-B / Tk3' },
                { id: 'compacto', nome: 'C12PBT3' },
                { id: 'modelo', nome: 'Modelo' },
              ]}
              valor={opcoes.claquete}
              bloqueado={false}
              aoMudar={v => mudarOpcoes({ claquete: v as OpcoesDoReport['claquete'] })}
            />
            {opcoes.claquete === 'modelo' && (
              <>
                <CampoTexto
                  value={opcoes.modelo}
                  aoGravar={v => mudarOpcoes({ modelo: v })}
                  placeholder="{cena}-{plano} / Tk{take}"
                  style={{ ...estiloCampo, fontFamily: MONO }}
                />
                <span className="text-xs text-muted">
                  Use {'{cena}'}, {'{plano}'} e {'{take}'}. Fica assim: <b style={{ fontFamily: MONO }}>{exemplo}</b>
                </span>
              </>
            )}
          </Campo>

          <Campo rotulo="Separar a tabela por">
            <Segmentado
              nome="relatorio-agrupar"
              opcoes={[
                { id: 'formato', nome: 'Formato' },
                { id: 'cena', nome: 'Cena' },
                { id: 'codec', nome: 'Codec' },
              ]}
              valor={opcoes.agrupar}
              bloqueado={false}
              aoMudar={v => mudarOpcoes({ agrupar: v as OpcoesDoReport['agrupar'] })}
            />
            <span className="text-xs text-muted">
              Uma faixa cinza abre cada trecho. Em "Formato", ela diz a resolução, o codec, o fps e o ISO — e aparece de novo quando algum deles muda.
            </span>
          </Campo>

          <Campo rotulo="Colunas">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {COLUNAS_DO_REPORT.map(c => {
                const marcada = opcoes.colunas.includes(c.id);
                return (
                  <BotaoTatil
                    key={c.id}
                    role="checkbox"
                    aria-checked={marcada}
                    escala={0.96}
                    onClick={() => alternarColuna(c.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 12px',
                      borderRadius: 'var(--radius-sm)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${marcada ? 'var(--cor-criativo)' : 'var(--border-light)'}`,
                      backgroundColor: marcada ? 'color-mix(in srgb, var(--cor-criativo) 10%, transparent)' : 'var(--bg-primary)',
                      color: marcada ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {marcada && <Check size={14} />}
                    {c.rotulo}
                  </BotaoTatil>
                );
              })}
            </div>
          </Campo>

          <p className="text-xs text-muted" style={{ margin: 0 }}>
            Estas escolhas ficam neste aparelho. O relatório de integridade e a planilha saem sempre completos.
          </p>
        </div>
      </Abre>
    </section>
  );
}
