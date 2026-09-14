import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '../db/db';
import { tipoDoEvento } from './EventosPanel';
import { useNavigate } from 'react-router-dom';
import {
  format, parseISO, addMonths, subMonths, addWeeks, subWeeks, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, CloudRain, Sun, Cloud, Calendar as CalendarIcon, CheckSquare,
  X, Clapperboard, ListTodo, Rows3, CalendarRange, CalendarDays,
} from 'lucide-react';
import { parseCoords } from '../lib/clima';
import { MOLA } from './ui/movimento';
import { useOrigemAncorada } from './ui/origemAncorada';
import type { Diaria, Evento, Task } from '../types';

interface WeatherData {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
}

/*
  TRÊS FORMAS DE VER O MESMO CALENDÁRIO.

  De onde veio: *"no celular acho que é importante conseguir ver"*. O mês em
  sete colunas é o jeito certo de enxergar a forma do mês, mas num celular cada
  dia tem ~40px de largura e o que está escrito nele vira "C…", "B…", "O…".

  - **Dias:** só os dias que têm alguma coisa, um cartão por dia, com o texto
    inteiro. É a agenda: a forma de LER.
  - **Semana:** os sete dias, com o texto inteiro. Lado a lado no computador,
    um embaixo do outro no celular.
  - **Mês:** a grade de sempre. No celular, os chips viram pontinhos, porque
    não cabem.

  E em qualquer um, tocar no dia abre o cartão do dia, como no Google Agenda.
*/
type ModoCalendario = 'dias' | 'semana' | 'mes';
const CHAVE_MODO = 'setprod:calendario:modo';

function modoInicial(): ModoCalendario {
  try {
    const salvo = localStorage.getItem(CHAVE_MODO);
    if (salvo === 'dias' || salvo === 'semana' || salvo === 'mes') return salvo;
  } catch { /* sem localStorage: segue o tamanho da tela */ }
  // Quem nunca escolheu abre no que se lê naquela tela.
  return typeof window !== 'undefined' && window.innerWidth < 600 ? 'dias' : 'mes';
}

/*
  O texto do chip vai num span próprio porque o chip é flex (ícone + hora +
  título). Num flex, o texto solto vira item anônimo e o `textOverflow` do chip
  não chega nele: o título era cortado seco no meio da letra, sem as
  reticências que avisam que tem mais.
*/
const TEXTO_DO_CHIP: React.CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };

interface ConteudoDoDia {
  iso: string;
  diarias: Diaria[];
  eventos: Evento[];
  tasks: Task[];
  /**
   * O que faz o dia se destacar na grade.
   *
   * Diária vence prazo: é o dia em que a equipe inteira está no set. Prazo só
   * conta com a task em aberto. Uma entrega já feita não pede atenção, e
   * pintar o dia dela faria o mês passado inteiro gritar à toa.
   */
  peso: 'diaria' | 'prazo' | null;
  vazio: boolean;
}

/*
  A cor do dia importante.

  Diária usa a cor do set (a identidade do app); prazo usa o laranja de aviso.
  Tinta fraca no fundo e borda mais forte. Nunca fundo chapado: num app escuro,
  um mês com oito diárias em amarelo cheio cansa a vista, e o texto dos chips
  some em cima dele.
*/
export function estiloDoPeso(peso: ConteudoDoDia['peso']): React.CSSProperties {
  if (peso === 'diaria') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--cor-set) 13%, var(--bg-primary))',
      borderColor: 'color-mix(in srgb, var(--cor-set) 55%, transparent)',
    };
  }
  if (peso === 'prazo') {
    return {
      backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, var(--bg-primary))',
      borderColor: 'color-mix(in srgb, var(--color-warning) 45%, transparent)',
    };
  }
  return { backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border-light)' };
}

/*
  HOJE É VERDE.

  Era amarelo, e amarelo é a cor da diária: um hoje que também fosse dia de
  diária ficava amarelo sobre amarelo, e um hoje comum parecia dia de
  filmagem. Verde não disputa com nenhum dos dois pesos, e diz "você está
  aqui" sem dizer "tem set".
*/
export const COR_DE_HOJE = 'var(--color-success)';

export const COR_DO_PESO = { diaria: 'var(--cor-set)', prazo: 'var(--color-warning)' } as const;

export function CalendarioDashboard({ projetoId }: { projetoId: string }) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mostrarClima, setMostrarClima] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [modo, setModoEstado] = useState<ModoCalendario>(modoInicial);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);

  const setModo = (m: ModoCalendario) => {
    setModoEstado(m);
    try { localStorage.setItem(CHAVE_MODO, m); } catch { /* fica só nesta visita */ }
  };

  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const eventos = useLiveQuery(() => db.eventos.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const locacoes = useLiveQuery(() => db.locacoes.where('projeto_id').equals(projetoId).toArray(), [projetoId]) || [];

  // Alcance configurável da camada de clima (v4 §1.2). A API gratuita cobre ~16 dias.
  const [alcanceDias, setAlcanceDias] = useState(14);

  /*
    De QUAL locação é a previsão do calendário.

    Antes era "a primeira do projeto que tivesse coordenadas" — escolhida em
    silêncio, sem aparecer em lugar nenhum. Numa produção com sets em cidades
    diferentes, a pessoa lia a previsão de um lugar achando que era de outro. E
    o pior: a locação escolhida podia nem ser usada no dia que ela estava
    olhando.

    Numa célula de calendário não cabem duas previsões, então a saída não é
    mostrar todas: é DIZER qual é, e deixar trocar. Uma linha por dia, com nome.
  */
  const locaisComCoords = locacoes.filter(l => parseCoords(l.coordenadas));
  const [localDoClima, setLocalDoClima] = useState<string>('');

  const localEscolhido =
    locaisComCoords.find(l => l.id === localDoClima) || locaisComCoords[0] || null;
  const coords = parseCoords(localEscolhido?.coordenadas);

  useEffect(() => {
    if (!mostrarClima || !coords) {
      if (!mostrarClima) setWeatherData(null);
      return;
    }

    const dias = Math.min(Math.max(alcanceDias, 1), 16);
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=${dias}`)
      .then(res => res.json())
      .then(data => {
        if (data.daily) setWeatherData(data.daily);
      })
      .catch(console.error);
  }, [mostrarClima, coords?.lat, coords?.lng, alcanceDias]);

  // A semana anda de sete em sete; Dias e Mês andam de mês em mês.
  const avancar = () => setCurrentDate(d => (modo === 'semana' ? addWeeks(d, 1) : addMonths(d, 1)));
  const voltar = () => setCurrentDate(d => (modo === 'semana' ? subWeeks(d, 1) : subMonths(d, 1)));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);

  const days = eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  const diasDaSemana = eachDayOfInterval({ start: startOfWeek(currentDate), end: endOfWeek(currentDate) });

  const titulo = modo === 'semana'
    ? (() => {
        const ini = diasDaSemana[0];
        const fim = diasDaSemana[6];
        return isSameMonth(ini, fim)
          ? `${format(ini, 'd')} – ${format(fim, "d 'de' MMMM yyyy", { locale: ptBR })}`
          : `${format(ini, "d 'de' MMM", { locale: ptBR })} – ${format(fim, "d 'de' MMM yyyy", { locale: ptBR })}`;
      })()
    : format(currentDate, 'MMMM yyyy', { locale: ptBR });

  const conteudo = (dia: Date): ConteudoDoDia => {
    const iso = format(dia, 'yyyy-MM-dd');
    const ds = (diarias || []).filter(d => d.data === iso);
    const es = (eventos || [])
      .filter(e => e.data === iso)
      .sort((a, b) => (a.hora_inicio || '99').localeCompare(b.hora_inicio || '99'));
    const ts = (tasks || []).filter(t => t.data_conclusao === iso);
    const peso = ds.length > 0 ? 'diaria' : ts.some(t => t.status !== 'done') ? 'prazo' : null;
    return { iso, diarias: ds, eventos: es, tasks: ts, peso, vazio: !ds.length && !es.length && !ts.length };
  };

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun size={14} className="text-warning" />;
    if (code <= 48) return <Cloud size={14} className="text-secondary" />;
    return <CloudRain size={14} className="text-info" />;
  };

  const clima = (iso: string) => {
    if (!mostrarClima || !weatherData) return null;
    const i = weatherData.time.indexOf(iso);
    if (i === -1) return null;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)' }}>
        {getWeatherIcon(weatherData.weathercode[i])} {Math.round(weatherData.temperature_2m_max[i])}°
      </span>
    );
  };

  const abrirDiaria = (d: Diaria) => navigate(`/projeto/${projetoId}/diaria/${d.id}`);

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h3 className="text-lg font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarIcon size={20} className="text-accent" />
          Calendário do Projeto
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={mostrarClima} onChange={e => setMostrarClima(e.target.checked)} />
            Mostrar Previsão do Tempo
          </label>
          {/* O nome do set fica à vista sempre que o clima estiver ligado.
              Previsão sem origem é pior que previsão nenhuma: parece
              informação, e não é. */}
          {mostrarClima && locaisComCoords.length > 0 && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              Clima de:
              <select
                value={localEscolhido?.id || ''}
                onChange={e => setLocalDoClima(e.target.value)}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)', maxWidth: '180px' }}
              >
                {locaisComCoords.map(l => (
                  <option key={l.id} value={l.id}>{l.nome}</option>
                ))}
              </select>
            </label>
          )}
          {mostrarClima && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              Alcance:
              <select
                value={alcanceDias}
                onChange={e => setAlcanceDias(Number(e.target.value))}
                style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-surface)' }}
              >
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={16}>16 dias (máx)</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {mostrarClima && !coords && (
        <div className="text-xs text-muted" style={{ backgroundColor: 'var(--bg-primary)', padding: '8px 12px', borderRadius: '8px' }}>
          Nenhuma locação com coordenadas cadastradas — sem isso não dá para buscar a previsão. Cadastre em Locações.
        </div>
      )}

      {/* O seletor segue o das Diárias (Simplificada / Detalhada): o mesmo
          gesto de "como quero ver" tem a mesma cara no app inteiro. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div
          role="radiogroup"
          aria-label="Como ver o calendário"
          // `maxWidth` e botões que encolhem: em 320px os três botões com
          // ícone passavam 2px da tela.
          style={{
            display: 'inline-flex', padding: '4px', gap: '4px', maxWidth: '100%',
            backgroundColor: 'var(--bg-primary)', borderRadius: '10px', border: '1px solid var(--border-light)',
          }}
        >
          {([
            { id: 'dias' as const, nome: 'Dias', icone: Rows3 },
            { id: 'semana' as const, nome: 'Semana', icone: CalendarRange },
            { id: 'mes' as const, nome: 'Mês', icone: CalendarDays },
          ]).map(m => {
            const ativo = modo === m.id;
            const Icone = m.icone;
            return (
              <button
                key={m.id}
                role="radio"
                aria-checked={ativo}
                onClick={() => setModo(m.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', flex: '1 1 auto', minWidth: 0,
                  padding: '8px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '13px',
                  backgroundColor: ativo ? 'var(--bg-active)' : 'transparent',
                  color: ativo ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                <Icone size={15} /> {m.nome}
              </button>
            );
          })}
        </div>

        <Legenda />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <button onClick={voltar} className="btn-icon" aria-label={modo === 'semana' ? 'Semana anterior' : 'Mês anterior'}><ChevronLeft size={20} /></button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="font-bold text-lg" style={{ textAlign: 'center', textTransform: modo === 'semana' ? 'none' : 'capitalize' }}>{titulo}</span>
          <button onClick={() => setCurrentDate(new Date())} className="btn-chip" style={{ padding: '6px 10px' }}>Hoje</button>
        </div>
        <button onClick={avancar} className="btn-icon" aria-label={modo === 'semana' ? 'Próxima semana' : 'Próximo mês'}><ChevronRight size={20} /></button>
      </div>

      {modo === 'mes' && (
        /*
          `minmax(0, 1fr)`, e não `1fr` puro. `1fr` quer dizer `minmax(auto, 1fr)`,
          e o `auto` não deixa a coluna ficar mais estreita que o item mais largo
          dela: o chip "Conferir e Alinhar – Logline e Conceito Geral" esticava a
          quarta-feira sozinho, e o mês passava da tela até em 1400px, com a
          página inteira rolando de lado. Com mínimo zero, as sete colunas ficam
          iguais e o texto comprido vira reticências.
        */
        <div className="cal-mes" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
            <div key={dia} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              {dia}
            </div>
          ))}

          {days.map(day => {
            const c = conteudo(day);
            const hoje = isToday(day);
            return (
              <div
                key={c.iso}
                className="cal-mes-dia"
                role={c.vazio ? undefined : 'button'}
                tabIndex={c.vazio ? undefined : 0}
                aria-label={c.vazio ? undefined : `Ver ${format(day, "d 'de' MMMM", { locale: ptBR })}`}
                onClick={() => { if (!c.vazio) setDiaAberto(c.iso); }}
                onKeyDown={e => { if (!c.vazio && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDiaAberto(c.iso); } }}
                style={{
                  minWidth: 0,
                  borderRadius: '8px',
                  border: '1px solid',
                  ...estiloDoPeso(c.peso),
                  // Hoje ganha contorno por FORA da borda: assim ele não apaga a
                  // cor de um hoje que também é dia de diária.
                  outline: hoje ? `2px solid ${COR_DE_HOJE}` : 'none',
                  outlineOffset: '-1px',
                  opacity: isSameMonth(day, monthStart) ? 1 : 0.4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  cursor: c.vazio ? 'default' : 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: hoje || c.peso ? 700 : 400, color: hoje ? COR_DE_HOJE : 'inherit' }}>
                    {format(day, 'd')}
                  </span>
                  <span className="cal-chips">{clima(c.iso)}</span>
                </div>

                <div className="cal-chips" style={{ flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <ItensDoDia c={c} cheio={false} aoAbrirDiaria={abrirDiaria} />
                </div>

                {/* No celular a célula tem ~40px: um ponto por tipo, na cor
                    dele, diz "tem coisa aqui" sem prometer um texto que não
                    cabe. O texto está a um toque, no cartão do dia. */}
                {!c.vazio && (
                  <div className="cal-pontos" aria-hidden>
                    {c.diarias.length > 0 && <span style={{ backgroundColor: 'var(--cor-set)' }} />}
                    {c.eventos.length > 0 && <span style={{ backgroundColor: tipoDoEvento(c.eventos[0].tipo).cor }} />}
                    {c.tasks.length > 0 && <span style={{ backgroundColor: c.tasks.some(t => t.status !== 'done') ? 'var(--color-warning)' : 'var(--text-muted)' }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modo === 'semana' && (
        <div className="cal-semana">
          {diasDaSemana.map(day => {
            const c = conteudo(day);
            return (
              <CartaoDoDia
                key={c.iso}
                dia={day}
                c={c}
                clima={clima(c.iso)}
                aoAbrir={() => setDiaAberto(c.iso)}
                aoAbrirDiaria={abrirDiaria}
              />
            );
          })}
        </div>
      )}

      {/* Enquanto o banco não respondeu, a agenda não fala nada. Sem a espera,
          ela anunciava "13 dias sem nada" por meio segundo, e mentir sobre um
          mês cheio é pior que não mostrar o mês ainda. */}
      {modo === 'dias' && diarias && tasks && eventos && (
        <AgendaDoMes
          dias={eachDayOfInterval({ start: monthStart, end: monthEnd })}
          conteudo={conteudo}
          clima={clima}
          aoAbrir={setDiaAberto}
          aoAbrirDiaria={abrirDiaria}
        />
      )}

      {diaAberto && (
        <CartaoFlutuanteDoDia
          dia={parseISO(diaAberto)}
          c={conteudo(parseISO(diaAberto))}
          clima={clima(diaAberto)}
          aoFechar={() => setDiaAberto(null)}
          aoAbrirDiaria={abrirDiaria}
          aoVerTasks={() => navigate(`/projeto/${projetoId}/tasks`)}
        />
      )}
    </div>
  );
}

function Legenda() {
  const item = (cor: string, nome: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: `color-mix(in srgb, ${cor} 25%, transparent)`, border: `1px solid ${cor}` }} />
      {nome}
    </span>
  );
  return (
    <div className="text-xs text-muted" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
      {item(COR_DE_HOJE, 'hoje')}
      {item(COR_DO_PESO.diaria, 'dia de diária')}
      {item(COR_DO_PESO.prazo, 'prazo de task')}
    </div>
  );
}

/**
 * O que tem no dia: diárias, depois eventos, depois tasks.
 *
 * Evento vem ANTES das tasks e DEPOIS da diária: a diária é o que manda no dia,
 * o evento é compromisso marcado, e a task é prazo. Essa é a ordem em que a
 * pessoa lê o dia.
 *
 * `cheio` decide entre chip de uma linha (a grade do mês, onde não cabe) e a
 * linha com o texto inteiro (semana, dias e o cartão do dia, onde é para ler).
 */
function ItensDoDia({ c, cheio, aoAbrirDiaria }: { c: ConteudoDoDia; cheio: boolean; aoAbrirDiaria: (d: Diaria) => void }) {
  const linha: React.CSSProperties = cheio
    ? { fontSize: '13px', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: 1.35, minWidth: 0, overflowWrap: 'anywhere' }
    : { fontSize: '10px', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 };
  const texto = cheio ? { minWidth: 0 } : TEXTO_DO_CHIP;

  return (
    <>
      {c.diarias.map(d => (
        <button
          key={d.id}
          onClick={e => { e.stopPropagation(); aoAbrirDiaria(d); }}
          title={`Abrir Diária ${d.numero}`}
          style={{ ...linha, border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 700, backgroundColor: 'var(--cor-set)', color: '#000' }}
        >
          {cheio && <Clapperboard size={14} style={{ flexShrink: 0, marginTop: '1px' }} />}
          <span style={texto}>Diária {String(d.numero).padStart(2, '0')}</span>
        </button>
      ))}

      {c.eventos.map(e => {
        const t = tipoDoEvento(e.tipo);
        return (
          <div
            key={e.id}
            title={`${t.nome}${e.hora_inicio ? ` · ${e.hora_inicio}` : ''}`}
            style={{ ...linha, backgroundColor: 'var(--bg-surface)', borderLeft: `3px solid ${t.cor}` }}
          >
            <span style={{ flexShrink: 0 }}>{t.emoji}</span>
            {e.hora_inicio && <strong style={{ flexShrink: 0 }}>{e.hora_inicio}</strong>}
            <span style={texto}>{e.titulo}</span>
          </div>
        );
      })}

      {c.tasks.map(t => (
        <div
          key={t.id}
          style={{
            ...linha, backgroundColor: 'var(--bg-surface)',
            border: `1px solid ${t.status !== 'done' ? 'color-mix(in srgb, var(--color-warning) 40%, transparent)' : 'var(--border-color)'}`,
          }}
        >
          <CheckSquare size={cheio ? 14 : 10} className={t.status === 'done' ? 'text-success' : 'text-warning'} style={{ flexShrink: 0, marginTop: cheio ? '1px' : 0 }} />
          <span style={{ ...texto, textDecoration: cheio && t.status === 'done' ? 'line-through' : 'none', opacity: t.status === 'done' ? 0.7 : 1 }}>{t.titulo}</span>
        </div>
      ))}
    </>
  );
}

function CabecalhoDoDia({ dia, c, clima }: { dia: Date; c: ConteudoDoDia; clima: React.ReactNode }) {
  const hoje = isToday(dia);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
      <div style={{ minWidth: '34px' }}>
        <div className="text-xs uppercase tracking-widest font-bold" style={{ color: hoje ? COR_DE_HOJE : 'var(--text-muted)' }}>
          {format(dia, 'EEE', { locale: ptBR }).replace('.', '')}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.1, color: hoje ? COR_DE_HOJE : 'var(--text-primary)' }}>
          {format(dia, 'd')}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        {hoje && <span className="text-xs font-bold" style={{ color: COR_DE_HOJE }}>hoje</span>}
        {c.peso && (
          <span className="text-xs font-bold" style={{ color: COR_DO_PESO[c.peso] }}>
            {c.peso === 'diaria' ? 'dia de diária' : 'prazo de task'}
          </span>
        )}
        {clima}
      </div>
    </div>
  );
}

/** Um dia com tudo escrito. É a unidade da Semana e dos Dias. */
function CartaoDoDia({ dia, c, clima, aoAbrir, aoAbrirDiaria }: {
  dia: Date; c: ConteudoDoDia; clima: React.ReactNode; aoAbrir: () => void; aoAbrirDiaria: (d: Diaria) => void;
}) {
  const hoje = isToday(dia);
  return (
    <div
      role={c.vazio ? undefined : 'button'}
      tabIndex={c.vazio ? undefined : 0}
      onClick={() => { if (!c.vazio) aoAbrir(); }}
      onKeyDown={e => { if (!c.vazio && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); aoAbrir(); } }}
      style={{
        border: '1px solid',
        ...estiloDoPeso(c.peso),
        borderLeft: `3px solid ${c.peso ? COR_DO_PESO[c.peso] : 'var(--border-light)'}`,
        outline: hoje ? `2px solid ${COR_DE_HOJE}` : 'none',
        outlineOffset: '-1px',
        borderRadius: '10px', padding: '10px', minWidth: 0,
        display: 'flex', flexDirection: 'column', gap: '8px',
        cursor: c.vazio ? 'default' : 'pointer',
      }}
    >
      <CabecalhoDoDia dia={dia} c={c} clima={clima} />
      {c.vazio
        ? <span className="text-xs text-muted">nada marcado</span>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
            <ItensDoDia c={c} cheio aoAbrirDiaria={aoAbrirDiaria} />
          </div>}
    </div>
  );
}

/**
 * Os dias do mês que têm alguma coisa, em lista.
 *
 * Os dias vazios somem, mas o intervalo não: "· 4 dias sem nada" entre dois
 * cartões diz que a próxima diária é daqui a uma semana, e não amanhã. Uma
 * agenda que cola o dia 3 no dia 12 esconde justamente o respiro que a produção
 * precisa enxergar. Hoje aparece sempre, mesmo vazio, para a pessoa saber onde
 * está.
 */
function AgendaDoMes({ dias, conteudo, clima, aoAbrir, aoAbrirDiaria }: {
  dias: Date[];
  conteudo: (d: Date) => ConteudoDoDia;
  clima: (iso: string) => React.ReactNode;
  aoAbrir: (iso: string) => void;
  aoAbrirDiaria: (d: Diaria) => void;
}) {
  const blocos: React.ReactNode[] = [];
  let vazios = 0;
  const fecharVazios = (chave: string) => {
    if (vazios > 0) {
      blocos.push(
        <div key={`vazio-${chave}`} className="text-xs text-muted" style={{ padding: '0 12px' }}>
          · {vazios === 1 ? '1 dia sem nada' : `${vazios} dias sem nada`}
        </div>
      );
      vazios = 0;
    }
  };

  for (const dia of dias) {
    const c = conteudo(dia);
    if (c.vazio && !isToday(dia)) { vazios++; continue; }
    fecharVazios(c.iso);
    blocos.push(
      <CartaoDoDia key={c.iso} dia={dia} c={c} clima={clima(c.iso)} aoAbrir={() => aoAbrir(c.iso)} aoAbrirDiaria={aoAbrirDiaria} />
    );
  }
  const temAlgo = blocos.length > 0;
  fecharVazios('fim');

  if (!temAlgo) {
    return <div className="text-sm text-muted" style={{ textAlign: 'center', padding: '24px 0' }}>Nada marcado neste mês.</div>;
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{blocos}</div>;
}

/**
 * O cartão que abre ao tocar no dia, como no Google Agenda.
 *
 * Existe porque na grade do mês não dá para ler: no celular o dia 9 mostrava
 * "C…", "B…", "O…". Aqui cada item tem o texto inteiro, a hora e o que ele é.
 *
 * Nasce de onde foi tocado (`useOrigemAncorada`), como os outros painéis do
 * app: o cartão sai do dia, e não do meio da tela.
 */
function CartaoFlutuanteDoDia({ dia, c, clima, aoFechar, aoAbrirDiaria, aoVerTasks }: {
  dia: Date; c: ConteudoDoDia; clima: React.ReactNode;
  aoFechar: () => void; aoAbrirDiaria: (d: Diaria) => void; aoVerTasks: () => void;
}) {
  const ancora = useOrigemAncorada();

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  const secao = (icone: React.ReactNode, nome: string) => (
    <div className="text-xs text-secondary font-bold uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
      {icone} {nome}
    </div>
  );

  return (
    <div
      onClick={aoFechar}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
    >
      <motion.div
        ref={ancora}
        role="dialog"
        aria-modal="true"
        aria-label={format(dia, "EEEE, d 'de' MMMM", { locale: ptBR })}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto', backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '16px', borderTop: c.peso ? `3px solid ${COR_DO_PESO[c.peso]}` : undefined }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: 0 }}>
            {/* Maiúscula só na primeira letra, e não `capitalize`: o CSS
                escrevia "Sábado, 12 De Setembro". */}
            <h3 className="font-bold text-lg">
              {(t => t.charAt(0).toUpperCase() + t.slice(1))(format(dia, "EEEE, d 'de' MMMM", { locale: ptBR }))}
            </h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
              {isToday(dia) && <span className="text-xs font-bold" style={{ color: COR_DE_HOJE }}>hoje</span>}
              {c.peso && <span className="text-xs font-bold" style={{ color: COR_DO_PESO[c.peso] }}>{c.peso === 'diaria' ? 'dia de diária' : 'prazo de task'}</span>}
              {clima}
            </div>
          </div>
          <button onClick={aoFechar} className="btn-icon" aria-label="Fechar"><X size={20} /></button>
        </div>

        {c.diarias.length > 0 && (
          <div>
            {secao(<Clapperboard size={13} />, c.diarias.length > 1 ? 'Diárias' : 'Diária')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {c.diarias.map(d => (
                <button
                  key={d.id}
                  onClick={() => aoAbrirDiaria(d)}
                  className="btn-primary"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', width: '100%' }}
                >
                  <span>Diária {String(d.numero).padStart(2, '0')}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>abrir <ChevronRight size={16} /></span>
                </button>
              ))}
            </div>
          </div>
        )}

        {c.eventos.length > 0 && (
          <div>
            {secao(<CalendarRange size={13} />, c.eventos.length > 1 ? 'Eventos' : 'Evento')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {c.eventos.map(e => {
                const t = tipoDoEvento(e.tipo);
                return (
                  <div key={e.id} style={{ backgroundColor: 'var(--bg-primary)', borderLeft: `3px solid ${t.cor}`, borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{t.emoji}</span>
                      {e.hora_inicio && <strong className="text-sm">{e.hora_inicio}{e.hora_fim ? `–${e.hora_fim}` : ''}</strong>}
                      <span className="font-bold" style={{ overflowWrap: 'anywhere' }}>{e.titulo}</span>
                    </div>
                    <span className="text-xs text-muted">{t.nome}</span>
                    {e.observacao && <span className="text-sm text-secondary" style={{ overflowWrap: 'anywhere' }}>{e.observacao}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {c.tasks.length > 0 && (
          <div>
            {secao(<ListTodo size={13} />, 'Prazos de tasks')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <ItensDoDia c={{ ...c, diarias: [], eventos: [] }} cheio aoAbrirDiaria={aoAbrirDiaria} />
            </div>
            <button onClick={aoVerTasks} className="btn-chip" style={{ marginTop: '8px' }}>
              Ver em Tasks <ChevronRight size={14} />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
