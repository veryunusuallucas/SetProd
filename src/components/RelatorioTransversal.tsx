import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { CAIXA_CENTRAL } from '../core/caixaCentral';
import { camadaDoCampo, podeVerCamada } from '../lib/camposSensiveis';
import type { Papel } from '../lib/permissoes';
import { Janela } from './ui/Janela';
import { Vazio } from './ui/Vazio';
import type { Perfil, Projeto } from '../types';

interface RelatorioTransversalProps {
  perfis: Perfil[];
  projeto: Projeto;
  /** Quem está olhando — o relatório respeita as camadas da ficha. */
  papel: Papel;
  meuPerfilId?: string | null;
  onClose: () => void;
}

/**
 * "Quem tem alergia?", "quem é PJ?" — a mesma pergunta atravessando a equipe.
 *
 * ELE OBEDECE ÀS CAMADAS DA FICHA (`camposSensiveis.ts`). Sem isso, a tela que
 * esconde o tipo sanguíneo na ficha de cada um o entregaria aqui, em lista, de
 * uma vez — e a soma é pior que a parte.
 *
 * Na prática o servidor já não manda o que a pessoa não pode ver, então antes
 * a lista não vazava: ela MENTIA. Oferecia "Alergias" e respondia "ninguém
 * preencheu", quando o certo era "você não vê isto". Agora o campo que ela não
 * pode ver não aparece na escolha.
 */
export function RelatorioTransversal({ perfis, projeto, papel, meuPerfilId, onClose }: RelatorioTransversalProps) {

  const camposFixos = [
    { id: 'alergias', nome: 'Alergias' },
    { id: 'restricao_alimentar', nome: 'Restrições Alimentares' },
    { id: 'tipo_sanguineo', nome: 'Tipo Sanguíneo' },
    { id: 'medicamentos_continuos', nome: 'Medicamentos Contínuos' },
    { id: 'contato_emergencia', nome: 'Contato de Emergência' },
    { id: 'funcao', nome: 'Função / Cargo' },
    { id: 'tipo_vinculo', nome: 'Tipo de Vínculo' },
  ];

  const equipe = perfis.filter(p => p.id !== CAIXA_CENTRAL);

  /** Vejo esta camada de ALGUÉM? Se nem de uma pessoa, o campo nem é oferecido. */
  const vejoDeAlguem = (campo: string) => {
    const camada = camadaDoCampo(campo);
    if (camada === 'publica') return true;
    return equipe.some(p => podeVerCamada(camada, { papel, meuPerfilId, perfilId: p.id }));
  };

  const todosCampos = [
    ...camposFixos.filter(c => vejoDeAlguem(c.id)),
    // Campo criado pela produção é ficha pública: não passa pelas camadas.
    ...(projeto.campos_customizados || []).map(c => ({ id: `custom_${c.id}`, nome: c.nome })),
  ];

  const [campoEscolhido, setCampoEscolhido] = useState<string>(todosCampos[0]?.id ?? '');
  const campoSelecionado = todosCampos.some(c => c.id === campoEscolhido) ? campoEscolhido : (todosCampos[0]?.id ?? '');

  const membros = equipe.map(p => {
    let valor = '';
    if (campoSelecionado.startsWith('custom_')) {
      const customId = campoSelecionado.replace('custom_', '');
      valor = p.custom?.[customId] || '';
    } else if (podeVerCamada(camadaDoCampo(campoSelecionado), { papel, meuPerfilId, perfilId: p.id })) {
      valor = (p as any)[campoSelecionado] || '';
    }
    return {
      id: p.id,
      nome: `${p.nome} ${p.sobrenome || ''}`,
      valor: valor.trim(),
    };
  }).filter(m => m.valor !== '');

  const nomeDoCampo = todosCampos.find(c => c.id === campoSelecionado)?.nome ?? 'este campo';

  return (
    <Janela titulo="Relatório por campo" icone={<SlidersHorizontal size={18} />} aoFechar={onClose} largura="600px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
        <label className="text-xs font-bold uppercase tracking-widest text-secondary">
          A mesma pergunta para a equipe inteira
        </label>
        <select
          value={campoSelecionado}
          onChange={e => setCampoEscolhido(e.target.value)}
          style={{ padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', width: '100%' }}
        >
          {todosCampos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {membros.length === 0 ? (
        <Vazio
          titulo={`Ninguém preencheu ${nomeDoCampo.toLowerCase()}`}
          ajuda="Quem preencher esse campo na própria ficha aparece aqui, em lista."
        />
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }} className="text-xs uppercase tracking-widest text-muted">Membro</th>
              <th style={{ textAlign: 'left', paddingBottom: '12px', borderBottom: '1px solid var(--border-light)' }} className="text-xs uppercase tracking-widest text-muted">{nomeDoCampo}</th>
            </tr>
          </thead>
          <tbody>
            {membros.sort((a, b) => a.nome.localeCompare(b.nome)).map(m => (
              <tr key={m.id}>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }} className="font-bold">{m.nome}</td>
                <td style={{ padding: '12px 0', borderBottom: '1px solid var(--border-light)' }} className="text-accent font-bold">{m.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Janela>
  );
}
