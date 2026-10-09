import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ImagePlus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { guardarArquivo, resolverArquivo, LIMITE_BYTES } from '../lib/arquivos';
import { CampoTexto } from './ui/CampoTexto';

/**
 * O que se repete em TODA Ordem do Dia desta produção.
 *
 * O logo e as observações gerais ("hidrate-se", "celular no silencioso") são
 * fixos por natureza. Perguntá-los a cada diária garantiria que ninguém
 * respondesse — e o modelo do mercado traz os dois em todo papel.
 *
 * ONDE MORA. Nasceu na lista de diárias, aberta entre o cabeçalho e os dias —
 * e saiu de lá porque empurrava para baixo a coisa que a pessoa abriu a tela
 * para ver. Foi para as Configurações, e de lá voltou (pedido do Lucas,
 * 02/10/2026): quem pensa "por que meu logo não sai na OD" está olhando para
 * as ODs. Agora fica na tela de Diárias, mas DENTRO DE UMA JANELA aberta pelo
 * botão "Ajustes da OD" do cabeçalho — perto, sem ocupar a lista.
 */
export function PadraoDaOD({ projetoId }: { projetoId: string }) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const arquivoRef = useRef<HTMLInputElement>(null);

  /*
    O texto se grava ao sair do campo E ao fechar a janela. Só no blur, o Esc
    fecharia a janela com o cursor ainda no campo e o que foi digitado sumiria:
    o React não dispara blur em quem está sendo desmontado.
  */
  const rascunho = useRef<string | null>(null);
  const gravarObservacoes = () => {
    if (rascunho.current === null) return;
    const valor = rascunho.current;
    rascunho.current = null;
    void db.projetos.update(projetoId, { observacoes_od: valor || undefined });
  };
  const gravarRef = useRef(gravarObservacoes);
  gravarRef.current = gravarObservacoes;
  useEffect(() => () => gravarRef.current(), []);

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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '20px', alignItems: 'start' }}>
      <div>
        <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '6px' }}>Logo da produtora</div>
        {previa ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Fundo branco nos dois temas: é como o logo sai no papel. */}
            <div style={{ backgroundColor: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px', display: 'flex', justifyContent: 'center', border: '1px solid var(--border-light)' }}>
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
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px', border: '1px dashed var(--border-color)', width: '100%', justifyContent: 'center', fontSize: '13px' }}
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
        <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '6px' }}>Aviso fixo</div>
        <textarea
          defaultValue={projeto.observacoes_od || ''}
          onChange={e => { rascunho.current = e.target.value; }}
          onBlur={gravarObservacoes}
          placeholder={'Discriminação, assédio e retaliação não são tolerados nesta produção. Canal de denúncia: …\nCelulares SEMPRE no silencioso.'}
          rows={5}
          style={{ width: '100%', padding: '10px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }}
        />
        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
          Sai em toda OD desta produção, logo abaixo dos horários — como o aviso de
          conduta do modelo do set. Deixe em branco e o bloco não é impresso.
        </div>
      </div>

      <div>
        <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ marginBottom: '6px' }}>Canais de rádio</div>
        <CampoTexto
          value={projeto.canais_radio || ''}
          aoGravar={v => db.projetos.update(projetoId, { canais_radio: v.trim() || undefined })}
          placeholder={'1 - Produção\n2 - Direção\n3 - Arte\n7 - Som'}
          linhas={5}
          style={{ width: '100%', padding: '10px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical' }}
        />
        <div className="text-xs text-muted" style={{ marginTop: '4px' }}>
          Um por linha. Sai no pé da OD, junto dos contatos.
        </div>
      </div>
    </div>
  );
}
