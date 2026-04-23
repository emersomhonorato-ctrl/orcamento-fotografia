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

export async function saveAppState(payload) {
  try {
    const { error } = await supabase.from("app_state").upsert(
      {
        id: APP_STATE_ID,
        payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

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
      message: "Dados salvos no Supabase e no navegador.",
    };
  } catch {
    return {
      source: "local",
      message: "Falha de rede ao salvar no Supabase. O backup local segue ativo.",
    };
  }
}
