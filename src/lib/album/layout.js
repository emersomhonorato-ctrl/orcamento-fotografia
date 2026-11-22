// Diagramação de álbum: lâminas (duas páginas lado a lado) com modelos prontos.
// Coordenadas normalizadas: a lâmina tem largura 2 (duas páginas de largura 1) e altura H = altura/largura da página.

export const SIZES = {
  "30x30": { label: "30 x 30 (quadrado)", h: 1 },
  "25x25": { label: "25 x 25 (quadrado)", h: 1 },
  "20x20": { label: "20 x 20 (quadrado)", h: 1 },
  "30x20": { label: "30 x 20 (paisagem)", h: 2 / 3 },
  "40x30": { label: "40 x 30 (paisagem)", h: 3 / 4 },
  "20x30": { label: "20 x 30 (retrato)", h: 3 / 2 },
  "30x40": { label: "30 x 40 (retrato)", h: 4 / 3 },
};
export const pageH = (size) => (SIZES[size] || SIZES["30x30"]).h;

const M = 0.08; // margem da página
const G = 0.025; // espaço entre fotos

// Modelos de uma página (x, y, w, h) dentro da página [0..1] x [0..H]
const PAGE = {
  vazia: () => [],
  uma: (H) => [[M, M, 1 - 2 * M, H - 2 * M]],
  cheia: (H) => [[0, 0, 1, H]],
  pequena: (H) => {
    const w = 0.56;
    const h = Math.min(H - 2 * M, w * 1.3);
    return [[(1 - w) / 2, (H - h) / 2, w, h]];
  },
  duasV: (H) => {
    const w = (1 - 2 * M - G) / 2;
    return [[M, M, w, H - 2 * M], [M + w + G, M, w, H - 2 * M]];
  },
  duasH: (H) => {
    const h = (H - 2 * M - G) / 2;
    return [[M, M, 1 - 2 * M, h], [M, M + h + G, 1 - 2 * M, h]];
  },
  tres: (H) => {
    const hTop = (H - 2 * M - G) * 0.55;
    const hBot = H - 2 * M - G - hTop;
    const w = (1 - 2 * M - G) / 2;
    return [[M, M, 1 - 2 * M, hTop], [M, M + hTop + G, w, hBot], [M + w + G, M + hTop + G, w, hBot]];
  },
  quatro: (H) => {
    const w = (1 - 2 * M - G) / 2;
    const h = (H - 2 * M - G) / 2;
    return [[M, M, w, h], [M + w + G, M, w, h], [M, M + h + G, w, h], [M + w + G, M + h + G, w, h]];
  },
};

export const LAYOUTS = {
  pano: { nome: "Foto atravessando as 2 páginas", slots: (H) => [[0, 0, 2, H]] },
  panoMargem: { nome: "Panorâmica com margem", slots: (H) => [[M, M, 2 - 2 * M, H - 2 * M]] },
  "cheia|uma": { nome: "Cheia + 1 foto" },
  "uma|cheia": { nome: "1 foto + cheia" },
  "uma|uma": { nome: "1 + 1" },
  "cheia|cheia": { nome: "Cheia + cheia" },
  "pequena|uma": { nome: "Pequena + 1" },
  "uma|duasV": { nome: "1 + 2 verticais" },
  "duasH|uma": { nome: "2 horizontais + 1" },
  "uma|tres": { nome: "1 + 3" },
  "tres|uma": { nome: "3 + 1" },
  "quatro|uma": { nome: "4 + 1" },
  "duasV|duasV": { nome: "2 + 2" },
  "cheia|quatro": { nome: "Cheia + 4" },
};

// Caixas da lâmina para um modelo
export function caixas(layout, H) {
  const def = LAYOUTS[layout] || LAYOUTS["uma|uma"];
  if (def.slots) return def.slots(H);
  const [esq, dir] = layout.split("|");
  return [...(PAGE[esq] || PAGE.uma)(H), ...(PAGE[dir] || PAGE.uma)(H).map(([x, y, w, h]) => [x + 1, y, w, h])];
}

export const quantas = (layout, H = 1) => caixas(layout, H).length;

// Ritmo de um álbum: abre e fecha com páginas fortes, alterna lâminas calmas e cheias
const RITMO = ["cheia|uma", "uma|duasV", "pano", "uma|tres", "pequena|uma", "duasV|duasV", "cheia|cheia", "uma|uma", "quatro|uma", "duasH|uma", "panoMargem", "tres|uma", "uma|cheia", "cheia|quatro"];

const prop = (foto) => (foto?.w && foto?.h ? foto.w / foto.h : 1.5);

// Monta o álbum: escolhe as fotos espalhadas pela história e encaixa vertical em caixa vertical
export function diagramar(fotos, nLaminas, size) {
  const H = pageH(size);
  const plano = Array.from({ length: nLaminas }, (_, i) => (i === nLaminas - 1 ? "uma|cheia" : RITMO[i % RITMO.length]));
  const total = plano.reduce((s, l) => s + quantas(l, H), 0);
  let escolhidas = fotos;
  if (fotos.length > total) {
    const passo = fotos.length / total;
    escolhidas = Array.from({ length: total }, (_, i) => fotos[Math.floor(i * passo)]);
  }
  const fila = [...escolhidas];
  const laminas = [];
  for (const layout of plano) {
    if (!fila.length) break;
    const cx = caixas(layout, H);
    const slots = cx.map(([, , w, h]) => {
      if (!fila.length) return { photo: "", ox: 0.5, oy: 0.5 };
      const alvo = w / h;
      // procura nas próximas fotos a de formato mais parecido com a caixa
      let melhor = 0;
      let dif = Infinity;
      fila.slice(0, 5).forEach((f, i) => {
        const d = Math.abs(Math.log(prop(f) / alvo));
        if (d < dif - 0.15) {
          dif = d;
          melhor = i;
        }
      });
      const [f] = fila.splice(melhor, 1);
      return { photo: f.id, ox: 0.5, oy: prop(f) < alvo ? 0.35 : 0.5 };
    });
    laminas.push({ layout, slots });
  }
  return laminas;
}

// Troca o modelo de uma lâmina mantendo as fotos que já estavam nela (na mesma ordem)
export function mudarLayout(lamina, layout, size) {
  const n = quantas(layout, pageH(size));
  const fotos = lamina.slots.map((s) => s.photo).filter(Boolean);
  return { ...lamina, layout, slots: Array.from({ length: n }, (_, i) => ({ photo: fotos[i] || "", ox: 0.5, oy: 0.5 })) };
}
