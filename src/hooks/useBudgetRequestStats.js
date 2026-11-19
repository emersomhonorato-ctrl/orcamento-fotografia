import { useEffect, useState } from "react";
import { supabase } from "@/supabase";

// Pedidos de orçamento: quantos estão novos (para o menu) e quando chegaram (para o funil do Início)
export default function useBudgetRequestStats(enabled, refreshKey = 0) {
  const [stats, setStats] = useState({ novos: 0, datas: [] });

  useEffect(() => {
    if (!enabled) return undefined;
    let ativo = true;
    const carregar = () =>
      supabase
        .from("budget_requests")
        .select("status, created_at")
        .order("created_at", { ascending: false })
        .limit(1000)
        .then(({ data }) => {
          if (!ativo || !data) return;
          setStats({
            novos: data.filter((item) => (item.status || "novo") === "novo").length,
            datas: data.map((item) => item.created_at).filter(Boolean),
          });
        });
    carregar();
    const timer = setInterval(carregar, 5 * 60 * 1000);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [enabled, refreshKey]);

  return stats;
}
