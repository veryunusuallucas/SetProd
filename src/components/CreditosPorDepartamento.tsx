import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Trash2, Link2, Users, LayoutGrid, Wand2, UserPlus, IdCard } from 'lucide-react';
import type { Projeto, Departamento, Credito } from '../types';
import {
  DEPARTAMENTOS_PADRAO,
  criarDepartamentosPadrao,
  linhasDoDepartamento,
  salvarCredito,
  removerCredito,
  ordenarCandidatos,
  sugestoesPelaFicha,
  proximaVariante,
  normalizar,
} from '../lib/creditos';
import { CampoTexto } from './ui/CampoTexto';

const VALOR_LIVRE = '__livre__';

/**
 * Ficha de créditos organizada por departamento (padrão da indústria).
 *
 * Cada departamento traz suas funções principais — chefe primeiro, depois
 * assistentes — e permite acrescentar outras. Ao vincular um membro da equipe a
 * uma função, o cadastro dele passa a refletir aquele departamento e aquela
 * função, e o caminho de volta também vale: o que já está na ficha da pessoa
 * aparece aqui como sugestão.
 *
 * ESTA TELA É UM DOCUMENTO, E NÃO UM FORMULÁRIO
 * O que se monta aqui é a ficha técnica do filme — o que vai no papel timbrado,
 * no fim do rolo e no cadastro do edital. Por isso ela mostra a pessoa (inicial,
 * nome, DRT), e não só um campo preenchido: quem confere uma ficha técnica está
 * conferindo GENTE, e uma lista de selects idênticos não deixa conferir nada.
 */
export function CreditosPorDepartamento({ projeto }: { projeto: Projeto }) {
  const departamentos = useLiveQuery(
    () => db.departamentos.where('projeto_id').equals(projeto.id).toArray(),
    [projeto.id]
  ) || [];
  const perfis = useLiveQuery(
    () => db.perfis.where('projeto_id').equals(projeto.id).toArray(),
    [projeto.id]
  ) || [];

  // Formulário de "adicionar outra função", por departamento
  const [novaFuncao, setNovaFuncao] = useState<Record<string, string>>({});
  // Linhas em que o usuário optou por digitar um nome em vez de escolher da equipe
  const [modoLivre, setModoLivre] = useState<Set<string>>(new Set());
  const [criandoDeptos, setCriandoDeptos] = useState(false);
  const [preenchendo, setPreenchendo] = useState(false);

  /**
   * Funções que ganharam uma vaga a mais nesta sessão, por "＋ outra pessoa".
   *
   * Vive só na tela, e não no banco, porque uma vaga vazia não é informação
   * nenhuma sobre o filme — é uma intenção de meio segundo atrás. Gravá-la faria
   * a ficha técnica de todo mundo encher de linhas em branco que alguém abriu
   * sem querer.
   */
  const [vagasExtras, setVagasExtras] = useState<Record<string, number>>({});

  const creditos = projeto.creditos || [];

  // Departamentos na ordem do catálogo; os criados pelo usuário vão para o fim.
  const ordemCatalogo = (d: Departamento) => {
    const i = DEPARTAMENTOS_PADRAO.findIndex(x => normalizar(x.nome) === normalizar(d.nome));
    return i === -1 ? 999 : i;
  };
  const ordenados = [...departamentos].sort((a, b) => ordemCatalogo(a) - ordemCatalogo(b) || a.nome.localeCompare(b.nome));

  const faltamPadrao = DEPARTAMENTOS_PADRAO.some(
    p => !departamentos.some(d => normalizar(d.nome) === normalizar(p.nome))
  );

  const gerarPadrao = async () => {
    setCriandoDeptos(true);
    try {
      const criados = await criarDepartamentosPadrao(projeto.id);
      if (criados === 0) alert('Todos os departamentos padrão já existem neste projeto.');
    } finally {
      setCriandoDeptos(false);
    }
  };

  /*
    O QUE A FICHA JÁ SABE.

    Quem preencheu a função de cada pessoa ao montar a equipe chegava aqui e via
    tudo em "— vazio —", tendo que dizer de novo o que já tinha dito. A regra de
    quando dá para adivinhar (e quando não dá) mora em `lib/creditos.ts`; aqui
    ela só é mostrada e aplicada.
  */
  const sugestoes = sugestoesPelaFicha(departamentos, perfis, creditos);
  const sugestaoDe = new Map(sugestoes.map(s => [s.chave, s]));

  const preencherPelasFichas = async () => {
    setPreenchendo(true);
    try {
      // Uma por vez, relendo o projeto: `salvarCredito` devolve a lista inteira
      // de créditos, então duas em paralelo se sobrescreveriam.
      for (const s of sugestoes) {
        const atual = await db.projetos.get(projeto.id);
        if (!atual) break;
        await salvarCredito({
          projeto: atual,
          departamentoId: s.departamentoId,
          papel: s.papel,
          perfilId: s.perfil.id,
        });
      }
    } finally {
      setPreenchendo(false);
    }
  };

  const atribuir = async (
    departamentoId: string,
    papel: string,
    valor: string,
    creditoExistente?: Credito,
    chaveLinha?: string,
    variante?: string
  ) => {
    const chave = chaveLinha || `${departamentoId}::${papel}`;

    if (valor === '') {
      // Voltou para "vazio": remove o crédito, se existir
      if (creditoExistente) await removerCredito(projeto, creditoExistente.id);
      setModoLivre(s => { const n = new Set(s); n.delete(chave); return n; });
      return;
    }

    if (valor === VALOR_LIVRE) {
      setModoLivre(s => new Set(s).add(chave));
      return;
    }

    setModoLivre(s => { const n = new Set(s); n.delete(chave); return n; });
    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      perfilId: valor,
      creditoExistente,
      variante,
    });
  };

  const salvarNomeLivre = async (
    departamentoId: string,
    papel: string,
    nome: string,
    creditoExistente?: Credito,
    variante?: string
  ) => {
    if (!nome.trim()) {
      if (creditoExistente) await removerCredito(projeto, creditoExistente.id);
      return;
    }
    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      nomeLivre: nome,
      creditoExistente,
      sincronizarPerfil: false,
      variante,
    });
  };

  /** Muda só o "(B)" de um crédito, sem tocar em quem o ocupa. */
  const mudarVariante = async (credito: Credito, variante: string) => {
    await db.projetos.update(projeto.id, {
      creditos: creditos.map(c => (c.id === credito.id ? { ...c, variante: variante.trim() || undefined } : c)),
    });
  };

  /**
   * Abre uma vaga a mais na mesma função — o segundo operador de câmera.
   *
   * ⚠️ ELA MARCA O PRIMEIRO TAMBÉM. Enquanto há uma pessoa só, "Operador de
   * Câmera" basta e um "(A)" pendurado seria ruído. A partir do segundo, os dois
   * precisam de marca: uma ficha técnica com dois "Operador de Câmera" idênticos
   * não diz qual é a câmera A, e é exatamente isso que quem lê precisa saber.
   */
  const abrirVagaIrma = async (departamentoId: string, papel: string, mesmos: Credito[]) => {
    const primeiro = mesmos[0];
    if (mesmos.length === 1 && primeiro && !primeiro.variante) {
      await mudarVariante(primeiro, proximaVariante(0));
    }
    const chave = `${departamentoId}::${papel}`;
    setVagasExtras(v => ({ ...v, [chave]: (v[chave] || 0) + 1 }));
  };

  const fecharVagaIrma = (departamentoId: string, papel: string) => {
    const chave = `${departamentoId}::${papel}`;
    setVagasExtras(v => ({ ...v, [chave]: Math.max(0, (v[chave] || 0) - 1) }));
  };

  const adicionarFuncao = async (departamentoId: string) => {
    const papel = (novaFuncao[departamentoId] || '').trim();
    if (!papel) return;

    const jaExiste = creditos.some(
      c => c.departamento_id === departamentoId && normalizar(c.papel) === normalizar(papel)
    );
    if (jaExiste) {
      alert('Essa função já existe neste departamento. Use o "＋" na linha dela para pôr uma segunda pessoa.');
      return;
    }

    await salvarCredito({
      projeto,
      departamentoId,
      papel,
      nomeLivre: 'A definir',
      sincronizarPerfil: false,
    });
    setNovaFuncao({ ...novaFuncao, [departamentoId]: '' });
  };

  const selectStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--border-light)',
    backgroundColor: 'var(--bg-surface)', fontSize: '13px', minWidth: 0, width: '100%',
    color: 'var(--text-primary)',
  };

  if (departamentos.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <LayoutGrid size={40} className="text-muted" style={{ margin: '0 auto 16px' }} />
        <h3 className="font-bold mb-2">Nenhum departamento ainda</h3>
        <p className="text-sm text-secondary" style={{ marginBottom: '20px' }}>
          Os créditos são organizados por departamento. Crie os departamentos básicos do
          audiovisual para começar — depois é só preencher quem ocupa cada função.
        </p>
        <button onClick={gerarPadrao} disabled={criandoDeptos} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> {criandoDeptos ? 'Criando...' : 'Criar departamentos padrão'}
        </button>
      </div>
    );
  }

  const totalCreditados = new Set(creditos.map(c => c.perfil_id || c.nome)).size;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/*
        O CABEÇALHO DIZ O TAMANHO DA FICHA.

        "3 de 5 preenchidas" por departamento não soma a pergunta que se faz ao
        olhar uma ficha técnica: quanta gente já tem nome nela. O número grande
        aqui em cima é o que se lê primeiro, e é o que muda quando o trabalho
        anda.
      */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Users size={18} className="text-accent" style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div className="text-sm font-bold">Ficha de créditos</div>
          <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
            {totalCreditados > 0
              ? <><b style={{ color: 'var(--text-secondary)' }}>{totalCreditados} pessoa{totalCreditados > 1 ? 's' : ''}</b> em {creditos.length} {creditos.length > 1 ? 'funções' : 'função'}. Vincular alguém aqui atualiza o departamento e a função no cadastro dele.</>
              : <>Ninguém creditado ainda. Vincular alguém aqui atualiza o departamento e a função no cadastro dele.</>}
          </div>
        </div>

        {sugestoes.length > 0 && (
          <button
            onClick={preencherPelasFichas}
            disabled={preenchendo}
            className="btn-icon"
            style={{ padding: '8px 14px', border: '1px solid var(--accent)', color: 'var(--accent)', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0, width: 'auto' }}
            title="Usa o departamento e a função que estão no cadastro de cada pessoa"
          >
            <Wand2 size={14} />
            {preenchendo ? 'Preenchendo...' : `Preencher ${sugestoes.length} pela ficha`}
          </button>
        )}
        {faltamPadrao && (
          <button onClick={gerarPadrao} disabled={criandoDeptos} className="btn-icon" style={{ padding: '8px 14px', border: '1px solid var(--border-light)', gap: '6px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0, width: 'auto' }}>
            <Plus size={14} /> {criandoDeptos ? 'Criando...' : 'Completar departamentos padrão'}
          </button>
        )}
      </div>

      {ordenados.map(depto => {
        const linhas = linhasDoDepartamento(depto, creditos);
        const preenchidas = linhas.filter(l => l.credito).length;
        const candidatos = ordenarCandidatos(perfis, depto.id);
        const cor = depto.cor || 'var(--accent)';
        const fracao = linhas.length ? preenchidas / linhas.length : 0;

        /** As linhas do catálogo, com as vagas abertas na tela intercaladas. */
        const comVagas: (typeof linhas[number] & { vagaExtra?: boolean })[] = [];
        for (let i = 0; i < linhas.length; i++) {
          comVagas.push(linhas[i]);
          const proxima = linhas[i + 1];
          const ultimaDaFuncao = !proxima || normalizar(proxima.papel) !== normalizar(linhas[i].papel);
          const abertas = vagasExtras[`${depto.id}::${linhas[i].papel}`] || 0;
          if (linhas[i].doCatalogo && ultimaDaFuncao && abertas > 0) {
            for (let n = 0; n < abertas; n++) {
              comVagas.push({
                ...linhas[i],
                chave: `${depto.id}::${linhas[i].papel}::vaga${n}`,
                credito: undefined,
                vagaExtra: true,
              });
            }
          }
        }

        return (
          <div key={depto.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: `4px solid ${cor}`, padding: '16px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h3 className="font-bold" style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: cor }} />
                {depto.nome}
              </h3>
              {/*
                A barra em vez do texto sozinho: numa página com doze
                departamentos, "3 de 5" doze vezes é aritmética; a barra deixa
                ver de longe qual está vazio e qual está fechado.
              */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '72px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-light)', overflow: 'hidden' }}>
                  <div style={{ width: `${fracao * 100}%`, height: '100%', backgroundColor: cor, transition: 'width .25s ease' }} />
                </div>
                <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {preenchidas} de {linhas.length}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {comVagas.map((linha, idx) => {
                const credito = linha.credito;
                const ehChefe = linha.doCatalogo && idx === 0;
                const livre = modoLivre.has(linha.chave) || (!!credito && !credito.perfil_id);
                const perfil = credito?.perfil_id ? perfis.find(p => p.id === credito.perfil_id) : undefined;
                const sugestao = !credito ? sugestaoDe.get(linha.chave) : undefined;

                /** Os outros que ocupam esta mesma função — quem decide se há variante. */
                const mesmos = creditos.filter(
                  c => c.departamento_id === depto.id && normalizar(c.papel) === normalizar(linha.papel)
                );
                const temIrmas = mesmos.length > 1 || linha.vagaExtra || Boolean(credito?.variante);

                return (
                  <div
                    key={linha.chave}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(150px, 1fr) minmax(180px, 1.3fr) auto',
                      gap: '10px',
                      alignItems: 'center',
                      padding: '9px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '10px',
                      // Só quem está preenchido recebe a cor do departamento na
                      // borda: o olho corre pela coluna e vê o que falta.
                      border: '1px solid var(--border-light)',
                      borderLeft: `3px solid ${credito ? cor : 'transparent'}`,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {linha.papel}
                        {ehChefe && (
                          <span className="text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '1px 8px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                            chefia
                          </span>
                        )}
                        {/*
                          A VARIANTE, editável na própria tira.

                          Ela só aparece quando existe mais de uma pessoa na
                          função — antes disso não há o que distinguir. Vem com
                          a letra já escrita (A, B, C, que é como o set nomeia
                          câmera desde sempre), e é campo de texto porque em
                          muita produção a distinção é outra: "principal",
                          "2ª unidade", "complementar".
                        */}
                        {temIrmas && credito && (
                          <CampoTexto
                            value={credito.variante || ''}
                            aoGravar={v => mudarVariante(credito, v)}
                            placeholder="A / B"
                            title="O que distingue esta pessoa da outra na mesma função"
                            style={{
                              width: '86px', padding: '1px 8px', fontSize: '11px', fontWeight: 'bold',
                              borderRadius: '10px', border: `1px solid ${cor}`, backgroundColor: 'transparent',
                              color: cor, textAlign: 'center',
                            }}
                          />
                        )}
                      </div>

                      {/* Quem ocupa: a linha de baixo é a que informa. */}
                      {perfil ? (
                        <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                          <Link2 size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          <span style={{ color: 'var(--accent)' }}>na equipe</span>
                          {perfil.drt && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} title="DRT — o registro profissional, que a ficha técnica costuma exigir">
                              <IdCard size={11} /> {perfil.drt}
                            </span>
                          )}
                        </div>
                      ) : credito ? (
                        <div className="text-xs text-muted">nome avulso — não está na equipe</div>
                      ) : sugestao ? (
                        /*
                          A sugestão aparece NA LINHA, e não só no botão de cima.
                          O botão preenche tudo; esta linha diz de onde a resposta
                          saiu, e deixa aceitar uma só.
                        */
                        <button
                          onClick={() => atribuir(depto.id, linha.papel, sugestao.perfil.id, undefined, linha.chave)}
                          className="text-xs"
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', color: 'var(--text-muted)', textAlign: 'left' }}
                          title="Está assim no cadastro desta pessoa"
                        >
                          <Wand2 size={11} style={{ flexShrink: 0 }} />
                          <span>na ficha: <b style={{ color: 'var(--accent)' }}>{sugestao.perfil.nome} {sugestao.perfil.sobrenome || ''}</b></span>
                        </button>
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        {/*
                          A INICIAL, na cor do departamento.

                          Não é enfeite: numa lista de trinta funções, o nome
                          escrito dentro de um select some no meio de trinta
                          selects iguais. O disco colorido é o que faz "esta
                          função tem gente" ser visível antes de ler qualquer
                          palavra — e é desenhado aqui, sem serviço de avatar de
                          fora, porque isto é um app que precisa abrir no set sem
                          internet.
                        */}
                        <span
                          aria-hidden
                          style={{
                            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 'bold',
                            backgroundColor: credito ? `color-mix(in srgb, ${cor} 22%, transparent)` : 'var(--bg-surface)',
                            color: credito ? cor : 'var(--text-muted)',
                            border: `1px solid ${credito ? `color-mix(in srgb, ${cor} 45%, transparent)` : 'var(--border-light)'}`,
                          }}
                        >
                          {credito ? iniciais(credito.nome) : <UserPlus size={12} style={{ opacity: 0.5 }} />}
                        </span>

                        <select
                          value={credito?.perfil_id || (livre ? VALOR_LIVRE : '')}
                          onChange={async e => {
                            const valor = e.target.value;
                            await atribuir(depto.id, linha.papel, valor, credito, linha.chave,
                              // Vaga aberta agora: já entra com a letra da vez.
                              linha.vagaExtra ? proximaVariante(mesmos.length) : undefined);
                            /*
                              A vaga cumpriu o papel dela e sai.

                              Sem isto a linha vazia continuava embaixo do crédito
                              recém-criado, e o departamento passava a mostrar um
                              "Operador de Câmera" vago que ninguém tinha pedido.
                              `VALOR_LIVRE` não fecha: ali a vaga ainda está
                              esperando o nome ser digitado.
                            */
                            if (linha.vagaExtra && valor && valor !== VALOR_LIVRE) {
                              fecharVagaIrma(depto.id, linha.papel);
                            }
                          }}
                          style={selectStyle}
                        >
                          <option value="">— vazio —</option>
                          {candidatos.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nome} {p.sobrenome || ''}
                              {p.departamento_id === depto.id ? ' ✓' : ''}
                            </option>
                          ))}
                          <option value={VALOR_LIVRE}>Outro (digitar nome)</option>
                        </select>
                      </div>

                      {livre && (
                        <input
                          defaultValue={credito?.nome === 'A definir' ? '' : credito?.nome || ''}
                          onBlur={async e => {
                            const nome = e.target.value;
                            await salvarNomeLivre(depto.id, linha.papel, nome, credito,
                              linha.vagaExtra ? proximaVariante(mesmos.length) : undefined);
                            if (linha.vagaExtra && nome.trim()) fecharVagaIrma(depto.id, linha.papel);
                          }}
                          placeholder="Nome de quem ocupa a função"
                          style={{ ...selectStyle, backgroundColor: 'var(--bg-primary)', marginLeft: '34px', width: 'auto' }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {/*
                        "＋ outra pessoa" na própria linha da função.

                        Uma produção com duas câmeras tem dois operadores, e não
                        uma função chamada "Operador de Câmera 2". O botão fica
                        aqui, colado na função de que se está falando, em vez de
                        obrigar a descer até a caixa de acrescentar e digitar o
                        nome da função de novo — com risco de digitar diferente e
                        criar duas funções que deviam ser uma.
                      */}
                      {linha.doCatalogo && credito && (
                        <button
                          onClick={() => abrirVagaIrma(depto.id, linha.papel, mesmos)}
                          className="btn-icon text-muted"
                          style={{ padding: '6px', border: 'none', background: 'transparent' }}
                          title={`Mais uma pessoa em ${linha.papel} — vira ${linha.papel} A e B`}
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                      {credito ? (
                        <button
                          onClick={() => removerCredito(projeto, credito.id)}
                          className="btn-icon text-muted"
                          style={{ padding: '6px', border: 'none', background: 'transparent' }}
                          title="Limpar esta função"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : linha.vagaExtra ? (
                        <button
                          onClick={() => fecharVagaIrma(depto.id, linha.papel)}
                          className="btn-icon text-muted"
                          style={{ padding: '6px', border: 'none', background: 'transparent' }}
                          title="Desistir desta vaga"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : (
                        <span style={{ width: '26px' }} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/*
              Acrescentar outra função.

              O campo e o botão viraram uma peça só — antes o "Adicionar" era um
              botão de contorno colado num campo de contorno, dois retângulos de
              peso igual disputando a mesma linha, e ele encostava na borda do
              cartão. Agora o campo é o elemento, e o botão é o fim dele: só
              acende quando há o que adicionar.
            */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                borderTop: '1px dashed var(--border-light)', paddingTop: '12px', marginTop: '2px',
              }}
            >
              <div
                style={{
                  display: 'flex', alignItems: 'center', flex: 1, minWidth: 0,
                  backgroundColor: 'var(--bg-primary)', borderRadius: '10px',
                  border: '1px solid var(--border-light)', overflow: 'hidden',
                }}
              >
                <Plus size={14} className="text-muted" style={{ margin: '0 4px 0 12px', flexShrink: 0 }} />
                <input
                  value={novaFuncao[depto.id] || ''}
                  onChange={e => setNovaFuncao({ ...novaFuncao, [depto.id]: e.target.value })}
                  onKeyDown={e => { if (e.key === 'Enter') adicionarFuncao(depto.id); }}
                  placeholder={`Outra função em ${depto.nome}…`}
                  style={{
                    flex: 1, minWidth: 0, padding: '9px 4px', fontSize: '13px',
                    background: 'transparent', border: 'none', color: 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={() => adicionarFuncao(depto.id)}
                  disabled={!(novaFuncao[depto.id] || '').trim()}
                  className="text-xs font-bold"
                  style={{
                    padding: '9px 16px', border: 'none', whiteSpace: 'nowrap', alignSelf: 'stretch',
                    cursor: (novaFuncao[depto.id] || '').trim() ? 'pointer' : 'default',
                    backgroundColor: (novaFuncao[depto.id] || '').trim() ? cor : 'transparent',
                    color: (novaFuncao[depto.id] || '').trim() ? '#000' : 'var(--text-muted)',
                    opacity: (novaFuncao[depto.id] || '').trim() ? 1 : 0.45,
                    transition: 'background-color .15s ease, color .15s ease',
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "Lore Leite" → "LL". Nome de uma palavra fica com uma letra só. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] || '' : '';
  return (primeira + ultima).toUpperCase();
}
