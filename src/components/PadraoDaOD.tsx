import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronDown, FileText, ImagePlus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { guardarArquivo, resolverArquivo, LIMITE_BYTES } from '../lib/arquivos';

/**
 * O que se repete em TODA Ordem do Dia desta produção.
 *
 * O logo e as observações gerais ("hidrate-se", "celular no silencioso") são
 * fixos por natureza. Perguntá-los a cada diária garantiria que ninguém
 * respondesse — e o modelo do mercado traz os dois em todo papel.
 *
 * Mora aqui, na lista de diárias, e não nas configurações da produção: quem
 * pensa "por que meu logo não sai na OD" está olhando para as ODs.
 */
export function PadraoDaOD({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const [aberto, setAberto] = useState(false);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let vivo = true;
    resolverArquivo(projeto?.logo_od).then(url => { if (vivo) setPrevia(url); });
    return () => { vivo = false; };
  }, [projeto?.logo_od]);

  if (!projeto) return null;

  const subirLogo = async (arquivo: File) => {
    setErro('');
    if (!arquivo.type.startsWith('image/')) { setErro('O logo precisa ser uma imagem.'); return; }
    if (arquivo.size > LIMITE_BYTES) { setErro('Imagem grande demais.'); return; }
    try {
      const referencia = await guardarArquivo(projetoId, arquivo, arquivo.name, arquivo.type);
      await db.projetos.update(projetoId, { logo_od: referencia });
    } catch (e: any) {
      setErro(e?.message || 'Não consegui guardar a imagem.');
    }
  };

  const temAlgo = Boolean(projeto.logo_od || projeto.observacoes_od);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: aberto ? '16px' : 0 }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
      >
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
          <FileText size={15} style={{ color: 'var(--cor-set)' }} /> Padrão da Ordem do Dia
        </h2>
        {!aberto && <span className="text-xs text-muted">{temAlgo ? 'logo e avisos configurados' : 'logo e avisos fixos — opcional'}</span>}
        <ChevronDown size={16} className="text-muted" style={{ transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {aberto && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: '20px', alignItems: 'start' }}>
          <div>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '6px' }}>Logo da produtora</div>
            {previa ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '10px', display: 'flex', justifyContent: 'center' }}>
                  <img src={previa} alt="Logo da produção" style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }} />
                </div>
                <button
                  onClick={() => db.projetos.update(projetoId, { logo_od: undefined })}
                  className="btn-icon text-xs"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', border: '1px solid var(--border-light)', width: 'auto' }}
                >
                  <Trash2 size={13} /> Tirar
                </button>
              </div>
            ) : (
              <button
                onClick={() => arquivoRef.current?.click()}
                className="btn-icon"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px', border: '1px dashed var(--border-light)', width: '100%', justifyContent: 'center', fontSize: '13px' }}
              >
                <ImagePlus size={16} /> Subir o logo
              </button>
            )}
            <input
              ref={arquivoRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void subirLogo(f); e.target.value = ''; }}
            />
            {erro && <div className="text-danger text-xs" style={{ marginTop: '6px' }}>{erro}</div>}
          </div>

          <div>
            <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '6px' }}>Observações gerais</div>
            <textarea
              defaultValue={projeto.observacoes_od || ''}
              onBlur={e => db.projetos.update(projetoId, { observacoes_od: e.target.value || undefined })}
              placeholder={'Hidrate-se e encha sua garrafinha de água.\nCelulares SEMPRE no silencioso.\nRespeite os horários e as pausas programadas.'}
              rows={5}
              style={{ width: '100%', padding: '10px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }}
            />
            <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
              Sai no pé de toda OD desta produção. Deixe em branco e o bloco não é impresso.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
