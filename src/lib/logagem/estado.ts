import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';

/**
 * O "agora" da Logagem numa diária: claquete e câmera ativa.
 *
 * ⚠️ O ID É DERIVADO DA DIÁRIA, e não sorteado. Se o DIT abre a Logagem no
 * notebook e o 2º AC no celular antes de qualquer sync, os dois criam o estado
 * da mesma diária. Com id sorteado, seriam DUAS linhas — e cada tela seguiria
 * uma, com contadores diferentes. Com o mesmo id, o sync trata as duas criações
 * como o mesmo registro e a última vence, que é o comportamento de qualquer
 * outra edição do app.
 */
export const idDoEstado = (diariaId: string) => `logest-${diariaId}`;

/** O ponto de partida do Lumavi (`estadoPadrao`), para uma produção que nunca logou. */
export const PADRAO: Omit<EstadoDaLogagem, 'id' | 'projeto_id' | 'diaria_id' | 'departamento_id'> = {
  cena: '1',
  plano: 'A',
  take: 1,
  ambiente: 'INT',
  luz: 'DIA',
  audio: 'DIRETO',
  nd: 'Clear',
  obs: '',
  plano_letras: true,
  camera_id: 'A',
  cartao: '001',
  posicao: 'C',
  proximo_clipe: 1,
  nomenclatura: 'camid',
  template: 'fx30_{CARD}_{CLIP}',
  zeros_clipe: 4,
  fps: '24',
  resolucao: '4K UHD (3840x2160)',
  codec: 'XAVC S-I',
  wb: '5600K',
  shutter: '180°',
  iso: '800',
  lut: '',
  lente: '35mm',
  abertura: 'f/2.8',
  revisar_antes: false,
};

/**
 * O estado de uma diária que ainda não tem, a partir do dia anterior.
 *
 * É o "Arquivar & Nova Diária" do Lumavi, sem botão (PLANO-logagem §2.12). A
 * câmera é a mesma do dia anterior: mesmo kit, mesmo setup, mesma nomenclatura,
 * e o CLIPE CONTINUA de onde parou — a câmera não zera o contador porque virou o
 * dia. O que recomeça é a claquete, porque cena, plano e take são do roteiro do
 * dia, e não da câmera.
 */
export function herdarEstado(
  anterior: EstadoDaLogagem | undefined,
  ids: { projeto_id: string; diaria_id: string; departamento_id?: string }
): EstadoDaLogagem {
  const base = { ...PADRAO, ...ids, id: idDoEstado(ids.diaria_id) };
  if (!anterior) return base;

  const { id: _id, projeto_id: _p, diaria_id: _d, atualizado_em: _a, ...daCamera } = anterior;
  return {
    ...base,
    ...daCamera,
    ...ids,
    id: idDoEstado(ids.diaria_id),
    // A claquete recomeça. Ambiente, luz, áudio e ND ficam (herdados acima):
    // o Lumavi mantinha os quatro, porque costumam valer para o dia seguinte.
    cena: PADRAO.cena,
    plano: anterior.plano_letras === false ? '1' : 'A',
    take: 1,
    obs: '',
  };
}

/**
 * Garante que a diária tem estado, criando a partir da última diária logada.
 *
 * "Última" é pela DATA da diária, e não pela hora em que o estado foi mexido:
 * quem abriu a Diária 5 para conferir algo não pode fazer a Diária 6 herdar a
 * câmera de uma Diária 3 editada por último. Vale o dia mais próximo ANTES; sem
 * nenhum antes (a primeira diária foi logada fora de ordem), o mais próximo
 * DEPOIS — ainda é a mesma câmera, e é melhor que o padrão de fábrica.
 */
export async function garantirEstado(projetoId: string, diariaId: string, departamentoId?: string) {
  const id = idDoEstado(diariaId);
  if (await db.log_estado.get(id)) return;

  const [estados, diarias] = await Promise.all([
    db.log_estado.where('projeto_id').equals(projetoId).toArray(),
    db.diarias.where('projeto_id').equals(projetoId).toArray(),
  ]);
  const dataDe = new Map(diarias.map(d => [d.id, d.data || '']));
  const minhaData = dataDe.get(diariaId) || '';

  const candidatos = estados
    .filter(e => e.diaria_id !== diariaId)
    .map(e => ({ e, data: dataDe.get(e.diaria_id) || '' }));
  const antes = candidatos.filter(c => c.data && c.data <= minhaData).sort((a, b) => b.data.localeCompare(a.data));
  const depois = candidatos.filter(c => c.data > minhaData).sort((a, b) => a.data.localeCompare(b.data));
  const anterior = (antes[0] ?? depois[0] ?? candidatos[0])?.e;

  // `add` e não `put`: se outra aba criou no meio do caminho, a dela fica.
  await db.log_estado.add(herdarEstado(anterior, { projeto_id: projetoId, diaria_id: diariaId, departamento_id: departamentoId }))
    .catch(() => { /* já existe — era isso que se queria */ });
}

export function mudarEstado(diariaId: string, mudancas: Partial<EstadoDaLogagem>) {
  return db.log_estado.update(idDoEstado(diariaId), mudancas);
}
