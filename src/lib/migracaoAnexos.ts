import { db } from '../db/db';
import { migrarValor } from './arquivos';

/**
 * Traz para o Storage os anexos que ainda estão em base64 dentro das linhas.
 *
 * Roda sozinha, uma vez por projeto, quando ele abre. Não é obrigatória para
 * nada funcionar — o resolvedor continua abrindo base64 antigo — mas enquanto
 * um roteiro estiver dentro da linha ele não viaja para a outra equipe, que é
 * justamente o ponto desta fase.
 *
 * Feita aos poucos e sem transação: são arquivos grandes, e uma transação longa
 * no IndexedDB trava a interface. Se parar no meio, a próxima abertura continua
 * de onde estava — cada linha convertida já está convertida.
 */

const JA_FEITO = (projetoId: string) => `setprod_anexos_migrados_${projetoId}`;

export async function migrarAnexosDoProjeto(projetoId: string): Promise<number> {
  if (localStorage.getItem(JA_FEITO(projetoId))) return 0;

  let convertidos = 0;

  try {
    // ---- roteiro em PDF: o maior de todos ----
    const roteiros = await db.roteiro_pdfs.where('projeto_id').equals(projetoId).toArray();
    for (const r of roteiros) {
      const novo = await migrarValor(projetoId, r.dados, r.nome || 'roteiro.pdf');
      if (novo && novo !== r.dados) {
        await db.roteiro_pdfs.update(r.id, { dados: novo });
        convertidos++;
      }
    }

    // ---- anexos da Ordem do Dia ----
    const diarias = await db.diarias.where('projeto_id').equals(projetoId).toArray();
    for (const d of diarias) {
      if (!d.anexos?.length) continue;
      let mexeu = false;

      const anexos = [];
      for (const a of d.anexos) {
        const novo = await migrarValor(projetoId, a.dados, a.nome);
        if (novo && novo !== a.dados) { mexeu = true; anexos.push({ ...a, dados: novo }); }
        else anexos.push(a);
      }

      if (mexeu) { await db.diarias.update(d.id, { anexos }); convertidos++; }
    }

    // ---- storyboard das cenas ----
    const cenas = await db.cenas.where('projeto_id').equals(projetoId).toArray();
    for (const c of cenas) {
      if (!c.anexos?.length) continue;
      let mexeu = false;

      const anexos = [];
      for (const [i, valor] of c.anexos.entries()) {
        const novo = await migrarValor(projetoId, valor, `storyboard-${c.numero || i}.png`);
        if (novo && novo !== valor) { mexeu = true; anexos.push(novo); }
        else anexos.push(valor);
      }

      if (mexeu) { await db.cenas.update(c.id, { anexos }); convertidos++; }
    }

    // ---- comprovantes de despesa ----
    const despesas = await db.despesas.where('projeto_id').equals(projetoId).toArray();
    for (const d of despesas) {
      const novo = await migrarValor(projetoId, d.comprovante, `comprovante-${d.descricao || d.id}`);
      if (novo && novo !== d.comprovante) {
        await db.despesas.update(d.id, { comprovante: novo });
        convertidos++;
      }
    }

    // ---- documentos ----
    const documentos = await db.documentos.where('projeto_id').equals(projetoId).toArray();
    for (const doc of documentos) {
      const url = await migrarValor(projetoId, doc.url, doc.nome);
      // A miniatura é o MESMO arquivo do documento quando é imagem — reaponta
      // para a referência nova em vez de subir uma segunda cópia.
      const preview = doc.preview_url === doc.url ? url : await migrarValor(projetoId, doc.preview_url, doc.nome);

      if (url !== doc.url || preview !== doc.preview_url) {
        await db.documentos.update(doc.id, { url: url as string, preview_url: preview as string | undefined });
        convertidos++;
      }
    }

    localStorage.setItem(JA_FEITO(projetoId), String(Date.now()));
  } catch (e) {
    // Sem marcar como feito: a próxima abertura tenta o que faltou.
    console.warn('[SetProd] Migração de anexos parou no meio (continua depois):', e);
  }

  return convertidos;
}
