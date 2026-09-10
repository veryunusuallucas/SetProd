/**
 * A Ordem do Dia em HTML — o corpo do e-mail e a prévia na tela.
 *
 * É o irmão pobre do `pdf.tsx` de propósito: cliente de e-mail não tem flexbox
 * confiável, não tem `gap`, e o Gmail joga fora `<style>` do cabeçalho. Então
 * aqui é tabela e estilo em atributo, como em 2003 — o que garante que o corpo
 * do e-mail chegue legível no celular de quem está indo para o set.
 *
 * O PAPEL não passa por aqui. Ele é PDF, gerado pelo app, e é o único lugar em
 * que vale gastar layout.
 */
import { textoDaCelula, type Campo, type DocumentoOD, type Secao, type Tabela } from './tipos';

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CINZA = '#666';
const BORDA = '#ddd';

function titulo(t?: string): string {
  if (!t) return '';
  return `<div style="font:bold 11px Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;color:#111;border-bottom:2px solid #111;padding-bottom:3px;margin:18px 0 8px">${escapar(t)}</div>`;
}

function listaDeCampos(itens: Campo[], colunas = 1): string {
  const celulas = itens.map(c => `
    <td valign="top" style="padding:2px 10px 2px 0;font:12px Arial,sans-serif">
      <span style="color:${CINZA}">${escapar(c.rotulo)}:</span>
      <b>${escapar(c.valor)}</b>
      ${c.detalhe ? `<div style="color:${CINZA};font-size:11px">${escapar(c.detalhe)}</div>` : ''}
    </td>`);

  const linhas: string[] = [];
  for (let i = 0; i < celulas.length; i += colunas) {
    linhas.push(`<tr>${celulas.slice(i, i + colunas).join('')}</tr>`);
  }
  return `<table style="width:100%;border-collapse:collapse">${linhas.join('')}</table>`;
}

function tabelaHtml(t: Tabela): string {
  const total = t.colunas.reduce((s, c) => s + c.peso, 0) || 1;
  const cabecalho = t.colunas.map(c =>
    `<th width="${Math.round((c.peso / total) * 100)}%" align="${c.alinhamento === 'centro' ? 'center' : c.alinhamento === 'dir' ? 'right' : 'left'}"
       style="font:bold 10px Arial,sans-serif;text-transform:uppercase;letter-spacing:.05em;color:${CINZA};border-bottom:1px solid #111;padding:4px 6px">${escapar(c.rotulo)}</th>`
  ).join('');

  const corpo = t.linhas.map(l => {
    if (l.faixa) {
      return `<tr><td colspan="${t.colunas.length}" style="background:#f0f0f0;border-bottom:1px solid ${BORDA};padding:5px 6px;font:bold 11px Arial,sans-serif">
        ${l.faixa.hora ? `${escapar(l.faixa.hora)} — ` : ''}${escapar(l.faixa.texto)}</td></tr>`;
    }
    const tds = t.colunas.map(c => {
      const v = l.celulas[c.chave];
      const texto = textoDaCelula(v);
      const detalhe = typeof v === 'object' && v?.detalhe;
      const forte = typeof v === 'object' && v?.enfase === 'forte';
      return `<td valign="top" align="${c.alinhamento === 'centro' ? 'center' : c.alinhamento === 'dir' ? 'right' : 'left'}"
        style="border-bottom:1px solid ${BORDA};padding:5px 6px;font:${forte ? 'bold ' : ''}11px Arial,sans-serif">
        ${escapar(texto)}${detalhe ? `<div style="color:${CINZA};font-size:10px;font-weight:normal">${escapar(detalhe)}</div>` : ''}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  const rodape = t.total
    ? `<tr>${t.colunas.map(c => `<td align="${c.alinhamento === 'centro' ? 'center' : 'left'}"
        style="border-top:2px solid #111;padding:5px 6px;font:bold 11px Arial,sans-serif">${escapar(t.total![c.chave] || '')}</td>`).join('')}</tr>`
    : '';

  return `<table style="width:100%;border-collapse:collapse;margin-bottom:4px"><tr>${cabecalho}</tr>${corpo}${rodape}</table>`;
}

function secaoHtml(s: Secao): string {
  switch (s.tipo) {
    case 'campos':
      return titulo(s.titulo) + listaDeCampos(s.itens, s.colunas || 1);

    case 'tabela':
      return titulo(s.titulo) + (s.nota
        ? `<div style="color:${CINZA};font-size:11px;margin-bottom:4px">${escapar(s.nota)}</div>` : '')
        + tabelaHtml(s.tabela);

    case 'texto':
      return titulo(s.titulo)
        + `<div style="font:12px/1.6 Arial,sans-serif;white-space:pre-wrap">${escapar(s.corpo)}</div>`;

    case 'lista':
      return titulo(s.titulo)
        + `<ul style="margin:0;padding-left:18px;font:12px/1.7 Arial,sans-serif">${
            s.itens.map(i => `<li>${escapar(i)}</li>`).join('')}</ul>`;

    case 'pessoas': {
      const blocos = s.grupos.map(g => `
        <div style="margin-bottom:10px">
          <div style="background:#111;color:#fff;font:bold 10px Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em;padding:3px 6px">${escapar(g.nome)}</div>
          <table style="width:100%;border-collapse:collapse">${
            g.pessoas.map(p => `<tr>
              <td valign="top" style="border-bottom:1px solid ${BORDA};padding:4px 6px;font:11px Arial,sans-serif">
                <b>${escapar(p.nome)}</b>${p.confirmado ? ' <span style="color:#1dd1a1" title="confirmou presença">✓</span>' : ''}
                ${p.funcao ? `<div style="color:${CINZA};font-size:10px">${escapar(p.funcao)}</div>` : ''}
                ${p.contato ? `<div style="font-size:10px">${escapar(p.contato)}</div>` : ''}
              </td>
              <td valign="top" align="right" style="border-bottom:1px solid ${BORDA};padding:4px 6px;font:11px Arial,sans-serif;white-space:nowrap">
                ${p.radio ? `<div style="color:${CINZA};font-size:10px">Rádio ${escapar(p.radio)}</div>` : ''}
                ${p.chamada ? `<b>${escapar(p.chamada)}</b>` : ''}
              </td>
            </tr>`).join('')}</table>
        </div>`).join('');
      return titulo(s.titulo) + blocos;
    }

    case 'faixa': {
      const total = s.colunas.reduce((acc, c) => acc + (c.peso || 1), 0) || 1;
      return `<table style="width:100%;border-collapse:collapse"><tr>${
        s.colunas.map(c => `<td valign="top" width="${Math.round(((c.peso || 1) / total) * 100)}%" style="padding-right:14px">
          ${c.secoes.map(secaoHtml).join('')}</td>`).join('')
      }</tr></table>`;
    }
  }
}

/** O documento inteiro, sem `<html>` em volta — para embutir no e-mail. */
export function paraHtml(doc: DocumentoOD): string {
  const c = doc.cabecalho;
  const cabecalho = `
    <table style="width:100%;border-collapse:collapse;border-bottom:3px solid #111;padding-bottom:6px">
      <tr>
        ${c.logo ? `<td width="70" valign="middle" style="padding-right:12px"><img src="${escapar(c.logo)}" alt="" style="max-width:70px;max-height:52px"></td>` : ''}
        <td valign="middle">
          <div style="font:bold 10px Arial,sans-serif;letter-spacing:.16em;color:${CINZA}">${escapar(c.titulo)}</div>
          <div style="font:bold 22px Arial,sans-serif;line-height:1.15">${escapar(c.producao)}</div>
        </td>
        <td valign="middle" align="right" style="font:11px Arial,sans-serif">
          <div style="font:bold 15px Arial,sans-serif">${escapar(c.diaria)}${c.versao && c.versao > 1 ? ` <span style="color:${CINZA};font-size:11px">v${c.versao}</span>` : ''}</div>
          <div>${escapar(c.data)}</div>
          ${c.janela ? `<div style="color:${CINZA}">${escapar(c.janela)}</div>` : ''}
        </td>
      </tr>
    </table>`;

  return `<div style="max-width:760px;margin:0 auto;color:#111">${cabecalho}${doc.secoes.map(secaoHtml).join('')}</div>`;
}

/** Versão para WhatsApp: o dia em texto puro, sem tabela nenhuma. */
export function paraTexto(doc: DocumentoOD): string {
  const linhas: string[] = [
    `*${doc.cabecalho.producao}* — ${doc.cabecalho.diaria}`,
    doc.cabecalho.data,
    doc.cabecalho.janela || '',
    '',
  ];

  const escrever = (s: Secao) => {
    if (s.tipo === 'faixa') { s.colunas.forEach(c => c.secoes.forEach(escrever)); return; }
    if (s.titulo) linhas.push(`*${s.titulo.toUpperCase()}*`);
    switch (s.tipo) {
      case 'campos':
        s.itens.forEach(i => linhas.push(`• ${i.rotulo}: ${i.valor}`));
        break;
      case 'lista':
        s.itens.forEach(i => linhas.push(`• ${i}`));
        break;
      case 'texto':
        linhas.push(s.corpo);
        break;
      case 'pessoas':
        s.grupos.forEach(g => {
          linhas.push(`— ${g.nome}`);
          g.pessoas.forEach(p => linhas.push(`• ${p.nome}${p.funcao ? ` (${p.funcao})` : ''}${p.contato ? ` — ${p.contato}` : ''}`));
        });
        break;
      case 'tabela':
        s.tabela.linhas.forEach(l => {
          if (l.faixa) { linhas.push(`— ${l.faixa.hora ? `${l.faixa.hora} ` : ''}${l.faixa.texto}`); return; }
          linhas.push('• ' + s.tabela.colunas
            .map(c => textoDaCelula(l.celulas[c.chave]))
            .filter(v => v && v !== '—').join(' · '));
        });
        break;
    }
    linhas.push('');
  };

  doc.secoes.forEach(escrever);
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
