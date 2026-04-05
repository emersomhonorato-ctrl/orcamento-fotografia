(function () {
  const key = "studio_manager_data";
  const raw = localStorage.getItem(key);
  if (!raw) {
    console.log("Sem dados em studio_manager_data");
    return;
  }

  const parsed = JSON.parse(raw);

  parsed.events = (parsed.events || []).map((e) => {
    const isBudget =
      e.recordType === "orcamento" ||
      (!e.eventDate && Number(e.amount || 0) > 0) ||
      (Array.isArray(e.items) && e.items.length > 0 && !e.eventDate);

    return {
      ...e,
      recordType: isBudget ? "orcamento" : "evento",
      status: e.status || "Pendente",
      paymentStatus: e.paymentStatus || "Pendente",
    };
  });

  localStorage.setItem(key, JSON.stringify(parsed));
  console.log("Dados corrigidos com sucesso:", parsed);
})();