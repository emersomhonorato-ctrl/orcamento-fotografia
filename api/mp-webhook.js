/* global process */
// Aviso automático do Mercado Pago: quando um pagamento muda de status,
// o Mercado Pago chama este endereço. Aqui só repassamos o número do
// pagamento para o banco, que confere direto no Mercado Pago (com a chave
// guardada lá) e marca a cobrança como paga. Nada que chega aqui é
// considerado verdade sem essa conferência.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://xkyaumxkysyrfwumvswi.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_U7ucBfUpDtgVklRlhS1uYA_xOSOQ5cU";

function readBody(req) {
  const body = req.body;
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

export default async function handler(req, res) {
  try {
    const query = req.query || {};
    const body = readBody(req);
    const type = String(query.type || query.topic || body.type || body.topic || body.action || "");
    let id = query["data.id"] || body?.data?.id || query.id || "";
    if (!id && body.resource) id = String(body.resource).split("/").pop();
    id = String(id || "");

    if (type.startsWith("payment") && /^\d{3,30}$/.test(id)) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/mp_sync`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_payment_id: id }),
      });
    }
  } catch (error) {
    console.error("mp-webhook", error);
  }
  res.status(200).json({ ok: true });
}
