import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import {
  Database, FileText, FileSpreadsheet, FileJson, Archive, ShieldAlert,
  CheckSquare, Square, Printer, X, AlertTriangle, ShieldCheck, Upload
} from 'lucide-react';
import { montarBackup, lerBackup, restaurarBackup, pesoDoBackup, nomeDoArquivo } from '../lib/backup';
import { formatarTamanho } from '../lib/documentos';
import { AIButton } from '../components/ui/AIButton';
import { AIThinking } from '../components/ui/ia';
import {
  CONJUNTOS, tabelaParaCSV, tabelaParaTXT, baixarArquivo, nomeSeguro,
  type Tabela
} from '../lib/exportacao';
import { useRole } from '../hooks/useRole';
import { diagramarRelatorio } from '../lib/gemini';
import { imprimirHtml, baixarHtml, montarPaginaRelatorio } from '../lib/impressao';
import { confirmar } from '../components/ui/Confirmacao';

type Grupo = (typeof CONJUNTOS)[number]['grupo'];
const ORDEM_GRUPOS: Grupo[] = ['Produção', 'Financeiro', 'Set', 'Criativo', 'Logística'];

export function GestaoDados() {
  const { id: projetoId } = useParams<{ id: string }>();
  const projeto = useLiveQuery(
    () => (projetoId ? db.projetos.get(projetoId) : undefined),
    [projetoId]
  );

  /**
   * Quem pode tirar CPF, banco e ficha médica do app.
   *
   * `gerir_membros` e não uma ação nova: exportar dado pessoal da equipe é do
   * mesmo nível de confiança que administrar quem entra e quem sai.
   */
  const { podeAqui } = useRole();
  const podeVerFichaCompleta = podeAqui('gerir_membros');

  const [selecionados, setSelecionados] = useState<Set<string>>(
    () => new Set(CONJUNTOS.filter(c => !c.sensivel).map(c => c.id))
  );

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  // ---- Backup ----
  const [peso, setPeso] = useState<{ dados: number; anexos: number; total: number; quantidadeDeAnexos: number } | null>(null);
  const [arquivoParaRestaurar, setArquivoParaRestaurar] = useState<File | null>(null);
  const [avisoRestauracao, setAvisoRestauracao] = useState('');

  // O peso é calculado ao abrir a tela: saber que o arquivo vai ter 60 MB só
  // quando o navegador engasga é frustrante.
  useEffect(() => {
    if (projetoId) pesoDoBackup(projetoId).then(setPeso).catch(() => setPeso(null));
  }, [projetoId]);

  // Relatório com IA
  const [instrucoes, setInstrucoes] = useState('');
  const [htmlGerado, setHtmlGerado] = useState('');

  const alternar = (id: string) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  };

  // "Marcar todos" respeita o bloqueio: senão ele seria a porta dos fundos que
  // devolve o conjunto sensível a quem a caixinha não deixa marcar.
  const marcarTodos = () => setSelecionados(new Set(
    CONJUNTOS.filter(c => !c.sensivel || podeVerFichaCompleta).map(c => c.id)
  ));
  const limparTodos = () => setSelecionados(new Set());

  const escolhidos = CONJUNTOS.filter(c => selecionados.has(c.id));

  /**
   * Está tudo o que dá para marcar já marcado?
   *
   * Conta só o que a pessoa PODE escolher: quem não administra nunca alcança os
   * conjuntos sensíveis, e comparar com o total faria o botão nunca virar
   * Limpar para ela.
   */
  const selecionaveis = CONJUNTOS.filter(c => !c.sensivel || podeVerFichaCompleta);
  const tudoMarcado = selecionaveis.length > 0 && selecionaveis.every(c => selecionados.has(c.id));
  const temSensivel = escolhidos.some(c => c.sensivel);

  /** Carrega as tabelas dos conjuntos escolhidos, na ordem em que aparecem na tela. */
  const carregarEscolhidos = async (): Promise<{ nome: string; tabela: Tabela; id: string }[]> => {
    const resultado = [];
    for (const c of escolhidos) {
      resultado.push({ id: c.id, nome: c.nome, tabela: await c.carregar(projetoId!) });
    }
    return resultado;
  };

  const exigirSelecao = () => {
    if (escolhidos.length === 0) {
      setErro('Escolha pelo menos um conjunto de dados.');
      return false;
    }
    setErro('');
    return true;
  };

  const exportarTXT = async () => {
    if (!exigirSelecao()) return;
    setOcupado('txt');
    try {
      const dados = await carregarEscolhidos();
      const cabecalho = [
        `RELATÓRIO — ${projeto?.nome || 'Produção'}`,
        `Gerado em ${new Date().toLocaleString('pt-BR')}`,
        '',
      ].join('\n');

      const corpo = dados.map(d => tabelaParaTXT(d.nome, d.tabela)).join('\n');
      baixarArquivo(`${nomeSeguro(projeto?.nome || 'projeto')}_dados.txt`, `${cabecalho}\n${corpo}`, 'text/plain;charset=utf-8');
    } catch (e: any) {
      setErro('Erro ao exportar: ' + (e?.message || e));
    } finally {
      setOcupado(null);
    }
  };

  const exportarCSV = async () => {
    if (!exigirSelecao()) return;
    setOcupado('csv');
    try {
      const dados = await carregarEscolhidos();
      const base = nomeSeguro(projeto?.nome || 'projeto');
      // Um arquivo por conjunto: CSV com várias tabelas juntas não abre direito no Excel.
      dados.forEach((d, i) => {
        setTimeout(() => {
          baixarArquivo(`${base}_${nomeSeguro(d.nome)}.csv`, tabelaParaCSV(d.tabela), 'text/csv;charset=utf-8');
        }, i * 350);
      });
    } catch (e: any) {
      setErro('Erro ao exportar: ' + (e?.message || e));
    } finally {
      setOcupado(null);
    }
  };

  /**
   * Backup completo, com anexos.
   *
   * A versão anterior listava 16 tabelas à mão e esquecia justamente as que
   * doem: roteiro, elementos, stripboard, configurações. E não levava nenhum
   * arquivo — restaurar daria uma produção sem o roteiro dentro.
   */
  const baixarBackup = async (comAnexos: boolean) => {
    setOcupado('json');
    setErro('');
    try {
      const backup = await montarBackup(projetoId!, { incluirAnexos: comAnexos });
      baixarArquivo(
        nomeDoArquivo(projeto?.nome || 'producao'),
        JSON.stringify(backup),
        'application/json'
      );
    } catch (e: any) {
      setErro('Erro ao gerar o backup: ' + (e?.message || e));
    } finally {
      setOcupado(null);
    }
  };

  const restaurar = async (arquivo: File, substituir: boolean) => {
    setOcupado('restaurar');
    setErro('');
    try {
      const backup = lerBackup(await arquivo.text());
      const r = await restaurarBackup(backup, { substituir });
      setAvisoRestauracao(
        `"${backup.nome_projeto}" restaurada: ${r.linhas} registros` +
        (r.anexos ? ` e ${r.anexos} anexo(s)` : '') +
        (r.substituiu ? ' — substituindo o que estava aqui.' : '.')
      );
      setArquivoParaRestaurar(null);
    } catch (e: any) {
      setErro(e?.message || String(e));
      // Guarda o arquivo: se o erro foi "já existe", a tela oferece substituir
      // sem obrigar a pessoa a escolher o arquivo de novo.
      if (/já existe/i.test(e?.message || '')) setArquivoParaRestaurar(arquivo);
    } finally {
      setOcupado(null);
    }
  };

  const exportarComIA = async () => {
    if (!exigirSelecao()) return;
    setOcupado('ia');
    setErro('');
    try {
      const dados = await carregarEscolhidos();
      const blocos = dados.map(d => ({
        titulo: d.nome,
        conteudo: tabelaParaTXT(d.nome, d.tabela),
      }));

      const html = await diagramarRelatorio({
        tituloProjeto: projeto?.nome || 'Produção',
        instrucoes,
        blocos,
      });
      setHtmlGerado(html);
    } catch (e: any) {
      setErro('Erro na IA: ' + (e?.message || e));
    } finally {
      setOcupado(null);
    }
  };

  const imprimirRelatorio = () => {
    const html = montarPaginaRelatorio(`Relatório — ${projeto?.nome || 'Produção'}`, htmlGerado);
    if (!imprimirHtml(html)) baixarHtml(html, `relatorio-${projeto?.nome || 'producao'}`);
  };

  const arquivarFinanceiro = async () => {
    const ok = await confirmar({
      titulo: 'Arquivar apaga TODAS as despesas e acertos deste projeto.',
      detalhe: 'O projeto e a equipe são mantidos. Exporte os dados antes — isto não tem volta.',
      confirmar: 'Arquivar mesmo assim',
      perigo: true,
    });
    if (!ok) return;

    await db.despesas.where('projeto_id').equals(projetoId!).delete();
    await db.acertos.where('projeto_id').equals(projetoId!).delete();
    alert('Financeiro arquivado. Despesas e acertos foram apagados.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>

      <div>
        <h1 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={22} /> Gestão de Dados
        </h1>
        <p className="text-sm text-secondary">
          Escolha o que exportar e em qual formato. Tudo sai do banco local — nada é enviado para fora,
          exceto quando você pedir o relatório com IA.
        </p>
      </div>

      {/* Seleção do que exportar */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 className="text-lg font-bold">O que exportar</h3>
            <p className="text-xs text-muted">{escolhidos.length} de {CONJUNTOS.length} conjuntos selecionados</p>
          </div>
          {/*
            UM BOTÃO QUE ALTERNA, no lugar de "Tudo" e "Limpar" lado a lado.

            Eram dois retângulos apertados no canto, e um deles estava sempre
            errado: com 14 de 15 marcados, "Tudo" quase não faz nada e "Limpar"
            é a ação óbvia. Deixar as duas ali obriga a pessoa a decidir o que a
            própria tela já sabe.

            E eram `.btn-icon` com texto dentro — a classe é 40x40 fixo, e o
            próprio CSS avisa contra isso. `.btn-chip` é a que aceita rótulo.
          */}
          <button
            onClick={tudoMarcado ? limparTodos : marcarTodos}
            className="btn-chip"
          >
            {tudoMarcado ? <><Square size={14} /> Limpar seleção</> : <><CheckSquare size={14} /> Selecionar tudo</>}
          </button>
        </div>

        {ORDEM_GRUPOS.map(grupo => {
          const doGrupo = CONJUNTOS.filter(c => c.grupo === grupo);
          if (doGrupo.length === 0) return null;

          return (
            <div key={grupo} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                {grupo}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '8px' }}>
                {doGrupo.map(c => {
                  const marcado = selecionados.has(c.id);
                  /*
                    Filtrar a ficha na tela e liberar tudo no CSV não protege
                    nada — o conjunto "Equipe (ficha completa)" leva CPF, banco
                    e saúde de todo mundo num arquivo que sai do app e vira
                    anexo de WhatsApp. Só quem administra a produção exporta.
                  */
                  const bloqueado = Boolean(c.sensivel) && !podeVerFichaCompleta;
                  return (
                    <label
                      key={c.id}
                      title={bloqueado ? 'Só quem é dono ou administra a produção pode exportar dados pessoais.' : undefined}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px',
                        borderRadius: '8px', cursor: bloqueado ? 'not-allowed' : 'pointer',
                        opacity: bloqueado ? 0.5 : 1,
                        backgroundColor: marcado ? 'var(--bg-active)' : 'var(--bg-primary)',
                        border: `1px solid ${marcado ? 'var(--accent)' : 'var(--border-light)'}`,
                        transition: 'background-color 0.15s, border-color 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={bloqueado}
                        onChange={() => alternar(c.id)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--accent)', marginTop: '2px' }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {c.nome}
                          {c.sensivel && <ShieldAlert size={13} className="text-warning" />}
                        </div>
                        <div className="text-xs text-muted">
                          {bloqueado
                            ? 'Só quem administra a produção pode exportar isto.'
                            : c.descricao}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {temSensivel && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(255,193,7,0.08)', border: '1px solid var(--color-warning)' }}>
            <ShieldAlert size={18} className="text-warning" />
            <span className="text-xs">
              A seleção inclui dados pessoais sensíveis (CPF, conta bancária, informações de saúde).
              Cuidado com quem recebe esse arquivo.
            </span>
          </div>
        )}
      </div>

      {erro && (
        <div className="card" style={{ borderColor: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={18} className="text-danger" />
          <span className="text-sm text-danger">{erro}</span>
        </div>
      )}

      {/* Formatos */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="text-lg font-bold">Formato</h3>
          <p className="text-xs text-muted">TXT gera um relatório único e legível. CSV gera uma planilha por conjunto.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <button
            onClick={exportarTXT}
            disabled={ocupado !== null}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            <FileText size={16} /> {ocupado === 'txt' ? 'Gerando...' : 'Exportar TXT'}
          </button>

          <button
            onClick={exportarCSV}
            disabled={ocupado !== null}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          >
            <FileSpreadsheet size={16} /> {ocupado === 'csv' ? 'Gerando...' : `Exportar CSV (${escolhidos.length})`}
          </button>

        </div>
      </div>

      {/* ---- Backup completo ---- */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={18} /> Backup da produção
          </h3>
          <p className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            Um arquivo com <strong>tudo</strong> desta produção, para guardar fora do app — no Drive,
            no computador, onde você quiser. É a rede de segurança para quando algo dá errado:
            alguém apaga sem querer, ou o servidor sai do ar.
          </p>
        </div>

        {peso && (
          <div className="text-xs text-muted" style={{ padding: '10px 12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            Com anexos: <strong>~{formatarTamanho(peso.total)}</strong>
            {peso.quantidadeDeAnexos > 0 && <> ({peso.quantidadeDeAnexos} arquivo(s))</>}.
            {' '}Sem anexos: <strong>~{formatarTamanho(peso.dados) || '0 B'}</strong>.
          </div>
        )}

        <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <button
            onClick={() => baixarBackup(true)}
            disabled={ocupado !== null}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <FileJson size={16} /> {ocupado === 'json' ? 'Montando...' : 'Backup completo'}
          </button>

          <button
            onClick={() => baixarBackup(false)}
            disabled={ocupado !== null}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            title="Bem menor, mas sem roteiro, comprovantes nem storyboard"
          >
            <FileJson size={16} /> Só os dados (sem anexos)
          </button>
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
          <h4 className="font-bold text-sm" style={{ marginBottom: '6px' }}>Restaurar de um backup</h4>
          <p className="text-xs text-muted" style={{ lineHeight: 1.5, marginBottom: '10px' }}>
            Traz a produção de volta a partir de um arquivo. Se ela já existir aqui, o app pergunta
            antes — restaurar por cima substitui o que está no lugar,{' '}
            <strong>inclusive para a outra equipe</strong>.
          </p>

          <label className="btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <Upload size={16} /> {ocupado === 'restaurar' ? 'Restaurando...' : 'Escolher arquivo'}
            <input
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              disabled={ocupado !== null}
              onChange={e => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) restaurar(f, false);
              }}
            />
          </label>

          {arquivoParaRestaurar && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-danger)', backgroundColor: 'rgba(220,38,38,0.06)' }}>
              <p className="text-xs" style={{ lineHeight: 1.5, marginBottom: '10px' }}>
                Esta produção já existe aqui. Substituir apaga o estado atual e coloca o do backup —
                e, como o conteúdo restaurado é mais recente, ele vence e chega na outra equipe.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => restaurar(arquivoParaRestaurar, true)}
                  className="btn-primary"
                  style={{ backgroundColor: 'var(--color-danger)', border: 'none', color: '#fff' }}
                >
                  Substituir mesmo assim
                </button>
                <button onClick={() => { setArquivoParaRestaurar(null); setErro(''); }} className="btn">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {avisoRestauracao && (
            <p className="text-xs" style={{ marginTop: '10px', color: 'var(--color-success, #4ade80)' }}>
              {avisoRestauracao}
            </p>
          )}
        </div>
      </div>

      {/* Relatório com IA */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="text-lg font-bold">Relatório diagramado com IA</h3>
          <p className="text-xs text-muted">
            A IA recebe os dados já apurados e só cuida da apresentação — ela não pode alterar
            nenhum número, nome ou data. Revise antes de imprimir.
          </p>
        </div>

        <div>
          <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
            Como você quer o relatório? (opcional)
          </label>
          <textarea
            rows={2}
            value={instrucoes}
            onChange={e => setInstrucoes(e.target.value)}
            placeholder="Ex: relatório de prestação de contas para o edital, com destaque para o total por departamento"
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <AIButton onClick={exportarComIA} loading={ocupado === 'ia'} loadingText="Diagramando...">
            Gerar relatório com IA
          </AIButton>
          {htmlGerado && (
            <button onClick={imprimirRelatorio} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Printer size={16} /> Imprimir / Salvar PDF
            </button>
          )}
        </div>

        {ocupado === 'ia' && (
          <div style={{ marginTop: '16px' }}>
            <AIThinking texto={`Diagramando ${escolhidos.length} conjunto(s) de dados...`} />
          </div>
        )}
      </div>

      {/* Arquivamento */}
      <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
        <h3 className="text-lg font-bold" style={{ marginBottom: '8px' }}>Arquivar financeiro</h3>
        <p className="text-xs text-secondary" style={{ marginBottom: '16px' }}>
          Apaga despesas e acertos, mantendo projeto e equipe. Use no fim de uma temporada,
          e só depois de exportar.
        </p>
        <button
          onClick={arquivarFinanceiro}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: 'var(--color-warning)', border: 'none', color: '#000' }}
        >
          <Archive size={16} /> Arquivar Despesas e Acertos
        </button>
      </div>

      {/* Pré-visualização do relatório da IA */}
      {htmlGerado && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '900px', height: '90vh', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-primary)' }}>
              <div>
                <h3 className="font-bold">Relatório gerado</h3>
                <p className="text-xs text-muted">Confira os números antes de imprimir. Você pode editar o texto clicando nele.</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={imprimirRelatorio} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Printer size={16} /> Imprimir
                </button>
                <button onClick={() => setHtmlGerado('')} className="btn-icon"><X size={20} /></button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: 'var(--bg-primary)' }}>
              <div
                contentEditable
                suppressContentEditableWarning
                style={{ backgroundColor: '#fff', color: '#000', padding: '40px', borderRadius: '8px', minHeight: '100%' }}
                dangerouslySetInnerHTML={{ __html: htmlGerado }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
