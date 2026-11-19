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

const RITMO = [1, 2, 1, 3, 2, 1, 2, 3];
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

export const fotosNecessarias = (n) => planejar(n).reduce((s, t) => s + (t === "P" ? 1 : t), 0);

function montarPaginas(fotos, nPaginas) {
  const fila = [...fotos];
  const paginas = [];
  const pegar = (cond, qtd, olhar = 5) => {
    const achadas = fila.slice(0, olhar).filter(cond).slice(0, qtd);
    return achadas.length < qtd ? null : achadas;
  };
  const tirar = (lista) => lista.forEach((f) => fila.splice(fila.indexOf(f), 1));

  for (let alvo of planejar(nPaginas)) {
    if (!fila.length) break;
    let pagina = null;
    if (alvo === "P") {
      const hor = pegar(horizontal, 1, 10);
      if (hor) {
        tirar(hor);
        paginas.push({ tipo: "panoramica", caixas: [layoutPanoramica(hor[0])], fotos: hor });
        continue;
      }
      alvo = 1;
    }
    if (alvo === 3) {
      const hor = pegar(horizontal, 1);
      const ver = pegar(vertical, 2);
      if (hor && ver) pagina = { caixas: layoutTres(), fotos: [hor[0], ...ver] };
    }
    if (!pagina && alvo >= 2) {
      const primeira = fila[0];
      if (vertical(primeira)) {
        const par = pegar(vertical, 2);
        if (par) pagina = { caixas: layoutDuasVerticais(), fotos: par };
      } else if (horizontal(primeira)) {
        const par = pegar(horizontal, 2);
        if (par) pagina = { caixas: layoutDuasHorizontais(), fotos: par };
      }
    }
    if (!pagina) pagina = { caixas: [layoutUma(fila[0])], fotos: [fila[0]] };
    tirar(pagina.fotos);
    paginas.push({ tipo: "fotos", ...pagina });
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
      const auto = p.fotos.length === 1 ? "uma" : undefined;
      paginas.push({ tipo: "fotos", marca: n % ASSINATURA_A_CADA === 0, slots: p.fotos.map((f, i) => slot(f, p.caixas[i], auto)) });
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
  s.oy = s.caixa[2] / s.caixa[3] > prop ? 0.3 : 0.5;
}
