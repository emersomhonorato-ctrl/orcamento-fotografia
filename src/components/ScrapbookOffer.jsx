import { useState } from "react";

// Oferta do álbum scrapbook na página de entrega: a família escolhe tamanho e capa e chama no WhatsApp.

const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif" };

export const SCRAPBOOK_COVERS = [
  { id: "arvore", name: "Árvore dourada" },
  { id: "ursinho", name: "Ursinho" },
  { id: "laco", name: "Laço vermelho" },
  { id: "listras", name: "Listras verdes" },
  { id: "colorido", name: "Natal colorido" },
  { id: "classico", name: "Clássico" },
];

export const SCRAPBOOK_SIZES = [
  { id: "10x15", label: "10×15 cm", priceKey: "price_10x15" },
  { id: "15x21", label: "15×21 cm", priceKey: "price_15x21" },
];

export const SCRAPBOOK_DEFAULT_TEXT =
  "Um álbum para a família montar junta. Ele vem com as fotos reveladas, prontas para colar, e espaço para escrever, enfeitar e personalizar do seu jeito.";

export default function ScrapbookOffer({ offer, title, whatsappLink }) {
  const [size, setSize] = useState("15x21");
  const [cover, setCover] = useState("arvore");
  if (!offer?.enabled) return null;

  const sizeInfo = SCRAPBOOK_SIZES.find((item) => item.id === size);
  const coverInfo = SCRAPBOOK_COVERS.find((item) => item.id === cover);
  const price = String(offer[sizeInfo.priceKey] || "").trim();
  const text = String(offer.text || "").trim() || SCRAPBOOK_DEFAULT_TEXT;
  const message = `Olá, Emerson! Vi minhas fotos (${title}) e quero o álbum scrapbook ${sizeInfo.label}, capa "${coverInfo.name}".${price ? ` Valor que vi: ${price}.` : ""} Como faço o pedido?`;

  return (
    <section className="pb-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#a8875a]">Novidade</p>
      <h2 className="mt-1 text-4xl" style={SERIF}>Álbum scrapbook da família</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#4a4036]">{text}</p>

      <div className="mt-6 grid gap-6 rounded-[28px] border border-[#e4dbd0] bg-white p-5 shadow-sm lg:grid-cols-2">
        <div>
          <img
            src={`/scrapbook/${cover}.jpg`}
            alt={`Álbum scrapbook com a capa ${coverInfo.name}`}
            className="aspect-[4/3] w-full rounded-2xl object-cover"
          />
          <img
            src="/scrapbook/tamanhos.jpg"
            alt="Os dois tamanhos do álbum, 10×15 e 15×21, lado a lado"
            loading="lazy"
            className="mt-3 hidden aspect-[4/3] w-full rounded-2xl object-cover lg:block"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-semibold text-[#2c241a]">1. Escolha o tamanho</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {SCRAPBOOK_SIZES.map((item) => {
                const itemPrice = String(offer[item.priceKey] || "").trim();
                const selected = size === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSize(item.id)}
                    className={`min-h-[64px] rounded-2xl border px-4 py-3 text-left transition ${selected ? "border-[#1b1610] bg-[#1b1610] text-white" : "border-[#d9cdbf] bg-white text-[#2c241a] hover:bg-[#fbf8f4]"}`}
                  >
                    <span className="block text-lg font-semibold">{item.label}</span>
                    {itemPrice ? <span className={`block text-sm ${selected ? "text-[#e9c77b]" : "text-[#7a6650]"}`}>{itemPrice}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-[#2c241a]">2. Escolha a capa: <span className="font-normal text-[#7a6650]">{coverInfo.name}</span></p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SCRAPBOOK_COVERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={cover === item.id}
                  aria-label={`Capa ${item.name}`}
                  onClick={() => setCover(item.id)}
                  className={`overflow-hidden rounded-xl border-2 transition ${cover === item.id ? "border-[#a8875a]" : "border-transparent opacity-80 hover:opacity-100"}`}
                >
                  <img src={`/scrapbook/${item.id}.jpg`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5 text-sm leading-6 text-[#4a4036]">
            <li>• Vem com as fotos reveladas para colar</li>
            <li>• A família monta e personaliza do seu jeito</li>
            <li>• Uma lembrança para guardar e presentear</li>
          </ul>

          <a
            href={whatsappLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex justify-center rounded-2xl bg-[#1b1610] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#2c241a]"
          >
            Quero o meu álbum{price ? ` • ${price}` : ""}
          </a>
        </div>
      </div>
    </section>
  );
}
