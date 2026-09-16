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
 * ⚠️ O MÓDULO É PESADO (~200 KB). Importe-o com `await import(...)`, nunca no
 * topo de uma tela — ele só precisa existir no instante em que alguém exporta.
 */
import {
  Document, Image, Page, StyleSheet, Text, View, pdf,
} from '@react-pdf/renderer';
import { textoDaCelula, type Campo, type DocumentoOD, type Secao, type Tabela } from './tipos';
import { limpar } from '../pdfTexto';

const PRETO = '#111';
const CINZA = '#6b6b6b';
const BORDA = '#d8d8d8';
const FUNDO = '#f1f1f1';

const s = StyleSheet.create({
  pagina: {
    paddingTop: 22, paddingBottom: 30, paddingHorizontal: 24,
    fontFamily: 'Helvetica', fontSize: 8, color: PRETO,
  },
  topo: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: PRETO, paddingBottom: 6, marginBottom: 4,
  },
  logo: { width: 62, maxHeight: 44, marginRight: 12, objectFit: 'contain' },
  chapeu: { fontSize: 7, letterSpacing: 1.6, color: CINZA, fontFamily: 'Helvetica-Bold' },
  producao: { fontSize: 17, fontFamily: 'Helvetica-Bold', lineHeight: 1.15 },
  diaria: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  meta: { fontSize: 8, color: CINZA, textAlign: 'right' },

  tituloSecao: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.9,
    borderBottomWidth: 1, borderBottomColor: PRETO, paddingBottom: 2,
    marginTop: 9, marginBottom: 4,
  },
  nota: { fontSize: 6.5, color: CINZA, marginBottom: 3 },

  campoRotulo: { fontSize: 6.5, color: CINZA, letterSpacing: 0.3 },
  campoValor: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  campoDetalhe: { fontSize: 6.5, color: CINZA },

  cabecalhoTabela: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: PRETO, paddingBottom: 2, marginBottom: 1,
  },
  th: { fontSize: 6, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5, color: CINZA, paddingHorizontal: 3 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: BORDA, paddingVertical: 2.5 },
  td: { fontSize: 7.5, paddingHorizontal: 3 },
  tdDetalhe: { fontSize: 6, color: CINZA, paddingHorizontal: 3 },
  faixa: {
    backgroundColor: FUNDO, paddingVertical: 3, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: BORDA,
  },
  faixaTexto: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  total: { flexDirection: 'row', borderTopWidth: 1.5, borderTopColor: PRETO, paddingVertical: 3 },

  deptoBarra: { backgroundColor: PRETO, paddingVertical: 2, paddingHorizontal: 4, marginBottom: 1 },
  deptoNome: { color: '#fff', fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.7 },
  pessoa: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 0.5, borderBottomColor: BORDA, paddingVertical: 2, paddingHorizontal: 3,
  },

  corpo: { fontSize: 8, lineHeight: 1.5 },
  rodape: {
    position: 'absolute', bottom: 14, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 6.5, color: CINZA,
    borderTopWidth: 0.5, borderTopColor: BORDA, paddingTop: 4,
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
          {linha.map((c, j) => (
            <View key={j} style={{ flexGrow: 1, flexBasis: 0, paddingRight: 8 }}>
              <Text style={s.campoRotulo}>{limpar(c.rotulo)}</Text>
              <Text style={s.campoValor}>{limpar(c.valor)}</Text>
              {c.detalhe ? <Text style={s.campoDetalhe}>{limpar(c.detalhe)}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function TabelaPdf({ t }: { t: Tabela }) {
  return (
    <View>
      {/*
        O cabeçalho da grade se repete quando a tabela vira a página.

        Sem `fixed` a segunda página começa com colunas anônimas, e a coluna do
        meio de uma grade de nove é indistinguível sem o rótulo. Quem está no
        set lê a página 2 tanto quanto a 1.
      */}
      <View style={s.cabecalhoTabela} fixed>
        {t.colunas.map(c => (
          <Text key={c.chave} style={[s.th, { flexGrow: c.peso, flexBasis: 0, textAlign: alinhar(c.alinhamento) }]}>
            {limpar(c.rotulo)}
          </Text>
        ))}
      </View>

      {t.linhas.map((l, i) => l.faixa ? (
        <View key={i} style={s.faixa} wrap={false}>
          <Text style={s.faixaTexto}>
            {l.faixa.hora ? `${limpar(l.faixa.hora)} - ` : ''}{limpar(l.faixa.texto)}
          </Text>
        </View>
      ) : (
        <View key={i} style={s.linha} wrap={false}>
          {t.colunas.map(c => {
            const v = l.celulas[c.chave];
            const forte = typeof v === 'object' && v?.enfase === 'forte';
            const fraco = typeof v === 'object' && v?.enfase === 'fraco';
            const detalhe = typeof v === 'object' ? v?.detalhe : undefined;
            return (
              <View key={c.chave} style={{ flexGrow: c.peso, flexBasis: 0 }}>
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
      ))}

      {t.total ? (
        <View style={s.total} wrap={false}>
          {t.colunas.map(c => (
            <Text
              key={c.chave}
              style={[s.td, { flexGrow: c.peso, flexBasis: 0, fontFamily: 'Helvetica-Bold', textAlign: alinhar(c.alinhamento) }]}
            >
              {limpar(t.total![c.chave] || '')}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SecaoPdf({ secao }: { secao: Secao }) {
  /*
    `minPresenceAhead` é o que impede o título órfão.

    Sem ele, "CONTATO DA EQUIPE" cabia no fim da página e o primeiro
    departamento não — o papel saía com um título sozinho no rodapé e a lista
    começando na página seguinte. O número são os pontos que precisam existir
    depois dele para valer a pena começar aqui.
  */
  const titulo = 'titulo' in secao && secao.titulo
    ? <Text style={s.tituloSecao} minPresenceAhead={46}>{limpar(secao.titulo.toUpperCase())}</Text>
    : null;

  switch (secao.tipo) {
    case 'campos':
      return <View wrap={false}>{titulo}<Campos itens={secao.itens} colunas={secao.colunas} /></View>;

    case 'tabela':
      return (
        <View>
          {titulo}
          {secao.nota ? <Text style={s.nota}>{limpar(secao.nota)}</Text> : null}
          <TabelaPdf t={secao.tabela} />
        </View>
      );

    case 'texto':
      return (
        <View wrap={false}>
          {titulo}
          <Text style={s.corpo}>{limpar(secao.corpo)}</Text>
        </View>
      );

    case 'lista': {
      const colunas = secao.colunas || 1;
      const blocos: string[][] = [];
      for (let i = 0; i < secao.itens.length; i += colunas) blocos.push(secao.itens.slice(i, i + colunas));
      return (
        <View wrap={false}>
          {titulo}
          {blocos.map((linha, i) => (
            <View key={i} style={{ flexDirection: 'row' }}>
              {linha.map((item, j) => (
                <Text key={j} style={[s.corpo, { flexGrow: 1, flexBasis: 0, paddingRight: 8 }]}>{limpar(item)}</Text>
              ))}
            </View>
          ))}
        </View>
      );
    }

    case 'pessoas': {
      /*
        A equipe sai em duas colunas — e as colunas são LINHAS DE PARES, não
        duas pilhas balanceadas.

        A pilha balanceada é mais bonita e quebra o documento: quando ela não
        cabe no resto da página, o PDF comprime a linha inteira em vez de
        empurrá-la, e os departamentos saem uns por cima dos outros. Em pares,
        cada linha é pequena, cabe inteira e a próxima simplesmente vai para a
        página seguinte.

        Duas colunas em vez de uma porque dezoito pessoas empilhadas comem uma
        página; com a faixa preta do departamento em cima de cada bloco, cabem
        na metade e continua dando para achar quem se procura — na OD ninguém
        procura uma pessoa pelo nome, procura pelo departamento dela.
      */
      const colunas = secao.colunas || 1;
      const linhas: typeof secao.grupos[] = [];
      for (let i = 0; i < secao.grupos.length; i += colunas) {
        linhas.push(secao.grupos.slice(i, i + colunas));
      }

      /*
        O TÍTULO VAI DENTRO DA PRIMEIRA LINHA, e não antes dela.

        Solto, ele cabia no fim da página e o primeiro departamento não: o papel
        saía com "CONTATO DA EQUIPE" sozinho no rodapé e a lista começando na
        página seguinte. Amarrado ao primeiro par, ou os dois cabem, ou os dois
        viram a página juntos.
      */
      return (
        <View>
          {linhas.map((linha, i) => (
            <View key={i} style={{ flexDirection: 'column' }} wrap={false}>
              {i === 0 ? titulo : null}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
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
      const total = secao.colunas.reduce((acc, c) => acc + (c.peso || 1), 0) || 1;
      return (
        <View style={{ flexDirection: 'row' }} wrap={false}>
          {secao.colunas.map((c, i) => (
            <View key={i} style={{ flexGrow: (c.peso || 1) / total, flexBasis: 0, paddingRight: i < secao.colunas.length - 1 ? 12 : 0 }}>
              {c.secoes.map(sub => <SecaoPdf key={sub.id} secao={sub} />)}
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
        Paisagem, como o modelo que a produção já usa.

        Não é gosto: a grade hora a hora tem nove colunas (horário, cena, I/E,
        D/N, locação, sinopse, planos, páginas, elenco). Em retrato, a sinopse
        fica com três centímetros e cada cena vira quatro linhas de texto — a
        grade deixa de ser uma grade.
      */}
      <Page size="A4" orientation="landscape" style={s.pagina}>
        <View style={s.topo} fixed>
          {c.logo ? <Image src={c.logo} style={s.logo} /> : null}
          <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <Text style={s.chapeu}>{limpar(c.titulo)}</Text>
            <Text style={s.producao}>{limpar(c.producao)}</Text>
          </View>
          <View>
            <Text style={s.diaria}>
              {limpar(c.diaria)}{c.versao && c.versao > 1 ? `  v${c.versao}` : ''}
            </Text>
            <Text style={s.meta}>{limpar(c.data)}</Text>
            {c.janela ? <Text style={s.meta}>{limpar(c.janela)}</Text> : null}
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
