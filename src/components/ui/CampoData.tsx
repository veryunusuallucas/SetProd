import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Um campo de data que é dd/mm/aaaa em qualquer computador.
 *
 * POR QUE ISTO EXISTE, JÁ QUE O NAVEGADOR TEM `<input type="date">`
 *
 * Porque aquele campo se escreve no idioma DO NAVEGADOR, e não no do site. Num
 * Chrome instalado em inglês — que é a maioria das máquinas que a gente vê em
 * produção, inclusive a do Lucas — ele mostra `mm/dd/yyyy` no meio de um app
 * inteiro em português. Não é só feio: 03/09 e 09/03 são dois dias diferentes, e
 * quem digita 09/03 esperando setembro marca a diária em março.
 *
 * Não adianta mexer no `lang` do documento (o Chrome ignora), nem em CSS: o
 * formato é decidido pelo idioma da interface do navegador, e página nenhuma
 * tem como mudar isso.
 *
 * COMO ELE FUNCIONA
 * O que se vê e se digita é um campo de texto com máscara, sempre em ordem
 * brasileira. Ao lado, o ícone de calendário é um `<input type="date">` de
 * verdade, invisível por cima: o seletor nativo continua ali para quem prefere
 * clicar, com o teclado numérico certo no celular — só o texto dele é que não
 * aparece mais.
 *
 * ⚠️ O VALOR CONTINUA SENDO `YYYY-MM-DD`.
 * Entra e sai no mesmo formato do `<input type="date">` que ele substitui, que é
 * o que o banco guarda. A tradução para o jeito brasileiro acontece aqui dentro
 * e só aqui — nenhuma tela precisa saber disso.
 */

/** "2026-09-03" → "03/09/2026". Vazio quando não for uma data completa. */
function paraBR(iso?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/**
 * "03/09/2026" → "2026-09-03". Devolve "" enquanto não for uma data de verdade.
 *
 * A checagem final é feita montando a data e conferindo se ela voltou igual —
 * é o que pega 31/02, que passa por qualquer validação de faixa.
 */
function paraISO(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return '';
  const dia = Number(m[1]), mes = Number(m[2]), ano = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900) return '';
  const d = new Date(ano, mes - 1, dia, 12, 0, 0);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * Vai pondo as barras enquanto a pessoa digita.
 *
 * Só dígitos entram; as barras são postas pelo campo. Quem cola "3/9/2026" ou
 * "03092026" também acerta — o que a máscara não pode fazer é obrigar a digitar
 * a barra, que no celular é troca de teclado.
 */
function mascarar(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function CampoData({
  value, defaultValue, onChange, name, required, autoFocus, disabled, id,
  min, max, style, className,
}: {
  /** Data em `YYYY-MM-DD`. Deixe de fora para usar o campo sem controlar. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** Para formulários lidos por `FormData`: sai um campo escondido com o ISO. */
  name?: string;
  required?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const controlado = value !== undefined;
  const [texto, setTexto] = useState(() => paraBR(controlado ? value : defaultValue));
  const nativo = useRef<HTMLInputElement>(null);

  /*
    Quando o valor vem de fora, o texto acompanha — mas só se a data mudou de
    verdade. Sem essa comparação, cada tecla digitada era desfeita pelo valor
    antigo que ainda estava no estado de quem chamou.
  */
  useEffect(() => {
    if (!controlado) return;
    if (paraISO(texto) === (value || '')) return;
    setTexto(paraBR(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const iso = paraISO(texto);

  const digitar = (bruto: string) => {
    const novo = mascarar(bruto);
    setTexto(novo);
    onChange?.(paraISO(novo));
  };

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', ...style }} className={className}>
      <input
        type="text"
        inputMode="numeric"
        id={id}
        value={texto}
        onChange={e => digitar(e.target.value)}
        placeholder="dd/mm/aaaa"
        required={required}
        autoFocus={autoFocus}
        disabled={disabled}
        maxLength={10}
        style={{ width: '100%', paddingRight: '38px' }}
      />

      {/*
        O calendário nativo, invisível por cima do ícone.

        É o próprio `<input type="date">` — clicar nele abre o seletor do
        sistema sem depender de `showPicker()`, que ainda falta em navegador
        antigo. O texto dele em inglês não aparece porque a opacidade é zero; o
        que se vê embaixo é o ícone.
      */}
      <span
        style={{
          position: 'absolute', right: '2px', top: 0, bottom: 0, width: '34px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', pointerEvents: disabled ? 'none' : 'auto',
        }}
      >
        <Calendar size={16} />
        <input
          ref={nativo}
          type="date"
          tabIndex={-1}
          aria-label="Escolher no calendário"
          value={iso}
          min={min}
          max={max}
          disabled={disabled}
          onChange={e => { setTexto(paraBR(e.target.value)); onChange?.(e.target.value); }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            opacity: 0, cursor: 'pointer', padding: 0, border: 'none', background: 'transparent',
          }}
        />
      </span>

      {name && <input type="hidden" name={name} value={iso} />}
    </div>
  );
}
