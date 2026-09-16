import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Sun, MessageSquare, Layers } from 'lucide-react';
import { db } from '../../db/db';
import type { EstadoDaLogagem } from '../../types';
import { CampoTexto } from '../ui/CampoTexto';
import { Campo, Escolha, Rotulo, Segmentado, estiloCampo } from './pecas';
import { garantirEstado, idDoEstado, mudarEstado, PADRAO } from '../../lib/logagem/estado';
import { digitarNaClaquete, passoNaClaquete, trocarModoDoPlano } from '../../lib/logagem/claquete';
import { OPCOES } from '../../lib/logagem/opcoes';
import { ListaDeTakes, useRegistroDeTake } from './RegistroDeTake';
import { PainelDoTake } from './PainelDoTake';
import { ODiaNaLogagem } from './ODiaNaLogagem';
import { FotoDeReferencia } from './FotoDeReferencia';
import { PlanosDaDecupagem } from './PlanosDaDecupagem';
import { ExportarRelatorios } from './ExportarRelatorios';
import { Acompanhamento } from './Acompanhamento';
import { NotasRapidas } from './NotasRapidas';
import { acrescentarNota } from '../../lib/logagem/notas';
import {
  NOME_DA_DENSIDADE, densidadeInicial, densidadesPossiveis, lembrarDensidade, lerDensidadeLembrada,
  type Densidade,
} from '../../lib/logagem/densidade';
import type { VisaoDeQuemVe } from '../../lib/logagem/permissao';

/**
 * Aba Logagem: a claquete do momento.
 *
 * Primeiro pedaço (15/09/2026): cena, plano e take com a cascata, o modo do
 * plano, o contexto do take (ambiente, luz, áudio, ND) e a observação. Segundo
 * pedaço (15/09/2026): o registro do take, em `RegistroDeTake.tsx`.
 *
 * A ORDEM DA TELA É A ORDEM DO SET: monta a claquete, diz como está a cena,
 * anota o que precisar, e só então aperta o status. A observação vem ANTES dos
 * botões porque ela é do take que está sendo registrado, e some com ele.
 *
 * A claquete vem gigante porque esta tela é lida de longe, com o aparelho na
 * mão e o set andando. Quem está logando não vai procurar um número de 14px no
 * meio de um formulário entre um "ação" e um "corta".
 */
export function AbaLogagem({ projetoId, diariaId, podeEditar, departamentoId, visaoDeQuemVe = 'acompanhamento', quem }: {
  projetoId: string;
  diariaId: string;
  podeEditar: boolean;
  departamentoId?: string;
  /** Em que visão quem SÓ VÊ abre — a continuísta vê tudo, o resto acompanha. */
  visaoDeQuemVe?: VisaoDeQuemVe;
  /** Quem registra: a ficha da pessoa na produção, ou a conta quando não há ficha. */
  quem?: string;
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

  /*
    A visão abre pelo aparelho e pelo papel, e depois obedece a pessoa.

    `window.matchMedia` e não um hook de largura porque isto se decide UMA vez,
    na abertura: trocar de visão sozinho porque alguém girou o celular seria a
    tela mudando de forma no meio do take.
  */
  const [densidade, setDensidade] = useState<Densidade>(() =>
    densidadeInicial({
      podeEditar,
      visaoDeQuemVe,
      ehCelular: typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
      lembrada: lerDensidadeLembrada(),
    })
  );
  const trocarDensidade = (nova: Densidade) => { setDensidade(nova); lembrarDensidade(nova); };

  // Antes de qualquer retorno, porque é hook. No Acompanhamento não há botões,
  // então o Espaço também não registra nada ali.
  const registro = useRegistroDeTake(estado, podeEditar && densidade !== 'acompanhamento', quem);

  /*
    Enter leva o cursor à observação (§6.4). Mesmas regras do Espaço: não vale
    quando alguém já está digitando ou com um botão em foco — ali o Enter é do
    campo, ou é o clique do botão.
  */
  useEffect(() => {
    if (!podeEditar || densidade === 'acompanhamento') return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(alvo.tagName))) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const campo = document.querySelector<HTMLTextAreaElement>('[data-logagem-obs] textarea');
      if (!campo || campo.disabled) return;
      e.preventDefault();
      campo.focus();
      campo.setSelectionRange(campo.value.length, campo.value.length);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [podeEditar, densidade]);

  const seletorDeVisao = (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 16px' }}>
      <span className="text-xs font-bold uppercase tracking-widest text-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={14} style={{ color: 'var(--cor-criativo)' }} />
        Visão
      </span>
      <div style={{ flex: '1 1 260px', minWidth: 0 }}>
        <Segmentado
          nome="logagem-densidade"
          opcoes={densidadesPossiveis(podeEditar).map(d => ({ id: d, nome: NOME_DA_DENSIDADE[d] }))}
          valor={densidade}
          bloqueado={false}
          aoMudar={v => trocarDensidade(v as Densidade)}
        />
      </div>
    </div>
  );

  if (densidade === 'acompanhamento') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ODiaNaLogagem estado={estado} bloqueado aoEscolher={() => {}} />
        <Acompanhamento estado={estado} />
        <ExportarRelatorios projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} quem={quem} />
        {seletorDeVisao}
      </div>
    );
  }

  const detalhada = densidade === 'detalhada';

  /*
    A pílula lê a observação do BANCO, como os steppers. Tocar nela tira o foco
    do campo, e sair do campo grava o que foi digitado; a leitura, pedida depois
    disso, já encontra o texto novo.
  */
  const acrescentar = (nota: string) => {
    if (!podeEditar) return;
    void (async () => {
      const atual = (await db.log_estado.get(idDoEstado(diariaId))) ?? estado;
      await mudarEstado(diariaId, { obs: acrescentarNota(atual.obs || '', nota) });
    })();
  };

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
      await mudarEstado(diariaId, { ...passoNaClaquete(atual, campo, direcao), ...soltarDaDecupagem(campo) });
    })();
  };

  /*
    Mexer à mão na cena ou no plano desfaz o vínculo com a decupagem: a
    claquete deixou de ser aquele plano, e o take não pode sair dizendo que
    foi. Mudar só o take mantém o vínculo — é o mesmo plano, rodado de novo.
  */
  const soltarDaDecupagem = (campo: 'cena' | 'plano' | 'take'): Partial<EstadoDaLogagem> =>
    campo === 'take' ? {} : { cena_id: '', plano_id: '' };

  const aoDigitar = (campo: 'cena' | 'plano' | 'take', v: string) =>
    mudar({ ...digitarNaClaquete(estado, campo, v), ...soltarDaDecupagem(campo) });

  /*
    A ORDEM DA TELA é a do pedido de quem opera câmera (16/09/2026):

    1. o dia — o que vem a seguir, as pausas, o próximo plano;
    2. o painel do take — cena, plano, take, o arquivo e os quatro botões,
       juntos e na mesma arrumação em qualquer tela;
    3. a observação e a foto, que são do take que vem;
    4. o resto: a decupagem inteira, o contexto da cena, a lista, os relatórios.
  */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <ODiaNaLogagem estado={estado} bloqueado={bloqueado} aoEscolher={mudar} compacto={!detalhada} />

      <PainelDoTake
        estado={estado}
        registro={registro}
        podeEditar={podeEditar}
        aoPassar={passo}
        aoDigitar={aoDigitar}
        mostrarAtalhos={detalhada}
      />

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 22px)' }}>
        <Rotulo icone={<MessageSquare size={14} />}>Observação deste take</Rotulo>
        <div data-logagem-obs>
          <CampoTexto
            value={estado.obs || ''}
            aoGravar={v => mudar({ obs: v })}
            disabled={bloqueado}
            linhas={2}
            placeholder="passou avião, o bom é o fim, foco perdido no meio…"
            style={estiloCampo}
          />
        </div>
        <NotasRapidas bloqueado={bloqueado} aoTocar={acrescentar} />
        <p className="text-xs text-muted" style={{ margin: 0 }}>
          É do take que vem, e se apaga quando ele for registrado.
        </p>
      </section>

      <FotoDeReferencia estado={estado} podeEditar={podeEditar} />

      <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 'clamp(14px, 3vw, 22px)' }}>
        <PlanosDaDecupagem estado={estado} bloqueado={bloqueado} aoEscolher={mudar} />
        {detalhada ? (
          <ContextoDaCena estado={estado} bloqueado={bloqueado} mudar={mudar} />
        ) : (
          /*
            No Foco o contexto vira uma linha do que está valendo, para conferir
            sem rolar. Mexer nele é raro no meio do take — o próprio resumo é o
            botão que leva para a Detalhada.
          */
          <button
            type="button"
            onClick={() => trocarDensidade('detalhada')}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
              padding: '0 4px', minHeight: '44px', textAlign: 'left', width: '100%',
              border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            <Sun size={14} style={{ color: 'var(--cor-criativo)', flexShrink: 0 }} />
            <span className="text-sm">
              {[estado.ambiente, estado.luz, estado.audio, estado.nd].filter(Boolean).join(' · ') || 'Ambiente, luz, áudio e ND'}
            </span>
            <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>mudar na Detalhada</span>
          </button>
        )}
      </section>

      <ListaDeTakes takes={registro.takes} ultimo={registro.ultimo} podeEditar={podeEditar} limite={detalhada ? undefined : 3} />

      {/* No Foco, o set não exporta nada: o relatório é trabalho do fim do dia. */}
      {detalhada && <ExportarRelatorios projetoId={projetoId} diariaId={diariaId} podeEditar={podeEditar} departamentoId={departamentoId} quem={quem} />}

      {seletorDeVisao}
    </div>
  );
}

/**
 * O contexto da cena (Detalhada): ambiente, luz, áudio, ND, e como a claquete
 * conta os planos. Vai junto em cada take e vale até alguém mudar.
 */
function ContextoDaCena({ estado, bloqueado, mudar }: {
  estado: EstadoDaLogagem;
  bloqueado: boolean;
  mudar: (m: Partial<EstadoDaLogagem>) => void;
}) {
  const letras = estado.plano_letras !== false;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
      <Rotulo icone={<Sun size={14} />}>Como está a cena</Rotulo>
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
      {/*
        A cascata é a convenção do set, e ela surpreende quem nunca viu: mexer
        na cena zera plano e take sozinho. Dizer isso aqui evita o "por que ele
        apagou meu take?".
      */}
      <p className="text-xs text-muted" style={{ margin: '-6px 0 0' }}>
        Trocar a cena devolve o plano para {letras ? 'A' : '1'} e o take para 1; trocar o plano devolve só o take.
        {letras && ' O alfabeto da claquete pula I, O, Q, S e Z, que à mão viram 1, 0, 2, 5 e 2. Depois de Y vem AA.'}
      </p>
    </div>
  );
}
