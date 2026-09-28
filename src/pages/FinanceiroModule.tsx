import { useEffect, useState } from 'react';
import { converterSaldoInicial } from '../lib/saldoInicial';
import { useMinhaFuncao } from '../hooks/useMinhaFuncao';
import { PainelDoDepartamento } from '../components/PainelDoDepartamento';
import { AreaProtegida, ModoLeitura, PedirAcesso } from '../components/ui/Acesso';
import { Vazio } from '../components/ui/Vazio';
import { useAcesso } from '../hooks/useAcesso';
import { SoQuemPode } from '../components/ui/SoQuemPode';
import { useParams } from 'react-router-dom';
import { DespesasList } from '../components/DespesasList';
import { ResumoList } from '../components/ResumoList';
import { DashboardFinanceiro } from '../components/DashboardFinanceiro';
import { ControleFinanceiro } from '../components/ControleFinanceiro';
import { GastoPorArea } from '../components/GastoPorArea';
import { GastoPorTipo } from '../components/GastoPorTipo';
import { LayoutDashboard, HandCoins, List, Settings, Users } from 'lucide-react';
import { useLayoutContext } from './ProjectLayout';
import { DetalhesUsuario } from '../components/DetalhesUsuario';

/*
  AS ABAS PELA PERGUNTA DE QUEM ABRE (leva 4, passo 3 — decisão B do Lucas,
  27/09/2026). Eram seis: Dashboard, Extrato, Controle, Entradas, Saídas e
  Acertos — um registro por aba, e o mesmo dinheiro em três delas.

  Quem administra: Visão · Lançamentos · Acertos · Ajustes.
  Quem é da equipe: Minha área · Meu acerto.
*/
type AbaFinanceiro = 'visao' | 'lancamentos' | 'acertos' | 'ajustes' | 'minha_area';

export function FinanceiroModule() {
  const { id } = useParams<{ id: string }>();
  const [abaEscolhida, setAbaAtiva] = useState<AbaFinanceiro | null>(null);
  const { openPanel, closePanel } = useLayoutContext();
  /*
    Quem não administra VÊ o financeiro inteiro — ler é global — mas não lança.
    A aba Ajustes (orçamento, metas, PIX) é só configuração, então some; nas
    outras, os botões de lançar somem e fica a linha dizendo quem pode.
  */
  const { podeEscrever, motivo } = useAcesso();
  const administra = podeEscrever('despesas');

  /*
    O FINANCEIRO RECORTADO POR DEPARTAMENTO (decisão do Lucas, 20/09/2026).

    Quem administra vê o filme inteiro. Quem é de um departamento vê o DELE: as
    saídas da sua área e quanto sobra do orçamento dela. Não é esconder o total
    — é mostrar o número que orienta o trabalho daquela pessoa, que é outro.

    Aporte não aparece para a equipe em lugar nenhum: dinheiro que entra é do
    caixa do filme, e não existe "aporte da Fotografia".
  */
  const { departamento: meuDepartamento, perfil: minhaFicha } = useMinhaFuncao();
  const minhaFichaId = minhaFicha?.id;
  const recorte = administra ? undefined : meuDepartamento?.id;
  /*
    SEM DEPARTAMENTO, SEM O CAIXA DO FILME (decisão do Lucas, 27/09/2026).

    Antes, quem não administra e ainda não tem departamento na ficha caía no
    "else" de tudo: Dashboard com o saldo do filme, Entradas, o Extrato e as
    Saídas inteiros, e o acerto de CADA pessoa da equipe. Não era escolha — era
    o `recorte` vazio, que para quem administra significa "tudo", valendo para
    quem não devia.

    Agora essa pessoa vê o próprio acerto (se já tem ficha) e um aviso: o que
    falta é um departamento, e só quem administra coloca (o `escopo.sql` barra
    trocar o próprio). O pedido vai pela ata, como o de acesso.
  */
  const semArea = !administra && !meuDepartamento;

  const abas: { id: AbaFinanceiro; nome: string; icone: React.ReactNode }[] = administra
    ? [
        { id: 'visao', nome: 'Visão', icone: <LayoutDashboard size={18} /> },
        { id: 'lancamentos', nome: 'Lançamentos', icone: <List size={18} /> },
        { id: 'acertos', nome: 'Acertos', icone: <HandCoins size={18} /> },
        { id: 'ajustes', nome: 'Ajustes', icone: <Settings size={18} /> },
      ]
    : [
        { id: 'minha_area', nome: 'Minha área', icone: <LayoutDashboard size={18} /> },
        { id: 'acertos', nome: 'Meu acerto', icone: <HandCoins size={18} /> },
      ];
  // O papel chega depois do primeiro desenho (vem do servidor): a aba escolhida
  // só vale se existir para o papel de agora — senão, a primeira.
  const abaAtiva: AbaFinanceiro = abaEscolhida && abas.some(a => a.id === abaEscolhida) ? abaEscolhida : abas[0].id;

  // Decisão C: o saldo inicial antigo vira uma entrada. Só quem administra
  // escreve dinheiro — e a conversão é idempotente (ver saldoInicial.ts).
  useEffect(() => {
    if (administra && id) converterSaldoInicial(id).catch(() => { /* fica para a próxima abertura */ });
  }, [administra, id]);

  if (!id) return <div>ID do projeto não encontrado.</div>;

  return (
    /*
      O Financeiro é "restrito" na matriz (escopo.ts): quem é equipe acompanha,
      quem é 'leitura' nem abre. Antes, a página inteira aparecia igual para
      todo mundo, com um aviso no meio — ver PLANO-acesso-na-tela.
    */
    <AreaProtegida titulo="Financeiro" projetoId={id}>
    <ModoLeitura tabela="despesas" complemento="Aqui você acompanha." faixa={false}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div className="tab-strip" style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAbaAtiva(a.id)}
            aria-pressed={abaAtiva === a.id}
            style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === a.id ? 'var(--bg-active)' : 'transparent', color: abaAtiva === a.id ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
          >
            {a.icone} <span style={{ fontSize: '12px' }}>{a.nome}</span>
          </button>
        ))}
      </div>

      {!administra && <SoQuemPode motivo={`Somente leitura. ${motivo('despesas')} Aqui você acompanha.`} />}

      {/* Quem administra: o filme inteiro. */}
      {abaAtiva === 'visao' && administra && (
        <>
          <DashboardFinanceiro projetoId={id} aoDefinirOrcamento={() => setAbaAtiva('ajustes')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <GastoPorArea projetoId={id} />
            <GastoPorTipo projetoId={id} aoDefinir={() => setAbaAtiva('ajustes')} />
          </div>
        </>
      )}
      {abaAtiva === 'lancamentos' && administra && <DespesasList projetoId={id} comEntradas />}
      {abaAtiva === 'ajustes' && administra && <ControleFinanceiro projetoId={id} />}

      {/* Quem é da equipe: a própria área — ou o aviso de que ainda não tem uma. */}
      {abaAtiva === 'minha_area' && !administra && (
        semArea ? (
          <div className="card">
            <Vazio
              icone={<Users size={28} />}
              titulo="Você ainda não está num departamento"
              paraQuemAcompanha
              ajuda="O caixa do filme fica com quem administra. Quando sua ficha tiver um departamento, aqui aparece quanto a sua área tem, já gastou e ainda pode gastar — e quem coloca você num departamento é quem administra a produção."
              acao={
                <PedirAcesso
                  projetoId={id}
                  area="Financeiro"
                  pedido="pediu para ser colocado num departamento (é na ficha, em Equipe) — sem isso, o Financeiro não mostra a área dele."
                  rotulo="Pedir um departamento"
                />
              }
            />
          </div>
        ) : (
          <>
            <PainelDoDepartamento projetoId={id} departamento={meuDepartamento!} />
            <DespesasList projetoId={id} soDoDepartamento={recorte} />
          </>
        )
      )}

      {abaAtiva === 'acertos' && (
        <ResumoList 
          projetoId={id} 
          // Quem não administra vê só o PRÓPRIO acerto — com ou sem
          // departamento. Sem ficha ainda, não há acerto dele: `'__ninguem__'`
          // não casa com ninguém, e a lista sai vazia em vez de sair inteira.
          soEstePerfil={administra ? undefined : (minhaFichaId ?? '__ninguem__')}
          onVerFicha={(uid) => {
            openPanel(
              <DetalhesUsuario 
                projetoId={id} 
                usuarioId={uid} 
                origem="acertos" 
                onVoltar={closePanel} 
              />
            );
          }} 
        />
      )}
      
    </div>
    </ModoLeitura>
    </AreaProtegida>
  );
}
