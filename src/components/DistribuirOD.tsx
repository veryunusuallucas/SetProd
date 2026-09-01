import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus, Mail, Video, ExternalLink, Check, AlertTriangle, Send, Download,
} from 'lucide-react';
import { db } from '../db/db';
import type { Cena, Diaria, Perfil } from '../types';
import { montarIcs, baixarIcs, linkGoogleAgenda } from '../lib/ics';
import { enviarOD, corpoDoEmail } from '../lib/emailOD';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * Como a Ordem do Dia sai do app e chega nas pessoas (spec §7).
 *
 * Só aparece depois de exportada. Antes disso não há o que distribuir — o plano
 * ainda é rascunho, e mandar um rascunho para a equipe é exatamente o problema
 * que o congelamento na exportação existe para evitar.
 */

export function DistribuirOD({
  diaria, cenas, escalados, nomeDoProjeto, locais, montarHtmlOD, podeEnviar,
}: {
  diaria: Diaria;
  cenas: Cena[];
  escalados: Perfil[];
  nomeDoProjeto: string;
  locais: string[];
  /** O mesmo gerador que imprime o papel — para o email dizer a mesma coisa. */
  montarHtmlOD: (completo?: boolean) => string;
  podeEnviar: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const [emailAberto, setEmailAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);

  const comEmail = escalados.filter(p => p.email?.includes('@'));
  const semEmail = escalados.filter(p => !p.email?.includes('@'));
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(comEmail.map(p => p.id)));

  const versao = diaria.versao_od || 1;
  const dados = { diaria, cenas, nomeDoProjeto, locais };

  const baixarAgenda = () => {
    const ics = montarIcs(dados);
    if (ics) baixarIcs(ics, `diaria-${String(diaria.numero).padStart(2, '0')}-${nomeDoProjeto.replace(/\W+/g, '-').toLowerCase()}`);
  };

  const alternar = (id: string) => {
    setMarcados(atual => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  };

  const enviar = async () => {
    const para = comEmail.filter(p => marcados.has(p.id)).map(p => p.email!);
    if (para.length === 0) {
      setResultado({ ok: false, texto: 'Escolha pelo menos uma pessoa.' });
      return;
    }

    setEnviando(true);
    setResultado(null);

    const assunto = `OD Diária ${String(diaria.numero).padStart(2, '0')}${versao > 1 ? ` — v${versao}` : ''} · ${nomeDoProjeto}`;
    const ics = montarIcs(dados);

    const r = await enviarOD({
      para,
      assunto,
      html: corpoDoEmail({
        conteudoDaOD: montarHtmlOD(false),
        nomeDoProjeto,
        numero: diaria.numero,
        versao,
        linkReuniao: diaria.link_reuniao,
      }),
      anexos: ics ? [{ filename: `diaria-${String(diaria.numero).padStart(2, '0')}.ics`, conteudo: ics }] : [],
    });

    setEnviando(false);
    setResultado(r.ok
      ? { ok: true, texto: `Enviada para ${r.enviados} ${r.enviados === 1 ? 'pessoa' : 'pessoas'}.` }
      : { ok: false, texto: r.erro || 'Não consegui enviar.' });
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: '3px solid var(--cor-logistica)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <h2 className="text-sm font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: 'auto' }}>
          <Send size={15} style={{ color: 'var(--cor-logistica)' }} /> Distribuir a OD
        </h2>
        {versao > 1 && (
          <span className="text-xs font-bold" style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            versão {versao}
          </span>
        )}
      </div>

      {/* ---- Agenda ---- */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={baixarAgenda} className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Download size={13} /> Baixar para a agenda (.ics)
        </button>
        <a
          href={linkGoogleAgenda(dados)}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-xs"
          style={{ display: 'flex', alignItems: 'center', gap: '7px', textDecoration: 'none' }}
        >
          <CalendarPlus size={13} /> Google Agenda <ExternalLink size={11} />
        </a>
        {podeEnviar && (
          <button onClick={() => setEmailAberto(a => !a)} className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <Mail size={13} /> Enviar por email
          </button>
        )}
      </div>

      <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
        O arquivo traz o dia inteiro e cada marco (chamada, refeição, wrap) como
        compromisso separado — cena não vira evento, senão a agenda de todo mundo
        vira uma parede.
      </div>

      {/* ---- Link da reunião ---- */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
        <label className="text-xs text-muted uppercase tracking-widest" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Video size={13} /> Link da reunião
        </label>
        <input
          defaultValue={diaria.link_reuniao || ''}
          onBlur={e => (diaria.link_reuniao || '') !== e.target.value && db.diarias.update(diaria.id, { link_reuniao: e.target.value || undefined })}
          placeholder="Cole aqui o link do Meet, Zoom ou Teams"
          style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-primary)' }}
        />
        <div className="text-xs text-muted" style={{ marginTop: '6px', lineHeight: 1.5 }}>
          Colado à mão de propósito: criar a sala sozinho exigiria a API do Google
          Calendar, com autorização de cada pessoa da equipe. O link entra no
          evento da agenda e no email.
        </div>
      </div>

      {/* ---- Email ---- */}
      <AnimatePresence initial={false}>
        {emailAberto && (
          <motion.div
            initial={reduzido ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduzido ? undefined : { height: 0, opacity: 0 }}
            transition={MOLA}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="text-xs text-muted uppercase tracking-widest">
                Para quem vai ({marcados.size} de {comEmail.length})
              </div>

              {comEmail.length === 0 ? (
                <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
                  Ninguém da equipe escalada tem email cadastrado. O email fica na
                  ficha de cada pessoa, em Equipe.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {comEmail.map(p => {
                    const on = marcados.has(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => alternar(p.id)}
                        className="text-xs"
                        style={{
                          padding: '5px 11px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                          border: `1px solid ${on ? 'var(--cor-logistica)' : 'var(--border-light)'}`,
                          backgroundColor: on ? 'var(--cor-logistica)' : 'transparent',
                          color: on ? '#04222e' : 'var(--text-muted)',
                          fontWeight: on ? 'bold' : 'normal',
                        }}
                        title={p.email}
                      >
                        {on ? '✓ ' : ''}{p.nome}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quem ficou de fora aparece, em vez de sumir. Sem isto, a produção
                  manda a OD achando que mandou para a equipe toda. */}
              {semEmail.length > 0 && (
                <div className="text-xs" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--color-warning)', lineHeight: 1.5 }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span>
                    Sem email na ficha, não recebem: {semEmail.map(p => p.nome).join(', ')}.
                  </span>
                </div>
              )}

              <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                Vai a OD no corpo do email (dá para ler no celular sem baixar nada) e o
                arquivo de agenda anexado. Todo mundo em cópia oculta — ninguém recebe a
                lista de emails dos outros. A confirmação de presença continua só no app.
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={enviar}
                  className="btn-primary text-xs"
                  disabled={enviando || comEmail.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                >
                  <Send size={13} /> {enviando ? 'Enviando…' : `Enviar a OD${versao > 1 ? ` v${versao}` : ''}`}
                </button>

                {resultado && (
                  <motion.span
                    initial={reduzido ? undefined : { opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs font-bold"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: resultado.ok ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1.5 }}
                  >
                    {resultado.ok ? <Check size={13} /> : <AlertTriangle size={13} style={{ flexShrink: 0 }} />}
                    {resultado.texto}
                  </motion.span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
