import { useState } from 'react';
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
import { EntradasList } from '../components/EntradasList';
import { ControleFinanceiro } from '../components/ControleFinanceiro';
import { MovimentoList } from '../components/MovimentoList';
import { GastoPorArea } from '../components/GastoPorArea';
import { MetasPorCategoria } from '../components/MetasPorCategoria';
import { LayoutDashboard, HandCoins, List, Settings, ArrowDownToLine, ArrowUpToLine, Users } from 'lucide-react';
import { useLayoutContext } from './ProjectLayout';
import { DetalhesUsuario } from '../components/DetalhesUsuario';

type AbaFinanceiro = 'visao' | 'movimento' | 'controle' | 'entradas' | 'saidas' | 'distribuicao';

export function FinanceiroModule() {
  const { id } = useParams<{ id: string }>();
  const [abaAtiva, setAbaAtiva] = useState<AbaFinanceiro>('visao');
  const { openPanel, closePanel } = useLayoutContext();
  /*
    Quem não administra VÊ o financeiro inteiro — ler é global — mas não lança.
    A aba Controle (saldo inicial, limites) é só configuração, então some; nas
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
  const soMinhaArea = Boolean(recorte);
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
      
      {/* Sub Navbar Financeiro */}
      <div className="tab-strip" style={{ display: 'flex', backgroundColor: 'var(--bg-surface)', padding: '4px', borderRadius: 'var(--radius-md)', gap: '4px' }}>
        <button 
          onClick={() => setAbaAtiva('visao')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'visao' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'visao' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <LayoutDashboard size={18} /> <span style={{ fontSize: '12px' }}>Dashboard</span>
        </button>
        {!semArea && <button 
          onClick={() => setAbaAtiva('movimento')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'movimento' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'movimento' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <List size={18} /> <span style={{ fontSize: '12px' }}>Extrato</span>
        </button>}
        {administra && <button 
          onClick={() => setAbaAtiva('controle')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'controle' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'controle' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <Settings size={18} /> <span style={{ fontSize: '12px' }}>Controle</span>
        </button>}
        {administra && <button 
          onClick={() => setAbaAtiva('entradas')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'entradas' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'entradas' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <ArrowDownToLine size={18} /> <span style={{ fontSize: '12px' }}>Entradas</span>
        </button>}
        {!semArea && <button 
          onClick={() => setAbaAtiva('saidas')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'saidas' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'saidas' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <ArrowUpToLine size={18} /> <span style={{ fontSize: '12px' }}>Saídas</span>
        </button>}
        <button 
          onClick={() => setAbaAtiva('distribuicao')}
          style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', backgroundColor: abaAtiva === 'distribuicao' ? 'var(--bg-active)' : 'transparent', color: abaAtiva === 'distribuicao' ? 'var(--text-primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}
        >
          <HandCoins size={18} /> <span style={{ fontSize: '12px' }}>Acertos</span>
        </button>
      </div>

      {!administra && <SoQuemPode motivo={`Somente leitura. ${motivo('despesas')} Aqui você acompanha.`} />}

      {/* Conteúdo Dinâmico */}
      {abaAtiva === 'visao' && (
        <>
          {semArea ? (
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
          ) : soMinhaArea
            ? <PainelDoDepartamento projetoId={id} departamento={meuDepartamento!} />
            : <DashboardFinanceiro projetoId={id} />}
          {/* "Quanto cada área gastou" é a segunda pergunta de qualquer reunião,
              depois de "quanto gastamos" — e é pergunta de quem administra. Para
              quem é de uma área, o painel acima já respondeu a dela. */}
          {/*
            `administra`, e não `!soMinhaArea`: quem não administra e ainda não
            tem departamento também não é "da minha área", e via estes quadros
            do caixa do filme. A regra da v4.15 é "o caixa é de quem administra".
          */}
          {administra && (
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <GastoPorArea projetoId={id} />
              <MetasPorCategoria projetoId={id} aoDefinir={() => setAbaAtiva('controle')} />
            </div>
          )}
        </>
      )}
      {abaAtiva === 'movimento' && !semArea && <MovimentoList projetoId={id} soDoDepartamento={recorte} />}
      {abaAtiva === 'controle' && administra && <ControleFinanceiro projetoId={id} />}
      {abaAtiva === 'entradas' && administra && <EntradasList projetoId={id} />}
      {abaAtiva === 'saidas' && !semArea && <DespesasList projetoId={id} soDoDepartamento={recorte} />}
      {abaAtiva === 'distribuicao' && (
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
