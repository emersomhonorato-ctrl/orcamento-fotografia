// Carrossel Álbum — montagem das páginas (mesma lógica do programa em Python do Mac)

export const LARGURA = 1080;
export const ALTURA = 1440; // 3:4, igual às miniaturas do perfil do Instagram
export const FUNDO = "#f7f5f1";
export const TEXTO = "#262626";
export const TEXTO_SUAVE = "#96928c";
export const MARGEM = 90;
export const ESPACO = 24;
export const ASSINATURA = "EMERSON HONORATO RETRATOS";
export const ASSINATURA_A_CADA = 3;

export const LI = LARGURA - 2 * MARGEM;
export const AI = ALTURA - 2 * MARGEM;
const METADE = Math.floor((LI - ESPACO) / 2);
export const CAIXA_CAPA = [Math.floor((LARGURA - 694) / 2), MARGEM, 694, 1040];

// Ritmo de álbum: alterna os modelos de página para o carrossel não ficar repetitivo
const RITMO = ["uma", "duas", "destaque", "tres", "quatro", "uma", "escalonadas", "assimetrica", "duas", "horVert", "tresV", "uma", "tres", "duas"];
const PAGINAS_POR_PANORAMICA = 8;

export const proporcao = (f) => f.largura / f.altura;
export const vertical = (f) => proporcao(f) < 0.95;
export const horizontal = (f) => proporcao(f) > 1.05;

export function caixaCentralizada(prop, largMax, altMax, topo = MARGEM) {
  let w = largMax;
  let h = Math.floor(largMax / prop);
  if (h > altMax) {
    h = altMax;
    w = Math.floor(altMax * prop);
  }
  return [Math.floor((LARGURA - w) / 2), topo + Math.floor((altMax - h) / 2), w, h];
}

function layoutUma(f) {
  return vertical(f) ? caixaCentralizada(proporcao(f), LI, AI) : caixaCentralizada(proporcao(f), LI, AI - 200);
}

function layoutDuasVerticais() {
  const h = Math.min(AI, Math.floor(METADE * 1.5));
  const y = MARGEM + Math.floor((AI - h) / 2);
  return [[MARGEM, y, METADE, h], [MARGEM + METADE + ESPACO, y, METADE, h]];
}

function layoutDuasHorizontais() {
  const h = Math.floor((AI - ESPACO - 60) / 2);
  const w = Math.min(LI, Math.floor(h * 1.5));
  const x = Math.floor((LARGURA - w) / 2);
  const y = MARGEM + 30;
  return [[x, y, w, h], [x, y + h + ESPACO, w, h]];
}

function layoutTres() {
  const hTopo = Math.floor(LI / 1.5);
  const hBaixo = AI - hTopo - ESPACO;
  return [
    [MARGEM, MARGEM, LI, hTopo],
    [MARGEM, MARGEM + hTopo + ESPACO, METADE, hBaixo],
    [MARGEM + METADE + ESPACO, MARGEM + hTopo + ESPACO, METADE, hBaixo],
  ];
}

function layoutPanoramica(f) {
  let w = 2 * LARGURA - 2 * MARGEM;
  let h = AI;
  if (w / h > proporcao(f)) w = Math.floor(h * proporcao(f));
  else h = Math.floor(w / proporcao(f));
  return [Math.floor((2 * LARGURA - w) / 2), MARGEM + Math.floor((AI - h) / 2), w, h];
}

function layoutDestaque(f) {
  // foto menor, com bastante respiro em volta (página "de pausa" do álbum)
  return vertical(f) ? caixaCentralizada(proporcao(f), 540, 810, MARGEM + Math.floor((AI - 810) / 2)) : caixaCentralizada(proporcao(f), 720, 480, MARGEM + Math.floor((AI - 480) / 2));
}

function layoutTresVerticais() {
  const w = Math.floor((LI - 2 * ESPACO) / 3);
  const h = Math.round(w * 1.5);
  const y = MARGEM + Math.floor((AI - h) / 2);
  return [0, 1, 2].map((i) => [MARGEM + i * (w + ESPACO), y, w, h]);
}

function layoutQuatro() {
  const h = Math.floor((AI - ESPACO) / 2);
  const w = Math.round(h / 1.5);
  const x = Math.floor((LARGURA - (2 * w + ESPACO)) / 2);
  return [[x, MARGEM, w, h], [x + w + ESPACO, MARGEM, w, h], [x, MARGEM + h + ESPACO, w, h], [x + w + ESPACO, MARGEM + h + ESPACO, w, h]];
}

function layoutAssimetrica() {
  // vertical grande à esquerda, duas horizontais empilhadas à direita
  const wV = 468;
  const hV = 702;
  const wH = LI - wV - ESPACO;
  const hH = Math.floor((hV - ESPACO) / 2);
  const y = MARGEM + Math.floor((AI - hV) / 2);
  return [[MARGEM, y, wV, hV], [MARGEM + wV + ESPACO, y, wH, hH], [MARGEM + wV + ESPACO, y + hH + ESPACO, wH, hH]];
}

function layoutEscalonadas() {
  // duas verticais em degrau
  const w = 400;
  const h = 600;
  return [[MARGEM, MARGEM + 60, w, h], [LARGURA - MARGEM - w, ALTURA - MARGEM - 60 - h, w, h]];
}

function layoutHorVert() {
  // horizontal larga em cima, vertical centralizada embaixo
  const hH = 600;
  const hV = AI - hH - ESPACO;
  const wV = Math.round(hV / 1.5);
  return [[MARGEM, MARGEM, LI, hH], [Math.floor((LARGURA - wV) / 2), MARGEM + hH + ESPACO, wV, hV]];
}

// Modelos de página: o que cada um pede (v = vertical, h = horizontal, q = qualquer)
export const MODELOS = {
  uma: { nome: "1 foto", pede: ["q"], caixas: (fs) => [layoutUma(fs[0])], auto: "uma" },
  destaque: { nome: "1 foto pequena", pede: ["q"], caixas: (fs) => [layoutDestaque(fs[0])], auto: "destaque" },
  duasV: { nome: "2 verticais", pede: ["v", "v"], caixas: layoutDuasVerticais },
  duasH: { nome: "2 horizontais", pede: ["h", "h"], caixas: layoutDuasHorizontais },
  escalonadas: { nome: "2 em degrau", pede: ["v", "v"], caixas: layoutEscalonadas },
  horVert: { nome: "horizontal + vertical", pede: ["h", "v"], caixas: layoutHorVert },
  tres: { nome: "3 (1 em cima, 2 embaixo)", pede: ["h", "v", "v"], caixas: layoutTres },
  tresV: { nome: "3 verticais", pede: ["v", "v", "v"], caixas: layoutTresVerticais },
  assimetrica: { nome: "1 grande + 2", pede: ["v", "h", "h"], caixas: layoutAssimetrica },
  quatro: { nome: "4 em grade", pede: ["v", "v", "v", "v"], caixas: layoutQuatro },
};

const combina = (f, tipo) => tipo === "q" || (tipo === "v" ? vertical(f) : horizontal(f));

// Escolhe, entre as fotos, as que servem para o modelo (na ordem das molduras). null se não der
function encaixar(modelo, candidatas) {
  const usadas = [];
  for (const tipo of MODELOS[modelo].pede) {
    const f = candidatas.find((c) => !usadas.includes(c) && combina(c, tipo));
    if (!f) return null;
    usadas.push(f);
  }
  return usadas;
}

// Lista do que vai em cada página: 1, 2, 3 fotos ou "P" (panorâmica em duas páginas)
export function planejar(nPaginas) {
  const nPan = nPaginas >= 5 ? Math.max(1, Math.floor(nPaginas / PAGINAS_POR_PANORAMICA)) : 0;
  const inicios = new Set(Array.from({ length: nPan }, (_, j) => Math.round(((j + 1) * nPaginas) / (nPan + 1)) - 1));
  const plano = [];
  let pagina = 0;
  let r = 0;
  while (pagina < nPaginas) {
    if (inicios.has(pagina) && pagina + 1 < nPaginas) {
      plano.push("P");
      pagina += 2;
    } else {
      plano.push(RITMO[r % RITMO.length]);
      r += 1;
      pagina += 1;
    }
  }
  return plano;
}

const tamanho = (t) => (t === "P" ? 1 : t === "duas" ? 2 : MODELOS[t].pede.length);
export const fotosNecessarias = (n) => planejar(n).reduce((s, t) => s + tamanho(t), 0);

function montarPaginas(fotos, nPaginas) {
  const fila = [...fotos];
  const paginas = [];
  const tirar = (lista) => lista.forEach((f) => fila.splice(fila.indexOf(f), 1));

  for (const alvo of planejar(nPaginas)) {
    if (!fila.length) break;
    if (alvo === "P") {
      const hor = fila.slice(0, 10).find(horizontal);
      if (hor) {
        tirar([hor]);
        paginas.push({ tipo: "panoramica", caixas: [layoutPanoramica(hor)], fotos: [hor] });
        continue;
      }
    }
    // tenta o modelo do ritmo; se as fotos por perto não servirem, cai para um mais simples
    const primeira = fila[0];
    const duas = vertical(primeira) ? "duasV" : horizontal(primeira) ? "duasH" : null;
    const tentativas = [alvo === "P" ? "uma" : alvo === "duas" ? duas : alvo, duas, "uma"].filter(Boolean);
    for (const modelo of tentativas) {
      const escolhidas = encaixar(modelo, fila.slice(0, 6));
      if (escolhidas) {
        tirar(escolhidas);
        paginas.push({ tipo: "fotos", modelo, caixas: MODELOS[modelo].caixas(escolhidas), fotos: escolhidas });
        break;
      }
    }
  }
  return paginas;
}

function espalhar(lista, quantidade) {
  if (lista.length <= quantidade) return [...lista];
  const passo = lista.length / quantidade;
  return Array.from({ length: quantidade }, (_, i) => lista[Math.floor(i * passo)]);
}

// Moldura com a foto dentro. zoom 1 = foto preenchendo; ox/oy = posição do corte (0 a 1)
export function slot(f, caixa, auto) {
  const [, , w, h] = caixa;
  const s = { foto: f.nome, caixa: [...caixa], zoom: 1, ox: 0.5, oy: w / h > proporcao(f) ? 0.3 : 0.5 };
  if (auto) s.auto = auto;
  return s;
}

const melhorVertical = (lista) => {
  const verticais = lista.filter(vertical);
  return (verticais.length ? verticais : lista).reduce((a, b) => (b.nitidez > a.nitidez ? b : a));
};

const medidas = () => ({ largura: LARGURA, altura: ALTURA, margem: MARGEM, li: LI, ai: AI });

export function criarProjeto(fotos, { cliente, tipo, nPaginas, comCapa }) {
  if (!fotos.length) return null;
  let resto = [...fotos];
  const paginas = [];
  const paginasFotos = nPaginas - 1 - (comCapa ? 1 : 0);
  if (comCapa) {
    const capa = melhorVertical(resto);
    resto = resto.filter((f) => f !== capa);
    paginas.push({ tipo: "capa", slots: [slot(capa, CAIXA_CAPA)] });
  }
  const escolhidas = espalhar(resto, fotosNecessarias(paginasFotos));
  let n = 0;
  for (const p of montarPaginas(escolhidas, paginasFotos)) {
    if (p.tipo === "panoramica") {
      paginas.push({ tipo: "panoramica", slots: [slot(p.fotos[0], p.caixas[0])] });
      n += 2;
    } else {
      n += 1;
      const auto = MODELOS[p.modelo].auto;
      paginas.push({ tipo: "fotos", modelo: p.modelo, marca: n % ASSINATURA_A_CADA === 0, slots: p.fotos.map((f, i) => slot(f, p.caixas[i], auto)) });
    }
  }
  paginas.push({ tipo: "encerramento", slots: [] });

  const usadas = new Set(paginas.flatMap((p) => p.slots.map((s) => s.foto)));
  const fora = fotos.filter((f) => !usadas.has(f.nome));
  const unica = melhorVertical(fora.length ? fora : fotos);
  return {
    modo: "carrossel",
    cliente,
    tipo,
    medidas: medidas(),
    paginas,
    unica: slot(unica, caixaCentralizada(proporcao(unica), LI, AI), "unica"),
  };
}

export function criarProjetoCapa(fotos, { cliente, tipo }) {
  if (!fotos.length) return null;
  return { modo: "capa", cliente, tipo, medidas: medidas(), paginas: [{ tipo: "capa", slots: [slot(melhorVertical(fotos), CAIXA_CAPA)] }], unica: null };
}

// Troca a foto de uma moldura (molduras "auto" se ajustam ao formato da foto nova)
export function trocarFoto(s, f) {
  const prop = proporcao(f);
  s.foto = f.nome;
  s.zoom = 1;
  s.ox = 0.5;
  if (s.auto === "uma") s.caixa = prop < 0.95 ? caixaCentralizada(prop, LI, AI) : caixaCentralizada(prop, LI, AI - 200);
  if (s.auto === "unica") s.caixa = caixaCentralizada(prop, LI, AI);
  if (s.auto === "destaque") s.caixa = layoutDestaque(f);
  s.oy = s.caixa[2] / s.caixa[3] > prop ? 0.3 : 0.5;
}

// Modelos que servem para as fotos desta página (+ as que ainda não estão no carrossel)
export function modelosPossiveis(pagina, fotos, usadasNoCarrossel) {
  const daPagina = pagina.slots.map((s) => fotos.find((f) => f.nome === s.foto)).filter(Boolean);
  const livres = fotos.filter((f) => !usadasNoCarrossel.has(f.nome));
  return Object.keys(MODELOS).filter((m) => encaixar(m, [...daPagina, ...livres]));
}

// Troca o modelo da página: usa primeiro as fotos que já estavam nela, depois fotos fora do carrossel
export function mudarModelo(pagina, modelo, fotos, usadasNoCarrossel) {
  const daPagina = pagina.slots.map((s) => fotos.find((f) => f.nome === s.foto)).filter(Boolean);
  const livres = fotos.filter((f) => !usadasNoCarrossel.has(f.nome));
  const escolhidas = encaixar(modelo, [...daPagina, ...livres]);
  if (!escolhidas) return false;
  const caixas = MODELOS[modelo].caixas(escolhidas);
  pagina.modelo = modelo;
  pagina.slots = escolhidas.map((f, i) => slot(f, caixas[i], MODELOS[modelo].auto));
  return true;
}
