/**
 * Relatórios da decupagem.
 *
 * São quatro papéis diferentes, para leitores diferentes:
 *  - Breakdown Summary: o que cada cena precisa (vai para o chefe de cada área)
 *  - Element List: inventário por departamento (vai para compras e produção)
 *  - DOOD: em que dias cada ator é necessário (vai para contrato e diária)
 *  - Shooting Schedule: o plano de filmagem dia a dia (vai para todo mundo)
 *
 * Tudo é derivado do que já existe — cenas, marcações, elementos e a ordem do
 * stripboard. Nenhum deles guarda estado próprio, então nunca ficam
 * desatualizados em relação à decupagem.
 */
import type { Cena, Elemento, RoteiroTag, Locacao } from '../types';
import { temaDe, oitavosParaPaginas, paginasParaOitavos } from './decupagem';
import { montarLinha, resumirDias, minutosDe, formatarDuracao, type ItemLinha } from './stripboard';
import type { StripboardItem } from '../types';

export interface DadosRelatorio {
  cenas: Cena[];
  itens: StripboardItem[];
  tags: RoteiroTag[];
  elementos: Elemento[];
  locacoes: Locacao[];
  tituloProjeto: string;
}

/** Em que dia de filmagem cada cena cai, segundo a ordem do stripboard. */
export function diaPorCena(linha: ItemLinha[]): Map<string, number> {
  const mapa = new Map<string, number>();
  let dia = 1;
  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') { dia += 1; continue; }
    if (it.tipo === 'SCENE') mapa.set(it.cena.id, dia);
  }
  return mapa;
}

/**
 * O nome aparece no texto da cena, como palavra inteira?
 *
 * A fronteira importa: sem ela, "Ana" casaria dentro de "Mariana" e o DOOD
 * colocaria a atriz em cenas onde ela não está — erro que vira cachê pago à
 * toa. O \b do JavaScript não serve aqui porque nome com acento não é ASCII.
 */
function aparece(texto: string, nome: string): boolean {
  const limpo = nome.trim();
  if (limpo.length < 2) return false;
  const escapado = limpo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapado}([^\\p{L}\\p{N}]|$)`, 'iu').test(texto);
  } catch {
    return texto.toLowerCase().includes(limpo.toLowerCase());
  }
}

function escapar(t: unknown): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------- 1. Breakdown Summary ----------

/** Resumo por cena: o que a produção precisa providenciar em cada uma. */
export function breakdownSummary(d: DadosRelatorio): string {
  const linha = montarLinha(d.cenas, d.itens);
  const dias = diaPorCena(linha);
  const cenasOrdenadas = linha.filter(i => i.tipo === 'SCENE').map(i => (i as any).cena as Cena);

  const blocos = cenasOrdenadas.map(c => {
    const daCena = d.tags.filter(t => t.cena_id === c.id);
    const porDepto = new Map<string, string[]>();

    for (const t of daCena) {
      const tema = temaDe(t.categoria);
      if (!porDepto.has(tema.rotulo)) porDepto.set(tema.rotulo, []);
      const el = d.elementos.find(e => e.id === t.elemento_id);
      porDepto.get(tema.rotulo)!.push(el?.nome || t.texto_selecionado);
    }

    const loc = d.locacoes.find(l => l.id === c.locacao_id);
    const listas = [...porDepto.entries()]
      .map(([depto, itens]) =>
        `<tr><td style="width:150px;font-weight:bold">${escapar(depto)}</td><td>${[...new Set(itens)].map(escapar).join(' · ')}</td></tr>`)
      .join('');

    return `
      <div style="page-break-inside:avoid;margin-bottom:18px;border:1px solid #ddd;border-radius:6px;overflow:hidden">
        <div style="background:#f4f4f4;padding:8px 10px;font-weight:bold;font-size:13px">
          CENA ${escapar(c.numero)} — ${escapar(c.descricao)}
          <span style="font-weight:normal;color:#666;font-size:11px">
            · ${(c.ambiente || '').toUpperCase()} ${(c.periodo || '').toUpperCase()}
            · ${escapar(loc?.nome || 'sem locação')}
            · ${escapar(c.paginas || '—')} pág
            · Diária ${dias.get(c.id) ?? 1}
          </span>
        </div>
        ${listas ? `<table style="width:100%">${listas}</table>` : '<div style="padding:8px 10px;color:#888;font-size:12px">Nada marcado nesta cena.</div>'}
      </div>`;
  }).join('');

  return `<h1>Breakdown por cena</h1>
    <div class="muted">${escapar(d.tituloProjeto)} · ${cenasOrdenadas.length} cena(s)</div>
    <div style="margin-top:20px">${blocos}</div>`;
}

// ---------- 2. Element List ----------

/** Inventário por departamento, com em quantas cenas cada item aparece. */
export function elementList(d: DadosRelatorio): string {
  const porDepto = new Map<string, { nome: string; cenas: string[]; aliases?: string[]; castId?: number }[]>();

  for (const el of d.elementos) {
    const tema = temaDe(el.categoria);
    const ocorrencias = d.tags.filter(t => t.elemento_id === el.id);
    const numeros = [...new Set(ocorrencias
      .map(t => d.cenas.find(c => c.id === t.cena_id)?.numero)
      .filter(Boolean) as string[])];

    if (!porDepto.has(tema.rotulo)) porDepto.set(tema.rotulo, []);
    porDepto.get(tema.rotulo)!.push({
      nome: el.nome, cenas: numeros, aliases: el.aliases, castId: el.cast_id,
    });
  }

  const secoes = [...porDepto.entries()].map(([depto, itens]) => {
    const linhas = itens
      .sort((a, b) => (a.castId ?? 999) - (b.castId ?? 999) || a.nome.localeCompare(b.nome))
      .map(i => `<tr>
        <td style="width:40px;text-align:center">${i.castId ?? ''}</td>
        <td><strong>${escapar(i.nome)}</strong>${i.aliases?.length ? `<br><span class="muted">também: ${i.aliases.map(escapar).join(', ')}</span>` : ''}</td>
        <td style="width:60px;text-align:center">${i.cenas.length}</td>
        <td>${i.cenas.join(', ') || '—'}</td>
      </tr>`).join('');

    return `<h2>${escapar(depto)} (${itens.length})</h2>
      <table><tr><th>#</th><th>Elemento</th><th>Cenas</th><th>Quais</th></tr>${linhas}</table>`;
  }).join('');

  return `<h1>Lista de elementos</h1>
    <div class="muted">${escapar(d.tituloProjeto)} · ${d.elementos.length} elemento(s)</div>
    ${secoes}`;
}

// ---------- 3. DOOD (Day Out of Days) ----------

export type CodigoDood = 'SW' | 'W' | 'H' | 'F' | 'SWF' | '';

export interface LinhaDood {
  nome: string;
  castId?: number;
  codigos: CodigoDood[];
  diasTrabalho: number;
  diasEspera: number;
}

/**
 * Monta a matriz do DOOD: cada ator contra cada dia de filmagem.
 *
 * A notação é a do mercado e cada letra tem consequência de contrato:
 *   SW = Start Work (primeiro dia)   W = Work (dia de trabalho)
 *   H  = Hold (não filma, mas está preso ao projeto — costuma ser pago)
 *   F  = Finish (último dia)         SWF = começa e termina no mesmo dia
 *
 * O "H" é o número que estoura orçamento: um ator que filma no dia 1 e no dia 8
 * normalmente é pago pelos seis dias de espera no meio.
 */
export function montarDood(d: DadosRelatorio, categoria = 'ELENCO'): { dias: number; linhas: LinhaDood[] } {
  const linha = montarLinha(d.cenas, d.itens);
  const porCena = diaPorCena(linha);
  const totalDias = Math.max(1, ...[...porCena.values()]);

  const elenco = d.elementos.filter(e => e.categoria === categoria);

  const linhas: LinhaDood[] = elenco.map(el => {
    const diasDoAtor = new Set<number>();

    // 1) Onde há marcação explícita, ela manda.
    for (const t of d.tags.filter(t => t.elemento_id === el.id)) {
      const dia = t.cena_id ? porCena.get(t.cena_id) : undefined;
      if (dia) diasDoAtor.add(dia);
    }

    // 2) E o texto da cena completa o resto.
    //
    // As marcações de elenco são únicas por texto — existe UMA "MARCOS" para o
    // roteiro inteiro, porque é assim que o destaque vale em todas as páginas.
    // Contar dias só por elas daria "1 diária" para o protagonista, e um DOOD
    // assim manda o ator embora no primeiro dia.
    for (const c of d.cenas) {
      if (!c.corpo) continue;
      if (aparece(c.corpo, el.nome) || (el.aliases || []).some(a => aparece(c.corpo!, a))) {
        const dia = porCena.get(c.id);
        if (dia) diasDoAtor.add(dia);
      }
    }

    const codigos: CodigoDood[] = [];
    if (diasDoAtor.size === 0) {
      for (let i = 0; i < totalDias; i++) codigos.push('');
      return { nome: el.nome, castId: el.cast_id, codigos, diasTrabalho: 0, diasEspera: 0 };
    }

    const primeiro = Math.min(...diasDoAtor);
    const ultimo = Math.max(...diasDoAtor);
    let espera = 0;

    for (let dia = 1; dia <= totalDias; dia++) {
      if (dia < primeiro || dia > ultimo) { codigos.push(''); continue; }
      const trabalha = diasDoAtor.has(dia);

      if (primeiro === ultimo && dia === primeiro) codigos.push('SWF');
      else if (dia === primeiro) codigos.push('SW');
      else if (dia === ultimo) codigos.push('F');
      else if (trabalha) codigos.push('W');
      else { codigos.push('H'); espera++; }
    }

    return { nome: el.nome, castId: el.cast_id, codigos, diasTrabalho: diasDoAtor.size, diasEspera: espera };
  });

  linhas.sort((a, b) => (a.castId ?? 999) - (b.castId ?? 999));
  return { dias: totalDias, linhas };
}

export function doodHtml(d: DadosRelatorio): string {
  const { dias, linhas } = montarDood(d);
  const cores: Record<string, string> = {
    SW: '#27ae60', W: '#3498db', H: '#e67e22', F: '#c0392b', SWF: '#8e44ad',
  };

  const cabecalho = Array.from({ length: dias }, (_, i) =>
    `<th style="width:26px;text-align:center">${i + 1}</th>`).join('');

  const corpo = linhas.map(l => `
    <tr>
      <td style="text-align:center">${l.castId ?? ''}</td>
      <td><strong>${escapar(l.nome)}</strong></td>
      ${l.codigos.map(c => `<td style="text-align:center;font-size:10px;font-weight:bold;${c ? `background:${cores[c]};color:#fff` : ''}">${c}</td>`).join('')}
      <td style="text-align:center">${l.diasTrabalho}</td>
      <td style="text-align:center;${l.diasEspera > 0 ? 'color:#c0392b;font-weight:bold' : ''}">${l.diasEspera}</td>
    </tr>`).join('');

  const totalEspera = linhas.reduce((s, l) => s + l.diasEspera, 0);

  return `<h1>DOOD — Day Out of Days</h1>
    <div class="muted">${escapar(d.tituloProjeto)} · ${linhas.length} no elenco · ${dias} diária(s)</div>
    <table style="margin-top:16px">
      <tr><th style="width:34px">#</th><th>Elenco</th>${cabecalho}<th style="width:40px">Trab.</th><th style="width:40px">Esp.</th></tr>
      ${corpo}
    </table>
    <p style="margin-top:14px;font-size:11px;color:#555">
      <strong>SW</strong> primeiro dia · <strong>W</strong> trabalha · <strong>H</strong> espera (preso ao projeto) ·
      <strong>F</strong> último dia · <strong>SWF</strong> começa e termina no mesmo dia.
    </p>
    ${totalEspera > 0 ? `<p style="font-size:12px;color:#c0392b"><strong>${totalEspera} dia(s) de espera no total.</strong> Cada um costuma ser pago sem filmar — reordenar o stripboard para juntar as cenas de um mesmo ator reduz esse número.</p>` : ''}`;
}

// ---------- 4. Shooting Schedule ----------

/** O plano de filmagem: cada dia com suas cenas, na ordem, com totais. */
export function shootingSchedule(d: DadosRelatorio): string {
  const linha = montarLinha(d.cenas, d.itens);
  const resumos = resumirDias(linha, c => d.locacoes.find(l => l.id === c.locacao_id)?.nome || '');

  const blocos: string[] = [];
  let dia = 1;
  let linhasDoDia: string[] = [];

  const fecharDia = (chave: string) => {
    const r = resumos.get(chave);
    blocos.push(`
      <div style="page-break-inside:avoid;margin-bottom:20px">
        <h2 style="background:#2d3436;color:#fff;padding:6px 10px;border:none;margin-bottom:0">
          DIÁRIA ${dia}
          <span style="font-weight:normal;font-size:11px;opacity:.85">
            · ${r?.cenas ?? 0} cena(s) · ${r?.paginas ?? '—'} páginas · ${r?.duracao ?? '—'}
            ${(r?.locacoes.length ?? 0) > 1 ? ` · ${r!.locacoes.length} locações` : ''}
          </span>
        </h2>
        <table>
          <tr><th style="width:44px">Cena</th><th>Descrição</th><th style="width:70px">Amb./Per.</th><th>Locação</th><th style="width:60px">Págs</th><th style="width:64px">Estim.</th></tr>
          ${linhasDoDia.join('') || '<tr><td colspan="6" style="color:#888">Sem cenas neste dia.</td></tr>'}
        </table>
      </div>`);
    linhasDoDia = [];
  };

  for (const it of linha) {
    if (it.tipo === 'DAY_BREAK') { fecharDia(it.id); dia += 1; continue; }

    if (it.tipo === 'SCENE') {
      const c = it.cena;
      const loc = d.locacoes.find(l => l.id === c.locacao_id);
      linhasDoDia.push(`<tr>
        <td style="font-weight:bold">${escapar(c.numero)}</td>
        <td>${escapar(c.descricao)}</td>
        <td>${(c.ambiente || '').toUpperCase()} ${(c.periodo || '').toUpperCase()}</td>
        <td>${escapar(loc?.nome || '—')}</td>
        <td>${escapar(c.paginas || '—')}</td>
        <td>${escapar(c.estimativa || '—')}</td>
      </tr>`);
    } else {
      // Banners aparecem no meio do dia, como acontecem no set.
      linhasDoDia.push(`<tr style="background:#f0f0f0">
        <td colspan="6" style="font-size:11px;font-weight:bold">
          ${escapar((it.item.titulo || it.tipo).toUpperCase())}
          ${it.item.duracao_min ? ` — ${formatarDuracao(it.item.duracao_min)}` : ''}
        </td>
      </tr>`);
    }
  }
  fecharDia('__ultimo__');

  const oitavos = d.cenas.reduce((s, c) => s + paginasParaOitavos(c.paginas), 0);
  const minutos = d.cenas.reduce((s, c) => s + minutosDe(c.estimativa), 0);

  return `<h1>Plano de filmagem</h1>
    <div class="muted">
      ${escapar(d.tituloProjeto)} · ${dia} diária(s) · ${d.cenas.length} cenas ·
      ${oitavosParaPaginas(oitavos)} páginas · ${formatarDuracao(minutos)} estimadas
    </div>
    <div style="margin-top:18px">${blocos.join('')}</div>`;
}

// ---------- CSV ----------

function csv(linhas: (string | number)[][]): string {
  return linhas
    .map(l => l.map(c => {
      const t = String(c ?? '');
      return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    }).join(';'))
    .join('\r\n');
}

export function elementListCsv(d: DadosRelatorio): string {
  const linhas: (string | number)[][] = [['Departamento', 'Cast ID', 'Elemento', 'Também chamado de', 'Nº de cenas', 'Cenas']];
  for (const el of d.elementos) {
    const ocorrencias = d.tags.filter(t => t.elemento_id === el.id);
    const numeros = [...new Set(ocorrencias
      .map(t => d.cenas.find(c => c.id === t.cena_id)?.numero).filter(Boolean) as string[])];
    linhas.push([
      temaDe(el.categoria).rotulo, el.cast_id ?? '', el.nome,
      (el.aliases || []).join(' / '), numeros.length, numeros.join(' '),
    ]);
  }
  return csv(linhas);
}

export function doodCsv(d: DadosRelatorio): string {
  const { dias, linhas } = montarDood(d);
  const cabecalho = ['Cast ID', 'Elenco', ...Array.from({ length: dias }, (_, i) => `Dia ${i + 1}`), 'Trabalho', 'Espera'];
  const corpo = linhas.map(l => [l.castId ?? '', l.nome, ...l.codigos, l.diasTrabalho, l.diasEspera]);
  return csv([cabecalho, ...corpo]);
}

export function shootingScheduleCsv(d: DadosRelatorio): string {
  const linha = montarLinha(d.cenas, d.itens);
  const porCena = diaPorCena(linha);
  const cabecalho = ['Diária', 'Ordem', 'Cena', 'Descrição', 'Ambiente', 'Período', 'Locação', 'Páginas', 'Estimativa'];

  const corpo: (string | number)[][] = [];
  let ordem = 0;
  for (const it of linha) {
    if (it.tipo !== 'SCENE') continue;
    const c = it.cena;
    const loc = d.locacoes.find(l => l.id === c.locacao_id);
    corpo.push([
      porCena.get(c.id) ?? 1, ++ordem, c.numero, c.descricao,
      (c.ambiente || '').toUpperCase(), (c.periodo || '').toUpperCase(),
      loc?.nome || '', c.paginas || '', c.estimativa || '',
    ]);
  }
  return csv([cabecalho, ...corpo]);
}
