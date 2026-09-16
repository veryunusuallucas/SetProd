/**
 * Os papéis da Logagem: camera report, integridade e o consolidado.
 *
 * O conteúdo é o do Lumavi (super-colunas, sub-cabeçalho de formato, claquete
 * configurável, comprovantes do Clone Tool); a infraestrutura é a da OD —
 * `@react-pdf`, `limpar()`, cabeçalho e rodapé fixos, logo da produção.
 *
 * ⚠️ MÓDULO PESADO. Só entra por `await import('./pdf')`, em `exportar.ts`.
 */
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import type { Take } from '../../types';
import { limpar } from '../pdfTexto';
import { data as dataLegivel, dataHora, numero } from '../formato';
import { ROTULO_DO_STATUS } from './takes';
import { resumirLogagem } from './resumo';
import {
  COLUNAS_DO_REPORT, TETO_DE_LINHAS, TITULO_DO_RELATORIO, agruparTakes, celulaDoTake, linhasDaIntegridade,
  type OpcoesDoReport, type TipoDeRelatorio,
} from './relatorio';
import { numeroDaDiaria, type DadosDoRelatorio } from './exportar';

const PRETO = '#111';
const CINZA = '#6b6b6b';
const BORDA = '#d8d8d8';
const FUNDO = '#ececec';
const VERDE = '#10876a';
const VERMELHO = '#c93c3c';

/*
  A cor do status no papel. Não é enfeite: o montador passa o olho procurando
  o HERO e pulando o NG, e em preto e branco os dois são a mesma palavra curta.
*/
const COR_NO_PAPEL: Record<Take['status'], string> = {
  OK: VERDE,
  NG: VERMELHO,
  HERO: '#b8620b',
  RECINV: '#9a7400',
  IMPORT: CINZA,
};

const s = StyleSheet.create({
  pagina: {
    paddingTop: 22, paddingBottom: 30, paddingHorizontal: 24,
    fontFamily: 'Helvetica', fontSize: 8, color: PRETO,
  },
  topo: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: PRETO, paddingBottom: 6, marginBottom: 6,
  },
  logo: { width: 62, maxHeight: 44, marginRight: 12, objectFit: 'contain' },
  chapeu: { fontSize: 7, letterSpacing: 1.6, color: CINZA, fontFamily: 'Helvetica-Bold' },
  producao: { fontSize: 17, fontFamily: 'Helvetica-Bold', lineHeight: 1.15 },
  diaria: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  meta: { fontSize: 7.5, color: CINZA, textAlign: 'right' },

  equipe: { flexDirection: 'row', marginBottom: 6 },
  rotulo: { fontSize: 6.5, color: CINZA, letterSpacing: 0.3 },
  valor: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  numeros: { fontSize: 7.5, color: CINZA, marginBottom: 8 },

  tituloSecao: {
    fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.9,
    borderBottomWidth: 1, borderBottomColor: PRETO, paddingBottom: 2,
    marginTop: 10, marginBottom: 4,
  },

  cabecalhoTabela: {
    flexDirection: 'row', backgroundColor: PRETO, paddingVertical: 3,
  },
  th: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.4, color: '#fff', paddingHorizontal: 3 },
  faixa: {
    backgroundColor: FUNDO, paddingVertical: 3, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: BORDA,
  },
  faixaTexto: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  linha: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 0.5, borderBottomColor: BORDA, paddingVertical: 3,
  },
  td: { fontSize: 7.5, paddingHorizontal: 3 },
  tdDetalhe: { fontSize: 6, color: CINZA, paddingHorizontal: 3 },
  foto: { height: 50, objectFit: 'contain', objectPosition: 'center' },

  vazio: { fontSize: 9, color: CINZA, fontFamily: 'Helvetica-Oblique', marginTop: 12 },

  cartaoTitulo: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', marginTop: 10 },
  cartaoMeta: { fontSize: 7, color: CINZA },
  codigo: { fontFamily: 'Courier', fontSize: 5.8, lineHeight: 1.3, marginTop: 4, color: '#333' },

  rodape: {
    position: 'absolute', bottom: 14, left: 24, right: 24,
    flexDirection: 'row', justifyContent: 'space-between',
    fontSize: 6.5, color: CINZA,
    borderTopWidth: 0.5, borderTopColor: BORDA, paddingTop: 4,
  },
});

function Topo({ dados, titulo }: { dados: DadosDoRelatorio; titulo: string }) {
  const { projeto, diaria } = dados;
  return (
    <View style={s.topo} fixed>
      {dados.logo ? <Image src={dados.logo} style={s.logo} /> : null}
      <View style={{ flexGrow: 1, flexBasis: 0 }}>
        <Text style={s.chapeu}>{limpar(titulo.toUpperCase())}</Text>
        <Text style={s.producao}>{limpar(projeto.nome)}</Text>
      </View>
      <View>
        <Text style={s.diaria}>{limpar(`Diária ${numeroDaDiaria(diaria)}`)}</Text>
        {diaria.data ? <Text style={s.meta}>{dataLegivel(diaria.data)}</Text> : null}
        <Text style={s.meta}>{limpar(`gerado em ${dataHora(dados.geradoEm)}`)}</Text>
      </View>
    </View>
  );
}

function Rodape({ dados, titulo }: { dados: DadosDoRelatorio; titulo: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text>{limpar(`${dados.projeto.nome} · Diária ${numeroDaDiaria(dados.diaria)} · ${titulo}`)}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Equipe({ dados }: { dados: DadosDoRelatorio }) {
  const e = dados.equipe;
  const campos = [
    ['Direção', e.diretor],
    ['Fotografia', e.fotografia],
    ['Operação de câmera', e.operador],
    ['Produção', e.produtor],
  ].filter(([, v]) => v);
  if (campos.length === 0) return null;
  return (
    <View style={s.equipe} wrap={false}>
      {campos.map(([rotulo, valor]) => (
        <View key={rotulo} style={{ flexGrow: 1, flexBasis: 0, paddingRight: 8 }}>
          <Text style={s.rotulo}>{limpar(rotulo)}</Text>
          <Text style={s.valor}>{limpar(valor)}</Text>
        </View>
      ))}
    </View>
  );
}

/** "12 takes · 8 OK · 3 NG · 1 HERO · cenas 2 · setups 4 · câmeras A, B · cartões 001, 002" */
function Numeros({ dados }: { dados: DadosDoRelatorio }) {
  const r = resumirLogagem(dados);
  const status = (Object.keys(ROTULO_DO_STATUS) as Take['status'][])
    .filter(k => r.porStatus[k])
    .map(k => `${r.porStatus[k]} ${ROTULO_DO_STATUS[k]}`);
  const cameras = [...new Set(dados.takes.map(t => t.camera_id).filter(Boolean))];
  const partes = [
    `${r.takes} take${r.takes === 1 ? '' : 's'}`,
    ...status,
    `${r.cenas} cena${r.cenas === 1 ? '' : 's'}`,
    `${r.planos} setup${r.planos === 1 ? '' : 's'}`,
    cameras.length ? `câmera${cameras.length === 1 ? '' : 's'} ${cameras.join(', ')}` : '',
    r.cartoes.length ? `${r.cartoes.length === 1 ? 'cartão' : 'cartões'} ${r.cartoes.map(c => c.nome).join(', ')}` : '',
    r.primeiro && r.ultimo ? `das ${r.primeiro.slice(0, 5)} às ${r.ultimo.slice(0, 5)}` : '',
  ].filter(Boolean);
  return <Text style={s.numeros}>{limpar(partes.join(' · '))}</Text>;
}

function CameraReport({ dados, opcoes }: { dados: DadosDoRelatorio; opcoes: OpcoesDoReport }) {
  const titulo = TITULO_DO_RELATORIO.camera;
  const colunas = COLUNAS_DO_REPORT.filter(c => opcoes.colunas.includes(c.id));
  const grupos = agruparTakes(dados.takes, opcoes.agrupar);

  return (
    /*
      Paisagem, como o Lumavi: são oito super-colunas, e a OBS precisa de
      largura para ser lida numa linha só.
    */
    <Page size="A4" orientation="landscape" style={s.pagina}>
      <Topo dados={dados} titulo={titulo} />
      <Equipe dados={dados} />
      <Numeros dados={dados} />

      {dados.takes.length === 0 ? (
        <Text style={s.vazio}>Nenhum take registrado nesta diária.</Text>
      ) : (
        <View>
          {/* Repete em toda página: a página 3 sem rótulo é uma grade de palpites. */}
          <View style={s.cabecalhoTabela} fixed>
            {colunas.map(c => (
              <Text key={c.id} style={[s.th, { flexGrow: c.peso, flexBasis: 0 }]}>{limpar(c.rotulo.toUpperCase())}</Text>
            ))}
          </View>

          {grupos.map((g, i) => (
            <View key={i}>
              {/*
                O sub-cabeçalho vai amarrado ao primeiro take do grupo. Solto,
                ele cabia no pé da página e o take não — e o papel saía com um
                formato anunciado sobre nada.
              */}
              {g.takes.map((t, j) => (
                <View key={t.id} wrap={false}>
                  {j === 0 ? (
                    <View style={s.faixa}>
                      <Text style={s.faixaTexto}>{limpar(g.rotulo)}</Text>
                    </View>
                  ) : null}
                  <LinhaDoTake take={t} colunas={colunas} dados={dados} opcoes={opcoes} />
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <Rodape dados={dados} titulo={titulo} />
    </Page>
  );
}

function LinhaDoTake({ take, colunas, dados, opcoes }: {
  take: Take;
  colunas: typeof COLUNAS_DO_REPORT;
  dados: DadosDoRelatorio;
  opcoes: OpcoesDoReport;
}) {
  return (
    <View style={s.linha}>
      {colunas.map(c => {
        const largura = { flexGrow: c.peso, flexBasis: 0 };

        if (c.id === 'foto') {
          const url = dados.fotos[take.id];
          return (
            <View key={c.id} style={[largura, { paddingHorizontal: 3 }]}>
              {/*
                `objectFit: contain` numa caixa de altura fixa: a foto do
                celular em pé e a do still deitado saem inteiras, sem esticar.
              */}
              {url ? <Image src={url} style={s.foto} /> : null}
            </View>
          );
        }

        const { texto, detalhe } = celulaDoTake(c.id, take, opcoes);
        const quem = c.id === 'hora' ? dados.quemLogou[take.id] : undefined;
        const cor = c.id === 'status' ? { color: COR_NO_PAPEL[take.status], fontFamily: 'Helvetica-Bold' } : {};
        const forte = c.id === 'claquete' || c.id === 'arquivo' ? { fontFamily: 'Helvetica-Bold' } : {};
        return (
          <View key={c.id} style={largura}>
            <Text style={[s.td, cor, forte]}>{limpar(texto)}</Text>
            {detalhe ? <Text style={s.tdDetalhe}>{limpar(detalhe)}</Text> : null}
            {quem ? <Text style={s.tdDetalhe}>{limpar(`por ${quem}`)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function Integridade({ dados }: { dados: DadosDoRelatorio }) {
  const titulo = TITULO_DO_RELATORIO.integridade;
  const linhas = linhasDaIntegridade(dados);
  const colunas: { rotulo: string; peso: number }[] = [
    { rotulo: 'Cartão', peso: 12 },
    { rotulo: 'Takes', peso: 6 },
    { rotulo: 'Estimado', peso: 8 },
    ...dados.hds.map(h => ({ rotulo: h.nome, peso: 8 })),
    { rotulo: 'Comprovante', peso: 22 },
    { rotulo: 'Status', peso: 18 },
  ];
  const comComprovante = linhas.filter(l => l.comprovante);

  return (
    <Page size="A4" orientation="portrait" style={s.pagina}>
      <Topo dados={dados} titulo={titulo} />

      {linhas.length === 0 ? (
        <Text style={s.vazio}>Nenhum cartão nesta diária.</Text>
      ) : (
        <>
          <Text style={s.tituloSecao}>CARTÕES E CÓPIAS</Text>
          {dados.hds.length === 0 ? (
            <Text style={[s.cartaoMeta, { marginBottom: 4 }]}>
              Nenhum HD cadastrado: nenhum cartão pode ser liberado para formatar.
            </Text>
          ) : null}
          {/*
            A tabela dentro de uma View própria: o cabeçalho `fixed` só se
            repete nas páginas em que ela está. Solto na página, ele aparecia
            também sobre as dez páginas de comprovante que vêm depois.
          */}
          <View>
            <View style={s.cabecalhoTabela} fixed>
              {colunas.map((c, i) => (
                <Text key={i} style={[s.th, { flexGrow: c.peso, flexBasis: 0 }]}>{limpar(c.rotulo.toUpperCase())}</Text>
              ))}
            </View>
            {linhas.map(l => {
              const pesos = colunas.map(c => ({ flexGrow: c.peso, flexBasis: 0 }));
              let i = 0;
              return (
                <View key={l.cartao} style={s.linha} wrap={false}>
                  <Text style={[s.td, pesos[i++], { fontFamily: 'Helvetica-Bold' }]}>{limpar(l.cartao)}</Text>
                  <Text style={[s.td, pesos[i++]]}>{l.takes}</Text>
                  <Text style={[s.td, pesos[i++]]}>{`~${numero(l.gb, l.gb < 10 ? 1 : 0)} GB`}</Text>
                  {l.copiado.map((ok, k) => (
                    <Text key={k} style={[s.td, pesos[i++], { color: ok ? VERDE : CINZA, fontFamily: ok ? 'Helvetica-Bold' : 'Helvetica' }]}>
                      {ok ? 'copiado' : '-'}
                    </Text>
                  ))}
                  <Text style={[s.td, pesos[i++]]}>{limpar(l.comprovante?.nome_arquivo || '-')}</Text>
                  <View style={pesos[i++]}>
                    <Text style={[s.td, { color: l.seguro ? VERDE : VERMELHO, fontFamily: 'Helvetica-Bold' }]}>
                      {l.seguro ? 'LIBERADO' : 'NÃO LIBERADO'}
                    </Text>
                    {!l.seguro && l.falta.length ? (
                      <Text style={s.tdDetalhe}>{limpar(`falta: ${l.falta.join('; ')}`)}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <Text style={s.tituloSecao} minPresenceAhead={60}>COMPROVANTES DE VERIFICAÇÃO</Text>
          {comComprovante.length === 0 ? (
            <Text style={s.cartaoMeta}>Nenhum comprovante de checksum anexado.</Text>
          ) : comComprovante.map(l => {
            const c = l.comprovante!;
            const conteudo = dados.comprovantes[c.id];
            return (
              <View key={c.id}>
                <View wrap={false} minPresenceAhead={40}>
                  <Text style={[s.cartaoTitulo, { color: l.seguro ? VERDE : VERMELHO }]}>
                    {limpar(`Cartão ${l.cartao} · ${l.seguro ? 'LIBERADO' : 'NÃO LIBERADO'}`)}
                  </Text>
                  <Text style={s.cartaoMeta}>{limpar(`Arquivo: ${c.nome_arquivo} · anexado em ${dataHora(c.anexado_em)}`)}</Text>
                  <Text style={s.cartaoMeta}>{limpar(`${c.algoritmo}: ${c.digest}`)}</Text>
                  <Text style={s.cartaoMeta}>
                    {limpar(`${c.bytes.toLocaleString('pt-BR')} bytes · ${c.linhas.toLocaleString('pt-BR')} linhas`)}
                  </Text>
                </View>
                {conteudo ? (
                  <>
                    <Text style={s.codigo}>{limpar(conteudo.linhas.join('\n'))}</Text>
                    {conteudo.cortadas > 0 ? (
                      <Text style={[s.cartaoMeta, { fontFamily: 'Helvetica-Oblique', marginTop: 3 }]}>
                        {limpar(`... mais ${conteudo.cortadas.toLocaleString('pt-BR')} linhas fora do papel (o teto é ${TETO_DE_LINHAS.toLocaleString('pt-BR')}). O ${c.algoritmo} acima cobre o arquivo inteiro.`)}
                      </Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={[s.cartaoMeta, { fontFamily: 'Helvetica-Oblique', marginTop: 3 }]}>
                    O conteúdo do arquivo não estava neste aparelho. O {c.algoritmo} acima é a prova.
                  </Text>
                )}
              </View>
            );
          })}
        </>
      )}

      <Rodape dados={dados} titulo={titulo} />
    </Page>
  );
}

function Relatorio({ tipo, dados, opcoes }: { tipo: TipoDeRelatorio; dados: DadosDoRelatorio; opcoes: OpcoesDoReport }) {
  const titulo = TITULO_DO_RELATORIO[tipo];
  return (
    <Document title={limpar(`${titulo} - ${dados.projeto.nome} - Diária ${numeroDaDiaria(dados.diaria)}`)} author="SetProd">
      {tipo !== 'integridade' ? <CameraReport dados={dados} opcoes={opcoes} /> : null}
      {tipo !== 'camera' ? <Integridade dados={dados} /> : null}
    </Document>
  );
}

export async function relatorioEmPdf(tipo: TipoDeRelatorio, dados: DadosDoRelatorio, opcoes: OpcoesDoReport): Promise<Blob> {
  return pdf(<Relatorio tipo={tipo} dados={dados} opcoes={opcoes} />).toBlob();
}
