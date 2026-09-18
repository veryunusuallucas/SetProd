import { useSyncExternalStore } from 'react';
import {
  LayoutDashboard, CalendarDays, DollarSign, ListTodo, CalendarClock, Clapperboard,
  Film, FileText, Users, MapPin, Truck, Database, Settings, type LucideIcon,
} from 'lucide-react';

/**
 * Os módulos da produção, do jeito que a dock e a folha do "Mais" os veem.
 *
 * A DOCK É DE QUEM USA (pedido do Lucas, 18/09/2026). Ela tem quatro lugares:
 *
 * - **três fixos**, que cada um escolhe — quem é da fotografia vive na Logagem,
 *   quem é da produção vive no $$$. O padrão é Dash, Diárias e $$$;
 * - **um que acompanha**: mostra o módulo aberto quando ele não é um dos fixos,
 *   e continua mostrando o último depois que você volta para um fixo. Assim a
 *   dock sempre diz onde você está, e voltar para Eventos custa um toque, não
 *   dois. Numa produção recém-aberta, ele começa em Tasks.
 *
 * A escolha dos fixos é do APARELHO, não da produção: é o jeito da mão de quem
 * segura o celular, igual em todo filme. O último aberto é de cada produção.
 */

export type IdModulo =
  | 'dash' | 'diarias' | 'financeiro' | 'tasks' | 'eventos' | 'logagem' | 'decupagem'
  | 'documentos' | 'producao' | 'locacoes' | 'transporte' | 'dados' | 'config';

export interface Modulo {
  id: IdModulo;
  /** Como aparece na folha e no editor. */
  nome: string;
  /** Na dock, quando o nome não cabe num quinto de 320px. */
  curto?: string;
  icone: LucideIcon;
  /** A cor da área, a mesma que agrupa a folha. */
  cor: string;
  /** O trecho depois de `/projeto/:id/`. O painel é o trecho vazio. */
  trecho: string;
  /** Outros trechos que são "dentro" deste módulo (a diária aberta é Diárias). */
  tambem?: string[];
}

/** Na ordem da folha do "Mais": área por área, como na barra do computador. */
export const MODULOS: Modulo[] = [
  { id: 'dash', nome: 'Dash', icone: LayoutDashboard, cor: 'var(--cor-set)', trecho: '' },
  { id: 'diarias', nome: 'Diárias', icone: CalendarDays, cor: 'var(--cor-set)', trecho: 'diarias', tambem: ['diaria'] },
  { id: 'tasks', nome: 'Tasks', icone: ListTodo, cor: 'var(--cor-set)', trecho: 'tasks' },
  { id: 'eventos', nome: 'Eventos', icone: CalendarClock, cor: 'var(--cor-set)', trecho: 'eventos' },
  { id: 'financeiro', nome: '$$$', icone: DollarSign, cor: 'var(--cor-financeiro)', trecho: 'financeiro' },
  { id: 'logagem', nome: 'Logagem', icone: Clapperboard, cor: 'var(--cor-criativo)', trecho: 'logagem' },
  { id: 'decupagem', nome: 'Decupagem', icone: Film, cor: 'var(--cor-criativo)', trecho: 'decupagem' },
  { id: 'documentos', nome: 'Documentos', curto: 'Docs', icone: FileText, cor: 'var(--cor-criativo)', trecho: 'documentos' },
  { id: 'producao', nome: 'Produção', icone: Users, cor: 'var(--cor-equipe)', trecho: 'producao' },
  { id: 'locacoes', nome: 'Locações', icone: MapPin, cor: 'var(--cor-logistica)', trecho: 'locacoes' },
  { id: 'transporte', nome: 'Transporte', icone: Truck, cor: 'var(--cor-logistica)', trecho: 'transporte' },
  { id: 'dados', nome: 'Dados', icone: Database, cor: 'var(--cor-logistica)', trecho: 'dados' },
  { id: 'config', nome: 'Config', icone: Settings, cor: 'var(--text-muted)', trecho: 'config' },
];

const POR_ID = new Map(MODULOS.map(m => [m.id, m]));
export const moduloPorId = (id: IdModulo) => POR_ID.get(id)!;

export const FIXOS_PADRAO: IdModulo[] = ['dash', 'diarias', 'financeiro'];
/** O que o lugar que acompanha mostra antes de você abrir qualquer coisa. */
const QUARTO_PADRAO: IdModulo = 'tasks';

export const caminhoDo = (projetoId: string, m: Modulo) =>
  m.trecho ? `/projeto/${projetoId}/${m.trecho}` : `/projeto/${projetoId}`;

/** Em que módulo está este caminho — `null` fora da produção. */
export function moduloDoCaminho(caminho: string, projetoId: string): IdModulo | null {
  const base = `/projeto/${projetoId}`;
  if (caminho !== base && !caminho.startsWith(base + '/')) return null;
  const trecho = caminho.slice(base.length + 1).split('/')[0] || '';
  const achado = MODULOS.find(m => m.trecho === trecho || m.tambem?.includes(trecho));
  return achado?.id ?? null;
}

/* ── os três fixos: guardados no aparelho, avisados a quem estiver olhando ── */

const CHAVE_FIXOS = 'setprod:dock:fixos';
const ouvintes = new Set<() => void>();

function lerFixos(): IdModulo[] {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_FIXOS) || 'null');
    // Três, diferentes, e todos módulos que ainda existem. Qualquer coisa fora
    // disso (versão velha, mão no DevTools) volta ao padrão.
    if (Array.isArray(bruto) && bruto.length === 3 && new Set(bruto).size === 3
      && bruto.every(x => POR_ID.has(x))) return bruto;
  } catch { /* sem armazenamento: padrão */ }
  return FIXOS_PADRAO;
}

let fixosAgora = lerFixos();

export function salvarFixos(novos: IdModulo[]) {
  fixosAgora = novos;
  try { localStorage.setItem(CHAVE_FIXOS, JSON.stringify(novos)); } catch { /* vale só nesta visita */ }
  for (const f of ouvintes) f();
}

export function useFixosDaDock(): IdModulo[] {
  return useSyncExternalStore(
    f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => fixosAgora,
    () => FIXOS_PADRAO,
  );
}

/* ── o lugar que acompanha: o último módulo aberto, por produção ── */

const chaveDaUltima = (projetoId: string) => `setprod:dock:ultima:${projetoId}`;

export function lerUltima(projetoId: string): IdModulo | null {
  try {
    const v = localStorage.getItem(chaveDaUltima(projetoId)) as IdModulo | null;
    return v && POR_ID.has(v) ? v : null;
  } catch { return null; }
}

export function guardarUltima(projetoId: string, id: IdModulo) {
  try { localStorage.setItem(chaveDaUltima(projetoId), id); } catch { /* vale só nesta visita */ }
}

/**
 * O módulo do lugar que acompanha. O aberto agora, se não for fixo; senão o
 * último que foi; senão Tasks — e, se Tasks virou fixo, o primeiro que sobrar.
 */
export function quartoLugar(fixos: IdModulo[], atual: IdModulo | null, ultima: IdModulo | null): IdModulo {
  if (atual && !fixos.includes(atual)) return atual;
  if (ultima && !fixos.includes(ultima)) return ultima;
  if (!fixos.includes(QUARTO_PADRAO)) return QUARTO_PADRAO;
  return MODULOS.find(m => !fixos.includes(m.id))!.id;
}

/** Abre o editor da dock de qualquer lugar (a tela de Config usa). */
export const EVENTO_EDITAR_DOCK = 'setprod-editar-dock';
export const abrirEditorDaDock = () => window.dispatchEvent(new Event(EVENTO_EDITAR_DOCK));
