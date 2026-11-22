import { useEffect, useRef, useState } from "react";
import { caixas, pageH } from "@/lib/album/layout";
import { albumThumb, albumThumbAlt } from "@/lib/album/drive";

// Uma lâmina do álbum (duas páginas). No modo de edição dá para arrastar a foto para enquadrar
// e clicar para trocar. No modo do cliente, a foto fica desfocada até ele segurar (dificulta print).

function SlotImage({ foto, slot, larguraPx, alturaPx, thumbSize, blurred }) {
  const [src, setSrc] = useState(albumThumb(foto.id, thumbSize));
  const prop = foto.w && foto.h ? foto.w / foto.h : null;
  if (!prop) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        referrerPolicy="no-referrer"
        onError={() => setSrc((atual) => (atual.includes("lh3.") ? atual : albumThumbAlt(foto.id, thumbSize)))}
        className="pointer-events-none h-full w-full select-none object-cover"
        style={{ objectPosition: `${(slot.ox ?? 0.5) * 100}% ${(slot.oy ?? 0.5) * 100}%`, filter: blurred ? "blur(14px)" : "none" }}
      />
    );
  }
  const esc = Math.max(larguraPx / foto.w, alturaPx / foto.h);
  const dw = foto.w * esc;
  const dh = foto.h * esc;
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setSrc((atual) => (atual.includes("lh3.") ? atual : albumThumbAlt(foto.id, thumbSize)))}
      className="pointer-events-none absolute max-w-none select-none"
      style={{ width: dw, height: dh, left: -(slot.ox ?? 0.5) * (dw - larguraPx), top: -(slot.oy ?? 0.5) * (dh - alturaPx), filter: blurred ? "blur(14px)" : "none" }}
    />
  );
}

export default function AlbumSpread({ lamina, size, fotosPorId, largura = 640, editavel = false, onSlotClick, onMudou, protegido = false, marca = "", selecionado = null }) {
  const H = pageH(size);
  const k = largura / 2; // px por unidade (uma página = 1)
  const altura = H * k;
  const cx = caixas(lamina.layout, H);
  const [segurando, setSegurando] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!protegido) return undefined;
    const soltar = () => setSegurando(false);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("blur", soltar);
    document.addEventListener("visibilitychange", soltar);
    return () => {
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("blur", soltar);
      document.removeEventListener("visibilitychange", soltar);
    };
  }, [protegido]);

  const desfocar = protegido && !segurando;

  function arrastar(ev, slot, wPx, hPx, foto) {
    if (!editavel || !foto?.w) return;
    ev.preventDefault();
    const alvo = ev.currentTarget;
    alvo.setPointerCapture(ev.pointerId);
    const esc = Math.max(wPx / foto.w, hPx / foto.h);
    const sobraX = foto.w * esc - wPx;
    const sobraY = foto.h * esc - hPx;
    let ux = ev.clientX;
    let uy = ev.clientY;
    let moveu = false;
    const mover = (e) => {
      if (Math.abs(e.clientX - ux) + Math.abs(e.clientY - uy) > 2) moveu = true;
      if (sobraX > 0) slot.ox = Math.min(1, Math.max(0, (slot.ox ?? 0.5) - (e.clientX - ux) / sobraX));
      if (sobraY > 0) slot.oy = Math.min(1, Math.max(0, (slot.oy ?? 0.5) - (e.clientY - uy) / sobraY));
      ux = e.clientX;
      uy = e.clientY;
      onMudou?.();
    };
    const soltar = () => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      alvo._moveu = moveu;
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
  }

  return (
    <div
      ref={ref}
      className="relative select-none overflow-hidden bg-[#f7f5f1] shadow-[0_8px_30px_rgba(0,0,0,0.18)]"
      style={{ width: largura, height: altura, WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={protegido ? () => setSegurando(true) : undefined}
      onPointerLeave={protegido ? () => setSegurando(false) : undefined}
    >
      {cx.map(([x, y, w, h], i) => {
        const slot = lamina.slots[i] || { photo: "" };
        const foto = fotosPorId.get(slot.photo);
        const wPx = w * k;
        const hPx = h * k;
        return (
          <div
            key={i}
            className={`absolute overflow-hidden ${foto ? "bg-stone-300" : "border-2 border-dashed border-stone-300 bg-stone-100"} ${editavel ? "cursor-grab active:cursor-grabbing" : ""} ${selecionado === i ? "outline outline-2 outline-offset-2 outline-[#7f274f]" : ""}`}
            style={{ left: x * k, top: y * k, width: wPx, height: hPx, touchAction: editavel ? "none" : "auto" }}
            onPointerDown={(ev) => arrastar(ev, slot, wPx, hPx, foto)}
            onClick={(ev) => {
              if (ev.currentTarget._moveu) {
                ev.currentTarget._moveu = false;
                return;
              }
              if (editavel) onSlotClick?.(i);
            }}
          >
            {foto ? <SlotImage key={foto.id} foto={foto} slot={slot} larguraPx={wPx} alturaPx={hPx} thumbSize={largura > 900 ? 1600 : 1000} blurred={desfocar} /> : editavel ? <span className="flex h-full items-center justify-center text-xs text-stone-400">+ foto</span> : null}
          </div>
        );
      })}
      {/* dobra do meio */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-6 -translate-x-1/2 bg-gradient-to-r from-transparent via-black/10 to-transparent" />
      {marca ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='170'><text x='50%' y='50%' text-anchor='middle' transform='rotate(-20 210 85)' fill='white' fill-opacity='0.2' font-family='Arial' font-size='14' letter-spacing='1'>${String(marca).replace(/[<>&"]/g, "").slice(0, 60)}</text></svg>`,
            )}")`,
          }}
        />
      ) : null}
      {desfocar ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full bg-black/55 px-4 py-2 text-sm font-semibold text-white shadow-lg">👆 Segure para ver a lâmina</span>
        </div>
      ) : null}
    </div>
  );
}
