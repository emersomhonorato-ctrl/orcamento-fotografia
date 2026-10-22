import { supabase } from "@/supabase";

const APP_STATE_ID = "studio-manager";

function hasTableError(error) {
  return error?.code === "42P01" || error?.message?.toLowerCase().includes("does not exist");
}

export async function loadAppState() {
  try {
    const { data, error } = await supabase
      .from("app_state")
      .select("payload, updated_at")
      .eq("id", APP_STATE_ID)
      .maybeSingle();

    if (error) {
      if (hasTableError(error)) {
        return {
          data: null,
          source: "local",
          message: "Tabela app_state não encontrada no Supabase. O app continua funcionando localmente.",
        };
      }

      return {
        data: null,
        source: "local",
        message: "Supabase indisponível no momento. Continuando com os dados locais.",
      };
    }

    if (!data?.payload) {
      return {
        data: null,
        source: "local",
        message: "Nenhum snapshot remoto encontrado ainda. Os dados serão salvos localmente e enviados quando possível.",
      };
    }

    return {
      data: data.payload,
      version: data.updated_at || null,
      source: "supabase",
      message: "Dados carregados do Supabase.",
    };
  } catch {
    return {
      data: null,
      source: "local",
      message: "Falha ao acessar o Supabase. Continuando com os dados locais.",
    };
  }
}

// Versão atual na nuvem (para saber se outro aparelho salvou algo)
export async function fetchRemoteVersion() {
  try {
    const { data, error } = await supabase.from("app_state").select("updated_at").eq("id", APP_STATE_ID).maybeSingle();
    if (error) return { ok: false };
    return { ok: true, version: data?.updated_at || null };
  } catch {
    return { ok: false };
  }
}

// Salva só se a nuvem ainda estiver na mesma versão que este aparelho carregou.
// Se outro aparelho salvou antes, devolve conflict: true e não sobrescreve nada.
export async function saveAppState(payload, expectedVersion = null, { force = false } = {}) {
  try {
    const nowIso = new Date().toISOString();
    let data;
    let error;
    if (expectedVersion && !force) {
      ({ data, error } = await supabase
        .from("app_state")
        .update({ payload, updated_at: nowIso })
        .eq("id", APP_STATE_ID)
        .eq("updated_at", expectedVersion)
        .select("updated_at"));
      if (!error && Array.isArray(data) && data.length === 0) {
        return {
          source: "conflict",
          conflict: true,
          message: "Outro aparelho salvou alterações. Escolha qual versão manter.",
        };
      }
    } else {
      ({ data, error } = await supabase
        .from("app_state")
        .upsert({ id: APP_STATE_ID, payload, updated_at: nowIso }, { onConflict: "id" })
        .select("updated_at"));
    }

    if (error) {
      if (hasTableError(error)) {
        return {
          source: "local",
          message: "Tabela app_state ausente no Supabase. O backup local segue ativo.",
        };
      }

      return {
        source: "local",
        message: "Não foi possível salvar no Supabase agora. O backup local segue ativo.",
      };
    }

    return {
      source: "supabase",
      version: (Array.isArray(data) ? data[0]?.updated_at : data?.updated_at) || nowIso,
      message: "Dados salvos no Supabase e no navegador.",
    };
  } catch {
    return {
      source: "local",
      message: "Falha de rede ao salvar no Supabase. O backup local segue ativo.",
    };
  }
}
