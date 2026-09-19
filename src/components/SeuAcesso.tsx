import { useLiveQuery } from 'dexie-react-hooks';
import { ShieldCheck, Check, X } from 'lucide-react';
import { db } from '../db/db';
import { useRole } from '../hooks/useRole';
import { useMinhaFuncao } from '../hooks/useMinhaFuncao';
import { DESCRICAO } from '../lib/permissoes';
import { ESCOPO, type Escopo } from '../lib/escopo';

/**
 * "Seu acesso" — a página que responde sozinha a maior parte das dúvidas.
 *
 * POR QUE ELA EXISTE
 * Sem ela, a pessoa descobre o próprio acesso por tentativa e erro: clica, o
 * botão não está lá, e ela não sabe se é falta de permissão, bug ou carregamento.
 * Aqui está em uma tela: quem você é, o que isso permite e quem procurar.
 *
 * O CONTEÚDO SAI DA MATRIZ (`escopo.ts`), não de uma lista escrita à mão. Se a
 * matriz mudar, esta tela muda junto — uma lista paralela mentiria no dia em que
 * alguém mexesse numa e esquecesse da outra.
 */

/** As áreas do app, na palavra de quem usa, agrupadas pelo escopo da matriz. */
const AREAS: { tabela: keyof typeof ESCOPO; nome: string }[] = [
  { tabela: 'diarias', nome: 'Criar e fechar diárias' },
  { tabela: 'despesas', nome: 'Lançar despesas e acertos' },
  { tabela: 'projetos', nome: 'Dados e configurações da produção' },
  { tabela: 'tasks', nome: 'Tasks' },
  { tabela: 'perfis', nome: 'Fichas da equipe' },
  { tabela: 'locacoes', nome: 'Locações e documentos' },
  { tabela: 'veiculos', nome: 'Transporte' },
  { tabela: 'cenas', nome: 'Roteiro, cenas e decupagem' },
];

function comoFica(escopo: Escopo, papel: string, temDepartamento: boolean): { pode: boolean; nota?: string } {
  if (papel === 'dono' || papel === 'admin') return { pode: true };
  if (papel === 'leitura') return { pode: false };
  if (escopo === 'restrito') return { pode: false };
  if (escopo === 'comum') return { pode: true };
  return temDepartamento
    ? { pode: true, nota: 'no seu departamento' }
    : { pode: true, nota: 'enquanto sua ficha não tem departamento' };
}

export function SeuAcesso({ projetoId }: { projetoId: string }) {
  const { role, souMembro } = useRole();
  const { perfil, departamento } = useMinhaFuncao();

  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  if (!souMembro) return null;

  const papel = DESCRICAO[role as 'equipe'] ?? { nome: role, resumo: '' };

  return (
    <div className="card">
      <h3 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <ShieldCheck size={18} style={{ color: 'var(--cor-funcao, var(--accent))' }} /> Seu acesso
      </h3>
      <p className="text-xs text-muted" style={{ marginBottom: '16px' }}>
        Em {projeto?.nome || 'esta produção'}.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <Pilula rotulo="Seu papel" valor={papel.nome} />
        <Pilula rotulo="Sua ficha" valor={perfil ? `${perfil.nome} ${perfil.sobrenome || ''}`.trim() : 'ainda não escolhida'} />
        <Pilula rotulo="Departamento" valor={departamento?.nome || '—'} cor={departamento?.cor} />
      </div>

      <p className="text-sm text-secondary" style={{ marginBottom: '16px', lineHeight: 1.5 }}>{papel.resumo}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {AREAS.map(a => {
          const { pode, nota } = comoFica(ESCOPO[a.tabela], role, Boolean(departamento));
          return (
            <div key={a.tabela} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {pode
                ? <Check size={16} style={{ color: 'var(--color-success, #4ade80)', flexShrink: 0 }} />
                : <X size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              <span className="text-sm" style={{ color: pode ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {a.nome}
                {pode && nota && <span className="text-muted"> · {nota}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted" style={{ marginTop: '16px', lineHeight: 1.5 }}>
        {role === 'dono'
          ? 'Você criou esta produção: o acesso é todo seu, inclusive apagá-la.'
          : 'Para mudar o seu acesso, fale com quem administra a produção — a lista está em Quem tem acesso.'}
      </p>
    </div>
  );
}

function Pilula({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: '10px',
      background: 'var(--bg-surface)',
      border: `1px solid ${cor ? `color-mix(in srgb, ${cor} 45%, transparent)` : 'var(--border-light)'}`,
    }}>
      <div className="text-xs text-muted">{rotulo}</div>
      <div className="text-sm font-bold">{valor}</div>
    </div>
  );
}
