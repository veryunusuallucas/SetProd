import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Link2, Copy, Check, Trash2, Users, ShieldAlert, UserCheck, Package, Plus, ToggleLeft, ToggleRight, UserMinus } from 'lucide-react';
import { db } from '../db/db';
import {
  criarConvite, convitesDoProjeto, revogarConvite, linkDoConvite,
  membrosDoProjeto, definirMeuPerfil, sincronizarParticipacoes, participacaoLocal, ligarConvite,
  type Convite, type Participacao, type PapelMembro,
} from '../lib/membros';
import { supabaseConfigurado } from '../lib/supabase';
import { pode, DESCRICAO, PAPEIS_CONVIDAVEIS, type PapelConvidavel } from '../lib/permissoes';
import {
  meusAcervos, acervosDaProducao, vincularAcervo, desvincularAcervo,
  type AcervoDisponivel,
} from '../lib/acervoVinculado';
import { listarMembros, mudarPapel, removerMembro, type MembroDetalhado } from '../lib/painelMembros';
import { MOLA } from './ui/ia';

interface Props {
  projetoId: string;
  nomeProjeto: string;
  aoFechar: () => void;
}

/**
 * Compartilhar a produção com outra equipe.
 *
 * O modelo é o da spec: A e B são dois membros do MESMO projeto, no mesmo
 * nível — não existe "cópia da A" e "cópia da B". Por isso a tela fala de
 * "quem tem acesso", e não de enviar nada para alguém.
 */
export function CompartilharModal({ projetoId, nomeProjeto, aoFechar }: Props) {
  const [membros, setMembros] = useState<Participacao[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [copiado, setCopiado] = useState('');
  const [gerando, setGerando] = useState(false);
  /** Que papel o próximo link vai conceder. 'equipe' é o caso comum. */
  const [papelDoConvite, setPapelDoConvite] = useState<PapelConvidavel>('equipe');
  /** Se o próximo link aceita várias pessoas. Uso único é o padrão, e é o seguro. */
  const [multiuso, setMultiuso] = useState(false);

  const alternarLink = async (c: Convite) => {
    try {
      await ligarConvite(c.token, c.ativo === false);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui mudar o link.');
    }
  };

  const perfis = useLiveQuery(
    () => db.perfis.where('projeto_id').equals(projetoId).toArray(),
    [projetoId]
  ) || [];

  const minhaParticipacao = participacaoLocal(projetoId);
  const podeConvidar = pode(minhaParticipacao?.papel ?? 'desconhecido', 'convidar');

  /*
    Vincular um acervo segue a régua de CONVIDAR, não a de editar.

    É conceder acesso a dado da produção — mesmo que seja pouco dado. Quem pode
    editar uma despesa não deveria poder decidir sozinho que outro app passa a
    receber o calendário de filmagem.
  */
  const podeGerirAcervo = pode(minhaParticipacao?.papel ?? 'desconhecido', 'gerir_membros');

  /**
   * O e-mail e o nome de cada conta.
   *
   * Vem da Edge Function porque a RLS de `auth.users` não deixa o app ler o
   * e-mail de ninguém além de si. Fica separado de `membros` de propósito: se a
   * função não estiver publicada, a lista continua aparecendo — só sem o e-mail.
   */
  const [detalhes, setDetalhes] = useState<MembroDetalhado[]>([]);
  const [mexendo, setMexendo] = useState<string | null>(null);

  const trocarPapel = async (m: Participacao, papel: PapelMembro) => {
    if (papel === m.papel) return;
    setMexendo(m.usuario_id);
    try {
      await mudarPapel(projetoId, m.usuario_id, papel);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui mudar o papel.');
    } finally {
      setMexendo(null);
    }
  };

  const expulsar = async (m: Participacao, email?: string | null) => {
    /*
      O aviso diz a verdade inteira, inclusive a parte incômoda.

      Remover corta o acesso ao servidor, mas NÃO apaga a cópia que já está no
      IndexedDB do aparelho da pessoa. É a natureza do offline-first, e quem
      clica precisa saber disso antes — descobrir depois é pior.
    */
    const quem = email || m.apelido || 'esta pessoa';
    const seguir = confirm(
      `Remover ${quem} desta produção?\n\n` +
      'Ela perde o acesso agora. Mas o que já baixou continua no aparelho dela — ' +
      'é assim que um app que funciona offline funciona.\n\n' +
      'Para voltar, vai precisar de um convite novo.'
    );
    if (!seguir) return;

    setMexendo(m.usuario_id);
    try {
      await removerMembro(projetoId, m.usuario_id);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui remover.');
    } finally {
      setMexendo(null);
    }
  };

  const [acervos, setAcervos] = useState<AcervoDisponivel[]>([]);
  const [vinculados, setVinculados] = useState<AcervoDisponivel[]>([]);
  const [ligando, setLigando] = useState<string | null>(null);

  const recarregarAcervos = async () => {
    const [todos, ligados] = await Promise.all([
      meusAcervos().catch(() => []),
      acervosDaProducao(projetoId).catch(() => []),
    ]);
    setAcervos(todos);
    setVinculados(ligados);
  };

  const jaLigados = new Set(vinculados.map(a => a.id));
  const naoVinculados = acervos.filter(a => !jaLigados.has(a.id));

  const ligarAcervo = async (a: AcervoDisponivel) => {
    setLigando(a.id);
    try {
      await vincularAcervo(projetoId, a.id);
      await recarregarAcervos();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui vincular o acervo.');
    } finally {
      setLigando(null);
    }
  };

  const soltarAcervo = async (a: AcervoDisponivel) => {
    // O aviso não é formalidade: o SetGear tem cópia local e funciona offline.
    // Desvincular corta o acesso dali para frente, não apaga o que já desceu —
    // exatamente como remover um membro da produção.
    const seguir = confirm(
      `Desvincular "${a.nome}" desta produção?\n\n` +
      'O SetGear para de receber as diárias a partir de agora. O que ele já baixou ' +
      'continua no aparelho de quem o usa — é assim que um app offline funciona.'
    );
    if (!seguir) return;

    try {
      await desvincularAcervo(projetoId, a.id);
      await recarregarAcervos();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui desvincular.');
    }
  };

  const recarregar = async () => {
    try {
      setErro('');
      const [m, c] = await Promise.all([membrosDoProjeto(projetoId), convitesDoProjeto(projetoId)]);
      setMembros(m);
      /*
        Some da lista o que não serve mais para nada: convite de uso único que
        já foi gasto. O multiuso FICA mesmo depois de usado — ele continua vivo,
        e é justamente a lista que dá o botão para desligá-lo.
      */
      setConvites(c.filter(x => x.multiuso || !x.usado_por));

      // Em separado e sem derrubar nada: se a função `membros` não estiver
      // publicada, a lista aparece do mesmo jeito, só sem os e-mails.
      listarMembros(projetoId)
        .then(setDetalhes)
        .catch(e => console.warn('[SetProd] Sem os e-mails dos membros:', e?.message));
    } catch (e: any) {
      setErro(e?.message || 'Não consegui ler quem tem acesso.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    sincronizarParticipacoes().then(recarregar);
    // Em paralelo, e nunca bloqueando: se o SQL do SetGear não estiver rodado
    // neste Supabase, a consulta falha — e falhar ali não pode impedir a tela de
    // compartilhar de abrir.
    void recarregarAcervos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetoId]);

  const gerarLink = async () => {
    setGerando(true);
    try {
      setErro('');
      // Sem apelido: a Edge Function preenche com o nome de quem realmente
      // aceitar. Chutar um rótulo aqui, sem saber quem vai abrir o link, é como
      // se chegou no "Equipe C", "Equipe D".
      const convite = await criarConvite(projetoId, nomeProjeto, papelDoConvite, undefined, undefined, multiuso);
      await navigator.clipboard.writeText(linkDoConvite(convite.token)).catch(() => {});
      setCopiado(convite.token);
      setTimeout(() => setCopiado(''), 2500);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui criar o convite.');
    } finally {
      setGerando(false);
    }
  };

  const copiar = async (token: string) => {
    await navigator.clipboard.writeText(linkDoConvite(token));
    setCopiado(token);
    setTimeout(() => setCopiado(''), 2500);
  };

  const derrubar = async (token: string) => {
    try {
      await revogarConvite(token);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui revogar.');
    }
  };

  const trocarPerfil = async (perfilId: string) => {
    try {
      await definirMeuPerfil(projetoId, perfilId || null);
      await recarregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar quem você é na equipe.');
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
        backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      }}
      onClick={aoFechar}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={MOLA}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', maxHeight: '86vh', overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)', borderRadius: '16px',
          border: '1px solid var(--border-color)', padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <h2 className="text-xl font-bold" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} /> Quem tem acesso
            </h2>
            <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
              Todo mundo aqui trabalha na <strong>mesma</strong> produção — não são cópias.
              O que uma equipe muda, a outra vê.
            </p>
          </div>
          <button className="btn-icon" onClick={aoFechar} aria-label="Fechar"><X size={20} /></button>
        </div>

        {!supabaseConfigurado && (
          <div style={avisoEstilo}>
            <ShieldAlert size={16} /> Sem conexão com o servidor configurada — compartilhar precisa dela.
          </div>
        )}

        {erro && <div style={{ ...avisoEstilo, color: 'var(--color-danger)' }}><ShieldAlert size={16} /> {erro}</div>}

        {/* ---- quem eu sou na equipe ---- */}
        {minhaParticipacao && (
          <section style={{ marginBottom: '24px' }}>
            <h3 style={tituloSecao}><UserCheck size={14} /> Eu, nesta produção</h3>
            <select
              value={minhaParticipacao.perfil_id || ''}
              onChange={e => trocarPerfil(e.target.value)}
              style={campoEstilo}
            >
              <option value="">— não sou da equipe cadastrada —</option>
              {perfis.filter(p => p.id !== 'caixa_central').map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome} {p.sobrenome || ''} {p.funcao ? `(${p.funcao})` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted" style={{ marginTop: '6px' }}>
              É o que faz “Minhas Tasks” saber o que é seu. Fica salvo na sua conta,
              então vale em qualquer aparelho.
            </p>
          </section>
        )}

        {/* ---- membros ---- */}
        <section style={{ marginBottom: '24px' }}>
          <h3 style={tituloSecao}><Users size={14} /> Quem participa</h3>
          {carregando ? (
            <p className="text-sm text-muted">Consultando…</p>
          ) : membros.length === 0 ? (
            <p className="text-sm text-muted">
              Ninguém ainda — nem você. Este projeto existe só neste navegador.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {membros.map(m => {
                /*
                  O e-mail e o nome da conta vêm da Edge Function — a RLS de
                  `auth.users` não deixa o app ler o e-mail de mais ninguém além
                  de si mesmo. Sem ela, a lista mostrava uuid.
                */
                const conta = detalhes.find(d => d.usuario_id === m.usuario_id);
                const souEu = m.usuario_id === minhaParticipacao?.usuario_id;
                /*
                  Os dois eixos lado a lado, e nunca misturados:

                    Maira · Direção de Arte    ← quem ela é no filme
                    pode editar                ← o que a conta pode fazer

                  Antes esta linha mostrava "Equipe A"/"Equipe B", que não é
                  nenhum dos dois — era o rótulo da máquina, de quando o app
                  tinha só dois lados.
                */
                const ficha = m.perfil_id ? perfis.find(p => p.id === m.perfil_id) : undefined;
                const nome = ficha
                  ? `${ficha.nome} ${ficha.sobrenome || ''}`.trim()
                  : (m.apelido || 'Sem nome');
                const funcao = ficha?.funcao;

                return (
                  <div key={m.usuario_id} style={{ ...linhaEstilo, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <div className="text-sm font-bold">
                        {nome || conta?.nome || 'Sem nome'}
                        {funcao && <span className="text-muted" style={{ fontWeight: 400 }}> · {funcao}</span>}
                      </div>
                      <div className="text-xs text-muted" style={{ wordBreak: 'break-all' }}>
                        {conta?.email && <>{conta.email} · </>}
                        {m.papel === 'dono' ? 'criou a produção' : (DESCRICAO[m.papel]?.nome ?? m.papel)}
                        {souEu && ' · você'}
                        {!m.perfil_id && ' · ainda não disse quem é na equipe'}
                      </div>
                    </div>

                    {/*
                      O painel só aparece para quem administra, e nunca sobre a
                      própria linha: rebaixar a si mesmo por engano é o jeito
                      mais rápido de ficar de fora da própria produção.
                    */}
                    {podeGerirAcervo && !souEu && (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                        <select
                          value={m.papel}
                          onChange={e => trocarPapel(m, e.target.value as PapelMembro)}
                          disabled={mexendo === m.usuario_id}
                          style={{ ...campoEstilo, width: 'auto', padding: '6px 8px', fontSize: '12px' }}
                        >
                          {/* `dono` na lista só quando a pessoa JÁ é: passar posse
                              é ação própria, com confirmação, e não um dropdown. */}
                          {m.papel === 'dono' && <option value="dono">Dono</option>}
                          {PAPEIS_CONVIDAVEIS.map(p => (
                            <option key={p} value={p}>{DESCRICAO[p].nome}</option>
                          ))}
                        </select>

                        <button
                          className="btn-icon"
                          title="Remover desta produção"
                          onClick={() => expulsar(m, conta?.email)}
                          disabled={mexendo === m.usuario_id}
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- convites ---- */}
        <section>
          <h3 style={tituloSecao}><Link2 size={14} /> Convidar alguém</h3>

          <AnimatePresence>
            {convites.map(c => (
              <motion.div
                key={c.token}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={MOLA}
                style={{ ...linhaEstilo, marginBottom: '8px' }}
              >
                <div style={{ flex: 1, minWidth: 0, opacity: c.ativo === false ? 0.55 : 1 }}>
                  <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {c.apelido || 'Convite em aberto'}
                    {c.multiuso && (
                      <span className="text-xs" style={{ padding: '1px 7px', borderRadius: '20px', fontWeight: 700, color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                        vários
                      </span>
                    )}
                    {c.ativo === false && (
                      <span className="text-xs" style={{ padding: '1px 7px', borderRadius: '20px', fontWeight: 700, color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                        desligado
                      </span>
                    )}
                  </div>
                  {/* O papel na lista, e não só na hora de criar: um link
                      pendente de dias atrás não diz mais o que vai conceder.
                      A contagem é o que decide quando desligar. */}
                  <div className="text-xs text-muted">
                    entra como <strong>{DESCRICAO[c.papel]?.nome ?? c.papel}</strong>
                    {' · '}vale até {new Date(c.expira_em).toLocaleDateString('pt-BR')}
                    {c.multiuso && ` · ${c.usos || 0} ${(c.usos || 0) === 1 ? 'pessoa entrou' : 'pessoas entraram'}`}
                  </div>
                </div>

                {/* O interruptor só existe no multiuso: num link de uso único
                    ele não teria o que fazer — o link já morre sozinho. */}
                {c.multiuso && podeConvidar && (
                  <button
                    className="btn-icon"
                    onClick={() => alternarLink(c)}
                    title={c.ativo === false ? 'Religar este link' : 'Desligar este link'}
                  >
                    {c.ativo === false ? <ToggleLeft size={18} /> : <ToggleRight size={18} color="var(--accent)" />}
                  </button>
                )}

                <button className="btn-icon" onClick={() => copiar(c.token)} title="Copiar link">
                  {copiado === c.token ? <Check size={16} color="var(--color-success, #4ade80)" /> : <Copy size={16} />}
                </button>
                <button className="btn-icon" onClick={() => derrubar(c.token)} title="Apagar de vez">
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* O papel se escolhe ANTES de gerar, porque o link já nasce com ele
              dentro — não dá para mudar depois sem revogar e criar outro. */}
          <label className="text-xs text-muted" style={{ display: 'block', marginTop: convites.length ? '12px' : 0, marginBottom: '6px' }}>
            Quem entrar por este link vai poder:
          </label>
          <select
            value={papelDoConvite}
            onChange={e => setPapelDoConvite(e.target.value as PapelConvidavel)}
            style={campoEstilo}
            disabled={!podeConvidar}
          >
            {PAPEIS_CONVIDAVEIS.map(p => (
              <option key={p} value={p}>{DESCRICAO[p].nome} — {DESCRICAO[p].resumo}</option>
            ))}
          </select>

          {/*
            Uma vez só × várias pessoas.

            O padrão continua sendo UMA VEZ SÓ, e não é conservadorismo: é o modo
            que limita o estrago de um link encaminhado sem querer. Quem escolhe
            "várias" está trocando isso por mandar uma mensagem só — uma decisão
            legítima, mas que precisa ser feita de propósito.
          */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button
              onClick={() => setMultiuso(false)}
              className="btn"
              style={{ flex: 1, fontSize: '12px', padding: '9px 10px', borderColor: !multiuso ? 'var(--accent)' : 'var(--border-color)' }}
              disabled={!podeConvidar}
            >
              Uma pessoa só
            </button>
            <button
              onClick={() => setMultiuso(true)}
              className="btn"
              style={{ flex: 1, fontSize: '12px', padding: '9px 10px', borderColor: multiuso ? 'var(--accent)' : 'var(--border-color)' }}
              disabled={!podeConvidar}
            >
              Várias pessoas
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={gerarLink}
            disabled={gerando || !supabaseConfigurado || !minhaParticipacao || !podeConvidar}
            style={{ width: '100%', marginTop: '8px' }}
          >
            <Link2 size={16} /> {gerando ? 'Criando…' : 'Criar link de convite'}
          </button>

          {/* Esconder o botão inteiro deixaria a pessoa procurando por ele. Uma
              linha dizendo o porquê custa menos que um chamado de suporte. */}
          {!podeConvidar && (
            <p className="text-xs text-muted" style={{ marginTop: '8px' }}>
              Só quem é dono ou administra a produção pode convidar gente.
            </p>
          )}

          <p className="text-xs text-muted" style={{ marginTop: '8px', lineHeight: 1.4 }}>
            O link vale por 7 dias e serve <strong>uma vez só</strong>. Quem abrir
            precisa entrar com uma conta — e quem tiver o link entra, então mande
            por um canal privado.
          </p>
        </section>

        {/*
          O acervo de equipamento.

          Fica aqui, e não numa tela própria, porque a pergunta é a mesma que a
          desta janela: quem mais participa desta produção. Um acervo é
          exatamente isso — só que em vez de uma pessoa, é o inventário da
          fotografia.

          Some inteira quando não há acervo nenhum na conta: quem não usa o
          SetGear não deveria ganhar uma seção vazia explicando um app que ele
          não tem.
        */}
        {(acervos.length > 0 || vinculados.length > 0) && (
          <section style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
            <h3 style={tituloSecao}><Package size={14} /> Equipamento (SetGear)</h3>

            {vinculados.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                {vinculados.map(a => (
                  <div key={a.id} style={linhaEstilo}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="text-sm font-bold">{a.nome}</div>
                      <div className="text-xs text-muted">recebe as diárias desta produção</div>
                    </div>
                    {podeGerirAcervo && (
                      <button
                        className="btn-icon"
                        title="Desvincular"
                        onClick={() => soltarAcervo(a)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted" style={{ marginBottom: '10px', lineHeight: 1.5 }}>
                Nenhum acervo vinculado. Ao vincular, o SetGear passa a ver o nome
                da produção, as datas das diárias e os veículos — <strong>e nada
                além disso</strong>.
              </p>
            )}

            {podeGerirAcervo && naoVinculados.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {naoVinculados.map(a => (
                  <button
                    key={a.id}
                    className="btn"
                    onClick={() => ligarAcervo(a)}
                    disabled={ligando === a.id}
                    style={{ fontSize: '13px', padding: '8px 12px' }}
                  >
                    <Plus size={14} /> {ligando === a.id ? 'Vinculando…' : a.nome}
                  </button>
                ))}
              </div>
            )}

            {!podeGerirAcervo && (
              <p className="text-xs text-muted">
                Só quem é dono ou administra a produção pode vincular um acervo.
              </p>
            )}

            <p className="text-xs text-muted" style={{ marginTop: '10px', lineHeight: 1.45 }}>
              O caminho de volta é só contagem: “Câmera, 46 de 47 voltaram”. O
              SetProd nunca vê a lista de equipamento.
            </p>
          </section>
        )}
      </motion.div>
    </div>
  );
}

const tituloSecao: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px',
  fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px',
};

const linhaEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 12px', borderRadius: '10px',
  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
};

const campoEstilo: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: '10px',
  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)',
  fontSize: '14px', color: 'var(--text-primary)',
};

const avisoEstilo: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '8px',
  padding: '10px 12px', borderRadius: '10px', marginBottom: '16px',
  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)',
  fontSize: '13px',
};
