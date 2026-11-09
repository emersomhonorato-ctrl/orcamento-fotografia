import { useEffect, useState } from "react";
import qrcode from "qrcode-generator";
import { Download, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const W = 1200; // 10 × 15 cm a 300 dpi (aprox.)
const H = 1800;
const INK = "#1b1610";
const GOLD = "#a8843f";

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitText(ctx, text, maxWidth, size, font) {
  let current = size;
  ctx.font = font(current);
  while (current > 28 && ctx.measureText(text).width > maxWidth) {
    current -= 2;
    ctx.font = font(current);
  }
  return current;
}

function formatDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso || ""))) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Desenha o cartão (fundo branco, pronto para imprimir) e devolve a imagem PNG
async function drawCard({ url, clientName, title, eventDate, pin, showPin }) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // moldura fina dourada
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  // logo (o arquivo tem muita margem: usa só o miolo)
  const logo = await loadImage("/logo.png");
  if (logo) {
    const crop = logo.width * 0.26;
    const size = logo.width - crop * 2;
    ctx.drawImage(logo, crop, crop, size, size, (W - 300) / 2, 110, 300, 300);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = "600 30px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("S U A S   F O T O S   E S T Ã O   P R O N T A S", W / 2, 480);

  ctx.fillStyle = INK;
  const name = String(clientName || "").trim() || "Sua galeria";
  fitText(ctx, name, W - 220, 78, (s) => `italic 500 ${s}px Georgia, 'Times New Roman', serif`);
  ctx.fillText(name, W / 2, 575);

  const sub = [title, formatDate(eventDate)].filter(Boolean).join(" • ");
  if (sub) {
    ctx.fillStyle = "#6b6257";
    fitText(ctx, sub, W - 240, 34, (s) => `400 ${s}px 'Helvetica Neue', Arial, sans-serif`);
    ctx.fillText(sub, W / 2, 630);
  }

  // QR Code
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  const count = qr.getModuleCount();
  const qrSize = 640;
  const cell = Math.floor(qrSize / count);
  const real = cell * count;
  const qx = Math.round((W - real) / 2);
  const qy = 680 + Math.round((qrSize - real) / 2);
  ctx.fillStyle = INK;
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, cell, cell);
    }
  }

  let y = 680 + qrSize + 90;
  ctx.fillStyle = INK;
  ctx.font = "500 40px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("Aponte a câmera do celular para o código", W / 2, y);
  y += 56;
  ctx.fillStyle = "#6b6257";
  ctx.font = "400 30px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("e abra a sua galeria de fotos", W / 2, y);

  if (showPin && pin) {
    y += 90;
    const label = `Senha da galeria: ${pin}`;
    ctx.font = "600 40px 'Helvetica Neue', Arial, sans-serif";
    const boxW = ctx.measureText(label).width + 80;
    ctx.fillStyle = "#f6efe3";
    ctx.beginPath();
    ctx.roundRect((W - boxW) / 2, y - 52, boxW, 76, 38);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(label, W / 2, y);
  }

  ctx.fillStyle = "#8a8075";
  const shortUrl = url.replace(/^https?:\/\//, "");
  fitText(ctx, shortUrl, W - 220, 24, (s) => `400 ${s}px 'Helvetica Neue', Arial, sans-serif`);
  ctx.fillText(shortUrl, W / 2, H - 150);
  ctx.fillStyle = GOLD;
  ctx.font = "600 24px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("E M E R S O N   H O N O R A T O   R E T R A T O S", W / 2, H - 100);

  return canvas.toDataURL("image/png");
}

function slugify(value) {
  return String(value || "galeria").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "galeria";
}

// Janela com o cartão do QR Code da entrega: baixar ou imprimir (10 × 15 cm)
export default function DeliveryQrCard({ url, item, onClose }) {
  const [showPin, setShowPin] = useState(true);
  const [image, setImage] = useState("");

  useEffect(() => {
    let alive = true;
    drawCard({ url, clientName: item.client_name, title: item.title, eventDate: item.event_date, pin: item.pin, showPin }).then((png) => {
      if (alive) setImage(png);
    });
    return () => {
      alive = false;
    };
  }, [url, item.client_name, item.title, item.event_date, item.pin, showPin]);

  function print() {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><title>QR ${item.client_name || ""}</title><style>@page{size:10cm 15cm;margin:0}html,body{margin:0}img{width:10cm;height:15cm;display:block}</style></head><body><img src="${image}"></body></html>`);
    doc.close();
    const img = doc.querySelector("img");
    const go = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    };
    if (img.complete) go();
    else img.onload = go;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-3xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">QR Code da entrega</h3>
          <button type="button" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {image ? <img src={image} alt="Cartão com QR Code" className="block w-full" /> : <div className="aspect-[2/3] animate-pulse" />}
        </div>
        {item.pin ? (
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={showPin} onChange={(event) => setShowPin(event.target.checked)} />
            Mostrar a senha da galeria no cartão
          </label>
        ) : null}
        {!item.active ? <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Esta entrega está desativada: ative antes de entregar o cartão, senão o cliente não consegue abrir.</p> : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button asChild className="rounded-2xl" disabled={!image}>
            <a href={image || undefined} download={`qr-entrega-${slugify(item.client_name)}.png`}><Download className="mr-2 h-4 w-4" />Baixar</a>
          </Button>
          <Button variant="outline" className="rounded-2xl" disabled={!image} onClick={print}><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">Tamanho 10 × 15 cm. Dá para imprimir em casa ou mandar a imagem para a gráfica junto com as fotos.</p>
      </div>
    </div>
  );
}
