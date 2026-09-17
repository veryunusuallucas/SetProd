import { useEffect, useRef } from 'react';

/**
 * O fundo da porta do app: um contraluz com grão de filme.
 *
 * Escolhido pelo Lucas em 17/09/2026, sobre a maquete dos fundos. O que veio
 * antes era o Silk — ondas de seda roxas, bonitas e sem assunto. Antes dele,
 * na maquete, um feixe dourado com poeira: cinema demais, festa demais.
 *
 * Aqui é UM feixe só, frio, entrando de cima pela direita e morrendo antes da
 * metade da tela; dois ou três grãos de poeira atravessando devagar; grão de
 * filme por cima e vinheta fechando os cantos. A referência é a luz de uma
 * janela alta num galpão vazio, não um holofote.
 *
 * CANVAS 2D, E NÃO SHADER. O Silk era WebGL (`ogl`), e aqui não há o que um
 * shader faria melhor: são três gradientes e um punhado de pontos. Em canvas
 * ele roda no aparelho fraco, no navegador sem WebGL e no iPad velho do set —
 * os mesmos aparelhos em que o shader era desligado e a tela ficava sem fundo.
 */

interface Props {
  /** Tinge de vermelho, para o modo de apagar da tela inicial. */
  perigo?: boolean;
  /** Sem movimento: pinta um quadro e para. */
  parado?: boolean;
}

/** Quantos grãos de poeira atravessam o feixe. Mais que isto vira chuva. */
const GRAOS_DE_POEIRA = 18;
/** Pontinhos de grão por quadro. É o que separa "luz num app" de "luz num filme". */
const GRAO_DE_FILME = 240;

export function Contraluz({ perigo = false, parado = false }: Props) {
  const lona = useRef<HTMLCanvasElement>(null);
  /* Em ref, e não em estado: muda a cada quadro e não deve redesenhar nada. */
  const perigoAgora = useRef(perigo);
  perigoAgora.current = perigo;

  useEffect(() => {
    const tela = lona.current;
    const ctx = tela?.getContext('2d');
    if (!tela || !ctx) return;

    let largura = 0, altura = 0;
    const medir = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      largura = tela.clientWidth;
      altura = tela.clientHeight;
      tela.width = Math.max(1, Math.round(largura * dpr));
      tela.height = Math.max(1, Math.round(altura * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    medir();

    const poeira = Array.from({ length: GRAOS_DE_POEIRA }, () => ({
      x: Math.random(),
      y: Math.random(),
      v: 0.2 + Math.random() * 0.6,
      r: 0.5 + Math.random() * 1.1,
      f: Math.random() * 6.28,
    }));

    let t = 0;
    let pedido = 0;
    const pixel = ctx.createImageData(1, 1);

    const pintar = () => {
      const quente = perigoAgora.current;
      const luz = quente ? [255, 190, 190] : [232, 236, 245];

      ctx.fillStyle = quente ? '#140b0c' : '#0b0b0d';
      ctx.fillRect(0, 0, largura, altura);

      /*
        O feixe respira devagar, para não parecer uma imagem congelada, e é
        medido pelo LADO MENOR da tela. Em pixels fixos ele ficava discreto num
        card e virava um triângulo enorme numa tela alta de computador.
      */
      const respiro = 1 + Math.sin(t * 0.2) * 0.06;
      const medida = Math.max(320, Math.min(largura, altura));
      const boca = medida * 0.1 * respiro;
      const pe = medida * 0.42 * respiro;
      ctx.save();
      ctx.translate(largura * 0.66, -altura * 0.12);
      ctx.rotate(0.42);
      const feixe = ctx.createLinearGradient(0, 0, 0, altura * 1.5);
      feixe.addColorStop(0, `rgba(${luz[0]},${luz[1]},${luz[2]},0.10)`);
      feixe.addColorStop(0.45, `rgba(${luz[0]},${luz[1]},${luz[2]},0.045)`);
      feixe.addColorStop(1, `rgba(${luz[0]},${luz[1]},${luz[2]},0)`);
      ctx.fillStyle = feixe;
      ctx.beginPath();
      ctx.moveTo(-boca, 0);
      ctx.lineTo(-pe, altura * 1.5);
      ctx.lineTo(pe, altura * 1.5);
      ctx.lineTo(boca, 0);
      ctx.fill();
      ctx.restore();

      for (const g of poeira) {
        if (!parado) {
          g.y -= g.v * 0.0004;
          if (g.y < -0.05) { g.y = 1.05; g.x = Math.random(); }
        }
        const x = (g.x + Math.sin(t * 0.2 + g.f) * 0.006) * largura;
        ctx.beginPath();
        ctx.arc(x, g.y * altura, g.r, 0, 6.3);
        ctx.fillStyle = `rgba(${luz[0]},${luz[1]},${luz[2]},0.22)`;
        ctx.fill();
      }

      for (let i = 0; i < GRAO_DE_FILME; i++) {
        const v = 200 + Math.random() * 55;
        pixel.data[0] = pixel.data[1] = pixel.data[2] = v;
        pixel.data[3] = 10 + Math.random() * 14;
        ctx.putImageData(pixel, (Math.random() * largura) | 0, (Math.random() * altura) | 0);
      }

      const vinheta = ctx.createRadialGradient(
        largura / 2, altura / 2, Math.min(largura, altura) * 0.25,
        largura / 2, altura / 2, Math.max(largura, altura) * 0.75,
      );
      vinheta.addColorStop(0, 'rgba(0,0,0,0)');
      vinheta.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vinheta;
      ctx.fillRect(0, 0, largura, altura);

      if (parado) return;
      t += 0.016;
      pedido = requestAnimationFrame(pintar);
    };

    pintar();

    const observador = new ResizeObserver(() => { medir(); if (parado) pintar(); });
    observador.observe(tela);

    return () => { cancelAnimationFrame(pedido); observador.disconnect(); };
  }, [parado]);

  return (
    <canvas
      ref={lona}
      aria-hidden
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
