import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xkyaumxkysyrfwumvswi.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_U7ucBfUpDtgVklRlhS1uYA_xOSOQ5cU";

export const supabase = createClient(supabaseUrl, supabaseKey);
