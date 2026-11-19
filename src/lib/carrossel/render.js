// Desenho das páginas em alta (1080 px) e o pacote .zip para baixar
import { zipSync } from "fflate";
import Pica from "pica";
import { ASSINATURA, FUNDO, LARGURA, MARGEM, TEXTO, TEXTO_SUAVE } from "./layout";

export const SERIFA = '"Didot", "Bodoni 72", "Bodoni Moda", "Baskerville", Georgia, serif';
export const SEM_SERIFA = '"Helvetica Neue", "Avenir Next", Helvetica, Arial, sans-serif';

function abrir(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Redução de alta qualidade (Lanczos, como no programa do Mac) + nitidez leve para tela.
// Não usa o redutor do navegador ("cib"), que deixa a foto mais mole.
let pica = null;
const redutor = () => (pica ||= new Pica({ features: ["js", "wasm", "ww"] }));
export const NITIDEZ = { filter: "lanczos3", unsharpAmount: 80, unsharpRadius: 0.6, unsharpThreshold: 2 };

// Mesma conta da tela: preenche a moldura, aplica o zoom e posiciona o corte
export async function desenharSlot(ctx, foto, s, dx = 0) {
  const [x, y, w, h] = s.caixa;
  const img = await abrir(foto.url);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const esc = Math.max(w / iw, h / ih) * Math.max(1, s.zoom || 1);
  const dw = Math.max(w, Math.round(iw * esc));
  const dh = Math.max(h, Math.round(ih * esc));
  const sx = Math.round(Math.min(1, Math.max(0, s.ox ?? 0.5)) * (dw - w));
  const sy = Math.round(Math.min(1, Math.max(0, s.oy ?? 0.5)) * (dh - h));
  const reduzida = document.createElement("canvas");
  reduzida.width = dw;
  reduzida.height = dh;
  if (esc < 1) {
    await redutor().resize(img, reduzida, NITIDEZ);
  } else {
    // foto menor que a moldura (ou zoom grande): amplia sem inventar nitidez
    const c = reduzida.getContext("2d");
    c.imageSmoothingQuality = "high";
    c.drawImage(img, 0, 0, dw, dh);
  }
  ctx.drawImage(reduzida, sx, sy, w, h, x + dx, y, w, h);
  reduzida.width = 0;
}

export function escreverEspacado(ctx, centroX, y, texto, fonte, cor, espaco) {
  ctx.font = fonte;
  ctx.fillStyle = cor;
  ctx.textBaseline = "top";
  const larguras = [...texto].map((c) => ctx.measureText(c).width);
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (larguras.length - 1);
  let x = centroX - total / 2;
  [...texto].forEach((c, i) => {
    ctx.fillText(c, x, y);
    x += larguras[i] + espaco;
  });
}

function escreverCentro(ctx, centroX, y, texto, fonte, cor) {
  ctx.font = fonte;
  ctx.fillStyle = cor;
  ctx.textBaseline = "top";
  ctx.fillText(texto, centroX - ctx.measureText(texto).width / 2, y);
}

function novaPagina(largura, altura) {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const ctx = c.getContext("2d");
  ctx.fillStyle = FUNDO;
  ctx.fillRect(0, 0, largura, altura);
  ctx.imageSmoothingQuality = "high";
  return [c, ctx];
}

export function textosCapa(ctx, cliente, tipo, alturaFoto) {
  const y = MARGEM + alturaFoto + 70;
  if (cliente) escreverCentro(ctx, LARGURA / 2, y, cliente, `78px ${SERIFA}`, TEXTO);
  if (tipo) escreverEspacado(ctx, LARGURA / 2, y + 110, tipo.toUpperCase(), `300 24px ${SEM_SERIFA}`, TEXTO_SUAVE, 6);
}

export function encerramento(ctx, cliente, altura) {
  const meio = altura / 2;
  if (cliente) escreverCentro(ctx, LARGURA / 2, meio - 150, cliente, `56px ${SERIFA}`, TEXTO);
  ctx.strokeStyle = TEXTO_SUAVE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(LARGURA / 2 - 30, meio - 20);
  ctx.lineTo(LARGURA / 2 + 30, meio - 20);
  ctx.stroke();
  escreverEspacado(ctx, LARGURA / 2, meio + 20, ASSINATURA, `300 24px ${SEM_SERIFA}`, TEXTO, 7);
}

export const ALTURA_REELS = 1920;

const paraJpg = (canvas) => new Promise((r) => canvas.toBlob((b) => r(b), "image/jpeg", 0.97));

// Gera todas as páginas: [{ nome: "01.jpg", blob }]
export async function renderizar(projeto, fotos, aoProgredir) {
  await document.fonts?.ready;
  const porNome = new Map(fotos.map((f) => [f.nome, f]));
  const alt = projeto.medidas.altura;
  const saida = [];
  let numero = 0;
  const salvar = async (canvas, pasta = "carrossel") => {
    numero += 1;
    aoProgredir?.(numero);
    saida.push({ nome: `${pasta}/${String(numero).padStart(2, "0")}.jpg`, blob: await paraJpg(canvas) });
  };

  for (const p of projeto.paginas) {
    if (p.tipo === "panoramica") {
      const [dupla, ctx] = novaPagina(2 * LARGURA, alt);
      for (const s of p.slots) await desenharSlot(ctx, porNome.get(s.foto), s);
      for (const lado of [0, 1]) {
        const [c, cx] = novaPagina(LARGURA, alt);
        cx.drawImage(dupla, lado * LARGURA, 0, LARGURA, alt, 0, 0, LARGURA, alt);
        await salvar(c);
      }
      continue;
    }
    const [c, ctx] = novaPagina(LARGURA, alt);
    if (p.tipo === "encerramento") encerramento(ctx, projeto.cliente, alt);
    for (const s of p.slots) await desenharSlot(ctx, porNome.get(s.foto), s);
    if (p.tipo === "capa") textosCapa(ctx, projeto.cliente, projeto.tipo, p.slots[0].caixa[3]);
    else if (p.marca) escreverEspacado(ctx, LARGURA / 2, alt - MARGEM / 2 - 8, ASSINATURA, `300 15px ${SEM_SERIFA}`, TEXTO_SUAVE, 4);
    if (p.tipo === "capa") {
      // Capa do Reels: 1080x1920 com a capa 3:4 no meio. No perfil o Instagram mostra só esse meio,
      // então o vídeo aparece na grade igual aos carrosséis (mesma proporção, foto e nome no mesmo lugar)
      const [r, rx] = novaPagina(LARGURA, ALTURA_REELS);
      rx.drawImage(c, 0, Math.round((ALTURA_REELS - alt) / 2));
      saida.push({ nome: "capa-reels.jpg", blob: await paraJpg(r) });
    }
    if (projeto.modo === "capa") {
      saida.push({ nome: "capa.jpg", blob: await paraJpg(c) });
      return saida;
    }
    await salvar(c);
  }
  if (projeto.unica) {
    const [c, ctx] = novaPagina(LARGURA, alt);
    await desenharSlot(ctx, porNome.get(projeto.unica.foto), projeto.unica);
    saida.push({ nome: "foto-unica.jpg", blob: await paraJpg(c) });
  }
  return saida;
}

export async function baixarZip(arquivos, nomeZip) {
  const entradas = {};
  for (const a of arquivos) entradas[a.nome] = [new Uint8Array(await a.blob.arrayBuffer()), { level: 0 }];
  const zip = zipSync(entradas);
  baixar(new Blob([zip], { type: "application/zip" }), nomeZip);
}

export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
