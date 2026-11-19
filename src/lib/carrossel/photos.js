// Leitura das fotos escolhidas no computador (nada sobe para a internet)

export const EXTENSOES = /\.(jpe?g|png|tiff?|webp|heic)$/i;
export const EXT_VIDEO = /\.(mp4|mov|m4v)$/i;
export const EXT_MUSICA = /\.(mp3|m4a|wav|aac)$/i;

// Data da foto (EXIF DateTimeOriginal), lendo só o começo do arquivo JPEG
async function dataExif(file) {
  try {
    const buf = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (buf.getUint16(0) !== 0xffd8) return null;
    let pos = 2;
    while (pos + 4 < buf.byteLength) {
      const marker = buf.getUint16(pos);
      const size = buf.getUint16(pos + 2);
      if (marker === 0xffe1 && buf.getUint32(pos + 4) === 0x45786966) {
        const tiff = pos + 10;
        const little = buf.getUint16(tiff) === 0x4949;
        const u16 = (o) => buf.getUint16(o, little);
        const u32 = (o) => buf.getUint32(o, little);
        const lerTexto = (o, n) => {
          let s = "";
          for (let i = 0; i < n - 1 && o + i < buf.byteLength; i += 1) s += String.fromCharCode(buf.getUint8(o + i));
          return s;
        };
        const lerIfd = (ifd) => {
          const out = {};
          const n = u16(tiff + ifd);
          for (let i = 0; i < n; i += 1) {
            const e = tiff + ifd + 2 + i * 12;
            const tag = u16(e);
            if (tag === 0x9003 || tag === 0x0132) out[tag] = lerTexto(tiff + u32(e + 8), u32(e + 4));
            if (tag === 0x8769) out.exif = u32(e + 8);
          }
          return out;
        };
        const ifd0 = lerIfd(u32(tiff + 4));
        const sub = ifd0.exif ? lerIfd(ifd0.exif) : {};
        const texto = sub[0x9003] || ifd0[0x0132];
        const m = texto && texto.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
        return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      pos += 2 + size;
    }
  } catch {
    // sem EXIF: usa o nome do arquivo
  }
  return null;
}

function abrirImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("não abriu"));
    img.src = url;
  });
}

// Nitidez: variação das bordas numa miniatura (quanto mais detalhe, maior)
function nitidez(img) {
  const lado = 300;
  const k = lado / Math.max(img.naturalWidth, img.naturalHeight);
  const w = Math.max(8, Math.round(img.naturalWidth * k));
  const h = Math.max(8, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const cinza = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) cinza[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
  let soma = 0;
  let soma2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const v = 4 * cinza[i] - cinza[i - 1] - cinza[i + 1] - cinza[i - w] - cinza[i + w];
      soma += v;
      soma2 += v * v;
      n += 1;
    }
  }
  const media = soma / n;
  return soma2 / n - media * media;
}

// Miniatura em JPEG (leve) para a tela de revisão
async function miniatura(img, lado = 1200) {
  const k = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  return URL.createObjectURL(blob);
}

// Lê as fotos: tamanho (já girado certo), data, nitidez e miniatura. Ordem da história: pela data; sem data, pelo nome
export async function lerFotos(files, aoProgredir) {
  const lista = [...files].filter((f) => EXTENSOES.test(f.name) && !f.name.startsWith("."));
  const fotos = [];
  for (let i = 0; i < lista.length; i += 1) {
    const file = lista[i];
    aoProgredir?.(i + 1, lista.length);
    const url = URL.createObjectURL(file);
    try {
      const img = await abrirImagem(url);
      fotos.push({
        nome: file.name,
        file,
        url,
        largura: img.naturalWidth,
        altura: img.naturalHeight,
        data: await dataExif(file),
        nitidez: nitidez(img),
        mini: await miniatura(img),
      });
    } catch {
      URL.revokeObjectURL(url);
    }
  }
  fotos.sort((a, b) => (a.data ?? Infinity) - (b.data ?? Infinity) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
  return fotos;
}

export function liberarFotos(fotos = []) {
  fotos.forEach((f) => {
    URL.revokeObjectURL(f.url);
    URL.revokeObjectURL(f.mini);
  });
}
