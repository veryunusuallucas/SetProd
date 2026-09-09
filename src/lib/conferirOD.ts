/**
 * Confere se a Ordem do Dia diagramada ainda diz a verdade.
 *
 * POR QUE ISTO EXISTE
 * A exportação da OD pedia à IA, literalmente, "Crie uma Ordem do Dia
 * profissional" — passando só o nome do projeto, o número da diária e uma lista
 * de nomes. Cenas, horários, locações e transporte ela inventava, porque foi
 * mandada inventar. O papel saiu para a equipe com uma produção que não existe.
 *
 * O conserto de verdade é o outro: a IA agora RECEBE a Ordem do Dia pronta,
 * montada pelo app com os dados reais, e a instrução é diagramar sem alterar
 * nada. Isto aqui é o cinto de segurança — porque "a instrução proíbe" não é
 * garantia, e uma OD errada não é um bug que dá para descobrir depois: ela
 * manda gente para o lugar errado na hora errada.
 *
 * O QUE ELA CONFERE, E O QUE NÃO
 * Só o que é verificável sem interpretar: se um horário, um número de cena, um
 * nome de quem está escalado ou uma locação sumiu do documento. Ela NÃO julga
 * se o texto ao redor está certo — para isso teria que entender a OD, e aí seria
 * mais uma opinião de máquina em cima da primeira.
 *
 * Some coisa = a diagramação comeu informação. Aparece coisa a mais = ela pode
 * ter inventado, mas isso não dá para provar por comparação de texto, então a
 * tela avisa e deixa a pessoa olhar.
 */

/** Tira as tags e devolve só o texto, com os espaços normalizados. */
export function soOTexto(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normaliza para comparar sem tropeçar em acento, caixa ou espaço duplo. */
function achatar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface FatoDaOD {
  /** O que é, para a mensagem: "horário", "cena", "quem está escalado". */
  tipo: string;
  /** O texto que precisa aparecer no documento. */
  valor: string;
}

export interface Conferencia {
  faltando: FatoDaOD[];
  /** Horários que aparecem na OD gerada e NÃO estavam nos dados. */
  horariosInventados: string[];
  ok: boolean;
}

/** Todo "07:30" do texto. */
function horariosDe(texto: string): string[] {
  return [...texto.matchAll(/\b([01]?\d|2[0-3]):[0-5]\d\b/g)].map(m => m[0].padStart(5, '0'));
}

/**
 * Compara o documento gerado com os fatos que ele tinha que carregar.
 *
 * A busca é por SUBSTRING no texto achatado, e não por igualdade: a diagramação
 * pode legitimamente escrever "Cena 12 — INT. COZINHA" onde o dado dizia
 * "Cena 12". O que ela não pode é não escrever.
 */
export function conferirOD(htmlGerado: string, fatos: FatoDaOD[], htmlOriginal: string): Conferencia {
  const texto = achatar(soOTexto(htmlGerado));

  const faltando = fatos.filter(f => {
    const alvo = achatar(f.valor);
    return alvo.length > 0 && !texto.includes(alvo);
  });

  /*
    Horário que apareceu do nada é o sintoma mais perigoso desta falha.

    Foi assim que ela se mostrou: uma OD inteira de horários plausíveis e
    falsos. Nome inventado alguém estranha; "chamada 06:00" ninguém questiona —
    e é o que faz a equipe sair de casa na hora errada.
  */
  const nosDados = new Set(horariosDe(soOTexto(htmlOriginal)));
  const horariosInventados = [...new Set(horariosDe(soOTexto(htmlGerado)))]
    .filter(h => !nosDados.has(h));

  return {
    faltando,
    horariosInventados,
    ok: faltando.length === 0 && horariosInventados.length === 0,
  };
}

/** A frase que a tela mostra quando algo não bateu. */
export function descreverConferencia(c: Conferencia): string {
  const partes: string[] = [];

  if (c.faltando.length > 0) {
    const porTipo = new Map<string, string[]>();
    for (const f of c.faltando) {
      const lista = porTipo.get(f.tipo) || [];
      lista.push(f.valor);
      porTipo.set(f.tipo, lista);
    }
    for (const [tipo, valores] of porTipo) {
      const mostra = valores.slice(0, 6).join(', ');
      partes.push(`${tipo}: ${mostra}${valores.length > 6 ? ` e mais ${valores.length - 6}` : ''}`);
    }
  }

  if (c.horariosInventados.length > 0) {
    partes.push(`horários que não existem na diária: ${c.horariosInventados.slice(0, 6).join(', ')}`);
  }

  return partes.join(' · ');
}
