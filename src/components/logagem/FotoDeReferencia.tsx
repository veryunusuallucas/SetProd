import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Image as Imagem, Trash2 } from 'lucide-react';
import type { EstadoDaLogagem } from '../../types';
import { MOLA, useMovimentoReduzido } from '../ui/movimento';
import { BotaoTatil } from '../ui/BotaoTatil';
import { ImagemAnexo } from '../ImagemAnexo';
import { Rotulo } from './pecas';
import { guardarArquivo, apagarArquivo } from '../../lib/arquivos';
import { comprimirFoto } from '../../lib/logagem/foto';
import { mudarEstado } from '../../lib/logagem/estado';

/**
 * A foto de referência do próximo take.
 *
 * Serve para a continuísta reconhecer o enquadramento depois — onde estava a
 * xícara, de que lado o ator entrou. É tirada ANTES de registrar, e vai junto
 * com o take, sumindo daqui assim que ele é gravado.
 *
 * No celular o botão abre a câmera de trás direto (`capture`); no computador,
 * o seletor de arquivo. São o mesmo botão porque são a mesma intenção.
 */
export function FotoDeReferencia({ estado, podeEditar }: { estado: EstadoDaLogagem; podeEditar: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const reduzido = useMovimentoReduzido();

  const escolher = async (arquivo?: File) => {
    if (!arquivo) return;
    setOcupado(true);
    setErro('');
    try {
      const menor = await comprimirFoto(arquivo);
      const referencia = await guardarArquivo(estado.projeto_id, menor, `ref-${Date.now()}.jpg`, 'image/jpeg');
      // A foto anterior que NÃO foi registrada com nenhum take não serve mais a
      // ninguém: some do aparelho junto, para a diária não juntar lixo.
      const antiga = estado.foto;
      await mudarEstado(estado.diaria_id, { foto: referencia });
      if (antiga) void apagarArquivo(antiga);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui usar esta imagem.');
    } finally {
      setOcupado(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const tirar = async () => {
    const antiga = estado.foto;
    await mudarEstado(estado.diaria_id, { foto: '' });
    if (antiga) void apagarArquivo(antiga);
  };

  if (!podeEditar && !estado.foto) return null;

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
      <Rotulo icone={<Imagem size={14} />}>Foto de referência</Rotulo>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        {estado.foto && (
          <motion.div
            initial={reduzido ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={MOLA}
          >
            <ImagemAnexo
              valor={estado.foto}
              alt="Foto de referência do próximo take"
              estiloLink={{ display: 'block', width: '120px', height: '80px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-light)' }}
              estiloImagem={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </motion.div>
        )}

        {podeEditar && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <BotaoTatil
              onClick={() => entrada.current?.click()}
              disabled={ocupado}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', minHeight: '44px', padding: '0 16px',
                borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)',
                backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600,
                cursor: ocupado ? 'default' : 'pointer', opacity: ocupado ? 0.6 : 1,
              }}
            >
              <Camera size={16} />
              {ocupado ? 'Guardando…' : estado.foto ? 'Trocar a foto' : 'Tirar foto'}
            </BotaoTatil>

            {estado.foto && (
              <BotaoTatil
                onClick={() => void tirar()}
                aria-label="Tirar a foto"
                title="Tirar a foto"
                style={{
                  width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)',
                  backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                <Trash2 size={16} />
              </BotaoTatil>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-muted" style={{ margin: 0 }}>
        {estado.foto
          ? 'Vai junto no próximo take registrado.'
          : 'Opcional. A foto encolhe para 800px antes de ser guardada, para não disputar a internet do set com os takes.'}
      </p>
      {erro && <p className="text-xs" style={{ color: 'var(--color-danger)', margin: 0 }}>{erro}</p>}

      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={e => void escolher(e.target.files?.[0])}
      />
    </section>
  );
}
