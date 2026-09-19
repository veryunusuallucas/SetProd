import type { Perfil } from '../types';
import type { Papel } from './permissoes';

/**
 * As três camadas da ficha da equipe — e a exceção à leitura global.
 *
 * O PROBLEMA
 * A RLS de `registros` libera `select` para qualquer membro. Então hoje TODO
 * convidado enxerga o CPF, o remédio de uso contínuo, o cachê e a conta
 * bancária de todo mundo — inclusive o figurante chamado para uma diária.
 *
 * Pela LGPD, saúde é dado pessoal sensível (art. 5º, II), com tratamento mais
 * restrito que dado comum. CPF e dado bancário não são "sensíveis" na letra da
 * lei, mas são o que causa prejuízo direto se vazarem.
 *
 * Em todo o resto do app, ler é global de propósito — produção de cinema
 * funciona com todo mundo enxergando a diária, o orçamento e o roteiro. **O
 * `Perfil` é a exceção**, e é a única.
 */

/** Ficha pública: o crachá. Todo membro vê. */
export const CAMPOS_PUBLICOS = [
  'id', 'projeto_id', 'nome', 'sobrenome', 'nome_social', 'funcao',
  'departamento_id', 'telefone', 'email', 'instagram', 'drt', 'experiencia',
] as const;

/**
 * Ficha restrita: documento, dinheiro e vínculo.
 *
 * `valor_diaria` está aqui e é político: cachê visível para a equipe inteira
 * gera conflito real numa produção. Restrito por padrão.
 */
export const CAMPOS_RESTRITOS = [
  'cpf', 'rg', 'data_nascimento', 'endereco', 'valor_diaria', 'tipo_vinculo',
  'chave_pix', 'banco', 'agencia', 'conta', 'cnpj', 'razao_social',
] as const;

/**
 * Ficha médica.
 *
 * ⚠️ EMERGÊNCIA TEM QUE FUNCIONAR. No set, com alguém passando mal, ninguém vai
 * achar o produtor para desbloquear uma tela. A regra pretendida é: quem está
 * escalado numa diária acessa a ficha médica de quem também está escalado
 * naquela diária — **com log**. Acesso registrado é diferente de acesso
 * bloqueado, e aqui o certo é registrar, não impedir.
 */
export const CAMPOS_MEDICOS = [
  'contato_emergencia', 'info_medica', 'tipo_sanguineo', 'alergias',
  'medicamentos_continuos', 'restricao_alimentar', 'plano_saude',
] as const;

export type Camada = 'publica' | 'restrita' | 'medica';

export function camadaDoCampo(campo: string): Camada {
  if ((CAMPOS_RESTRITOS as readonly string[]).includes(campo)) return 'restrita';
  if ((CAMPOS_MEDICOS as readonly string[]).includes(campo)) return 'medica';
  return 'publica';
}

interface Quem {
  papel: Papel;
  /** O perfil que ESTA conta é na produção. */
  meuPerfilId?: string | null;
  /** Estamos vendo a ficha de quem? */
  perfilId: string;
  /** Emergência: os dois estão escalados na mesma diária aberta. */
  mesmaDiaria?: boolean;
}

/**
 * Posso ver esta camada desta pessoa?
 *
 * É a mesma regra da RLS de leitura (`pode_ver_ficha` em `fichas.sql`) e de
 * quem sobe as camadas (`fichaEmCamadas.ts`). Ver o fim deste arquivo.
 */
export function podeVerCamada(camada: Camada, quem: Quem): boolean {
  if (camada === 'publica') return true;

  // A própria ficha, sempre. Sem isto ninguém atualiza o próprio PIX.
  if (quem.meuPerfilId && quem.meuPerfilId === quem.perfilId) return true;

  if (quem.papel === 'dono' || quem.papel === 'admin') return true;

  // Falha abrindo, como o resto do cliente: projeto só local, offline, sem
  // Supabase. Trancar aí esconderia a ficha do próprio dono do aparelho.
  if (quem.papel === 'desconhecido') return true;

  if (camada === 'medica' && quem.mesmaDiaria) return true;

  return false;
}

/** A ficha com o que não pode ser visto removido. */
export function fichaVisivel(perfil: Perfil, quem: Quem): Partial<Perfil> {
  const saida: Record<string, unknown> = {};
  for (const [campo, valor] of Object.entries(perfil)) {
    if (podeVerCamada(camadaDoCampo(campo), quem)) saida[campo] = valor;
  }
  return saida as Partial<Perfil>;
}

/*
 * =============================================================================
 * O ARMAZENAMENTO (Etapa 3 do ROADMAP — implementado em 18/09/2026)
 * =============================================================================
 *
 * O `registros` é jsonb genérico e a RLS esconde LINHA, não campo. A decisão foi
 * a (a), linha separada — e ela foi feita na fronteira com o servidor, sem
 * partir o `Perfil` do app: a ficha sobe em três linhas (`perfis`,
 * `perfis_restritos`, `perfis_medicos`) e é remontada ao descer. Ver
 * `fichaEmCamadas.ts` e `supabase/sql/fichas.sql`.
 *
 * O que `podeVerCamada` decide aqui é o MESMO que a RLS decide lá
 * (`pode_ver_ficha`). Quem não pode ver uma camada não a recebe do servidor,
 * e a cópia antiga some deste aparelho ao abrir a produção.
 *
 * A emergência (`mesmaDiaria`) não passa por aqui: ela é pontual e registrada,
 * pela função `ficha_medica_de_emergencia` — ver `EmergenciaMedica.tsx`.
 */
