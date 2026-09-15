import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus, Clapperboard, Sun, MessageSquare } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { CampoTexto } from '../ui/CampoTexto';
import { BotaoContador, Campo, Escolha, Rotulo, Segmentado, ValorQueTroca, estiloCampo } from './pecas';
import { garantirEstado, idDoEstado, mudarEstado, PADRAO } from '../../lib/logagem/estado';
import { digitarNaClaquete, passoNaClaquete, trocarModoDoPlano } from '../../lib/logagem/claquete';
import { OPCOES } from '../../lib/logagem/opcoes';
import { nomeArquivoPrevisto } from '../../lib/logagem/nomenclatura';

/**
 * Aba Logagem: a claquete do momento.
 *
 * Primeiro pedaço (15/09/2026): cena, plano e take com a cascata, o modo do
 * plano, o contexto do take (ambiente, luz, áudio, ND) e a observação. O
 * REGISTRO do take — os botões de status, a lista e o anti-duplicado — é o
 * pedaço seguinte.
 *
 * A claquete vem gigante porque esta tela é lida de longe, com o aparelho na
 * mão e o set andando. Quem está logando não vai procurar um número de 14px no
 * meio de um formulário entre um "ação" e um "corta".
 */
export function AbaLogagem({ projetoId, diariaId, podeEditar, departamentoId }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
}) {
  const estadoSalvo = useLiveQuery(() => db.log_estado.get(idDoEstado(diariaId)), [diariaId]);

  useEffect(() => {
    if (podeEditar && estadoSalvo === undefined) {
      void garantirEstado(projetoId, diariaId, departamentoId);
    }
  }, [podeEditar, estadoSalvo, projetoId, diariaId, departamentoId]);

  const estado: EstadoDaLogagem = estadoSalvo ?? { ...PADRAO, id: idDoEstado(diariaId), projeto_id: projetoId, diaria_id: diariaId };
  const mudar = (m: Partial<EstadoDaLogagem>) => { if (podeEditar) void mudarEstado(diariaId, m); };
  const bloqueado = !podeEditar;
  const letras = estado.plano_letras !== false;

  /*
    O − e o + leem do BANCO, e não do que está na tela.

    O campo de texto do app grava depois de uma pausa (`CampoTexto`, que existe
    para não empurrar o cursor nem cancelar acentos). Quem digita "12" na cena e
    aperta o + em seguida tem, na tela renderizada, a cena ainda antiga — somar
    em cima dela daria 2, e não 13. Ler o estado salvo no momento do clique faz
    o botão andar a partir do que a pessoa acabou de escrever.
  */
  const passo = (campo: 'cena' | 'plano' | 'take', direcao: 1 | -1) => {
    if (!podeEditar) return;
    void (async () => {
      const atual = (await db.log_estado.get(idDoEstado(diariaId))) ?? estado;
      await mudarEstado(diariaId, passoNaClaquete(atual, campo, direcao));
    })();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <Rotulo icone={<Clapperboard size={14} />}>Claquete</Rotulo>
          {/* O arquivo previsto mora na aba Câmera, mas aparece aqui de leve:
              é o que vai junto com este take, e conferir não pode custar uma
              troca de aba. */}
          <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
            próximo arquivo · {nomeArquivoPrevisto(estado)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(190px, 100%), 1fr))', gap: '12px' }}>
          <Contador
            rotulo="Cena"
            valor={String(estado.cena)}
            bloqueado={bloqueado}
            aoPassar={d => passo('cena', d)}
            aoDigitar={v => mudar(digitarNaClaquete(estado, 'cena', v))}
          />
          <Contador
            rotulo="Plano"
            valor={String(estado.plano)}
            bloqueado={bloqueado}
            maiuscula={letras}
            aoPassar={d => passo('plano', d)}
            aoDigitar={v => mudar(digitarNaClaquete(estado, 'plano', v))}
          />
          <Contador
            rotulo="Take"
            valor={String(estado.take)}
            bloqueado={bloqueado}
            destaque
            aoPassar={d => passo('take', d)}
            aoDigitar={v => mudar(digitarNaClaquete(estado, 'take', v))}
          />
        </div>

        {/*
          A cascata é a convenção do set, e ela surpreende quem nunca viu: mexer
          na cena zera plano e take sozinho. Dizer isso aqui, uma linha, evita o
          "por que ele apagou meu take?".
        */}
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          Trocar a cena devolve o plano para {letras ? 'A' : '1'} e o take para 1. Trocar o plano devolve só o take.
        </p>

        <Campo rotulo="Planos em">
          <Segmentado
            nome="logagem-modo-plano"
            opcoes={[{ id: 'letras', nome: 'Letras (A, B, C…)' }, { id: 'numeros', nome: 'Números' }]}
            valor={letras ? 'letras' : 'numeros'}
            bloqueado={bloqueado}
            aoMudar={v => {
              const paraLetras = v === 'letras';
              mudar({ plano_letras: paraLetras, plano: trocarModoDoPlano(estado.plano, paraLetras) });
            }}
          />
        </Campo>
        <p className="text-xs text-muted" style={{ marginTop: '-8px' }}>
          O alfabeto de claquete pula I, O, Q, S e Z, que à mão viram 1, 0, 2, 5 e 2. Depois de Y vem AA.
        </p>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '22px' }}>
        <Rotulo icone={<Sun size={14} />}>Como está a cena</Rotulo>
        <p className="text-xs text-muted" style={{ marginTop: '-10px' }}>
          Vai junto em cada take, e continua valendo até alguém mudar.
        </p>
        <Campo rotulo="Ambiente">
          <Escolha nome="logagem-ambiente" opcoes={OPCOES.ambiente} valor={estado.ambiente} bloqueado={bloqueado} aoMudar={v => mudar({ ambiente: v })} />
        </Campo>
        <Campo rotulo="Luz">
          <Escolha nome="logagem-luz" opcoes={OPCOES.luz} valor={estado.luz} bloqueado={bloqueado} aoMudar={v => mudar({ luz: v })} />
        </Campo>
        <Campo rotulo="Áudio">
          <Escolha nome="logagem-audio" opcoes={OPCOES.audio} valor={estado.audio} bloqueado={bloqueado} aoMudar={v => mudar({ audio: v })} />
        </Campo>
        <Campo rotulo="ND">
          <Escolha nome="logagem-nd" opcoes={OPCOES.nd} valor={estado.nd} bloqueado={bloqueado} aoMudar={v => mudar({ nd: v })} />
        </Campo>
      </section>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '22px' }}>
        <Rotulo icone={<MessageSquare size={14} />}>Observação deste take</Rotulo>
        <CampoTexto
          value={estado.obs || ''}
          aoGravar={v => mudar({ obs: v })}
          disabled={bloqueado}
          linhas={3}
          placeholder="passou avião, o bom é o fim, foco perdido no meio…"
          style={estiloCampo}
        />
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          A observação é do take que vem, e se apaga quando ele for registrado.
        </p>
      </section>

      {podeEditar && (
        <p className="text-sm text-secondary">
          Os botões de <strong>OK, NG, HERO e REC invertido</strong>, a lista de takes e o aviso de claquete
          repetida chegam no próximo pedaço. Até lá, a claquete já fica guardada e sincronizada.
        </p>
      )}
    </div>
  );
}

/**
 * Um número grande de claquete, com − e + e o campo para digitar.
 *
 * O valor é o que a pessoa lê de longe; os botões são o que ela aperta sem
 * olhar. O campo existe para o pulo — cena 47 não se alcança no +.
 */
function Contador({ rotulo, valor, bloqueado, destaque, maiuscula, aoPassar, aoDigitar }: {
  rotulo: string;
  valor: string;
  bloqueado: boolean;
  destaque?: boolean;
  maiuscula?: boolean;
  aoPassar: (direcao: 1 | -1) => void;
  aoDigitar: (valor: string) => void;
}) {
  return (
    <div role="group" aria-label={rotulo} style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
      <span className="text-xs font-bold uppercase tracking-widest text-secondary">{rotulo}</span>

      <ValorQueTroca
        texto={valor || '—'}
        rotuloDeLeitura={rotulo}
        tamanho="clamp(38px, 11vw, 56px)"
        cor={destaque ? 'var(--cor-criativo)' : undefined}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <BotaoContador rotulo={`${rotulo} anterior`} disabled={bloqueado} onClick={() => aoPassar(-1)}>
          <Minus size={18} />
        </BotaoContador>
        <CampoTexto
          value={valor}
          aoGravar={aoDigitar}
          disabled={bloqueado}
          title={rotulo}
          style={{ ...estiloCampo, flex: 1, minWidth: 0, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textTransform: maiuscula ? 'uppercase' : 'none' }}
        />
        <BotaoContador rotulo={`Próximo ${rotulo.toLowerCase()}`} disabled={bloqueado} onClick={() => aoPassar(1)}>
          <Plus size={18} />
        </BotaoContador>
      </div>
    </div>
  );
}
