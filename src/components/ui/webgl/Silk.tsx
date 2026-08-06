import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl';

/**
 * Fundo "silk": ondas lentas de tecido, escuras, quase imperceptíveis.
 *
 * É pano de fundo, não espetáculo — a estrela da tela é o título. Por isso
 * velocidade baixa, contraste baixo e opacidade baixa: se você reparar nele
 * antes de reparar no conteúdo, está forte demais.
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

uniform float uTempo;
uniform vec3  uCor;
uniform float uVelocidade;
uniform float uEscala;
uniform float uRuido;
uniform vec2  uResolucao;

varying vec2 vUv;

/** Ruído barato o bastante para rodar em GPU de tablet. */
float ruido(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

/**
 * O padrão do tecido: senos cruzados em frequências diferentes.
 * Frequências múltiplas inteiras deixariam o desenho repetitivo e óbvio;
 * usar valores quebrados faz a onda demorar a se repetir.
 */
float tecido(vec2 uv, float t) {
  float onda = sin(uv.x * 3.1 + t * 0.7)
             + sin(uv.y * 2.3 - t * 0.5)
             + sin((uv.x + uv.y) * 1.7 + t * 0.35);
  onda += 0.5 * sin(uv.x * 6.7 - t * 0.9) * sin(uv.y * 5.3 + t * 0.6);
  return onda * 0.25 + 0.5;
}

void main() {
  // Corrige o esticamento em telas largas — sem isto, a onda fica achatada.
  vec2 uv = vUv;
  uv.x *= uResolucao.x / max(uResolucao.y, 1.0);
  uv *= uEscala;

  float t = uTempo * uVelocidade;
  float f = tecido(uv, t);

  // Luz suave atravessando o tecido, na diagonal.
  float luz = pow(f, 2.2);
  float brilho = smoothstep(0.55, 1.0, f) * 0.35;

  vec3 cor = uCor * (0.35 + luz * 0.8) + vec3(brilho);

  // Granulado leve: sem ele o degradê mostra faixas em tela escura.
  cor += (ruido(gl_FragCoord.xy + t) - 0.5) * uRuido;

  // Vinheta para as bordas não competirem com o conteúdo.
  vec2 c = vUv - 0.5;
  float vinheta = 1.0 - dot(c, c) * 0.9;

  gl_FragColor = vec4(cor * vinheta, 1.0);
}
`;

interface SilkProps {
  cor?: string;
  velocidade?: number;
  escala?: number;
  ruido?: number;
  /** Opacidade do canvas inteiro — o freio mais direto. */
  opacidade?: number;
}

export default function Silk({
  cor = '#1a1030',
  velocidade = 0.35,
  escala = 1.3,
  ruido = 0.03,
  opacidade = 0.55,
}: SilkProps) {
  const container = useRef<HTMLDivElement>(null);

  /**
   * A cor vive num ref, não nas dependências do efeito.
   *
   * Se ela entrasse no array de dependências, trocar de cor destruiria o
   * contexto WebGL e criaria outro — a tela piscaria preta no meio da
   * transição. Assim o laço de render persegue o valor novo e a mudança sai
   * como um esmaecimento.
   */
  const corAlvo = useRef(cor);
  useEffect(() => { corAlvo.current = cor; }, [cor]);

  useEffect(() => {
    const alvo = container.current;
    if (!alvo) return;

    let renderer: Renderer | null = null;
    let quadro = 0;
    let rodando = true;

    try {
      renderer = new Renderer({
        alpha: false,
        antialias: false,
        // Retina dobraria os pixels sem ganho visível num fundo desfocado.
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      });
    } catch {
      return; // Sem contexto: a tela simplesmente fica sem fundo animado.
    }

    const gl = renderer.gl;
    alvo.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'width:100%;height:100%;display:block';

    const programa = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTempo: { value: 0 },
        uCor: { value: new Color(cor) },
        uVelocidade: { value: velocidade },
        uEscala: { value: escala },
        uRuido: { value: ruido },
        uResolucao: { value: [1, 1] },
      },
    });

    const malha = new Mesh(gl, { geometry: new Triangle(gl), program: programa });

    const redimensionar = () => {
      const { clientWidth: l, clientHeight: a } = alvo;
      renderer!.setSize(l || 1, a || 1);
      programa.uniforms.uResolucao.value = [l || 1, a || 1];
    };
    redimensionar();

    const observador = new ResizeObserver(redimensionar);
    observador.observe(alvo);

    const inicio = performance.now();
    let anterior = inicio;
    const atual = new Color(cor);

    const desenhar = () => {
      if (!rodando) return;
      quadro = requestAnimationFrame(desenhar);

      const agora = performance.now();
      // Passo limitado: voltar de uma aba parada daria um dt enorme e a cor
      // saltaria de uma vez, perdendo justamente a transição.
      const dt = Math.min((agora - anterior) / 1000, 1 / 30);
      anterior = agora;

      const destino = new Color(corAlvo.current);
      const passo = Math.min(1, dt * 3);
      atual.r += (destino.r - atual.r) * passo;
      atual.g += (destino.g - atual.g) * passo;
      atual.b += (destino.b - atual.b) * passo;
      programa.uniforms.uCor.value = atual;

      programa.uniforms.uTempo.value = (agora - inicio) / 1000;
      renderer!.render({ scene: malha });
    };
    desenhar();

    // Aba escondida não precisa de GPU — e no celular isso é bateria.
    const aoTrocarAba = () => {
      if (document.hidden) {
        rodando = false;
        cancelAnimationFrame(quadro);
      } else if (!rodando) {
        rodando = true;
        desenhar();
      }
    };
    document.addEventListener('visibilitychange', aoTrocarAba);

    return () => {
      rodando = false;
      cancelAnimationFrame(quadro);
      document.removeEventListener('visibilitychange', aoTrocarAba);
      observador.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      if (gl.canvas.parentElement === alvo) alvo.removeChild(gl.canvas);
    };
    // `cor` de propósito fora daqui: ela é perseguida no laço (ver corAlvo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [velocidade, escala, ruido]);

  return (
    <div
      ref={container}
      aria-hidden
      style={{
        position: 'absolute', inset: 0, opacity: opacidade,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    />
  );
}
