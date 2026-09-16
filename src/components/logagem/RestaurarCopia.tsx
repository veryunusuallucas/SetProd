import { useRef, useState } from 'react';
import { ArchiveRestore, AlertTriangle, Check, Loader2 } from 'lucide-react';
import { BotaoTatil } from '../ui/BotaoTatil';
import { Abre } from './pecas';
import {
  CopiaInvalida, lerCopia, planejarRestauracao, planoVazio,
  type CopiaLida, type PlanoDeRestauracao,
} from '../../lib/logagem/copia';
import { restaurarCopia, situacaoParaRestaurar } from '../../lib/logagem/exportar';
import { dataHora } from '../../lib/formato';

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * "Trazer de uma cópia": o caminho de volta do JSON.
 *
 * Aceita a cópia do SetProd e o backup do Lumavi. Nada é gravado antes de a
 * pessoa ver o que vai entrar — e o que vai entrar é SÓ o que falta: o que já
 * está na diária fica como está.
 */
export function RestaurarCopia({ projetoId, diariaId, departamentoId, quem }: {
  projetoId: string;
  diariaId: string;
  departamentoId?: string;
  quem?: string;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lida, setLida] = useState<{ copia: CopiaLida; plano: PlanoDeRestauracao; nome: string } | null>(null);
  const [erro, setErro] = useState('');
  const [trabalhando, setTrabalhando] = useState(false);
  const [feito, setFeito] = useState('');

  const abrir = async (arquivo: File) => {
    setErro('');
    setFeito('');
    setLida(null);
    try {
      const copia = lerCopia(await arquivo.text());
      const plano = planejarRestauracao(copia, await situacaoParaRestaurar(projetoId, diariaId));
      setLida({ copia, plano, nome: arquivo.name });
    } catch (e) {
      setErro(e instanceof CopiaInvalida ? e.message : 'Não consegui ler este arquivo.');
      if (!(e instanceof CopiaInvalida)) console.error('[SetProd] Falha ao ler a cópia da Logagem:', e);
    }
  };

  const aplicar = async () => {
    if (!lida || trabalhando) return;
    setTrabalhando(true);
    try {
      await restaurarCopia(lida.copia, lida.plano, { projetoId, diariaId, departamentoId, quem });
      setFeito(resumo(lida.plano).join(', ') + '.');
      setLida(null);
    } catch (e) {
      console.error('[SetProd] Falha ao restaurar a cópia da Logagem:', e);
      setErro('A restauração parou no meio. O que entrou fica; abrir o arquivo de novo traz só o que faltou.');
    } finally {
      setTrabalhando(false);
    }
  };

  const outraDiaria = lida?.copia.origem === 'setprod' && lida.copia.diariaId && lida.copia.diariaId !== diariaId;
  const vazio = lida ? planoVazio(lida.plano) : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
      <input
        ref={entrada}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={e => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void abrir(f);
        }}
      />
      <BotaoTatil
        onClick={() => entrada.current?.click()}
        disabled={trabalhando}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px', minHeight: '48px', padding: '0 14px', alignSelf: 'flex-start',
          borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-color)', background: 'none',
          color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <ArchiveRestore size={18} />
        Trazer de uma cópia (JSON)
      </BotaoTatil>
      <span className="text-xs text-muted">
        A cópia de segurança do SetProd ou o backup do Lumavi. Só entra o que falta nesta diária.
      </span>

      {erro && (
        <p role="alert" className="text-sm" style={{ margin: 0, display: 'flex', gap: '8px', color: 'var(--color-danger)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> {erro}
        </p>
      )}

      {feito && (
        <p role="status" className="text-sm" style={{ margin: 0, display: 'flex', gap: '8px', color: 'var(--color-success)' }}>
          <Check size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> Entrou: {feito}
        </p>
      )}

      <Abre aberto={Boolean(lida)}>
        {lida && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
              <span className="text-sm font-bold" style={{ overflowWrap: 'anywhere' }}>{lida.nome}</span>
              <span className="text-xs text-muted">
                {lida.copia.origem === 'lumavi' ? 'Backup do Lumavi' : 'Cópia do SetProd'}
                {lida.copia.projeto ? ` · ${lida.copia.projeto}` : ''}
                {lida.copia.diaria ? ` · diária ${lida.copia.diaria}` : ''}
                {lida.copia.exportadoEm ? ` · feita em ${dataHora(Date.parse(lida.copia.exportadoEm))}` : ''}
              </span>
            </div>

            {outraDiaria && (
              <Aviso>Esta cópia é de outra diária. O que entrar vai para a diária aberta agora.</Aviso>
            )}
            {lida.copia.avisos.map(a => <Aviso key={a}>{a}</Aviso>)}

            {vazio ? (
              <p className="text-sm text-secondary" style={{ margin: 0 }}>
                Tudo o que está nesta cópia já está aqui. {lida.plano.takesRepetidos > 0 && `(${plural(lida.plano.takesRepetidos, 'take', 'takes')} iguais.)`}
              </p>
            ) : (
              <ul className="text-sm" style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {resumo(lida.plano).map(l => <li key={l}>{l}</li>)}
                {lida.plano.takesRepetidos > 0 && (
                  <li className="text-muted">
                    {plural(lida.plano.takesRepetidos, 'take já está', 'takes já estão')} aqui e {lida.plano.takesRepetidos === 1 ? 'fica' : 'ficam'} como {lida.plano.takesRepetidos === 1 ? 'está' : 'estão'}
                  </li>
                )}
              </ul>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!vazio && (
                <BotaoTatil
                  onClick={() => void aplicar()}
                  disabled={trabalhando}
                  className="btn-primary"
                  style={{ minHeight: '44px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {trabalhando && <Loader2 size={16} className="girando" />}
                  {trabalhando ? 'Trazendo…' : textoDoBotao(lida.plano)}
                </BotaoTatil>
              )}
              <BotaoTatil
                onClick={() => setLida(null)}
                disabled={trabalhando}
                className="btn-secondary"
                style={{ minHeight: '44px' }}
              >
                {vazio ? 'Fechar' : 'Cancelar'}
              </BotaoTatil>
            </div>
          </div>
        )}
      </Abre>
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs" style={{
      margin: 0, display: 'flex', gap: '8px', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
      color: 'var(--color-warning)', backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
    }}>
      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
      <span>{children}</span>
    </p>
  );
}

function resumo(p: PlanoDeRestauracao): string[] {
  const linhas: string[] = [];
  if (p.takesNovos.length) linhas.push(plural(p.takesNovos.length, 'take', 'takes'));
  if (p.kitsNovos.length) linhas.push(plural(p.kitsNovos.length, 'kit', 'kits'));
  if (p.hdsNovos.length) linhas.push(`${plural(p.hdsNovos.length, 'HD', 'HDs')} (${p.hdsNovos.map(h => h.nome).join(', ')})`);
  if (p.backupsNovos.length) linhas.push(plural(p.backupsNovos.length, 'marcação de cópia', 'marcações de cópia'));
  if (p.comprovantesNovos.length) linhas.push(plural(p.comprovantesNovos.length, 'comprovante', 'comprovantes'));
  if (p.estado) linhas.push('a claquete e a câmera de onde a cópia parou');
  return linhas;
}

function textoDoBotao(p: PlanoDeRestauracao): string {
  if (p.takesNovos.length) return `Trazer ${plural(p.takesNovos.length, 'take', 'takes')}${resumo(p).length > 1 ? ' e o resto' : ''}`;
  return 'Trazer';
}
