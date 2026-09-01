import type { Diaria } from '../types';
import { calcularDia, montarLinhaDoDia, emMinutos } from './linhaDoDia';
import type { Cena } from '../types';

/**
 * Gera o arquivo .ics do dia (spec §7.1).
 *
 * POR QUE .ICS E NÃO A API DO GOOGLE
 * A API do Calendar é gratuita, e ainda assim cara: exige projeto no Google
 * Cloud, tela de consentimento OAuth, autorização de cada pessoa da equipe e
 * guarda de tokens que expiram. Em troca disso, o evento passaria a se
 * atualizar sozinho — que é bom, mas não é o que resolve o problema de hoje.
 *
 * O .ics é um arquivo de texto que Google, Apple e Outlook abrem sem que
 * ninguém autorize nada, e funciona para quem não usa Google. Quando a diária
 * mudar, manda-se o arquivo novo.
 *
 * Um .ics pode conter VÁRIOS eventos, e é o que fazemos: entra a diária inteira
 * como um bloco, e cada marco do dia (chamada, refeição, wrap) como evento
 * próprio. Quem quiser só o bloco apaga os outros; quem quiser o alarme do
 * almoço já tem.
 */

/** Escapa o que o formato reserva. Vírgula e ponto-e-vírgula separam campos lá. */
function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * "2026-10-10" + minutos do dia → "20261010T073000".
 *
 * Sem `Z` e sem fuso, de propósito: é a "hora local flutuante" do padrão. A
 * chamada é às 7h no relógio de quem está no set, e converter para UTC daria
 * 10h para quem abrisse o convite em outro fuso — que é exatamente o erro que
 * faz alguém perder a chamada.
 */
function carimbo(data: string, minutosDoDia: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  /*
    A soma é feita em Date local só para a virada de dia funcionar: um wrap às
    02:00 pertence ao dia seguinte, e `minutosDoDia` pode passar de 1440. Criar
    a data com componentes (não com string ISO) evita o parse em UTC.
  */
  const d = new Date(ano, mes - 1, dia, 0, minutosDoDia);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}

/**
 * "20260901T125459Z" — o instante em UTC, no formato do calendário.
 *
 * ⚠️ O "Z" JÁ VEM AQUI, do próprio `toISOString`. A primeira versão o
 * acrescentava de novo no template do DTSTAMP e saía "...459ZZ": alguns
 * leitores engolem, outros descartam o VEVENT inteiro sem reclamar, e o convite
 * simplesmente não aparece na agenda de quem abriu o arquivo.
 */
function agoraUTC(): string {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Dobra as linhas em 75 octetos, como o RFC 5545 manda.
 *
 * Não é preciosismo: o Outlook trunca linhas longas em vez de aceitá-las, e uma
 * descrição comprida some do convite sem nenhum aviso.
 */
function dobrar(linha: string): string {
  if (linha.length <= 75) return linha;
  const partes: string[] = [linha.slice(0, 75)];
  let resto = linha.slice(75);
  while (resto.length > 74) {
    partes.push(' ' + resto.slice(0, 74));
    resto = resto.slice(74);
  }
  if (resto) partes.push(' ' + resto);
  return partes.join('\r\n');
}

interface Evento {
  uid: string;
  inicio: number;
  fim: number;
  titulo: string;
  descricao?: string;
  local?: string;
}

export interface DadosDoIcs {
  diaria: Diaria;
  cenas: Cena[];
  nomeDoProjeto: string;
  /** Nome das locações do dia, para o campo LOCATION. */
  locais: string[];
}

export function montarIcs({ diaria, cenas, nomeDoProjeto, locais }: DadosDoIcs): string {
  if (!diaria.data) return '';

  const dia = calcularDia(montarLinhaDoDia(diaria), diaria.chamada, id => cenas.find(c => c.id === id));
  const local = locais.join(' · ');
  const rotuloDiaria = `Diária ${String(diaria.numero).padStart(2, '0')} — ${nomeDoProjeto}`;

  const inicio = dia.itens.length ? dia.itens[0].inicio : (emMinutos(diaria.chamada) ?? 7 * 60);
  const fim = dia.itens.length ? dia.itens[dia.itens.length - 1].fim : inicio + 12 * 60;

  const eventos: Evento[] = [{
    uid: `diaria-${diaria.id}@setprod`,
    inicio,
    fim,
    titulo: rotuloDiaria,
    descricao: [
      dia.wrap ? `Wrap previsto: ${dia.wrap}.` : '',
      dia.itens.length ? dia.itens.map(i => `${i.hora} ${i.cena ? `Cena ${i.cena.numero} — ${i.cena.descricao}` : (i.item.titulo || '')}`).join('\n') : '',
      diaria.link_reuniao ? `Reunião: ${diaria.link_reuniao}` : '',
    ].filter(Boolean).join('\n\n'),
    local,
  }];

  /*
    Só os MARCOS viram evento separado — cena, não.

    Um dia de dez cenas encheria a agenda de todo mundo com dez compromissos de
    quarenta minutos, e a agenda pessoal deixaria de ser legível. Chamada,
    refeição e wrap são os horários que a pessoa quer que o telefone lembre.
  */
  for (const c of dia.itens) {
    if (c.item.tipo === 'cena' || c.item.tipo === 'nota') continue;
    eventos.push({
      uid: `item-${c.item.id}@setprod`,
      inicio: c.inicio,
      fim: c.fim > c.inicio ? c.fim : c.inicio + 15,
      titulo: `${c.item.titulo || 'Marco'} — D${String(diaria.numero).padStart(2, '0')}`,
      local,
    });
  }

  const linhas: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SetProd//Ordem do Dia//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const e of eventos) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${agoraUTC()}`,
      `DTSTART:${carimbo(diaria.data, e.inicio)}`,
      `DTEND:${carimbo(diaria.data, e.fim)}`,
      dobrar(`SUMMARY:${escapar(e.titulo)}`),
    );
    if (e.local) linhas.push(dobrar(`LOCATION:${escapar(e.local)}`));
    if (e.descricao) linhas.push(dobrar(`DESCRIPTION:${escapar(e.descricao)}`));
    linhas.push('END:VEVENT');
  }

  linhas.push('END:VCALENDAR');

  // CRLF é obrigatório no formato — o Outlook rejeita o arquivo com LF puro.
  return linhas.join('\r\n');
}

/** Baixa o .ics. */
export function baixarIcs(conteudo: string, nome: string) {
  const blob = new Blob([conteudo], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${nome}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * O link de "adicionar ao Google Agenda", que abre o formulário já preenchido.
 *
 * Existe ao lado do arquivo porque no celular baixar um .ics é desajeitado —
 * o arquivo cai em Downloads e a pessoa precisa achá-lo. O link abre a agenda
 * direto. Ele leva só o bloco da diária: a URL não comporta vários eventos.
 */
export function linkGoogleAgenda({ diaria, cenas, nomeDoProjeto, locais }: DadosDoIcs): string {
  const dia = calcularDia(montarLinhaDoDia(diaria), diaria.chamada, id => cenas.find(c => c.id === id));
  const inicio = dia.itens.length ? dia.itens[0].inicio : (emMinutos(diaria.chamada) ?? 7 * 60);
  const fim = dia.itens.length ? dia.itens[dia.itens.length - 1].fim : inicio + 12 * 60;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Diária ${String(diaria.numero).padStart(2, '0')} — ${nomeDoProjeto}`,
    dates: `${carimbo(diaria.data, inicio)}/${carimbo(diaria.data, fim)}`,
    location: locais.join(' · '),
    details: [
      dia.wrap ? `Wrap previsto: ${dia.wrap}.` : '',
      diaria.link_reuniao ? `Reunião: ${diaria.link_reuniao}` : '',
    ].filter(Boolean).join('\n'),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
