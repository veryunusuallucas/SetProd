import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarPlus, Mail, Video, ExternalLink, Check, AlertTriangle, Send, Download,
  Share2, Copy, ChevronDown,
} from 'lucide-react';
import { db } from '../db/db';
import type { Cena, Diaria, Perfil } from '../types';
import { montarIcs, baixarIcs, linkGoogleAgenda } from '../lib/ics';
import { enviarOD, corpoDoEmail } from '../lib/emailOD';
import { htmlParaTexto } from '../lib/textoDeHtml';
import { compartilharOD, copiar, linkDeEmail } from '../lib/compartilhar';
import { MOLA, useMovimentoReduzido } from './ui/movimento';

/**
 * Como a Ordem do Dia sai do app e chega nas pessoas (spec §7).
 *
 * ⚠️ A ORDEM DOS BOTÕES AQUI É UMA DECISÃO, NÃO ESTÉTICA.
 *
 * COMPARTILHAR vem primeiro porque é o único que funciona hoje, em qualquer
 * produção, sem custo: usa o WhatsApp e o email que a equipe já tem.
 *
 * ENVIAR PELO APP (Resend) vem por último e some quando não está configurado.
 * Ele exige um DOMÍNIO PRÓPRIO com DKIM e SPF no DNS — sem isso o Gmail joga em
 * spam ou recusa, e não existe jeito de contornar: é regra de quem recebe, não
 * limitação do app. Domínio custa dinheiro, e uma produção pequena não tem por
 * que gastar com isso para mandar uma OD.
 *
 * Ele continua no código porque é o caminho melhor quando existe domínio — o
 * email sai em nome da produção, e não da conta pessoal de quem clicou.
 */

export function DistribuirOD({
  diaria, cenas, escalados, nomeDoProjeto, locais, montarHtmlOD, podeEnviar,
}: {
  diaria: Diaria;
  cenas: Cena[];
  escalados: Perfil[];
  nomeDoProjeto: string;
  locais: string[];
  /** O mesmo gerador que imprime o papel — para tudo dizer a mesma coisa. */
  montarHtmlOD: (completo?: boolean) => string;
  podeEnviar: boolean;
}) {
  const reduzido = useMovimentoReduzido();
  const [emailAberto, setEmailAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [avulso, setAvulso] = useState<string | null>(null);

  const comEmail = escalados.filter(p => p.email?.includes('@'));
  const semEmail = escalados.filter(p => !p.email?.includes('@'));
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(comEmail.map(p => p.id)));

  const versao = diaria.versao_od || 1;
  const dados = { diaria, cenas, nomeDoProjeto, locais };
  const rotulo = `OD Diária ${String(diaria.numero).padStart(2, '0')}${versao > 1 ? ` — v${versao}` : ''}`;
  const assunto = `${rotulo} · ${nomeDoProjeto}`;
  const nomeDoArquivo = `diaria-${String(diaria.numero).padStart(2, '0')}-${nomeDoProjeto.replace(/\W+/g, '-').toLowerCase()}`;

  /** A OD em texto puro, com um cabeçalho que diz de onde ela veio. */
  const textoDaOD = () => {
    const corpo = htmlParaTexto(montarHtmlOD(false));
    const cabecalho = [
      nomeDoProjeto.toUpperCase(),
      `Ordem do Dia — Diária ${String(diaria.numero).padStart(2, '0')}${versao > 1 ? ` (v${versao})` : ''}`,
      versao > 1 ? '⚠️ Esta versão substitui a anterior — confira os horários.' : '',
      diaria.link_reuniao ? `Reunião: ${diaria.link_reuniao}` : '',
    ].filter(Boolean).join('\n');
    return `${cabecalho}\n${corpo}`;
  };

  /** Um recado curto que some sozinho — não vale ocupar espaço permanente. */
  const avisar = (texto: string) => {
    setAvulso(texto);
    setTimeout(() => setAvulso(a => (a === texto ? null : a)), 4000);
  };

  const compartilhar = async () => {
    const r = await compartilharOD({
      titulo: assunto,
      texto: textoDaOD(),
      ics: montarIcs(dados) || undefined,
      nomeDoArquivo,
    });
    if (r === 'copiou') avisar('Seu navegador não abre o menu de compartilhar — copiei a OD, é só colar.');
    if (r === 'falhou') avisar('Não consegui compartilhar nem copiar. Use "Exportar OD" e mande o arquivo.');
  };

  const copiarOD = async () => {
    avisar(await copiar(textoDaOD()) ? 'OD copiada. Cole no WhatsApp, no email, onde precisar.' : 'Não consegui copiar.');
  };

  /*
    O email pessoal: copia a OD ANTES de abrir o cliente.

    O `mailto:` leva os destinatários e o assunto, nunca o corpo — ele tem
    limite de tamanho que varia de cliente para cliente e corta sem avisar,
    entregando uma OD que termina no meio de uma cena. Copiar e colar é um
    passo a mais e nunca perde nada.
  */
  const abrirNoMeuEmail = async () => {
    const enderecos = comEmail.map(p => p.email!);
    if (enderecos.length === 0) {
      avisar('Ninguém da equipe tem email cadastrado na ficha.');
      return;
    }
    const copiou = await copiar(textoDaOD());
    window.location.href = linkDeEmail({ destinatarios: enderecos, assunto });
    avisar(copiou
      ? 'Abri seu email com a equipe em cópia oculta. A OD está copiada — cole no corpo.'
      : 'Abri seu email com a equipe em cópia oculta. Copie a OD com o botão ao lado.');
  };

  const baixarAgenda = () => {
    const ics = montarIcs(dados);
    if (ics) baixarIcs(ics, nomeDoArquivo);
  };

  const alternar = (id: string) => {
    setMarcados(atual => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  };

  const enviarPeloApp = async () => {
    const para = comEmail.filter(p => marcados.has(p.id)).map(p => p.email!);
    if (para.length === 0) {
      setResultado({ ok: false, texto: 'Escolha pelo menos uma pessoa.' });
      return;
    }

    setEnviando(true);
    setResultado(null);
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
      anexos: ics ? [{ filename: `${nomeDoArquivo}.ics`, conteudo: ics }] : [],
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
          <Send size={15} style={{ color: 'var(--cor-logistica)' }} /> Mandar para a equipe
        </h2>
        {versao > 1 && (
          <span className="text-xs font-bold" style={{ padding: '3px 10px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
            versão {versao}
          </span>
        )}
      </div>

      {/* ---- O caminho de todo dia ---- */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={compartilhar} className="btn-primary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Share2 size={13} /> Compartilhar a OD
        </button>
        <button onClick={copiarOD} className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Copy size={13} /> Copiar
        </button>
        <button onClick={abrirNoMeuEmail} className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Mail size={13} /> Abrir no meu email
        </button>
      </div>

      <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
        Compartilhar abre o WhatsApp, o Telegram ou o email do seu aparelho, com a
        OD e o arquivo de agenda junto. No computador, ele copia a OD para você
        colar. O email sai da sua conta — a equipe já vai em cópia oculta.
      </div>

      <AnimatePresence>
        {avulso && (
          <motion.div
            initial={reduzido ? undefined : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={MOLA}
            className="text-xs"
            style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '9px 11px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', lineHeight: 1.5 }}
          >
            <Check size={13} style={{ flexShrink: 0, marginTop: '2px' }} /> {avulso}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quem ficou de fora aparece, em vez de sumir. Sem isto, a produção manda
          a OD achando que mandou para a equipe toda. */}
      {semEmail.length > 0 && (
        <div className="text-xs" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', color: 'var(--color-warning)', lineHeight: 1.5 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>Sem email na ficha, não entram na lista: {semEmail.map(p => p.nome).join(', ')}.</span>
        </div>
      )}

      {/* ---- Agenda ---- */}
      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={baixarAgenda} className="btn-secondary text-xs" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <Download size={13} /> Arquivo de agenda (.ics)
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
      </div>

      {/* ---- O envio pelo app, para quem tiver domínio ---- */}
      {podeEnviar && (
        <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
          <button
            onClick={() => setEmailAberto(a => !a)}
            className="text-xs text-muted"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <ChevronDown size={13} style={{ transform: emailAberto ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform .15s' }} />
            Enviar em nome da produção (precisa de domínio próprio)
          </button>

          <AnimatePresence initial={false}>
            {emailAberto && (
              <motion.div
                initial={reduzido ? undefined : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduzido ? undefined : { height: 0, opacity: 0 }}
                transition={MOLA}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>
                    Aqui o email sai em nome da produção (<i>od@seudominio.com.br</i>), e não
                    da sua conta pessoal. Para isso é preciso um domínio próprio com os
                    registros de DNS certos — sem eles o Gmail joga em spam, e não há como
                    contornar: é regra de quem recebe. O passo a passo está em{' '}
                    <code>supabase/functions/enviar-od/LEIA.md</code>.
                  </div>

                  {comEmail.length === 0 ? (
                    <div className="text-sm text-muted" style={{ lineHeight: 1.6 }}>
                      Ninguém da equipe escalada tem email cadastrado. O email fica na
                      ficha de cada pessoa, em Equipe.
                    </div>
                  ) : (
                    <>
                      <div className="text-xs text-muted uppercase tracking-widest">
                        Para quem vai ({marcados.size} de {comEmail.length})
                      </div>
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
                    </>
                  )}

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={enviarPeloApp}
                      className="btn-secondary text-xs"
                      disabled={enviando || comEmail.length === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
                    >
                      <Send size={13} /> {enviando ? 'Enviando…' : 'Enviar pelo app'}
                    </button>

                    {resultado && (
                      <motion.span
                        initial={reduzido ? undefined : { opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-xs font-bold"
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: resultado.ok ? 'var(--color-success)' : 'var(--color-danger)', lineHeight: 1.5 }}
                      >
                        {resultado.ok ? <Check size={13} /> : <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />}
                        {resultado.texto}
                      </motion.span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
