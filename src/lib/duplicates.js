// Encontra clientes que provavelmente são a mesma pessoa
const PARTICLES = new Set(["de", "da", "do", "das", "dos", "e"]);

export const stripText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const phoneKey = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
};
const cpfKey = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14 ? digits : "";
};
const emailKey = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return /.+@.+\..+/.test(text) ? text : "";
};
const nameTokens = (value) => stripText(value).split(" ").filter((token) => token && !PARTICLES.has(token));
const fullNameKey = (value) => nameTokens(value).join(" ");
const shortNameKey = (value) => {
  const tokens = nameTokens(value);
  return tokens.length >= 2 ? `${tokens[0]} ${tokens[tokens.length - 1]}` : "";
};

export function clientKeys(client) {
  return {
    phones: [...new Set([phoneKey(client.phone), phoneKey(client.whatsapp)].filter(Boolean))],
    email: emailKey(client.email),
    cpf: cpfKey(client.cpf),
    name: fullNameKey(client.name),
    shortName: shortNameKey(client.name),
  };
}

// Um trabalho pertence a este cliente?
export function recordBelongsTo(record, client) {
  if (!record || !client) return false;
  if (client.id && record.clientId === client.id) return true;
  const keys = clientKeys(client);
  const email = emailKey(record.email);
  if (keys.email && email === keys.email) return true;
  const phones = [phoneKey(record.phone), phoneKey(record.whatsapp)].filter(Boolean);
  if (keys.phones.length && phones.some((phone) => keys.phones.includes(phone))) return true;
  return Boolean(keys.name) && fullNameKey(record.clientName) === keys.name;
}

export function groupSignature(ids) {
  return [...ids].sort().join("|");
}

// Retorna grupos: [{ id, clients: [...], reasons: ["mesmo telefone", ...], strong: bool }]
export function findDuplicateGroups(clients = [], ignored = []) {
  const list = clients.filter((client) => client && client.id);
  const parent = new Map(list.map((client) => [client.id, client.id]));
  const find = (id) => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(id, root);
    return root;
  };
  const reasons = new Map();
  const link = (a, b, reason) => {
    if (a === b) return;
    const ra = find(a);
    const rb = find(b);
    const key = groupSignature([a, b]);
    if (!reasons.has(key)) reasons.set(key, new Set());
    reasons.get(key).add(reason);
    if (ra !== rb) parent.set(ra, rb);
  };

  const buckets = new Map();
  const add = (bucket, id) => {
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket).push(id);
  };
  list.forEach((client) => {
    const keys = clientKeys(client);
    keys.phones.forEach((phone) => add(`telefone:${phone}`, client.id));
    if (keys.email) add(`email:${keys.email}`, client.id);
    if (keys.cpf) add(`cpf:${keys.cpf}`, client.id);
    if (keys.name) add(`nome:${keys.name}`, client.id);
    if (keys.shortName) add(`parecido:${keys.shortName}`, client.id);
  });
  const LABEL = { telefone: "mesmo telefone", email: "mesmo e-mail", cpf: "mesmo CPF", nome: "mesmo nome", parecido: "nome parecido" };
  buckets.forEach((ids, bucket) => {
    const unique = [...new Set(ids)];
    if (unique.length < 2) return;
    const type = bucket.split(":")[0];
    for (let i = 1; i < unique.length; i += 1) link(unique[0], unique[i], LABEL[type]);
  });

  const groups = new Map();
  list.forEach((client) => {
    const root = find(client.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(client);
  });

  const ignoredSet = new Set(ignored);
  return [...groups.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const ids = members.map((client) => client.id);
      const why = new Set();
      reasons.forEach((set, key) => {
        const [a, b] = key.split("|");
        if (ids.includes(a) && ids.includes(b)) set.forEach((reason) => why.add(reason));
      });
      const reasonsList = ["mesmo CPF", "mesmo e-mail", "mesmo telefone", "mesmo nome", "nome parecido"].filter((reason) => why.has(reason));
      return {
        id: groupSignature(ids),
        clients: members.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")),
        reasons: reasonsList,
        strong: reasonsList.some((reason) => reason !== "nome parecido"),
      };
    })
    .filter((group) => !ignoredSet.has(group.id))
    .sort((a, b) => Number(b.strong) - Number(a.strong) || String(a.clients[0].name).localeCompare(String(b.clients[0].name), "pt-BR"));
}

// Junta os dados: o escolhido manda; campos vazios são preenchidos pelos outros
export function mergeClientData(keep, others) {
  const merged = { ...keep };
  ["cpf", "email", "phone", "whatsapp", "city", "address", "instagram"].forEach((field) => {
    if (!String(merged[field] || "").trim()) {
      const donor = others.find((client) => String(client[field] || "").trim());
      if (donor) merged[field] = donor[field];
    }
  });
  const notes = [merged.notes, ...others.filter((client) => client.isRegistered !== false).map((client) => client.notes)]
    .map((note) => String(note || "").trim())
    .filter(Boolean);
  merged.notes = [...new Set(notes)].join("\n");
  return merged;
}
