import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CloudRain, Sun, Cloud, Calendar as CalendarIcon, CheckSquare } from 'lucide-react';
import { parseCoords } from '../lib/clima';

interface WeatherData {
  time: string[];
  weathercode: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
}

export function CalendarioDashboard({ projetoId }: { projetoId: string }) {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mostrarClima, setMostrarClima] = useState(false);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  
  const diarias = useLiveQuery(() => db.diarias.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
  const tasks = useLiveQuery(() => db.tasks.where('projeto_id').equals(projetoId).toArray(), [projetoId]);
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

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getWeatherIcon = (code: number) => {
    if (code <= 3) return <Sun size={14} className="text-warning" />;
    if (code <= 48) return <Cloud size={14} className="text-secondary" />;
    return <CloudRain size={14} className="text-info" />;
  };

  return (
    <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={prevMonth} className="btn-icon"><ChevronLeft size={20} /></button>
        <span className="font-bold text-lg capitalize">{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</span>
        <button onClick={nextMonth} className="btn-icon"><ChevronRight size={20} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
          <div key={dia} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            {dia}
          </div>
        ))}

        {days.map((day, idx) => {
          const diaIso = format(day, 'yyyy-MM-dd');
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isDiaHoje = isToday(day);
          
          const diariasNoDia = (diarias || []).filter(d => d.data === diaIso);
          const tasksNoDia = (tasks || []).filter(t => t.data_conclusao === diaIso);

          let weatherNode = null;
          if (mostrarClima && weatherData) {
            const wIdx = weatherData.time.indexOf(diaIso);
            if (wIdx !== -1) {
              const code = weatherData.weathercode[wIdx];
              const max = Math.round(weatherData.temperature_2m_max[wIdx]);
              weatherNode = (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {getWeatherIcon(code)} {max}°
                </div>
              );
            }
          }

          return (
            <div 
              key={idx} 
              style={{ 
                minHeight: '80px',
                padding: '8px', 
                backgroundColor: isDiaHoje ? 'rgba(var(--accent-rgb), 0.1)' : 'var(--bg-primary)',
                border: isDiaHoje ? '1px solid var(--accent)' : '1px solid var(--border-light)',
                borderRadius: '8px',
                opacity: isCurrentMonth ? 1 : 0.4,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                cursor: diariasNoDia.length > 0 ? 'pointer' : 'default'
              }}
              onClick={() => {
                // Clicar num dia com diária abre aquela diária (§1.2): o calendário
                // é navegação, não só visualização.
                if (diariasNoDia.length > 0) {
                  navigate(`/projeto/${projetoId}/diaria/${diariasNoDia[0].id}`);
                }
              }}
              title={diariasNoDia.length > 0 ? `Abrir Diária ${diariasNoDia[0].numero}` : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '14px', fontWeight: isDiaHoje ? 'bold' : 'normal', color: isDiaHoje ? 'var(--accent)' : 'inherit' }}>
                  {format(day, 'd')}
                </span>
              </div>
              
              {weatherNode}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', flex: 1 }}>
                {diariasNoDia.map(d => (
                  <div key={d.id} style={{ fontSize: '10px', backgroundColor: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    Diária {d.numero}
                  </div>
                ))}
                
                {tasksNoDia.map(t => (
                  <div key={t.id} style={{ fontSize: '10px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <CheckSquare size={10} className={t.status === 'done' ? 'text-success' : 'text-warning'} />
                    {t.titulo}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
