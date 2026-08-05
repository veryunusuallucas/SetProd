import { useForm } from 'react-hook-form';
import type { DefinicaoCampo, GrupoCampo } from '../lib/camposFicha';
import { ROTULO_GRUPO, tipoInputHtml } from '../lib/camposFicha';

interface FormRendererProps {
  /** Definição dos campos em JSON (vinda do Construtor de Ficha). */
  schema: DefinicaoCampo[];
  valoresIniciais?: Record<string, any>;
  onSubmit: (valores: Record<string, any>) => void | Promise<void>;
  textoBotao?: string;
  enviando?: boolean;
  /** Some com os grupos vazios e permite esconder grupos inteiros (ex: financeiro no link público). */
  gruposOcultos?: GrupoCampo[];
}

/**
 * Renderizador de formulário (v4 §6.1): lê a definição JSON dos campos e desenha o
 * formulário, com validação de obrigatórios via React Hook Form. Serve tanto para a
 * ficha interna quanto para o link público de cadastro.
 */
export function FormRenderer({
  schema,
  valoresIniciais,
  onSubmit,
  textoBotao = 'Salvar',
  enviando = false,
  gruposOcultos = [],
}: FormRendererProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, any>>({ defaultValues: valoresIniciais || {} });

  const visiveis = schema.filter(c => !gruposOcultos.includes(c.grupo));
  const grupos = Array.from(new Set(visiveis.map(c => c.grupo))) as GrupoCampo[];

  return (
    <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {grupos.map(grupo => {
        const campos = visiveis.filter(c => c.grupo === grupo);
        if (campos.length === 0) return null;

        return (
          <div key={grupo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px' }}>
              {ROTULO_GRUPO[grupo]}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {campos.map(campo => {
                const erro = errors[campo.id];
                return (
                  <div key={campo.id}>
                    <label className="text-xs text-secondary font-bold uppercase tracking-widest mb-2 block">
                      {campo.nome} {campo.obrigatorio && <span className="text-danger">*</span>}
                    </label>

                    {campo.tipo === 'selecao' ? (
                      <select
                        {...register(campo.id, { required: campo.obrigatorio })}
                        style={{
                          width: '100%', padding: '14px', borderRadius: '12px',
                          border: `1px solid ${erro ? 'var(--color-danger)' : 'var(--border-color)'}`,
                          backgroundColor: 'var(--bg-surface)'
                        }}
                      >
                        <option value="">Selecione...</option>
                        {(campo.opcoes || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        {...register(campo.id, { required: campo.obrigatorio })}
                        type={tipoInputHtml(campo.tipo)}
                        step={campo.tipo === 'valor' ? '0.01' : undefined}
                        placeholder={campo.placeholder || campo.nome}
                        style={{
                          width: '100%',
                          borderColor: erro ? 'var(--color-danger)' : undefined
                        }}
                      />
                    )}

                    {erro && <div className="text-xs text-danger mt-1">Campo obrigatório.</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <button type="submit" disabled={enviando} className="btn-primary" style={{ marginTop: '8px' }}>
        {enviando ? 'Enviando...' : textoBotao}
      </button>
    </form>
  );
}
