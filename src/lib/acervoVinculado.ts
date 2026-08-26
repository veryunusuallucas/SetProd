import { db } from '../db/db';
import { supabase, supabaseConfigurado } from './supabase';
import type { Projeto } from '../types';

/**
 * A ponte estreita com o SetGear.
 *
 * O SetGear é o app de logística de equipamento da fotografia: o que sai da
 * base, o que chega no set, o que volta. Ele precisa saber QUANDO SE FILMA — e
 * isso é do SetProd. A produção precisa saber SE TUDO VOLTOU — e isso é do
 * SetGear. Nenhum dos dois precisa do resto.
 *
 * POR QUE NÃO É SÓ ADICIONAR A CONTA DO SETGEAR COMO MEMBRO
 * O caminho curto seria esse, e ele está errado. A política de leitura de
 * `registros` é uma só, SEM filtro por tabela — e `registros` espelha as 24
 * tabelas do Dexie. Membro do projeto lê tudo: despesas, acertos, e em `perfis`
 * o CPF, o cachê e a ficha médica de toda a equipe.
 *
 * O `camposSensiveis.ts` esconde isso NA TELA. O servidor não: a RLS esconde
 * linha, não campo, e `registros.dados` é jsonb opaco para ela. Uma conta membro
 * que chame a API direto recebe o jsonb cru.
 *
 * Hoje isso não morde, porque quem usa o SetGear é o dono das produções. Morde
 * no dia em que um assistente de câmera tiver conta própria — e é para esse dia
 * que a ponte existe.
 *
 * O DESENHO
 *   SetProd → projeto_publicado → SetGear    projeto, diárias, veículos. Nada mais.
 *   SetGear → diaria_resumo     → SetProd    contagens. NUNCA nome de item.
 *
 * Nenhum lado vira membro do outro. Cada um publica o pouco que o outro precisa.
 */

export interface AcervoDisponivel {
  id: string;
  nome: string;
}

/**
 * Os acervos que esta conta pode oferecer.
 *
 * A RLS já filtra: só volta o que ela é membro. Não há filtro no cliente, e nem
 * deveria haver — filtrar aqui daria a impressão de que a lista é a proteção,
 * quando quem protege é a política do servidor.
 *
 * ⚠️ Só enxerga acervo da PRÓPRIA conta. Se um dia o equipamento for de outra
 * pessoa — um DP com acervo dele —, vincular vai precisar de um convite, como o
 * de projeto. Não existe ainda; só não assuma que a lista sempre terá algo.
 */
export async function meusAcervos(): Promise<AcervoDisponivel[]> {
  if (!supabaseConfigurado) return [];

  const { data, error } = await supabase.from('acervos').select('id, nome').order('nome');
  if (error) {
    // Tabela ausente = o SQL do SetGear ainda não foi rodado neste projeto do
    // Supabase. Não é erro do usuário e não vale assustar: a seção some da tela.
    console.warn('[SetProd] Não consegui listar os acervos:', error.message);
    return [];
  }
  return (data as AcervoDisponivel[]) ?? [];
}

/** Os acervos já vinculados a esta produção. */
export async function acervosDaProducao(projetoId: string): Promise<AcervoDisponivel[]> {
  if (!supabaseConfigurado) return [];

  const { data, error } = await supabase
    .from('projeto_acervo')
    .select('acervo_id, acervos(id, nome)')
    .eq('projeto_id', projetoId);

  if (error) {
    console.warn('[SetProd] Não consegui ler os acervos da produção:', error.message);
    return [];
  }

  return (data ?? [])
    .map((linha: any) => linha.acervos)
    .filter((a: any): a is AcervoDisponivel => Boolean(a?.id));
}

/**
 * Liga um acervo a esta produção.
 *
 * A PRODUÇÃO CONVIDA O ACERVO, NUNCA O CONTRÁRIO. A política de insert em
 * `projeto_acervo` exige `e_membro(projeto_id)`, então quem descobrir um
 * `projeto_id` por aí não consegue se plugar nele por conta própria.
 */
export async function vincularAcervo(projetoId: string, acervoId: string): Promise<void> {
  const { error } = await supabase
    .from('projeto_acervo')
    .upsert({ projeto_id: projetoId, acervo_id: acervoId }, { onConflict: 'projeto_id,acervo_id' });
  if (error) throw error;

  // Publica na hora. Sem isto o acervo entraria e veria uma produção sem diária
  // nenhuma, até alguém salvar alguma coisa por acaso.
  await publicarParaAcervo(projetoId);
}

/**
 * Corta o vínculo.
 *
 * ⚠️ NÃO APAGA O QUE JÁ DESCEU. O SetGear tem cópia local e funciona offline —
 * é a natureza do local-first, a mesma coisa que acontece ao remover um membro
 * da produção. Cortar o vínculo corta o acesso dali para frente, e a tela
 * precisa dizer isso antes de a pessoa clicar.
 */
export async function desvincularAcervo(projetoId: string, acervoId: string): Promise<void> {
  const { error } = await supabase
    .from('projeto_acervo')
    .delete()
    .eq('projeto_id', projetoId)
    .eq('acervo_id', acervoId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// A projeção — o que atravessa a ponte
// ---------------------------------------------------------------------------

/**
 * Quem é o DP desta produção.
 *
 * A spec da ponte pedia um campo `dp_fotografia` que não existe em `Projeto` — e
 * não deveria existir: o diretor de fotografia é um CRÉDITO, e `Credito` já tem
 * `papel`. Criar um campo solto seria uma segunda fonte de verdade para a mesma
 * pessoa, exatamente como o "Produtor Executivo" das configurações já é.
 */
function acharDP(projeto: Projeto): string | null {
  const credito = (projeto.creditos || []).find(c =>
    /fotografia|^dp$/i.test((c.papel || '').trim())
  );
  return credito?.nome || null;
}

/**
 * Manda para o SetGear o pouco que ele precisa: quando se filma, e com o quê.
 *
 * A LISTA DE CAMPOS É FECHADA DE PROPÓSITO. Não é economia de bytes — é a
 * fronteira. Cada campo aqui é uma decisão de expor aquilo; mandar `...diaria`
 * faria observações, orçamento do dia e equipe escalada atravessarem a ponte
 * sem ninguém ter decidido nada.
 */
export async function publicarParaAcervo(projetoId: string): Promise<void> {
  if (!supabaseConfigurado || !navigator.onLine) return;

  /*
    Sem vínculo, não publica.

    Este `return` não é otimização: publicar CRIA a linha, e linha criada é dado
    exposto a quem vier a se vincular depois. Uma produção que nunca teve acervo
    não deveria deixar rastro do lado de lá.
  */
  const { data: vinculos } = await supabase
    .from('projeto_acervo')
    .select('acervo_id')
    .eq('projeto_id', projetoId)
    .limit(1);
  if (!vinculos?.length) return;

  const projeto = await db.projetos.get(projetoId);
  if (!projeto) return;

  const diarias = await db.diarias.where('projeto_id').equals(projetoId).toArray();
  const veiculos = await db.veiculos.where('projeto_id').equals(projetoId).toArray().catch(() => []);

  const { error } = await supabase.from('projeto_publicado').upsert(
    {
      projeto_id: projeto.id,
      nome: projeto.nome,
      diretor: projeto.diretor ?? null,
      dp_fotografia: acharDP(projeto),

      diarias: diarias
        .sort((a, b) => a.numero - b.numero)
        .map(d => ({
          id: d.id,
          numero: d.numero,
          data: d.data, // YYYY-MM-DD — o SetGear normaliza na entrada dele
          /*
            A chamada é o primeiro horário do cronograma, que é como a Ordem do
            Dia já a trata. Sem cronograma, `null`: chutar um horário faria a
            fotografia planejar a saída da base por um dado inventado.
          */
          horario_chamada: d.horarios?.[0]?.hora ?? null,
        })),

      veiculos: veiculos.map(v => ({
        id: v.id,
        nome: v.nome,
        placa: v.placa ?? null,
        tipo: v.tipo ?? null,
      })),

      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'projeto_id' }
  );

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// O retorno
// ---------------------------------------------------------------------------

export interface ResumoConferencia {
  por_departamento: { nome: string; total: number; saiu: number; voltou: number; pendente: number }[];
  fase_atual: string | null;
  pendencias: number;
  fechada: boolean;
}

/**
 * O que o SetGear diz sobre o equipamento desta diária.
 *
 * Contagens, nunca lista. E isso não depende deste arquivo se comportar: o banco
 * impõe um CHECK que RECUSA a linha se aparecer qualquer chave fora de
 * `nome/total/saiu/voltou/pendente`. Um combinado que vive só no cliente se rompe
 * no primeiro descuido — alguém acrescenta `itens_pendentes` para depurar, e o
 * inventário passa a vazar sem ninguém perceber.
 */
export async function resumoDaDiaria(
  projetoId: string,
  diariaId: string
): Promise<ResumoConferencia | null> {
  if (!supabaseConfigurado || !navigator.onLine) return null;

  const { data, error } = await supabase
    .from('diaria_resumo')
    .select('por_departamento, fase_atual, pendencias, fechada')
    .eq('projeto_id', projetoId)
    .eq('diaria_id', diariaId)
    .maybeSingle();

  if (error) {
    console.warn('[SetProd] Não consegui ler o resumo da conferência:', error.message);
    return null;
  }
  return (data as ResumoConferencia) ?? null;
}
