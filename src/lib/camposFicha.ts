import type { CampoCustomizado, Projeto, TipoCampo, Perfil } from '../types';

/**
 * Fonte única dos campos da ficha (v4 §6.2): a mesma definição alimenta a ficha do
 * membro, o formulário do link público e a importação de CSV. Sem listas duplicadas.
 */

export type GrupoCampo = 'pessoal' | 'profissional' | 'saude' | 'financeiro' | 'custom';

export interface DefinicaoCampo {
  id: string;              // chave em Perfil, ou id do campo customizado
  nome: string;            // label
  tipo: TipoCampo;
  grupo: GrupoCampo;
  opcoes?: string[];
  obrigatorio: boolean;
  custom: boolean;         // true = mora em Perfil.custom[id]
  placeholder?: string;
}

export const ROTULO_GRUPO: Record<GrupoCampo, string> = {
  pessoal: 'Pessoais e Contato',
  profissional: 'Profissional / Set',
  saude: 'Saúde & Emergência',
  financeiro: 'Financeiro / Contrato',
  custom: 'Campos do Projeto',
};

/** Os campos que já existem hoje no app — o construtor parte daqui (§6.2). */
export const CAMPOS_PADRAO: Omit<DefinicaoCampo, 'obrigatorio' | 'custom'>[] = [
  // Pessoais e contato
  { id: 'nome', nome: 'Nome', tipo: 'texto', grupo: 'pessoal', placeholder: 'Como você é chamado no set' },
  { id: 'sobrenome', nome: 'Sobrenome', tipo: 'texto', grupo: 'pessoal' },
  { id: 'nome_social', nome: 'Nome Social / Apelido de Set', tipo: 'texto', grupo: 'pessoal' },
  { id: 'cpf', nome: 'CPF', tipo: 'texto', grupo: 'pessoal', placeholder: '000.000.000-00' },
  { id: 'rg', nome: 'RG', tipo: 'texto', grupo: 'pessoal' },
  { id: 'data_nascimento', nome: 'Data de Nascimento', tipo: 'data', grupo: 'pessoal' },
  { id: 'telefone', nome: 'Telefone / WhatsApp', tipo: 'telefone', grupo: 'pessoal', placeholder: '(11) 99999-9999' },
  { id: 'email', nome: 'E-mail', tipo: 'texto', grupo: 'pessoal', placeholder: 'seu@email.com' },
  { id: 'endereco', nome: 'Endereço', tipo: 'texto', grupo: 'pessoal' },
  { id: 'instagram', nome: 'Instagram', tipo: 'texto', grupo: 'pessoal' },

  // Profissional
  { id: 'funcao', nome: 'Função / Cargo', tipo: 'texto', grupo: 'profissional', placeholder: 'Ex: Diretor, Atriz' },
  { id: 'drt', nome: 'DRT', tipo: 'texto', grupo: 'profissional' },
  { id: 'experiencia', nome: 'Experiência', tipo: 'texto', grupo: 'profissional' },

  // Saúde
  { id: 'contato_emergencia', nome: 'Contato de Emergência', tipo: 'texto', grupo: 'saude', placeholder: 'Nome e telefone' },
  { id: 'tipo_sanguineo', nome: 'Tipo Sanguíneo', tipo: 'texto', grupo: 'saude' },
  { id: 'alergias', nome: 'Alergias', tipo: 'texto', grupo: 'saude', placeholder: 'Ex: Dipirona, picada de abelha' },
  { id: 'medicamentos_continuos', nome: 'Medicamentos Contínuos', tipo: 'texto', grupo: 'saude' },
  { id: 'restricao_alimentar', nome: 'Restrições Alimentares', tipo: 'texto', grupo: 'saude', placeholder: 'Ex: Vegano, intolerante à lactose' },
  { id: 'plano_saude', nome: 'Plano de Saúde', tipo: 'texto', grupo: 'saude' },
  { id: 'info_medica', nome: 'Outras Informações Médicas', tipo: 'texto', grupo: 'saude' },

  // Financeiro
  { id: 'valor_diaria', nome: 'Valor Diária', tipo: 'valor', grupo: 'financeiro' },
  { id: 'tipo_vinculo', nome: 'Tipo de Vínculo', tipo: 'selecao', grupo: 'financeiro', opcoes: ['Diarista', 'Fixo / Semanal', 'Cachê Fechado'] },
  { id: 'chave_pix', nome: 'Chave PIX', tipo: 'texto', grupo: 'financeiro', placeholder: 'Celular, CPF ou e-mail' },
  { id: 'banco', nome: 'Banco', tipo: 'texto', grupo: 'financeiro' },
  { id: 'agencia', nome: 'Agência', tipo: 'texto', grupo: 'financeiro' },
  { id: 'conta', nome: 'Conta', tipo: 'texto', grupo: 'financeiro' },
  { id: 'cnpj', nome: 'CNPJ', tipo: 'texto', grupo: 'financeiro' },
  { id: 'razao_social', nome: 'Razão Social', tipo: 'texto', grupo: 'financeiro' },
];

/** Campos que o app sempre exige, independentemente da configuração. */
export const CAMPOS_SEMPRE_OBRIGATORIOS = ['nome'];

/**
 * Monta o schema completo da ficha: padrão + customizados, já resolvendo o que é
 * obrigatório (projeto.campos_obrigatorios para os padrão, campo.obrigatorio para os custom).
 */
export function montarSchemaFicha(projeto?: Pick<Projeto, 'campos_customizados' | 'campos_obrigatorios'>): DefinicaoCampo[] {
  const obrigatorios = new Set([...(projeto?.campos_obrigatorios || []), ...CAMPOS_SEMPRE_OBRIGATORIOS]);

  const padrao: DefinicaoCampo[] = CAMPOS_PADRAO.map(c => ({
    ...c,
    custom: false,
    obrigatorio: obrigatorios.has(c.id),
  }));

  const custom: DefinicaoCampo[] = (projeto?.campos_customizados || []).map((c: CampoCustomizado) => ({
    id: c.id,
    nome: c.nome,
    tipo: c.tipo,
    grupo: 'custom' as GrupoCampo,
    opcoes: c.opcoes,
    obrigatorio: !!c.obrigatorio,
    custom: true,
  }));

  return [...padrao, ...custom];
}

/** Lê o valor de um campo num perfil, seja ele padrão ou customizado. */
export function lerValorCampo(perfil: Partial<Perfil>, campo: DefinicaoCampo): string {
  if (campo.custom) return perfil.custom?.[campo.id] || '';
  const v = (perfil as any)[campo.id];
  return v === undefined || v === null ? '' : String(v);
}

/**
 * Converte o objeto plano do formulário (chave = id do campo) num Perfil parcial,
 * separando os campos customizados para dentro de `custom`.
 */
export function valoresParaPerfil(valores: Record<string, any>, schema: DefinicaoCampo[]): Partial<Perfil> {
  const perfil: Record<string, any> = {};
  const custom: Record<string, string> = {};

  for (const campo of schema) {
    const bruto = valores[campo.id];
    if (bruto === undefined || bruto === null || bruto === '') continue;

    if (campo.custom) {
      custom[campo.id] = String(bruto);
    } else if (campo.tipo === 'valor' || campo.tipo === 'numero') {
      perfil[campo.id] = Number(bruto);
    } else {
      perfil[campo.id] = bruto;
    }
  }

  if (Object.keys(custom).length > 0) perfil.custom = custom;
  return perfil as Partial<Perfil>;
}

/**
 * Valida os obrigatórios. Devolve a lista de nomes que ficaram vazios —
 * campos obrigatórios de fato bloqueiam o cadastro (§6.2).
 */
export function validarObrigatorios(valores: Record<string, any>, schema: DefinicaoCampo[]): string[] {
  return schema
    .filter(c => c.obrigatorio)
    .filter(c => {
      const v = valores[c.id];
      return v === undefined || v === null || String(v).trim() === '';
    })
    .map(c => c.nome);
}

/** Tipo de <input> HTML correspondente ao tipo do campo. */
export function tipoInputHtml(tipo: TipoCampo): string {
  switch (tipo) {
    case 'numero':
    case 'valor':
      return 'number';
    case 'data':
      return 'date';
    case 'telefone':
      return 'tel';
    default:
      return 'text';
  }
}
