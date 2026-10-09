/**
 * A Ordem do Dia em PDF — o papel que a equipe recebe.
 *
 * ⚠️ QUEM FAZ O ARQUIVO É O APP, E NÃO O NAVEGADOR. Essa é a mudança.
 *
 * A exportação era `window.print()` dentro de um iframe: quem produzia o PDF
 * era o Chrome de quem clicou. O app nunca via o arquivo, e por isso não podia
 * guardá-lo em Documentos, nem anexá-lo no e-mail, nem devolvê-lo depois —
 * reexportar era o único jeito de ter o papel de novo. E o resultado mudava de
 * navegador para navegador: margem, quebra de página, o "about:blank" que o
 * Chrome carimba no cabeçalho.
 *
 * Aqui sai um `Blob`. O app tem o arquivo.
 *
 * O VISUAL É O DO MODELO DO SET (09/10/2026): retrato, chamada e fim do dia
 * num círculo grande, títulos em barra cinza, tabelas com grade e cabeçalho
 * cinza-claro. É o papel que a equipe já sabe ler sem procurar.
 *
 * ⚠️ O MÓDULO É PESADO (~200 KB). Importe-o com `await import(...)`, nunca no
 * topo de uma tela — ele só precisa existir no instante em que alguém exporta.
 */
import {
  Document, Image, Page, StyleSheet, Text, View, pdf,
} from '@react-pdf/renderer';
import { textoDaCelula, type Campo, type DocumentoOD, type Secao, type Tabela } from './tipos';
import { limpar } from '../pdfTexto';

const PRETO = '#111';
const CINZA = '#5c5c5c';
const BARRA = '#5f5f5f';
const CABECALHO = '#d6d6d6';
const ZEBRA = '#f2f2f2';
const FAIXA = '#e4e4e4';
const GRADE = '#9a9a9a';

const s = StyleSheet.create({
  pagina: {
    paddingTop: 20, paddingBottom: 30, paddingHorizontal: 22,
    fontFamily: 'Helvetica', fontSize: 7.5, color: PRETO,
  },

  topo: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  circulo: {
    width: 92, height: 92, borderRadius: 46, borderWidth: 1.5, borderColor: PRETO,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  circuloRotulo: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4 },
  circuloHora: { fontSize: 18, lineHeight: 1.05, marginBottom: 1 },
  logo: { width: 56, maxHeight: 40, marginBottom: 3, objectFit: 'contain' },
  producao: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'center', lineHeight: 1.1 },
  direcao: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 3 },
  chapeu: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  diaria: { fontSize: 14, textAlign: 'right' },
  meta: { fontSize: 8, color: CINZA, textAlign: 'right', marginTop: 4 },

  barra: {
    backgroundColor: BARRA, color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 7.5,
    letterSpacing: 0.6, textAlign: 'center', paddingVertical: 2.5, marginTop: 8,
  },
  barraClara: {
    backgroundColor: CABECALHO, fontFamily: 'Helvetica-Bold', fontSize: 7,
    letterSpacing: 0.5, textAlign: 'center', paddingVertical: 2,
  },
  nota: { fontSize: 6.5, color: CINZA, marginVertical: 2 },

  campoRotulo: { fontSize: 6.5, color: CINZA },
  campoValor: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  campoDetalhe: { fontSize: 6.5, color: CINZA },

  tabela: { borderWidth: 0.5, borderColor: GRADE, borderBottomWidth: 0 },
  cabecalhoTabela: { flexDirection: 'row', backgroundColor: CABECALHO, borderBottomWidth: 0.5, borderBottomColor: GRADE },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', paddingHorizontal: 3, paddingVertical: 2.5, textTransform: 'uppercase' },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: GRADE },
  celula: { paddingHorizontal: 3, paddingVertical: 2.5, borderRightWidth: 0.5, borderRightColor: GRADE, justifyContent: 'center' },
  td: { fontSize: 7.5 },
  tdDetalhe: { fontSize: 6.5, color: CINZA, marginTop: 1 },
  faixa: { backgroundColor: FAIXA, paddingVertical: 3, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: GRADE },
  faixaTexto: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  total: { flexDirection: 'row', backgroundColor: CABECALHO, borderBottomWidth: 0.5, borderBottomColor: GRADE },

  caixa: { borderWidth: 0.5, borderColor: GRADE, padding: 5 },

  deptoBarra: { backgroundColor: BARRA, paddingVertical: 2, paddingHorizontal: 4, marginBottom: 1 },
  deptoNome: { color: '#fff', fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.7 },
  pessoa: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 0.5, borderBottomColor: CABECALHO, paddingVertical: 2, paddingHorizontal: 3,
  },

  corpo: { fontSize: 7.5, lineHeight: 1.45 },
  rodape: {
    position: 'absolute', bottom: 14, left: 22, right: 22,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 6.5, color: CINZA,
    borderTopWidth: 0.5, borderTopColor: CABECALHO, paddingTop: 4,
  },
});

const alinhar = (a?: 'esq' | 'centro' | 'dir') =>
  (a === 'centro' ? 'center' : a === 'dir' ? 'right' : 'left') as 'center' | 'right' | 'left';

function Campos({ itens, colunas = 1 }: { itens: Campo[]; colunas?: number }) {
  const linhas: Campo[][] = [];
  for (let i = 0; i < itens.length; i += colunas) linhas.push(itens.slice(i, i + colunas));

  return (
    <View>
      {linhas.map((linha, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
          {Array.from({ length: colunas }, (_, j) => linha[j]).map((c, j) => (
            <View key={j} style={{ flexGrow: 1, flexBasis: 0, paddingRight: 6 }}>
              {c ? (
                <>
                  <Text style={s.campoRotulo}>{limpar(c.rotulo)}</Text>
                  <Text style={s.campoValor}>{limpar(c.valor)}</Text>
                  {c.detalhe ? <Text style={s.campoDetalhe}>{limpar(c.detalhe)}</Text> : null}
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function TabelaPdf({ t }: { t: Tabela }) {
  const ultima = t.colunas.length - 1;
  /** A última célula da linha não desenha borda: a da tabela já fecha. */
  const celula = (peso: number, j: number) => [s.celula, { flexGrow: peso, flexBasis: 0 }, j === ultima ? { borderRightWidth: 0 } : {}];
  let zebra = 0;

  return (
    <View style={s.tabela}>
      {/*
        O cabeçalho se repete quando a tabela vira a página: sem `fixed`, a
        segunda página começa com colunas anônimas.
      */}
      <View style={s.cabecalhoTabela} fixed>
        {t.colunas.map((c, j) => (
          <View key={c.chave} style={celula(c.peso, j)}>
            <Text style={[s.th, { paddingHorizontal: 0, paddingVertical: 0, textAlign: alinhar(c.alinhamento) }]}>
              {limpar(c.rotulo)}
            </Text>
          </View>
        ))}
      </View>

      {t.linhas.map((l, i) => {
        if (l.faixa) {
          zebra = 0;
          return (
            <View key={i} style={s.faixa} wrap={false}>
              <Text style={s.faixaTexto}>
                {limpar(l.faixa.texto)}{l.faixa.hora ? `  ||  ${limpar(l.faixa.hora)}` : ''}
              </Text>
            </View>
          );
        }
        const fundo = zebra++ % 2 === 1 ? { backgroundColor: ZEBRA } : {};
        return (
          <View key={i} style={[s.linha, fundo]} wrap={false}>
            {t.colunas.map((c, j) => {
              const v = l.celulas[c.chave];
              const forte = typeof v === 'object' && v?.enfase === 'forte';
              const fraco = typeof v === 'object' && v?.enfase === 'fraco';
              const detalhe = typeof v === 'object' ? v?.detalhe : undefined;
              return (
                <View key={c.chave} style={celula(c.peso, j)}>
                  <Text style={[
                    s.td,
                    { textAlign: alinhar(c.alinhamento) },
                    forte ? { fontFamily: 'Helvetica-Bold' } : {},
                    fraco ? { color: CINZA } : {},
                  ]}>
                    {limpar(textoDaCelula(v))}
                  </Text>
                  {detalhe ? (
                    <Text style={[s.tdDetalhe, { textAlign: alinhar(c.alinhamento) }]}>{limpar(detalhe)}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}

      {t.total ? (
        <View style={s.total} wrap={false}>
          {t.colunas.map((c, j) => (
            <View key={c.chave} style={celula(c.peso, j)}>
              <Text style={[s.td, { fontFamily: 'Helvetica-Bold', textAlign: alinhar(c.alinhamento) }]}>
                {limpar(t.total![c.chave] || '')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * `dentro`: a seção está numa coluna de uma faixa (locação, bases, tempo).
 * Ali o título vira a barra clara da caixa, e não a barra escura da página.
 */
function SecaoPdf({ secao, dentro = false }: { secao: Secao; dentro?: boolean }) {
  /*
    `minPresenceAhead` é o que impede o título órfão: sem ele, o título cabia
    no fim da página e o conteúdo não — o papel saía com um título sozinho no
    rodapé.
  */
  const titulo = 'titulo' in secao && secao.titulo
    ? <Text style={dentro ? s.barraClara : s.barra} minPresenceAhead={40}>{limpar(secao.titulo.toUpperCase())}</Text>
    : null;
  const quebra = secao.novaPagina ? { break: true } : {};

  switch (secao.tipo) {
    case 'campos':
      return (
        <View wrap={false} {...quebra}>
          {titulo}
          <View style={dentro ? { padding: 5 } : [s.caixa, { borderTopWidth: titulo ? 0 : 0.5 }]}>
            <Campos itens={secao.itens} colunas={secao.colunas} />
          </View>
        </View>
      );

    case 'tabela':
      return (
        <View {...quebra} style={titulo ? {} : { marginTop: 8 }}>
          {titulo}
          {secao.nota ? <Text style={s.nota}>{limpar(secao.nota)}</Text> : null}
          <TabelaPdf t={secao.tabela} />
        </View>
      );

    case 'texto':
      return (
        <View wrap={false} {...quebra}>
          {titulo}
          <View style={[s.caixa, { borderTopWidth: titulo ? 0 : 0.5, marginTop: titulo ? 0 : 6 }]}>
            <Text style={s.corpo}>{limpar(secao.corpo)}</Text>
          </View>
        </View>
      );

    case 'lista': {
      const colunas = secao.colunas || 1;
      const blocos: string[][] = [];
      for (let i = 0; i < secao.itens.length; i += colunas) blocos.push(secao.itens.slice(i, i + colunas));
      return (
        <View wrap={false} {...quebra}>
          {titulo}
          <View style={[s.caixa, { borderTopWidth: 0 }]}>
            {blocos.map((linha, i) => (
              <View key={i} style={{ flexDirection: 'row' }}>
                {linha.map((item, j) => (
                  <Text key={j} style={[s.corpo, { flexGrow: 1, flexBasis: 0, paddingRight: 8 }]}>{limpar(item)}</Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      );
    }

    case 'pessoas': {
      /*
        A equipe sai em LINHAS DE PARES, e não em duas pilhas balanceadas: a
        pilha que não cabe no resto da página é comprimida em vez de empurrada,
        e os departamentos saem uns por cima dos outros. Em pares, cada linha é
        pequena, cabe inteira e a próxima vai para a página seguinte.

        O título vai DENTRO da primeira linha, para nunca ficar sozinho no pé.
      */
      const colunas = secao.colunas || 1;
      const linhas: typeof secao.grupos[] = [];
      for (let i = 0; i < secao.grupos.length; i += colunas) {
        linhas.push(secao.grupos.slice(i, i + colunas));
      }

      return (
        <View {...quebra}>
          {linhas.map((linha, i) => (
            <View key={i} style={{ flexDirection: 'column' }} wrap={false}>
              {i === 0 ? titulo : null}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: i === 0 ? 4 : 0 }}>
              {Array.from({ length: colunas }, (_, j) => linha[j]).map((g, j) => (
                <View key={j} style={{ flexGrow: 1, flexBasis: 0, paddingRight: j < colunas - 1 ? 10 : 0, marginBottom: 6 }}>
                  {g ? (
                    <>
                      <View style={s.deptoBarra}><Text style={s.deptoNome}>{limpar(g.nome.toUpperCase())}</Text></View>
                      {g.pessoas.map((p, k) => (
                        <View key={k} style={s.pessoa}>
                          <View style={{ flexGrow: 1, flexBasis: 0 }}>
                            <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>{limpar(p.nome)}</Text>
                            {p.funcao ? <Text style={{ fontSize: 6.5, color: CINZA }}>{limpar(p.funcao)}</Text> : null}
                            {p.contato ? <Text style={{ fontSize: 6.5 }}>{limpar(p.contato)}</Text> : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            {p.radio ? <Text style={{ fontSize: 6.5, color: CINZA }}>Rádio {limpar(p.radio)}</Text> : null}
                            {p.confirmado ? <Text style={{ fontSize: 6, color: CINZA }}>confirmou</Text> : null}
                            {p.chamada ? <Text style={{ fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>{limpar(p.chamada)}</Text> : null}
                          </View>
                        </View>
                      ))}
                    </>
                  ) : null}
                </View>
              ))}
              </View>
            </View>
          ))}
        </View>
      );
    }

    case 'faixa': {
      /*
        Colunas lado a lado, cada uma uma caixa — os quadros "Locação / Bases /
        Previsão do tempo" do modelo. Uma faixa de uma coluna só é só um jeito
        de agrupar seções, e aí não desenha caixa.
      */
      const total = secao.colunas.reduce((acc, c) => acc + (c.peso || 1), 0) || 1;
      if (secao.colunas.length === 1) {
        return <View {...quebra}>{secao.colunas[0].secoes.map(sub => <SecaoPdf key={sub.id} secao={sub} />)}</View>;
      }
      return (
        <View style={{ flexDirection: 'row', marginTop: 8, borderWidth: 0.5, borderColor: GRADE }} wrap={false} {...quebra}>
          {secao.colunas.map((c, i) => (
            <View
              key={i}
              style={{
                flexGrow: (c.peso || 1) / total, flexBasis: 0,
                borderRightWidth: i < secao.colunas.length - 1 ? 0.5 : 0, borderRightColor: GRADE,
              }}
            >
              {c.secoes.map(sub => <SecaoPdf key={sub.id} secao={sub} dentro />)}
            </View>
          ))}
        </View>
      );
    }
  }
}

function ODPdf({ doc }: { doc: DocumentoOD }) {
  const c = doc.cabecalho;
  return (
    <Document title={`${c.titulo} - ${c.producao} - ${c.diaria}`} author="SetProd">
      {/*
        Retrato, como o modelo do set. A grade cabe porque "Rodando" junta
        preparação e roda numa célula e I/E com D/N noutra — eram quatro
        colunas no papel deitado, são duas aqui.
      */}
      <Page size="A4" style={s.pagina}>
        {/* O cabeçalho é só da primeira página; as outras têm o rodapé. */}
        <View style={s.topo}>
          {/*
            CHAMADA E FIM DO DIA GRANDES, no círculo. É a primeira coisa que
            alguém procura na OD — no ônibus, no celular, com pressa (pedido do
            Lucas, 09/10/2026).
          */}
          {c.chamada || c.fim ? (
            <View style={s.circulo}>
              {c.chamada ? <><Text style={s.circuloRotulo}>CHAMADA</Text><Text style={s.circuloHora}>{limpar(c.chamada)}</Text></> : null}
              {c.fim ? <><Text style={s.circuloRotulo}>FIM DO DIA</Text><Text style={s.circuloHora}>{limpar(c.fim)}</Text></> : null}
            </View>
          ) : null}

          <View style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center' }}>
            {c.logo ? <Image src={c.logo} style={s.logo} /> : null}
            <Text style={s.producao}>{limpar(c.producao.toUpperCase())}</Text>
            {c.direcao ? <Text style={s.direcao}>Direção: {limpar(c.direcao)}</Text> : null}
          </View>

          <View style={{ width: 120 }}>
            <Text style={s.chapeu}>{limpar(c.titulo)}</Text>
            <Text style={s.diaria}>
              {limpar(c.diaria)}{c.versao && c.versao > 1 ? `  v${c.versao}` : ''}
            </Text>
            <Text style={s.meta}>{limpar(c.data)}</Text>
          </View>
        </View>

        {doc.secoes.map(secao => <SecaoPdf key={secao.id} secao={secao} />)}

        <View style={s.rodape} fixed>
          <Text>{limpar(doc.rodape || '')}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** O papel, como arquivo. */
export async function paraPdf(doc: DocumentoOD): Promise<Blob> {
  return pdf(<ODPdf doc={doc} />).toBlob();
}
