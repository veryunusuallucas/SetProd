import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { lerFichaPublica } from '../lib/sync';
import type { CampoCustomizado } from '../types';
import { FormRenderer } from '../components/FormRenderer';
import { montarSchemaFicha, valoresParaPerfil, type DefinicaoCampo } from '../lib/camposFicha';

/**
 * Link público de cadastro (v4 §6.2): renderiza o MESMO conjunto de campos definido
 * no Construtor de Ficha — os padrão do app mais os adicionados pelo projeto — e
 * respeita os obrigatórios. Fonte única, sem lista duplicada aqui.
 */
export function CadastroEquipe() {
  const { projetoId } = useParams();

  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [sucesso, setSucesso] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<DefinicaoCampo[]>([]);

  useEffect(() => {
    async function carregarProjeto() {
      if (!projetoId) return;
      let camposCustomizados: CampoCustomizado[] = [];
      let camposObrigatorios: string[] = [];

      try {
        const ficha = await lerFichaPublica(projetoId);

        if (ficha) {
          camposCustomizados = ficha.campos || [];
          camposObrigatorios = ficha.obrigatorios || [];
        } else {
          console.warn(
            '[SetProd] Ficha deste projeto ainda não foi publicada. Exibindo só os campos padrão.'
          );
        }
      } catch (err) {
        // Sem conexão ou sem permissão: cai nos campos padrão, que já cobrem o essencial.
        console.error('Erro ao carregar campos do projeto', err);
      } finally {
        setSchema(montarSchemaFicha({ campos_customizados: camposCustomizados, campos_obrigatorios: camposObrigatorios }));
        setLoadingConfig(false);
      }
    }
    carregarProjeto();
  }, [projetoId]);

  const handleSubmit = async (valores: Record<string, any>) => {
    setLoading(true);
    setError(null);

    try {
      if (!projetoId) throw new Error('Link de projeto inválido.');

      const novoPerfil = {
        id: crypto.randomUUID(),
        projeto_id: projetoId,
        ...valoresParaPerfil(valores, schema),
      };

      // Salva direto no Supabase; o produtor puxa (pull) de lá na aba Equipe.
      const { error: supabaseError } = await supabase.from('perfis').insert([novoPerfil]);
      if (supabaseError) throw supabaseError;

      setSucesso(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao enviar cadastro. Verifique sua conexão.');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="card" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h2 className="text-xl font-bold" style={{ color: 'var(--accent)', marginBottom: '16px' }}>Cadastro Enviado!</h2>
          <p className="text-secondary">Obrigado! Seus dados foram enviados para a equipe de produção.</p>
        </div>
      </div>
    );
  }

  if (loadingConfig) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Carregando formulário...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', padding: '24px', backgroundColor: 'var(--bg-default)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '720px', margin: 'auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 className="text-xl font-bold">Ficha de Cadastro</h1>
          <p className="text-sm text-secondary">Preencha seus dados para a produção</p>
        </div>

        {error && (
          <div style={{ padding: '12px', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '14px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <FormRenderer
          // O valor da diária é definido pela produção, não por quem preenche a ficha.
          schema={schema.filter(c => c.id !== 'valor_diaria')}
          onSubmit={handleSubmit}
          enviando={loading}
          textoBotao="Enviar Cadastro"
        />
      </div>
    </div>
  );
}
