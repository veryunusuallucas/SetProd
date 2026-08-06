import { useEffect, useRef, useState } from 'react';
import { Renderer, Program, Mesh, Triangle, Texture } from 'ogl';

/**
 * Título com efeito de vidro: o texto é desenhado num canvas 2D, vira textura,
 * e um shader distorce a leitura dela — ondulação lenta, lente que segue o
 * cursor e uma separação mínima de cores nas bordas, como vidro grosso.
 *
 * Por que desenhar o texto em canvas em vez de usar geometria: assim a fonte é
 * a fonte do sistema, com kerning e acentuação corretos, e trocar a família é
 * mudar uma string — o Vucas ainda vai escolher a definitiva.
 *
 * `tensao` é o que o easter egg move: uma mola integrada aqui dentro persegue o
 * valor pedido, então o acúmulo é contínuo e interrompível — clicar de novo no
 * meio do relaxamento soma, não recomeça.
 */

const VERTEX = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAGMENT = `
precision mediump float;

uniform sampler2D uTexto;
uniform float uTempo;
uniform vec2  uPonteiro;      // -1..1, centro na origem
uniform float uPonteiroPeso;  // 0 quando o cursor está fora
uniform float uForca;
uniform float uEscala;
uniform float uRefracao;
uniform float uTensao;        // 0..1, acumulada pelos cliques
uniform float uRipple;        // 0..1, decai depois de cada clique
uniform vec2  uRippleOrigem;
uniform vec2  uResolucao;

varying vec2 vUv;

float ondas(vec2 p, float t) {
  return sin(p.x * 3.0 + t) * 0.5
       + sin(p.y * 2.4 - t * 0.8) * 0.5
       + sin((p.x + p.y) * 1.9 + t * 0.6) * 0.35;
}

void main() {
  vec2 uv = vUv;
  float aspecto = uResolucao.x / max(uResolucao.y, 1.0);

  // Coordenada centrada e corrigida: sem isto a lente vira elipse em tela larga.
  vec2 centrada = (uv - 0.5) * vec2(aspecto, 1.0);

  float forca = uForca * (1.0 + uTensao * 4.0);
  float t = uTempo;

  // 1) Ondulação de base: quase nada. O texto em repouso tem que estar LIMPO —
  //    é a lente que distorce, não o tempo. Uma onda constante em cima de tudo
  //    faz o título parecer defeito de tela, não vidro.
  vec2 desloc = vec2(
    ondas(centrada * uEscala, t),
    ondas(centrada * uEscala + 4.7, t * 0.9)
  ) * forca * 0.07;

  // 2) Lente do cursor: é ela a protagonista. Forte e concentrada — o que está
  //    debaixo do dedo entorta, o resto do título continua legível.
  vec2 doPonteiro = centrada - uPonteiro * vec2(aspecto, 1.0) * 0.5;
  float dist = length(doPonteiro);
  float lente = exp(-dist * dist * 26.0) * uPonteiroPeso;
  desloc += normalize(doPonteiro + 1e-5) * lente * forca * 9.0;

  // 3) Ripple do clique: anel que sai da origem e se apaga.
  if (uRipple > 0.001) {
    float d = length(centrada - uRippleOrigem * vec2(aspecto, 1.0));
    float anel = sin(d * 18.0 - (1.0 - uRipple) * 14.0);
    float envelope = exp(-d * 2.5) * uRipple;
    desloc += normalize(centrada - uRippleOrigem * vec2(aspecto, 1.0) + 1e-5)
              * anel * envelope * forca * 6.0;
  }

  // Separação de cores PROPORCIONAL à distorção local.
  //
  // Antes era normalize(desloc) * refr — sem crase, que aqui dentro fecharia
  // o template literal do JS. Normalizar joga fora a intensidade,
  // então até um pixel praticamente parado recebia a franja inteira — e a
  // palavra toda ficava colorida, como tela quebrada. Multiplicando pelo
  // próprio deslocamento, onde o texto está limpo não há franja nenhuma.
  float refr = uRefracao * (1.0 + uTensao * 5.0);
  vec2 sep = desloc * refr;

  float r = texture2D(uTexto, uv + desloc + sep).a;
  float g = texture2D(uTexto, uv + desloc).a;
  float b = texture2D(uTexto, uv + desloc - sep).a;

  // A textura é só alfa (texto branco): a cor vem daqui, para o CSS do app
  // continuar mandando no visual.
  vec3 cor = vec3(1.0);
  float alfa = max(max(r, g), b);

  // No pico da tensão o texto quase se desfaz — é o aviso de que algo vai
  // acontecer, sem precisar de contador na tela.
  cor.r *= r / max(alfa, 0.001);
  cor.g *= g / max(alfa, 0.001);
  cor.b *= b / max(alfa, 0.001);

  gl_FragColor = vec4(cor, alfa);
}
`;

export interface WarpTextProps {
  texto: string;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: string;
  /** Altura da fonte em px do container (o canvas acompanha o tamanho real). */
  tamanho?: number;
  forca?: number;
  escala?: number;
  velocidade?: number;
  influenciaPonteiro?: number;
  refracao?: number;
  /** 0..1 — quanto mais alto, mais o vidro distorce. O easter egg mexe aqui. */
  tensao?: number;
  /** Muda de valor a cada clique: dispara um ripple novo. */
  pulso?: number;
  onClick?: (e: React.MouseEvent) => void;
}

export default function WarpText({
  texto,
  fontFamily = "'Archivo Black', 'Arial Black', system-ui, sans-serif",
  fontWeight = 900,
  letterSpacing = '-0.06em',
  tamanho = 96,
  /** Amplitude base. A lente multiplica isto por 9 no ponto do cursor. */
  forca = 0.02,
  escala = 1.7,
  velocidade = 0.55,
  influenciaPonteiro = 1,
  /**
   * Multiplicador da franja sobre o deslocamento local — não é deslocamento em
   * si. Onde o texto não entorta, não há cor separada.
   */
  refracao = 0.5,
  tensao = 0,
  pulso = 0,
  onClick,
}: WarpTextProps) {
  const container = useRef<HTMLDivElement>(null);
  /** Enquanto for falso, quem aparece é o texto comum do fallback. */
  const [webglAtivo, setWebglAtivo] = useState(false);
  const tensaoAlvo = useRef(tensao);
  const pulsoAnterior = useRef(pulso);
  const dispararRipple = useRef<(x: number, y: number) => void>(() => {});

  useEffect(() => { tensaoAlvo.current = tensao; }, [tensao]);

  useEffect(() => {
    if (pulso !== pulsoAnterior.current) {
      pulsoAnterior.current = pulso;
      dispararRipple.current(0, 0);
    }
  }, [pulso]);

  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;

    let renderer: Renderer | null = null;
    try {
      renderer = new Renderer({ alpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
    } catch {
      return; // O texto de fallback (no JSX) continua visível.
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    alvo.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'width:100%;height:100%;display:block';
    setWebglAtivo(true);

    // ---- Textura do texto ----
    const canvasTexto = document.createElement('canvas');
    const ctx = canvasTexto.getContext('2d')!;
    const textura = new Texture(gl, { generateMipmaps: false });

    const desenharTexto = (largura: number, altura: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvasTexto.width = Math.max(1, Math.floor(largura * dpr));
      canvasTexto.height = Math.max(1, Math.floor(altura * dpr));

      ctx.clearRect(0, 0, canvasTexto.width, canvasTexto.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${fontWeight} ${tamanho}px ${fontFamily}`;
      if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = letterSpacing;
      ctx.fillText(texto, largura / 2, altura / 2);
      ctx.restore();

      textura.image = canvasTexto;
      textura.needsUpdate = true;
    };

    const programa = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      transparent: true,
      uniforms: {
        uTexto: { value: textura },
        uTempo: { value: 0 },
        uPonteiro: { value: [0, 0] },
        uPonteiroPeso: { value: 0 },
        uForca: { value: forca },
        uEscala: { value: escala },
        uRefracao: { value: refracao },
        uTensao: { value: 0 },
        uRipple: { value: 0 },
        uRippleOrigem: { value: [0, 0] },
        uResolucao: { value: [1, 1] },
      },
    });

    const malha = new Mesh(gl, { geometry: new Triangle(gl), program: programa });

    const redimensionar = () => {
      const l = alvo.clientWidth || 1;
      const a = alvo.clientHeight || 1;
      renderer!.setSize(l, a);
      programa.uniforms.uResolucao.value = [l, a];
      desenharTexto(l, a);
    };
    redimensionar();

    const observador = new ResizeObserver(redimensionar);
    observador.observe(alvo);

    // A fonte pode chegar depois do primeiro desenho; sem isto o título fica
    // com a fonte de fallback até o próximo resize.
    document.fonts?.ready.then(redimensionar).catch(() => {});

    // ---- Ponteiro ----
    const ponteiroAlvo = { x: 0, y: 0, peso: 0 };
    const aoMover = (e: PointerEvent) => {
      const r = alvo.getBoundingClientRect();
      ponteiroAlvo.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ponteiroAlvo.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
      ponteiroAlvo.peso = influenciaPonteiro;
    };
    const aoSair = () => { ponteiroAlvo.peso = 0; };
    alvo.addEventListener('pointermove', aoMover);
    alvo.addEventListener('pointerleave', aoSair);

    // ---- Ripple ----
    let ripple = 0;
    dispararRipple.current = (x, y) => {
      ripple = 1;
      programa.uniforms.uRippleOrigem.value = [x, y];
    };

    // ---- Laço ----
    // Mola crítica (ζ ≈ 1) perseguindo a tensão pedida: o valor nunca salta,
    // e um clique no meio do relaxamento soma em vez de recomeçar.
    let tensaoAtual = 0;
    let velocidadeTensao = 0;
    const RIGIDEZ = 120;
    const AMORTECIMENTO = 2 * Math.sqrt(RIGIDEZ);

    const ponteiro = { x: 0, y: 0, peso: 0 };
    let quadro = 0;
    let rodando = true;
    let anterior = performance.now();
    const inicio = anterior;

    const desenhar = () => {
      if (!rodando) return;
      quadro = requestAnimationFrame(desenhar);

      const agora = performance.now();
      // Passo limitado: voltar de uma aba parada daria um dt enorme e a mola
      // explodiria numa distorção instantânea.
      const dt = Math.min((agora - anterior) / 1000, 1 / 30);
      anterior = agora;

      const acel = RIGIDEZ * (tensaoAlvo.current - tensaoAtual) - AMORTECIMENTO * velocidadeTensao;
      velocidadeTensao += acel * dt;
      tensaoAtual += velocidadeTensao * dt;

      // Suaviza o ponteiro para o movimento do mouse não pipocar.
      ponteiro.x += (ponteiroAlvo.x - ponteiro.x) * Math.min(1, dt * 8);
      ponteiro.y += (ponteiroAlvo.y - ponteiro.y) * Math.min(1, dt * 8);
      ponteiro.peso += (ponteiroAlvo.peso - ponteiro.peso) * Math.min(1, dt * 6);

      ripple = Math.max(0, ripple - dt * 1.4);

      programa.uniforms.uTempo.value = ((agora - inicio) / 1000) * velocidade;
      programa.uniforms.uPonteiro.value = [ponteiro.x, ponteiro.y];
      programa.uniforms.uPonteiroPeso.value = ponteiro.peso;
      programa.uniforms.uTensao.value = Math.max(0, tensaoAtual);
      programa.uniforms.uRipple.value = ripple;

      renderer!.render({ scene: malha });
    };
    desenhar();

    const aoTrocarAba = () => {
      if (document.hidden) {
        rodando = false;
        cancelAnimationFrame(quadro);
      } else if (!rodando) {
        rodando = true;
        anterior = performance.now();
        desenhar();
      }
    };
    document.addEventListener('visibilitychange', aoTrocarAba);

    return () => {
      rodando = false;
      setWebglAtivo(false);
      cancelAnimationFrame(quadro);
      document.removeEventListener('visibilitychange', aoTrocarAba);
      alvo.removeEventListener('pointermove', aoMover);
      alvo.removeEventListener('pointerleave', aoSair);
      observador.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (gl.canvas.parentElement === alvo) alvo.removeChild(gl.canvas);
    };
  }, [texto, fontFamily, fontWeight, letterSpacing, tamanho, forca, escala, velocidade, influenciaPonteiro, refracao]);

  return (
    <div
      ref={container}
      onClick={onClick}
      style={{ position: 'relative', width: '100%', height: `${tamanho * 1.35}px`, cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Título comum, que some quando o canvas assume. É ele que aparece se o
          WebGL falhar — e é ele que o leitor de tela lê, porque canvas não tem
          texto. Por isso continua no DOM, só invisível. */}
      <span
        style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          fontFamily, fontWeight, letterSpacing, fontSize: `${tamanho}px`,
          color: 'var(--text-primary)', pointerEvents: 'none', userSelect: 'none',
          opacity: webglAtivo ? 0 : 1,
        }}
      >
        {texto}
      </span>
    </div>
  );
}
