import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { Wallet, TrendingUp, HandCoins } from 'lucide-react';
import { useState } from 'react';

interface DashboardProps {
  projetoId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#ffc658', '#d0ed57', '#a4de6c'];

export function DashboardFinanceiro({ projetoId }: DashboardProps) {
  const projeto = useLiveQuery(() => db.projetos.get(projetoId), [projetoId]);
  const aportes = useLiveQuery(() => db.aportes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const despesas = useLiveQuery(() => db.despesas.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];
  const departamentos = useLiveQuery(() => db.departamentos.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  const [novoAporte, setNovoAporte] = useState({ origem: '', valor: '', obs: '' });

  if (!projeto) return <div>Carregando dashboard...</div>;

  const saldoInicial = projeto.saldo_inicial || 0;
  const totalAportes = aportes.reduce((acc, a) => acc + a.valor, 0);
  const totalEntradas = saldoInicial + totalAportes;
  const totalGasto = despesas.reduce((acc, d) => acc + d.valor_total, 0);
  const saldoAtual = totalEntradas - totalGasto;

  const handleAddAporte = async () => {
    const val = Number(novoAporte.valor);
    if (!novoAporte.origem || isNaN(val) || val <= 0) return;
    await db.aportes.add({
      id: crypto.randomUUID(),
      projeto_id: projetoId,
      origem: novoAporte.origem,
      valor: val,
      data: Date.now(),
      obs: novoAporte.obs
    });
    setNovoAporte({ origem: '', valor: '', obs: '' });
  };

  const handleDeleteAporte = async (id: string) => {
    if (confirm("Remover este aporte?")) {
      await db.aportes.delete(id);
    }
  };

  // Dados para o Gráfico de Categorias
  const gastosPorCategoria = despesas.reduce((acc, d) => {
    acc[d.categoria] = (acc[d.categoria] || 0) + d.valor_total;
    return acc;
  }, {} as Record<string, number>);

  const dataCategoria = Object.keys(gastosPorCategoria).map(cat => ({
    name: cat,
    value: gastosPorCategoria[cat]
  })).sort((a, b) => b.value - a.value);

  // Dados para o Gráfico de Departamentos (usaremos barras)
  const getDeptoName = (id: string) => departamentos.find(d => d.id === id)?.nome || 'Outros';
  const gastosPorDepto = despesas.reduce((acc, d) => {
    // Para simplificar, assumiremos que se devedor = departamento, mapeamos o custo pra lá.
    // Se não, joga em "Geral/Outros"
    let deptoId = 'geral';
    const devedorDepto = d.devedores.find(dev => dev.tipo === 'departamento');
    if (devedorDepto) deptoId = devedorDepto.id_ref;
    
    acc[deptoId] = (acc[deptoId] || 0) + d.valor_total;
    return acc;
  }, {} as Record<string, number>);

  const dataDepto = Object.keys(gastosPorDepto).map(id => ({
    name: id === 'geral' ? 'Geral' : getDeptoName(id),
    Gasto: gastosPorDepto[id]
  })).sort((a, b) => b.Gasto - a.Gasto);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '12px' }}>
            <Wallet size={24} className="text-secondary" />
          </div>
          <div>
            <div className="text-xs text-muted font-bold uppercase tracking-widest">Total Arrecadado</div>
            <div className="text-xl font-bold mt-1">R$ {totalEntradas.toFixed(2)}</div>
          </div>
        </div>
        
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '12px' }}>
            <TrendingUp size={24} className="text-danger" />
          </div>
          <div>
            <div className="text-xs text-muted font-bold uppercase tracking-widest">Total Gasto</div>
            <div className="text-xl font-bold mt-1">R$ {totalGasto.toFixed(2)}</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-surface)', borderRadius: '12px' }}>
            <HandCoins size={24} className={saldoAtual >= 0 ? "text-accent" : "text-danger"} />
          </div>
          <div>
            <div className="text-xs text-muted font-bold uppercase tracking-widest">Saldo Atual</div>
            <div className="text-xl font-bold mt-1">R$ {saldoAtual.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        
        {/* Despesas por Categoria */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Gastos por Categoria</div>
          {dataCategoria.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-muted text-sm">Sem dados suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataCategoria}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {dataCategoria.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Despesas por Departamento */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
          <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Gastos por Departamento</div>
          {dataDepto.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="text-muted text-sm">Sem dados suficientes</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataDepto} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                <RechartsTooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Bar dataKey="Gasto" fill="#8884d8" radius={[0, 4, 4, 0]}>
                  {dataDepto.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Gestão de Aportes */}
      <div className="card">
        <div className="text-xs text-secondary font-bold uppercase tracking-widest mb-4">Entradas e Aportes de Dinheiro</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input 
            placeholder="Origem (Ex: Sócio, Ancine...)" 
            value={novoAporte.origem} 
            onChange={e => setNovoAporte({ ...novoAporte, origem: e.target.value })}
            style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}
          />
          <input 
            type="number" 
            placeholder="Valor R$" 
            value={novoAporte.valor} 
            onChange={e => setNovoAporte({ ...novoAporte, valor: e.target.value })}
            style={{ width: '120px', backgroundColor: 'var(--bg-primary)' }}
          />
          <input 
            placeholder="Observação" 
            value={novoAporte.obs} 
            onChange={e => setNovoAporte({ ...novoAporte, obs: e.target.value })}
            style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}
          />
          <button onClick={handleAddAporte} className="btn-primary" style={{ padding: '0 16px' }}>Adicionar</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {projeto.saldo_inicial != null && projeto.saldo_inicial > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px' }}>
              <div>
                <span className="font-bold">Saldo Inicial (Configuração do Projeto)</span>
              </div>
              <span className="text-accent font-bold">R$ {projeto.saldo_inicial.toFixed(2)}</span>
            </div>
          )}
          {aportes.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div>
                <div className="font-bold">{a.origem}</div>
                <div className="text-xs text-muted">{new Date(a.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })} {a.obs && `- ${a.obs}`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className="text-accent font-bold">R$ {a.valor.toFixed(2)}</span>
                <button onClick={() => handleDeleteAporte(a.id)} className="text-danger" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Excluir</button>
              </div>
            </div>
          ))}
          {(!projeto.saldo_inicial && aportes.length === 0) && (
            <div className="text-center text-muted py-4">Nenhum aporte registrado. O projeto não possui fundos iniciais.</div>
          )}
        </div>
      </div>

    </div>
  );
}
